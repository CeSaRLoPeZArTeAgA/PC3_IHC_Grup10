import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createSqliteStore} from '../db/sqlite-store.mjs';

const legacyCase={id:'id-001',code:'PRUEBA01',alias:'Paciente ficticio',region:'Cabeza',
 answers:{motivo:'Dolor simulado',inicio:'Ayer',intensidad:'Moderada',adicionales:'Sin otras molestias'},
 summary:'Resumen ficticio.',priority:'Pendiente',status:'enviado',
 createdAt:'2026-11-11T12:00:00.000Z',ackAt:null,replies:[]};

test('SQLite: migra JSON, conserva códigos/respuestas/perfiles y no reimporta',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'triagevoz-sqlite-'));
 const dbFile=path.join(dir,'triagevoz.db'),legacyCasesFile=path.join(dir,'runtime.json'),legacyProfilesFile=path.join(dir,'profiles.json');
 const opts={dbFile,legacyCasesFile,legacyProfilesFile};
 try {
   await writeFile(legacyCasesFile,JSON.stringify([legacyCase]));
   await writeFile(legacyProfilesFile,JSON.stringify({paciente_demo_01:{language:'es',contrast:true,persona:'profesional',personality:{empatia:8}}}));
   let db=await createSqliteStore(opts);
   assert.equal(db.stats().cases,1);assert.equal(db.stats().profiles,1);
   assert.equal(db.readCases()[0].code,'PRUEBA01');
   assert.equal(db.readProfiles().paciente_demo_01.personality.empatia,8);
   const rec=db.readCases()[0];
   rec.status='recibido';rec.ackAt='2026-11-11T12:03:00.000Z';
   rec.replies.push({author:'Médico simulado',message:'Respuesta ficticia',createdAt:'2026-11-11T12:05:00.000Z'});
   db.saveCases([rec]);db.saveCases([rec]); // idempotencia
   db.saveProfile('paciente_demo_01',{language:'qu',contrast:true,persona:'acompanante'});
   assert.equal(db.stats().replies,1);
   assert.equal(db.stats().events,3); // creado, acuse, respuesta
   db.close();
   // Modificar los antiguos JSON no debe alterar la DB ya migrada.
   await writeFile(legacyCasesFile,JSON.stringify([{...legacyCase,code:'OTRO'}]));
   db=await createSqliteStore(opts);
   assert.equal(db.stats().cases,1);
   const rows=db.readCases();
   assert.equal(rows[0].code,'PRUEBA01');
   assert.equal(rows[0].status,'recibido');
   assert.equal(rows[0].replies.length,1);
   assert.equal(db.readProfiles().paciente_demo_01.language,'qu');
   db.close();
   assert.ok((await readFile(legacyProfilesFile,'utf8')).includes('paciente_demo_01')); // respeta respaldo
 }finally {await rm(dir,{recursive:true,force:true})}
});

test('SQLite: claves iguales no duplican y una escritura fallida hace rollback',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'triagevoz-sqlite-test-'));
 const opts={dbFile:path.join(dir,'test.db'),legacyCasesFile:path.join(dir,'legacy.json'),legacyProfilesFile:path.join(dir,'profiles.json')};
 try {
   const db=await createSqliteStore(opts);
   const records=Array.from({length:8},(_,i)=>({...legacyCase,id:'id-'+i,code:'C'+i}));
   db.saveCases(records);db.saveCases(records);
   assert.equal(db.stats().cases,8);
   assert.throws(()=>db.saveCases([...records,{...legacyCase,code:''}]),/sin código/);
   assert.equal(db.stats().cases,8);
   assert.equal(db.readCases().length,8);
   db.close();
 }finally{await rm(dir,{recursive:true,force:true})}
});
