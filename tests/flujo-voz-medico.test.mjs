import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
// Aísla las pruebas: nunca deben escribir data/runtime.json ni data/profiles.json reales.
const tmp=path.join(os.tmpdir(),'triagevoz-voz-'+crypto.randomUUID());
process.env.STORAGE_FILE=tmp+'.json';
process.env.PROFILES_FILE=tmp+'-profiles.json';
const {handler}=await import('../server.mjs');
after(async()=>{
  await fs.rm(process.env.STORAGE_FILE,{force:true});
  await fs.rm(process.env.PROFILES_FILE,{force:true});
});

test('PC3: confirmar por voz guarda un código y el médico publica su respuesta',async()=>{
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const post=async(route,body)=>{
    const response=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal(response.status,200);return response.json();
  };
  try{
    let result=await post('/api/assistant/start',{lang:'es'});
    const session=result.session;
    for(const answer of ['dolor de cabeza','desde ayer','moderado','sin otros síntomas']){
      result=await post('/api/assistant/reply',{session,text:answer,region:'Cabeza'});
    }
    assert.equal(result.complete,true);
    assert.equal(result.caseCode,undefined,'No guardar antes de confirmar');
    result=await post('/api/assistant/reply',{session,text:'sí, confirmo',region:'Cabeza'});
    assert.match(result.caseCode,/^SALA-[A-F0-9]{12}$/);
    const code=result.caseCode;
    const repeat=await post('/api/assistant/reply',{session,text:'confirmo',region:'Cabeza'});
    assert.equal(repeat.caseCode,code,'Confirmación repetida no crea un nuevo caso');
    let response=await fetch(base+'/api/cases/by-code?code='+encodeURIComponent(code));
    let record=await response.json();assert.equal(record.region,'Cabeza');assert.equal(record.replies.length,0);
    const draft=await post('/api/doctor/reply-draft',{code,preset:'profesional'});
    assert.match(draft.draft,/No se emite diagnóstico ni receta/);
    assert.equal((await fetch(base+'/api/doctor/draft',{method:'POST',body:'{}'})).status,404,'La propuesta con hipótesis diagnósticas ya no existe');
    record=await post('/api/cases/reply',{code,message:'Respuesta profesional revisada para este caso ficticio.'});
    assert.equal(record.replies.length,1);
    response=await fetch(base+'/api/cases/by-code?code='+encodeURIComponent(code));
    record=await response.json();assert.match(record.replies[0].message,/revisada/);
  }finally{await new Promise(resolve=>server.close(resolve))}
});
