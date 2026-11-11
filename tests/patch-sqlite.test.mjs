import test from 'node:test';
import assert from 'node:assert/strict';
import {transform} from '../scripts/aplicar-sqlite.mjs';
const source=`import {listGeminiModels,transcribeQuechua} from './gemini-api.mjs';
const root='.';
const storage='runtime.json';
const profilesFile='profiles.json';
let profiles={};
try{const p=JSON.parse(await fs.readFile(profilesFile,'utf8'));if(p&&typeof p==='object'&&!Array.isArray(p))profiles=p;}catch{}
let cases=[];
try{const r=JSON.parse(await fs.readFile(storage,'utf8'));if(Array.isArray(r))cases=r;}catch{}
if(!cases.length){ cases=[]; }
const mime={};
function save(){
  const snapshot=JSON.stringify(cases,null,2);
  return Promise.resolve(snapshot);
}
async function profileSave(){
  profiles[id]=allowed;
  await fs.mkdir(path.dirname(profilesFile),{recursive:true});
  const temp=profilesFile+'.'+crypto.randomUUID()+'.tmp';
  await fs.writeFile(temp,JSON.stringify(profiles,null,2),{mode:0o600});await fs.rename(temp,profilesFile);
}
const h={model:process.env.GEMINI_API_KEY?'remoto-configurado':'simulacion'};
`;

test('Parche inserta SQLite en arranque, casos y perfiles sin duplicarse',()=>{
 const a=transform(source);assert.equal(a.changed,true);
 assert.match(a.content,/createSqliteStore/);
 assert.match(a.content,/sqliteStore\.saveCases\(cases\)/);
 assert.match(a.content,/sqliteStore\.saveProfile\(id,allowed\)/);
 assert.match(a.content,/storage:sqliteStore\?'sqlite':'json'/);
 const b=transform(a.content);assert.equal(b.changed,false);assert.equal(b.content,a.content);
});

test('Parche aborta si el formato del servidor cambia',()=>{
 assert.throws(()=>transform('const cosa = 4;'),/No se reconoce/);
});


test('Parche reconoce CRLF de Windows, conserva estilo y es idempotente',()=>{
 const winSource=source.replace(/\n/g,'\r\n');
 const result=transform(winSource);
 assert.equal(result.changed,true);
 assert.match(result.content,/sqliteStore\.saveCases\(cases\)/);
 assert.match(result.content,/function save\(\)\{\r\n  if\(sqliteStore\)/);
 assert.ok(result.content.includes('\r\n'));
 assert.equal(transform(result.content).changed,false);
});

test('Parche reconoce mezcla de LF/CRLF de Git',()=>{
 const mixed=source.replace('function save(){\n','function save(){\r\n');
 const result=transform(mixed);
 assert.equal(result.changed,true);
 assert.match(result.content,/sqliteStore\.saveCases\(cases\)/);
});
