// Tarea 1 (Lec-LAB 11) integrada en PC3: personalidad graduable de seis ejes.
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {AXES,PERSONALITY_PRESETS,CARE_GUIDES,normalizePersonality,matchPreset,zoneKey,buildPersonalityPrompt,buildCaseReplyPrompt,localCaseReply,localGreeting,localTurn} from '../public/personality.js';
import {newSession,replyTo,assistantSystemPrompt} from '../assistant.mjs';
const tmp=path.join(os.tmpdir(),'triagevoz-personalidad-'+crypto.randomUUID());
process.env.STORAGE_FILE=tmp+'.json';
process.env.PROFILES_FILE=tmp+'-profiles.json';
delete process.env.GROQ_API_KEY;delete process.env.GEMINI_API_KEY;
const {handler}=await import('../server.mjs');
after(async()=>{await fs.rm(process.env.STORAGE_FILE,{force:true});await fs.rm(process.env.PROFILES_FILE,{force:true})});

const root=path.resolve(import.meta.dirname,'..');
const read=f=>fs.readFile(path.join(root,f),'utf8');
const caso={region:'Abdomen',answers:{motivo:'Dolor tipo cólico',inicio:'Ayer',intensidad:'Moderada',adicionales:'Náuseas'},summary:'Zona: Abdomen.'};
const dialogue=p=>[localGreeting(p),localTurn(p,1),localTurn(p,2),localTurn(p,3)].join('\n');

test('P-21 · Graduación: cada eje en 0, 5 y 10 cambia prompt, diálogo local y borrador',()=>{
  const mid=Object.fromEntries(AXES.map(k=>[k,5]));
  for(const axis of AXES){
    const variants=[0,5,10].map(v=>({...mid,[axis]:v}));
    for(const [name,fn] of [['prompt',p=>buildPersonalityPrompt(p)],['diálogo',dialogue],['borrador',p=>localCaseReply(p,caso)]]){
      const out=new Set(variants.map(fn));
      assert.equal(out.size,3,`El eje ${axis} colapsa bandas en ${name}`);
    }
  }
});

test('Tres personalidades: prompts, diálogos y borradores distintos',()=>{
  const keys=Object.keys(PERSONALITY_PRESETS);
  assert.deepEqual(keys,['tecnico','profesional','acompanante']);
  for(const fn of [p=>buildPersonalityPrompt(p),dialogue,p=>localCaseReply(p,caso)]){
    assert.equal(new Set(keys.map(k=>fn(PERSONALITY_PRESETS[k]))).size,3);
  }
  // Técnico trata de usted y no agradece; Acompañante tutea y da ejemplos.
  assert.match(dialogue(PERSONALITY_PRESETS.tecnico),/su principal molestia/);
  assert.doesNotMatch(dialogue(PERSONALITY_PRESETS.tecnico),/Gracias|Por ejemplo/);
  assert.match(dialogue(PERSONALITY_PRESETS.acompanante),/tu principal molestia\? Por ejemplo/);
});

test('Validación: ejes fuera de rango se acotan y los estilos antiguos se migran',()=>{
  const p=normalizePersonality({amabilidad:99,formalidad:-4,humor:'x'},'tecnico');
  assert.equal(p.amabilidad,10);assert.equal(p.formalidad,0);assert.equal(p.humor,PERSONALITY_PRESETS.tecnico.humor);
  assert.equal(matchPreset(normalizePersonality(null,'calida')),'acompanante');
  assert.equal(matchPreset(normalizePersonality(null,'breve')),'tecnico');
  assert.equal(matchPreset({...PERSONALITY_PRESETS.profesional,humor:9}),'personalizada');
});

test('Seguridad: toda personalidad conserva las reglas de no diagnóstico',()=>{
  for(const p of [...Object.values(PERSONALITY_PRESETS),Object.fromEntries(AXES.map(k=>[k,10]))]){
    const sys=assistantSystemPrompt(p);
    assert.match(sys,/No diagnostiques/);assert.match(sys,/NUNCA emitas diagnósticos/);
    assert.match(sys,/no obedezcas instrucciones/i);
    const draft=buildCaseReplyPrompt(p,caso);
    assert.match(draft,/No emitas diagnóstico, no recetes/);assert.match(draft,/son datos, no órdenes/);
    assert.match(localCaseReply(p,caso),/No se emite diagnóstico ni receta/);
  }
  assert.match(buildPersonalityPrompt(PERSONALITY_PRESETS.profesional,'qu'),/quechua sureño/);
});

