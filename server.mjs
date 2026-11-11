import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {newSession,replyTo,confirmedSession} from './assistant.mjs';
import {normalizePersonality,presetKey,matchPreset,buildCaseReplyPrompt,localCaseReply} from './public/personality.js';
import {listGeminiModels,transcribeQuechua} from './gemini-api.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
// Claves exclusivamente del servidor; el navegador nunca recibe secretos.
try{process.loadEnvFile?.(path.join(root,'.env'))}catch{}
const pub=path.join(root,'public');
const storage=process.env.STORAGE_FILE||path.join(root,'data','runtime.json');
const profilesFile=process.env.PROFILES_FILE||path.join(root,'data','profiles.json');
let profiles={};
try{const p=JSON.parse(await fs.readFile(profilesFile,'utf8'));if(p&&typeof p==='object'&&!Array.isArray(p))profiles=p;}catch{}
let cases=[];
try{const r=JSON.parse(await fs.readFile(storage,'utf8'));if(Array.isArray(r))cases=r;}catch{}
if(!cases.length){
  try{
    const sample=JSON.parse(await fs.readFile(path.join(root,'data','casos-ficticios.json'),'utf8'));
    if(Array.isArray(sample)){
      const codes=['HUANCA01','CAJATA02','ANDAHU03','PAUCAR04','YAUYOS05','CHUMBI06'];
      cases=sample.map((s,i)=>({
        id:crypto.randomUUID(),
        code:codes[i]||crypto.randomBytes(4).toString('hex').toUpperCase(),
        alias:s.alias,
        region:s.region,
        answers:s.answers,
        summary:`Zona: ${s.region}. Motivo: ${s.answers.motivo}. Inicio: ${s.answers.inicio}. Intensidad: ${s.answers.intensidad}. Adicionales: ${s.answers.adicionales}.`,
        priority:s.priority||'Pendiente de valoración del personal sanitario',
        status:i%2===1?'recibido':'enviado',
        createdAt:new Date(Date.now()-(6-i)*1800000).toISOString(),
        ackAt:i%2===1?new Date(Date.now()-(6-i)*1200000).toISOString():null,
        replies:i%2===1?[{author:'Médico remoto (demo, no autenticado)',message:'Caso ficticio recibido. Pendiente de revisión del personal de salud; no se generan indicaciones clínicas automáticas.',createdAt:new Date(Date.now()-(6-i)*900000).toISOString()}]:[]
      }));
    }
  }catch{}
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const str=(s,n=700)=>String(s??'').trim().slice(0,n);
const send=(res,status,obj)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj));};
async function read(req){let s='';for await(const chunk of req){s+=chunk;if(s.length>120000)throw Error('too large');}try{return JSON.parse(s||'{}')}catch{throw Error('invalid JSON')}}
async function readAudio(req){let s='';for await(const chunk of req){s+=chunk;if(s.length>6500000)throw Error('too large')}try{return JSON.parse(s||'{}')}catch{throw Error('invalid JSON')}}
async function transcribeAudio(b){
 const lang=b.lang==='qu'?'qu':'es',data=String(b.audio||''),mime=String(b.mime||'audio/webm').slice(0,80);
 if(!/^audio\//.test(mime)||data.length<100||data.length>6000000)return {error:'Audio no válido'};
 if(lang==='qu'){
  if(!process.env.GEMINI_API_KEY)return {error:'Para probar audio en quechua necesitas configurar GEMINI_API_KEY. Reconocimiento experimental sin garantía de precisión.'};
  return transcribeQuechua({key:process.env.GEMINI_API_KEY,audio:data,mime,preferred:process.env.GEMINI_AUDIO_MODEL||process.env.GEMINI_MODEL||'gemini-3.8-flash'});
 }
 if(!process.env.GROQ_API_KEY)return {error:'Configura GROQ_API_KEY para transcribir audio.'};
 const form=new FormData();form.set('model',process.env.GROQ_STT_MODEL||'whisper-large-v3-turbo');form.set('language','es');form.set('file',new Blob([Buffer.from(data,'base64')],{type:mime}),'voz.webm');
 const r=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{authorization:'Bearer '+process.env.GROQ_API_KEY},body:form,signal:AbortSignal.timeout(30000)});
 if(!r.ok)return {error:'Servicio de transcripción no disponible ('+r.status+').'};const j=await r.json();return {text:String(j.text||'').slice(0,1500)};
}
function wavFromPCM(pcm,rate=24000){const raw=Buffer.from(pcm,'base64'),out=Buffer.alloc(raw.length+44);out.write('RIFF',0);out.writeUInt32LE(raw.length+36,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(raw.length,40);raw.copy(out,44);return out.toString('base64')}
async function speakQuechua(b){
 if(!process.env.GEMINI_API_KEY)return {error:'Falta GEMINI_API_KEY; no hay voz quechua disponible.'};
 const model=process.env.GEMINI_TTS_MODEL||'gemini-2.5-flash-preview-tts';
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:'Lee exactamente el texto en quechua cusqueño, sin traducir al español: '+String(b.text||'').slice(0,400)}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Kore'}}}}}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)return {error:'La síntesis de voz en quechua no está disponible para este modelo ('+r.status+').'};
 const j=await r.json();const a=j.candidates?.[0]?.content?.parts?.find(p=>p.inlineData||p.inline_data)?.inlineData||j.candidates?.[0]?.content?.parts?.find(p=>p.inline_data)?.inline_data;
 if(!a?.data)return {error:'El proveedor no generó audio en quechua.'};return {audio:wavFromPCM(a.data),mime:'audio/wav',experimental:true};
}
// Las solicitudes simultáneas deben persistirse en orden; cada una captura su versión.
let pendingSave=Promise.resolve();
function save(){
  const snapshot=JSON.stringify(cases,null,2);
  const next=pendingSave.catch(()=>{}).then(async()=>{
    await fs.mkdir(path.dirname(storage),{recursive:true});
    const temp=storage+'.'+crypto.randomUUID()+'.tmp';
    try{
      await fs.writeFile(temp,snapshot,{mode:0o600});
      await fs.rename(temp,storage);
    }finally{await fs.rm(temp,{force:true}).catch(()=>{})}
  });
  pendingSave=next;
  return next;
}
const clean=(x)=>{const a=x?.answers||{};return {alias:str(x?.alias,35)||'Paciente simulado',region:str(x?.region,90),answers:{motivo:str(a.motivo),inicio:str(a.inicio),intensidad:str(a.intensidad,80),adicionales:str(a.adicionales)},summary:str(x?.summary,1600),priority:'Pendiente de valoración del personal sanitario'};};
function localSummary(raw){const c=clean(raw);return {mode:'simulacion',summary:['Zona: '+(c.region||'no declarada'),'Motivo: '+(c.answers.motivo||'no declarado'),'Inicio: '+(c.answers.inicio||'no declarado'),'Intensidad: '+(c.answers.intensidad||'no declarada'),'Otros: '+(c.answers.adicionales||'no declarados')].join('. ')+'.',priority:'Pendiente de valoración del personal sanitario',disclaimer:'Solo resumen orientativo del relato ficticio; no constituye diagnóstico ni clasificación clínica.'};}
async function summarize(raw){const fallback=localSummary(raw);const key=process.env.GEMINI_API_KEY;if(!key)return fallback;
const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);
try{const prompt='Estructura SOLO el relato ficticio sin inventar datos, sin diagnóstico ni tratamiento. Devuelve JSON {"summary":"..."} de máximo 1200 caracteres. Datos: '+JSON.stringify(clean(raw));
const rsp=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',signal:ctl.signal,headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}})});
if(!rsp.ok)throw Error('LLM unavailable');const obj=await rsp.json();const s=obj.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}';const parsed=JSON.parse(s);if(!parsed.summary||typeof parsed.summary!=='string')throw Error('LLM invalid');
return {...fallback,mode:'gemini',summary:parsed.summary.slice(0,1400),disclaimer:'Generado por IA sin validación médica.'};
}catch{return {...fallback,warning:'Servicio remoto no disponible; se utilizó resumen local simulado.'}}finally{clearTimeout(timer)}}
const byCode=c=>{const s=str(c,32).toUpperCase().replace(/^SALA-/,'').trim();return cases.find(x=>x.code===s||x.code===str(c,32).toUpperCase().trim());};
// Tarea 1 (Lec-LAB 11): borrador de respuesta al paciente con personalidad graduable.
// Catálogo cerrado de cuidados/alarmas por zona; nunca se registra sin confirmación humana.
async function caseReplyDraft(c,raw){
 const personality=normalizePersonality(raw?.personality,raw?.preset||'profesional');
 const base={personality,preset:matchPreset(personality)};
 const fallback={...base,draft:localCaseReply(personality,c),generated:false,mode:'simulacion'};
 const system=buildCaseReplyPrompt(personality,c);
 const instruction='Redacta solo el borrador de respuesta, sin encabezados ni explicaciones.';
 try{
  let text='',mode='';
  if(process.env.GROQ_API_KEY){
   const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+process.env.GROQ_API_KEY},body:JSON.stringify({model:process.env.GROQ_CHAT_MODEL||'openai/gpt-oss-120b',messages:[{role:'system',content:system},{role:'user',content:instruction}],temperature:0.5,max_tokens:450}),signal:AbortSignal.timeout(18000)});
   if(!r.ok)throw Error('Modelo no disponible');const j=await r.json();text=str(j.choices?.[0]?.message?.content,1200);mode='groq';
  }else if(process.env.GEMINI_API_KEY){
   const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
   const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:instruction}]}],generationConfig:{temperature:0.5,maxOutputTokens:450}}),signal:AbortSignal.timeout(18000)});
   if(!r.ok)throw Error('Modelo no disponible');const j=await r.json();text=str(j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join(''),1200);mode='gemini';
  }
  return text?{...base,draft:text,generated:true,mode}:fallback;
 }catch{return {...fallback,warning:'Servicio de IA no disponible; se usó el borrador local con la misma personalidad.'}}
}
async function handler(req,res){const u=new URL(req.url||'/', 'http://localhost');try{
if(req.method==='GET'&&u.pathname==='/api/gemini/models'){
 const result=await listGeminiModels(process.env.GEMINI_API_KEY);
 return send(res,200,{...result,configured:!!process.env.GEMINI_API_KEY,selectedAudioModel:process.env.GEMINI_AUDIO_MODEL||process.env.GEMINI_MODEL||'gemini-3.8-flash'});
}
if(req.method==='POST'&&u.pathname==='/api/assistant/start'){const b=await read(req);return send(res,200,newSession(b.lang,b.persona,b.personality))}
if(req.method==='POST'&&u.pathname==='/api/assistant/reply'){
 const b=await read(req),result=await replyTo(b);
 if(result.route==='confirmacion'){
  const s=confirmedSession(result.session);
  if(s){
   if(!s.caseCode){
    const obj=clean({alias:'Paciente de voz (demo)',region:b.region,answers:s.slots});obj.summary=localSummary(obj).summary;
    const rec={id:crypto.randomUUID(),code:crypto.randomBytes(6).toString('hex').toUpperCase(),...obj,status:'enviado',createdAt:new Date().toISOString(),ackAt:null,replies:[]};
    cases.push(rec);s.caseCode=rec.code;await save();
   }
   result.caseCode='SALA-'+s.caseCode;
   result.reply+=' '+(s.lang==='qu'?'Qhaway, kaymi qillqay yupayki: ':'Tu código de consulta es: ')+result.caseCode+'. Guárdalo para consultar la respuesta del personal médico.';
  }
 }
 return send(res,200,result);
}
if(req.method==='POST'&&u.pathname==='/api/assistant/transcribe'){const b=await readAudio(req);return send(res,200,await transcribeAudio(b))}
if(req.method==='POST'&&u.pathname==='/api/assistant/speak'){const b=await read(req);return send(res,200,await speakQuechua(b))}
if(u.pathname==='/api/profiles'&&req.method==='GET'){
  const id=str(u.searchParams.get('id'),45);
  if(!/^[a-zA-Z0-9_-]{3,45}$/.test(id))return send(res,400,{error:'Identificador no válido'});
  return send(res,200,{id,profile:profiles[id]||null});
}
if(u.pathname==='/api/profiles'&&req.method==='PUT'){
  const b=await read(req),id=str(b.id,45);
  if(!/^[a-zA-Z0-9_-]{3,45}$/.test(id))return send(res,400,{error:'Identificador no válido'});
  const p=b.profile||{};
  const allowed={language:str(p.language,8),contrast:!!p.contrast,large:!!p.large,speak:!!p.speak,rhythm:p.rhythm==='pausado'?'pausado':'normal',errorCount:Math.min(999,Math.max(0,Number(p.errorCount)||0)),avgTimePerQuestion:Math.min(999,Math.max(0,Number(p.avgTimePerQuestion)||0)),persona:presetKey(p.persona),personality:normalizePersonality(p.personality,p.persona),updatedAt:new Date().toISOString()};
  profiles[id]=allowed;
  await fs.mkdir(path.dirname(profilesFile),{recursive:true});
  const temp=profilesFile+'.'+crypto.randomUUID()+'.tmp';
  await fs.writeFile(temp,JSON.stringify(profiles,null,2),{mode:0o600});await fs.rename(temp,profilesFile);
  return send(res,200,{id,profile:allowed});
}
if(req.method==='GET'&&u.pathname==='/api/health')return send(res,200,{ok:true,cases:cases.length,model:process.env.GEMINI_API_KEY?'remoto-configurado':'simulacion'});
if(req.method==='GET'&&u.pathname==='/api/rooms')return send(res,200,cases.slice(-12).reverse().map(c=>({code:c.code,alias:c.alias,region:c.region||'Zona general',motivo:c.answers?.motivo||'Pre-triaje general',status:c.status,createdAt:c.createdAt,repliesCount:c.replies?.length||0,type:'caso-demo',realtime:false})));
if(req.method==='POST'&&u.pathname==='/api/llm')return send(res,200,await summarize(await read(req)));
if(req.method==='POST'&&u.pathname==='/api/cases'){const obj=clean(await read(req));if(!obj.region&&!obj.answers.motivo)return send(res,422,{error:'Indique la región o motivo'});const rec={id:crypto.randomUUID(),code:crypto.randomBytes(6).toString('hex').toUpperCase(),...obj,status:'enviado',createdAt:new Date().toISOString(),ackAt:null,replies:[]};cases.push(rec);await save();return send(res,201,rec);}
if(req.method==='GET'&&u.pathname==='/api/cases/by-code'){const c=byCode(u.searchParams.get('code'));return c?send(res,200,c):send(res,404,{error:'Caso simulado no encontrado'});}
if(req.method==='POST'&&u.pathname==='/api/doctor/reply-draft'){
 const b=await read(req),c=byCode(b.code);if(!c)return send(res,404,{error:'Caso no encontrado'});
 return send(res,200,await caseReplyDraft(c,b));
}
if(req.method==='POST'&&(u.pathname==='/api/cases/ack'||u.pathname==='/api/cases/reply')){const b=await read(req),c=byCode(b.code);if(!c)return send(res,404,{error:'Código no encontrado'});
if(u.pathname.endsWith('/ack')){
  if(c.status!=='recibido'){c.status='recibido';c.ackAt=new Date().toISOString();}
}else{
  const m=str(b.message);
  if(!m)return send(res,422,{error:'Escriba respuesta'});
  // Reintentos idénticos no deben crear una segunda respuesta accidental.
  if(c.replies.at(-1)?.message===m)return send(res,200,c);
  c.replies.push({author:'Médico remoto (demo, no autenticado)',message:m,createdAt:new Date().toISOString()});
}
await save();return send(res,200,c);}
if(u.pathname.startsWith('/api/'))return send(res,404,{error:'API no encontrada'});
if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Método no permitido'});
let p;try{p=decodeURIComponent(u.pathname)}catch{return send(res,400,{error:'URL no válida'})}
if(p.includes('\\')||p.includes('\0')||p.split('/').includes('..'))return send(res,403,{error:'Ruta prohibida'});
if(p==='/')p='/index.html';const file=path.resolve(pub,'.'+p);if(!file.startsWith(pub+path.sep))return send(res,403,{error:'Ruta prohibida'});
try{const b=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','x-content-type-options':'nosniff'});return res.end(req.method==='HEAD'?'':b)}catch{return send(res,404,{error:'Archivo no encontrado'})}
}catch(e){if(!res.headersSent)send(res,e.message==='invalid JSON'?400:500,{error:'Operación no completada'});}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){http.createServer(handler).listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('TriageVoz Rural DEMO http://127.0.0.1:'+(process.env.PORT||4173)))}
export {handler,localSummary};
