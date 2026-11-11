import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newSession,replyTo} from '../assistant.mjs';
import http from 'node:http';
import {handler} from '../server.mjs';

test('Asistente integrado: cuatro respuestas completan campos para formulario PC2',async()=>{
 let r=newSession('es');assert.match(r.reply,/molestia/i);
 for(const txt of ['Me duele la cabeza','Desde ayer','Leve','No'])r=await replyTo({session:r.session,text:txt});
 assert.equal(r.complete,true);assert.equal(r.slots.motivo,'Me duele la cabeza');assert.equal(r.slots.intensidad,'Leve');
 assert.match(r.reply,/revisión médica/i);
});

test('Intents Lab11: explicación no contamina los síntomas',async()=>{
 let r=newSession('es');r=await replyTo({session:r.session,text:'No entiendo qué significa intensidad'});
 assert.equal(r.index,0);assert.equal(r.mode,'comprension');assert.deepEqual(r.slots,{});
 r=await replyTo({session:r.session,text:'Tengo miedo y estoy nervioso'});
 assert.equal(r.mode,'contencion');assert.equal(r.index,0);
});

test('Quechua: sesión diferenciada y sin usar voz española',async()=>{
 let r=newSession('qu');assert.equal(r.lang,'qu');assert.match(r.reply,/Imaynanmi/);
 r=await replyTo({session:r.session,lang:'qu',text:'Umaymi nanawan'});
 assert.equal(r.slots.motivo,'Umaymi nanawan');assert.equal(r.index,1);
});

test('API unificada: inicia y responde desde el mismo puerto',async()=>{
 const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  let res=await fetch(base+'/api/assistant/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lang:'es'})});assert.equal(res.status,200);
  let s=await res.json();assert.ok(s.session);
  res=await fetch(base+'/api/assistant/reply',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session:s.session,text:'Me duele la cabeza'})});
  s=await res.json();assert.equal(s.slots.motivo,'Me duele la cabeza');
 }finally{await new Promise(resolve=>server.close(resolve))}
});