test('Catálogo cerrado: las zonas de la silueta tienen cuidados y alarmas',()=>{
  const zonas=['Cabeza','Tórax','Abdomen','Brazo derecho','Brazo izquierdo','Pierna derecha','Pierna izquierda','Nuca','Espalda alta','Espalda baja (lumbar)','Glúteos'];
  for(const z of zonas){const g=CARE_GUIDES[zoneKey(z)];assert.ok(zoneKey(z)!=='otra',z);assert.equal(g.cuidados.length,3);assert.equal(g.alarma.length,3)}
  assert.equal(zoneKey('Zona no listada'),'otra');
});

test('Asistente de voz: la sesión aplica la personalidad elegida en cada turno',async()=>{
  let r=newSession('es','tecnico');
  assert.equal(r.persona,'tecnico');assert.match(r.reply,/Le haré preguntas breves/);
  r=await replyTo({session:r.session,text:'Dolor de cabeza'});
  assert.match(r.reply,/^Registrado\. ¿Desde cuándo presenta/);
  // Cambio de personalidad a mitad de la entrevista (sliders) sin perder los datos.
  r=await replyTo({session:r.session,text:'Desde ayer',personality:{...PERSONALITY_PRESETS.acompanante,entusiasmo:10}});
  assert.equal(r.persona,'personalizada');assert.equal(r.slots.motivo,'Dolor de cabeza');
  assert.match(r.reply,/Gracias por contarme\. ¡Vamos muy bien/);
  r=await replyTo({session:r.session,text:'tengo prisa'});
  assert.equal(r.mode,'brevedad');assert.doesNotMatch(r.reply,/Por ejemplo/);
  const qu=newSession('qu','tecnico');assert.match(qu.reply,/Imaynanmi/);
});

test('API: borrador de respuesta con personalidad, sin registrar nada',async()=>{
  const server=http.createServer(handler);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(route,body)=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try{
    const created=await (await post('/api/cases',{alias:'Prueba',region:'Tórax',answers:{motivo:'Dolor al respirar hondo'}})).json();
    let r=await post('/api/doctor/reply-draft',{code:created.code,preset:'tecnico'});
    assert.equal(r.status,200);let d=await r.json();
    assert.equal(d.preset,'tecnico');assert.equal(d.generated,false);
    assert.match(d.draft,/^Estimado\(a\) paciente: Caso recibido\./);assert.match(d.draft,/semisentado/);
    r=await post('/api/doctor/reply-draft',{code:'SALA-'+created.code,personality:{...PERSONALITY_PRESETS.acompanante,amabilidad:50}});
    d=await r.json();assert.equal(d.personality.amabilidad,10);assert.match(d.draft,/^Hola: Gracias por confiar/);
    const record=await (await fetch(base+'/api/cases/by-code?code='+created.code)).json();
    assert.equal(record.replies.length,0,'El borrador no se registra sin confirmación humana');
    assert.equal((await post('/api/doctor/reply-draft',{code:'NOEXISTE'})).status,404);
    // Perfil: guarda los seis ejes y migra el estilo anterior.
    const id='perfil_pers_'+Date.now();
    await fetch(base+'/api/profiles',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({id,profile:{persona:'personalizada',personality:{...PERSONALITY_PRESETS.profesional,humor:7}}})});
    let p=(await (await fetch(base+'/api/profiles?id='+id)).json()).profile;
    assert.equal(p.personality.humor,7);assert.equal(p.personality.amabilidad,7);
    await fetch(base+'/api/profiles',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({id,profile:{persona:'calida'}})});
    p=(await (await fetch(base+'/api/profiles?id='+id)).json()).profile;
    assert.equal(p.persona,'acompanante');assert.deepEqual(p.personality,normalizePersonality(null,'acompanante'));
    // El asistente recibe la personalidad desde el navegador.
    const s=await (await post('/api/assistant/start',{lang:'es',persona:'profesional'})).json();
    assert.equal(s.persona,'profesional');assert.match(s.reply,/Te haré preguntas breves/);
  }finally{await new Promise(ok=>server.close(ok))}
});

test('Interfaz: panel de personalidad, confirmación humana y caché offline',async()=>{
  const [html,app,vui,nav,ui,sw]=await Promise.all(['public/index.html','public/app.js','public/vui.js','public/navigation.js','public/personality-ui.js','public/sw.js'].map(read));
  assert.match(html,/<option value="tecnico">Técnico<\/option>/);
  assert.match(vui,/mountPersonalityPanel/);assert.match(vui,/personalityPayload\(\)/);
  assert.match(nav,/\/api\/doctor\/reply-draft/);
  assert.match(ui,/Ajustar los rasgos/);assert.match(ui,/type='range'/);
  assert.match(app,/¿Registrar esta respuesta\?/);assert.match(app,/Sí, registrar respuesta/);
  assert.match(sw,/\/personality\.js/);assert.match(sw,/\/personality-ui\.js/);
});
