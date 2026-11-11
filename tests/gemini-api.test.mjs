import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interactionText,transcribeQuechua} from '../gemini-api.mjs';

test('Interactions: lee respuesta estructurada de audio sin usar generateContent antiguo',()=>{
 assert.equal(interactionText({outputs:[{type:'model_output',content:[{type:'text',text:'Umaymi nanawan'}]}]}),'Umaymi nanawan');
});
test('Gemini: diagnostica HTTP 404 y no lo trata como error de micrófono',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url)=>{
  calls.push(String(url));
  if(String(url).includes('/models?'))return {ok:true,json:async()=>({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]})};
  return {ok:false,status:404,json:async()=>({error:{message:'Model not found'}})};
 };
 try{
  const r=await transcribeQuechua({key:'clave_de_prueba',audio:'ZGF0YQ==',mime:'audio/webm',preferred:'gemini-3.8-flash'});
  assert.match(r.error,/404/);assert.ok(calls.some(url=>url.endsWith('/interactions')));
 }finally{globalThis.fetch=original}
});
