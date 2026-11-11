/**
 * Parche reproducible y con copia de seguridad del servidor PC3 actual.
 * Ejecutar desde la RAÍZ del repositorio: node scripts/aplicar-sqlite.mjs
 */
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.cwd();
const serverFile=path.join(root,'server.mjs');
const pkgFile=path.join(root,'package.json');
const gitignore=path.join(root,'.gitignore');
const read=async p=>fs.readFile(p,'utf8');
const appendMissing=(s,line)=>s.split(/\r?\n/).some(x=>x.trim()===line)?s:s.trimEnd()+'\n'+line+'\n';
const checkedReplace=(s,oldText,newText,desc)=>{
  const count=s.split(oldText).length-1;
  if(count!==1)throw new Error(`No se reconoce ${desc} en server.mjs (coincidencias=${count}). No se cambió el servidor.`);
  return s.replace(oldText,newText);
};
function transform(src){
  // PowerShell/Git para Windows deja a menudo server.mjs con CRLF.
  // Normalizamos SOLO para reconocer patrones; luego restauramos el fin de línea.
  // Así el parche funciona en Linux (LF), Windows (CRLF) y entradas mixtas.
  if(src.includes("from './db/sqlite-store.mjs'"))return {content:src,changed:false};
  const originalEol=src.includes('\r\n')?'\r\n':'\n';
  let s=src.replace(/\r\n?/g,'\n');
  s=checkedReplace(s,"import {listGeminiModels,transcribeQuechua} from './gemini-api.mjs';",
    "import {listGeminiModels,transcribeQuechua} from './gemini-api.mjs';\nimport {createSqliteStore} from './db/sqlite-store.mjs';",'importación del servidor');
  const pStart=s.indexOf('let profiles={};');
  const pEnd=s.indexOf('if(!cases.length){',pStart);
  if(pStart<0||pEnd<0||pEnd-pStart>1200)throw Error('Estructura de inicialización distinta: se detiene para evitar perder datos.');
  s=s.slice(0,pStart)+`// SQLite por defecto. Las pruebas legadas que definen STORAGE_FILE/PROFILES_FILE siguen en JSON.\n// Para migrar, deja ambas variables comentadas en .env. Nunca importes claves ni datos reales.\nconst sqliteEnabled=!process.env.STORAGE_FILE&&!process.env.PROFILES_FILE;\nconst sqliteStore=sqliteEnabled?await createSqliteStore({\n dbFile:path.resolve(root,process.env.SQLITE_FILE||'data/triagevoz.db'),\n legacyCasesFile:storage,legacyProfilesFile:profilesFile\n}):null;\nlet profiles=sqliteStore?sqliteStore.readProfiles():{};\nif(!sqliteStore)try{const p=JSON.parse(await fs.readFile(profilesFile,'utf8'));if(p&&typeof p==='object'&&!Array.isArray(p))profiles=p;}catch{}\nlet cases=sqliteStore?sqliteStore.readCases():[];\nif(!sqliteStore)try{const r=JSON.parse(await fs.readFile(storage,'utf8'));if(Array.isArray(r))cases=r;}catch{}\n`+s.slice(pEnd);
  s=checkedReplace(s,'const mime={',"// Si el catálogo ficticio inicial se cargó, también persistirlo en SQLite.\nif(sqliteStore&&cases.length)sqliteStore.saveCases(cases);\nconst mime={",'registro del catálogo inicial');
  s=checkedReplace(s,'function save(){\n  const snapshot=',
    'function save(){\n  if(sqliteStore){sqliteStore.saveCases(cases);return Promise.resolve();}\n  const snapshot=',
    'persistencia de casos');
  const profileOld=`  profiles[id]=allowed;\n  await fs.mkdir(path.dirname(profilesFile),{recursive:true});\n  const temp=profilesFile+'.'+crypto.randomUUID()+'.tmp';\n  await fs.writeFile(temp,JSON.stringify(profiles,null,2),{mode:0o600});await fs.rename(temp,profilesFile);`;
  const profileNew=`  profiles[id]=allowed;\n  if(sqliteStore){sqliteStore.saveProfile(id,allowed);}\n  else{\n   await fs.mkdir(path.dirname(profilesFile),{recursive:true});\n   const temp=profilesFile+'.'+crypto.randomUUID()+'.tmp';\n   await fs.writeFile(temp,JSON.stringify(profiles,null,2),{mode:0o600});await fs.rename(temp,profilesFile);\n  }`;
  s=checkedReplace(s,profileOld,profileNew,'persistencia de perfiles');
  s=checkedReplace(s,"model:process.env.GEMINI_API_KEY?'remoto-configurado':'simulacion'", 
    "model:process.env.GEMINI_API_KEY?'remoto-configurado':'simulacion',storage:sqliteStore?'sqlite':'json'",'endpoint de salud');
  if(originalEol==='\r\n')s=s.replace(/\n/g,'\r\n');
  return {content:s,changed:true};
}

async function apply(){
  const v=process.versions.node.split('.').map(Number);
  if(v[0]<22||(v[0]===22&&v[1]<13))throw Error('Requiere Node.js 22.13+ para SQLite. Versión: '+process.versions.node);
  await fs.access(path.join(root,'db','sqlite-store.mjs'));
  const original=await read(serverFile);
  const next=transform(original);
  if(next.changed){
    const backup=serverFile+'.pre-sqlite.bak';
    try{await fs.access(backup);throw Error('Ya existe '+path.basename(backup)+'. Guárdalo antes de ejecutar de nuevo.');}catch(e){if(e.code!=='ENOENT')throw e;}
    await fs.writeFile(backup,original,{flag:'wx'});
    const temp=serverFile+'.sqlite.tmp';
    await fs.writeFile(temp,next.content);
    await fs.rename(temp,serverFile);
    console.log('Servidor actualizado; copia anterior: '+path.basename(backup));
  }else console.log('Servidor ya integrado con SQLite; no se alteró.');
  const pkg=JSON.parse(await read(pkgFile));
  pkg.engines={...pkg.engines,node:'>=22.13.0'};
  pkg.scripts={...pkg.scripts,'db:check':'node scripts/inspeccionar-sqlite.mjs'};
  await fs.writeFile(pkgFile,JSON.stringify(pkg,null,2)+'\n');
  let gi=await read(gitignore);
  for(const line of ['data/*.db','data/*.db-*','data/*.sqlite','data/*.sqlite-*','server.mjs.pre-sqlite.bak','server.mjs.sqlite.tmp'])gi=appendMissing(gi,line);
  await fs.writeFile(gitignore,gi);
  const envFile=path.join(root,'.env.example');
  let env=await read(envFile);
  if(!env.includes('SQLITE_FILE='))env+='\n# SQLite por defecto desde Node 22.13+. No coloques STORAGE_FILE/PROFILES_FILE para usar SQLite.\n# SQLITE_FILE=data/triagevoz.db\n';
  await fs.writeFile(envFile,env);
  console.log('Archivos actualizados: server.mjs, package.json, .gitignore, .env.example');
  console.log('Siguiente: node --check server.mjs && npm test && node server.mjs');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){apply().catch(e=>{console.error('[ERROR] '+e.message);process.exitCode=1});}
export {transform};
