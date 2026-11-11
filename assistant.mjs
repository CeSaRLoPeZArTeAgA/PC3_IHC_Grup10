// Adaptación del motor de intents y modos de Lab11 a la PWA unificada.
// Uso académico: registra relatos, nunca emite diagnósticos ni clasifica urgencia clínica.
// Tarea 1 (Lec-LAB 11): la personalidad graduable de seis ejes define el estilo de cada turno,
// tanto en las frases locales (sin clave de API) como en el prompt enviado al LLM.
import crypto from 'node:crypto';
import {normalizePersonality,presetKey,matchPreset,buildPersonalityPrompt,localGreeting,localQuestion,localTurn} from './public/personality.js';

const sessions=new Map();
const questionsQu=['¿Imaynanmi nanasunki?','¿Hayk’aqmantataq chay nanay qallarin?','¿Pisi, chawpi icha sinchitachu nanasunki?','¿Huk nanaykunapas kachkanchu?'];
const keys=['motivo','inicio','intensidad','adicionales'];
const clean=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const patterns={
 alarm:/no puedo respirar|me falta el aire|me estoy ahogando|dolor (?:muy |fuerte |intenso )?(?:en el pecho|de pecho)|convulsion|perdi el conocimiento|sangrado abundante|hemorragia|quiero suicidarme|me quiero matar/i,
 explain:/no entiendo|no comprendo|que significa|explicame|mas simple|no se que responder/i,
 distress:/tengo miedo|estoy nervios|me preocupa|estoy angustiad|estoy asustad/i,
 hurry:/tengo prisa|rapido por favor|no tengo tiempo|contesta rapido/i,
 reset:/ya estoy tranquil|ahora entiendo|ya comprendo|sin prisa/i,
 complex:/por que|podria ser|deberia|tratamiento|medicamento|recomiendas|diferencia/i
};
const safety='Registra información declarada para pre-triaje simulado. No diagnostiques, no indiques medicamentos, dosis ni tratamientos, ni asignes una prioridad clínica. Una señal de peligro exige atención humana urgente. Haz una pregunta a la vez. No inventes datos.';
const warning={es:'Lo descrito podría requerir atención urgente. Detén esta entrevista y busca ayuda médica inmediata. En Perú puedes llamar al SAMU 106.',qu:'Chay nisqaykiqa usqhay yanapayta munanman. Kunan pacha hampiq yanapayninta maskhay. Perú suyupi SAMU 106 yupayman waqyay.'};

// Ejes explícitos > preset elegido > preset por defecto (Acompañante).
function applyPersonality(s,persona,personality){
  if(personality&&typeof personality==='object'){s.personality=normalizePersonality(personality,persona||s.persona);s.persona=matchPreset(s.personality);}
  else if(persona){s.persona=presetKey(persona);s.personality=normalizePersonality(null,s.persona);}
}
const usted=s=>s.personality.formalidad>=7;
const question=(s,i)=>s.lang==='qu'?questionsQu[i]:localQuestion(s.personality,i);

export function newSession(lang='es',persona,personality){
  const id=crypto.randomUUID();
  const s={id,lang:lang==='qu'?'qu':'es',persona:presetKey(persona),personality:null,slots:{},index:0,mode:'rutina',history:[],ended:false,confirmed:false,caseCode:null};
  s.personality=normalizePersonality(null,s.persona);
  applyPersonality(s,persona,personality);
  sessions.set(id,s);
  const reply=s.lang==='qu'?'Allin p’unchay. TriageVoz Rural kani. ¿Imaynanmi nanasunki?':localGreeting(s.personality);
  s.history.push({role:'assistant',text:reply});return output(s,reply,'inicio');
}
function output(s,reply,route){return {session:s.id,reply,route,mode:s.mode,slots:{...s.slots},index:s.index,complete:s.index===4,ended:s.ended,lang:s.lang,persona:s.persona,personality:{...s.personality}};}

