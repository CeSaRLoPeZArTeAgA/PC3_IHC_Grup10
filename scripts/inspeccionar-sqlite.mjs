import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import path from 'node:path';
try{process.loadEnvFile?.(path.resolve(process.cwd(),'.env'));}catch{}
const file=path.resolve(process.cwd(),process.env.SQLITE_FILE||'data/triagevoz.db');
if(!existsSync(file)){console.error('No existe la BD: '+file+'; inicia node server.mjs para crearla/importarla.');process.exit(1)}
const db=new DatabaseSync(file,{readOnly:true});
try{
  const counts=Object.fromEntries(['cases','case_replies','profiles','case_events'].map(t=>[t,db.prepare('SELECT count(*) AS total FROM '+t).get().total]));
  const integrity=db.prepare('PRAGMA integrity_check').get();
  console.log('SQLite:',file);
  console.log('Conteos (sin datos personales):',counts);
  console.log('Integridad:',integrity.integrity_check);
  if(integrity.integrity_check!=='ok')process.exitCode=2;
}finally{db.close()}
