import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {handler} from '../server.mjs';

test('PC3: perfil persistente y aislado por identificador ficticio',async()=>{
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const id='testpc3_'+Date.now();
  try{
    let r=await fetch(base+'/api/profiles',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({id,profile:{language:'es',contrast:true,rhythm:'pausado',errorCount:4,persona:'calida'}})});
    assert.equal(r.status,200);
    r=await fetch(base+'/api/profiles?id='+id);
    const p=(await r.json()).profile;
    assert.equal(p.contrast,true);assert.equal(p.rhythm,'pausado');assert.equal(p.errorCount,4);
    r=await fetch(base+'/api/profiles?id=otro_usuario_demo');assert.equal((await r.json()).profile,null);
    r=await fetch(base+'/api/profiles?id=../etc/passwd');assert.equal(r.status,400);
  }finally{await new Promise(resolve=>server.close(resolve))}
});
