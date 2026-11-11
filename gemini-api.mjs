// Interactions API (2026) para audio; modelo accesible según la clave del usuario.
const base='https://generativelanguage.googleapis.com/v1beta';
let cached=null;
export async function listGeminiModels(key){
  if(!key)return {models:[],error:'Falta GEMINI_API_KEY'};
  if(cached&&Date.now()-cached.time<300000)return cached.value;
  try{
    const r=await fetch(base+'/models?pageSize=500',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(12000)});
    const j=await r.json();
    if(!r.ok)return {models:[],error:`No se pudo consultar modelos Gemini (${r.status}): ${String(j.error?.message||'').slice(0,200)}`};
    const value={models:(j.models||[]).map(m=>({name:String(m.name||'').replace(/^models\//,''),actions:m.supportedGenerationMethods||m.supportedActions||[]}))};
    cached={time:Date.now(),value};return value;
  }catch{return {models:[],error:'No se pudo consultar el catálogo de modelos de Gemini'}}
}
export function interactionText(j){
  if(typeof j.output_text==='string'&&j.output_text.trim())return j.output_text.trim();
  const blocks=j.outputs||j.steps||j.output||[];
  const found=[];
  for(const part of blocks){
    if(part.type&&part.type!=='model_output'&&part.type!=='text')continue;
    if(typeof part.text==='string')found.push(part.text);
    for(const c of part.content||[])if(typeof c.text==='string')found.push(c.text);
  }
  return found.join(' ').trim();
}
export async function transcribeQuechua({key,audio,mime,preferred=''}){
  const catalog=await listGeminiModels(key);
  const available=new Set(catalog.models.map(m=>m.name));
  // 3.8 y 3.6 trabajan con Interactions; 2.5 se conserva como último recurso.
  const candidates=[preferred,'gemini-3.8-flash','gemini-3.6-flash','gemini-2.5-flash'].filter(Boolean);
  const unique=[...new Set(candidates)].filter(m=>!available.size||available.has(m));
  if(!unique.length)return {error:'Tu clave no muestra modelos Gemini compatibles para audio. Revisa GEMINI_API_KEY y el catálogo en /api/gemini/models.'};
  let last='';
  for(const model of unique){
    try{
      const legacy=model.startsWith('gemini-2.');
      const url=legacy?`${base}/models/${encodeURIComponent(model)}:generateContent`:`${base}/interactions`;
      const body=legacy?{contents:[{parts:[{text:'Transcribe literalmente este audio en quechua sureño (Cusco). Devuelve solo la transcripción, sin inventar ni traducir. Si no es comprensible, escribe INAUDIBLE.'},{inline_data:{mime_type:mime,data:audio}}]}]}:{model,input:[{type:'text',text:'Transcribe literalmente este audio en quechua sureño (Cusco). Devuelve solo las palabras en quechua, sin traducción ni invenciones. Si no se entiende, escribe INAUDIBLE.'},{type:'audio',data:audio,mime_type:mime}]};
      const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key,...(legacy?{}:{'Api-Revision':'2026-05-20'})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
      const j=await r.json();
      if(!r.ok){last=`${model}: HTTP ${r.status} (${String(j.error?.message||'sin detalle').slice(0,180)})`;if(r.status===404)continue;return {error:'Gemini rechazó el audio: '+last}}
      const text=legacy?j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join(' '):interactionText(j);
      if(!text||text.trim().toUpperCase()==='INAUDIBLE')return {error:'No se reconoció el quechua. Escribe la respuesta o solicita apoyo de un intérprete.',model};
      return {text:text.trim().slice(0,1500),model,experimental:true};
    }catch(e){last=`${model}: ${e.name==='TimeoutError'?'tiempo de espera agotado':'no disponible'}`}
  }
  return {error:'No fue posible transcribir con tu cuenta Gemini. '+last+'. Consulta /api/gemini/models para verificar acceso.'};
}