export async function replyTo({session,text,lang,persona,personality,provider='groq',consent=false}){
  let s=sessions.get(session);if(!s)return newSession(lang,persona,personality);
  if(lang==='qu'||lang==='es')s.lang=lang;
  applyPersonality(s,persona,personality);
  const original=String(text||'').trim().slice(0,1500);if(!original)return output(s,s.lang==='qu'?'Ama hina kaychu, yapamanta rimay.':(usted(s)?'No le escuché. Por favor, repita o escriba.':'No te escuché. Por favor, repite o escribe.'), 'intencion');
  const t=clean(original);
  s.history.push({role:'patient',text:original});
  if(patterns.alarm.test(t)&&!/no tengo|sin dolor|niego|no presento/.test(t)){s.ended=true;s.mode='alarma';return end(s,warning[s.lang],'seguridad')}
  if(/^(reiniciar|empezar de nuevo|borrar conversacion)$/i.test(t))return newSession(s.lang,s.persona,s.personality);
  if(s.ended)return end(s,warning[s.lang],'seguridad');
  if(patterns.explain.test(t)){s.mode='comprension';return end(s,s.lang==='qu'?'Allinmi. Aswan sut’ita tapusayki: '+questionsQu[s.index]:(usted(s)?'Le explicaré con palabras sencillas. Intensidad significa qué tan fuerte siente la molestia. ':'Te explicaré con palabras sencillas. Intensidad significa qué tan fuerte sientes la molestia. ')+(question(s,s.index)||'¿La información está correcta?'),'intent_contextual')}
  if(patterns.distress.test(t)){s.mode='contencion';return end(s,s.lang==='qu'?'Ama manchakuychu. Samaykuspa kutichiy. '+questionsQu[s.index]:(usted(s)?'Entiendo su preocupación. Responda a su ritmo. ':'Entiendo tu preocupación. Responde a tu ritmo. ')+(question(s,s.index)||''),'intent_contextual')}
  // Prisa: pregunta sin ejemplos, aunque la personalidad sea muy paciente.
  if(patterns.hurry.test(t)){s.mode='brevedad';return end(s,s.lang==='qu'?'Usqhaylla. '+(questionsQu[s.index]||''):'Iré al punto. '+(localQuestion({...s.personality,paciencia:0},s.index)||''),'intent_contextual')}
  if(patterns.reset.test(t))s.mode='rutina';
  if(/^(resumen|resumir|que dije|mis sintomas)$/i.test(t))return end(s,summary(s),'intent_resumen');
  if(/^(hola|buenos dias|buenas tardes)$/i.test(t))return end(s,question(s,s.index)||summary(s),'intent_saludo');
  if(s.index>=4){
    if(/^(si|sí|confirmo|correcto|allinmi|ari)/i.test(t)){s.confirmed=true;return end(s,s.lang==='qu'?'Willakuyqa chiqapchasqam. Hampiq runaman apachisqa.':'Información confirmada. El caso se registrará para revisión del personal de salud.','confirmacion')}
    if(/^(no|mana|corregir)/i.test(t)){s.index=0;s.slots={};s.confirmed=false;return end(s,question(s,0),'correccion')}
    return end(s,summary(s),'resumen');
  }
  if((patterns.complex.test(t)||original.length>160)&&consent){
    const result=await askLLM({provider,system:safety,question:original,slots:s.slots,lang:s.lang,personality:s.personality,mode:s.mode});
    return end(s,result.text,result.route);
  }
  // La entrevista estructura cuatro campos en secuencia, con confirmación final.
  s.slots[keys[s.index]]=original;s.index++;
  if(s.index===4)return end(s,summary(s)+(s.lang==='qu'?' ¿Allinchu?':' ¿Es correcta la información?'),'intent_resumen');
  return end(s,s.lang==='qu'?questionsQu[s.index]:localTurn(s.personality,s.index),'intent_pregunta');
}
function summary(s){const vals=keys.map(k=>`${k}: ${s.slots[k]||'—'}`).join('; ');return s.lang==='qu'?`Kaymi willakuyki: ${vals}. Hampiq qhawarinanpaqmi, manam unquy sutichaychu.`:`Resumen de lo declarado: ${vals}. Es para revisión médica; no es un diagnóstico.`}
function end(s,msg,route){s.history.push({role:'assistant',text:msg});return output(s,msg,route)}
export function forgetSession(id){sessions.delete(id)}
export function confirmedSession(id){const s=sessions.get(id);return s?.confirmed&&s.index===4?s:null}

/** Prompt de sistema completo: reglas de seguridad + personalidad graduable (Tarea 1). */
export function assistantSystemPrompt(personality,lang='es',system=safety){
  return system+'\n\n'+buildPersonalityPrompt(personality,lang);
}

export async function askLLM({provider,system=safety,question,slots={},lang='es',personality,persona,mode='rutina'}){
  const p=normalizePersonality(personality,persona);
  const systemText=assistantSystemPrompt(p,lang,system);
  const prompt='Modo de la sesión: '+mode+'.\nDatos declarados: '+JSON.stringify(slots)+'\nConsulta: '+question;
  try{
    if(provider==='gemini'){
      const key=process.env.GEMINI_API_KEY;if(!key)return {text:'Gemini no está configurado; continúa con las preguntas de registro.',route:'sin_clave'};
      const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:systemText}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.6,maxOutputTokens:300}}),signal:AbortSignal.timeout(18000)});
      if(!r.ok)throw Error('Gemini HTTP '+r.status);const j=await r.json();return {text:j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join(' ').slice(0,1500)||'No pude responder.',route:'llm_gemini'};
    }
    const key=process.env.GROQ_API_KEY;if(!key)return {text:'Groq no está configurado; continúa con las preguntas de registro.',route:'sin_clave'};
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({model:process.env.GROQ_CHAT_MODEL||'openai/gpt-oss-120b',messages:[{role:'system',content:systemText},{role:'user',content:prompt}],temperature:0.6,max_tokens:330}),signal:AbortSignal.timeout(18000)});
    if(!r.ok)throw Error('Groq HTTP '+r.status);const j=await r.json();return {text:String(j.choices?.[0]?.message?.content||'No pude responder.').slice(0,1500),route:'llm_groq'};
  }catch{return {text:lang==='qu'?'Mana kunan yanapay atikunchu. Qillqayta atinki.':'El servicio de IA no está disponible. Continúa por texto o con las preguntas guiadas.',route:'llm_error'}}
}
