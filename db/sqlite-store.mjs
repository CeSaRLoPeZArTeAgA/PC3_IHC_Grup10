/**
 * Persistencia SQLite para TriageVoz Rural PC3 (solo datos de prueba).
 * Node.js >= 22.13: node:sqlite (DatabaseSync); no requiere npm install.
 * Las tablas se crean automáticamente; los JSON antiguos se importan UNA sola vez.
 */
import {DatabaseSync} from 'node:sqlite';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

async function jsonIfExists(file) {
  try {return JSON.parse(await fs.readFile(file, 'utf8'));}
  catch (e) {if(e.code==='ENOENT') return null;throw new Error('No se pudo leer el JSON legado '+file+': '+e.message);}
}

export async function createSqliteStore({dbFile,legacyCasesFile,legacyProfilesFile}) {
  if (!dbFile) throw new Error('Falta dbFile');
  await fs.mkdir(path.dirname(dbFile),{recursive:true});
  const db = new DatabaseSync(dbFile);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cases (
        code TEXT PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        alias TEXT NOT NULL,
        region TEXT NOT NULL DEFAULT '',
        motivo TEXT NOT NULL DEFAULT '',
        inicio TEXT NOT NULL DEFAULT '',
        intensidad TEXT NOT NULL DEFAULT '',
        adicionales TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('enviado','recibido')),
        created_at TEXT NOT NULL,
        ack_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
      CREATE TABLE IF NOT EXISTS case_replies (
        case_code TEXT NOT NULL REFERENCES cases(code) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        author TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(case_code,sequence)
      );
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        language TEXT NOT NULL DEFAULT 'es',
        persona TEXT NOT NULL DEFAULT 'acompanante',
        contrast INTEGER NOT NULL DEFAULT 0,
        large INTEGER NOT NULL DEFAULT 0,
        speak INTEGER NOT NULL DEFAULT 0,
        rhythm TEXT NOT NULL DEFAULT 'normal',
        error_count INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS case_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_code TEXT NOT NULL REFERENCES cases(code) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_case ON case_events(case_code,id);
    `);

    const oldStatus=db.prepare('SELECT status FROM cases WHERE code=?');
    const upsertCase=db.prepare(`INSERT INTO cases
      (code,id,alias,region,motivo,inicio,intensidad,adicionales,summary,priority,status,created_at,ack_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(code) DO UPDATE SET
      alias=excluded.alias,region=excluded.region,motivo=excluded.motivo,
      inicio=excluded.inicio,intensidad=excluded.intensidad,adicionales=excluded.adicionales,
      summary=excluded.summary,priority=excluded.priority,status=excluded.status,ack_at=excluded.ack_at`);
    const getReply=db.prepare('SELECT 1 FROM case_replies WHERE case_code=? AND sequence=?');
    const addReply=db.prepare('INSERT OR IGNORE INTO case_replies(case_code,sequence,author,message,created_at) VALUES(?,?,?,?,?)');
    const addEvent=db.prepare('INSERT INTO case_events(case_code,event_type,created_at) VALUES(?,?,?)');
    const upsertProfile=db.prepare(`INSERT INTO profiles(id,language,persona,contrast,large,speak,rhythm,error_count,payload_json,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      language=excluded.language,persona=excluded.persona,contrast=excluded.contrast,
      large=excluded.large,speak=excluded.speak,rhythm=excluded.rhythm,
      error_count=excluded.error_count,payload_json=excluded.payload_json,updated_at=excluded.updated_at`);
    const now=()=>new Date().toISOString();
    const text=v=>String(v??'');
    const caseWrite=c=>{
      const code=text(c.code).trim();
      if(!code)throw new Error('Caso sin código: no se puede persistir');
      const status=c.status==='recibido'?'recibido':'enviado';
      const previous=oldStatus.get(code);
      const a=c.answers||{};
      const created=text(c.createdAt)||now();
      upsertCase.run(code,text(c.id)||crypto.randomUUID(),text(c.alias),text(c.region),text(a.motivo),text(a.inicio),text(a.intensidad),text(a.adicionales),text(c.summary),text(c.priority),status,created,c.ackAt||null);
      if(!previous)addEvent.run(code,'creado',created);
      else if(previous.status!==status)addEvent.run(code,status==='recibido'?'acuse':'cambio_estado',now());
      for(const [i,r] of (Array.isArray(c.replies)?c.replies:[]).entries()) {
        if(getReply.get(code,i))continue;
        addReply.run(code,i,text(r.author),text(r.message),text(r.createdAt)||now());
        addEvent.run(code,'respuesta',text(r.createdAt)||now());
      }
    };
    const profileWrite=(id,profile)=>{
      if(!/^[a-zA-Z0-9_-]{3,45}$/.test(id))throw new Error('Identificador de perfil inválido');
      const p=profile||{};
      upsertProfile.run(id,text(p.language)||'es',text(p.persona)||'acompanante',Number(!!p.contrast),Number(!!p.large),Number(!!p.speak),text(p.rhythm)||'normal',Math.max(0,Math.trunc(Number(p.errorCount)||0)),JSON.stringify(p),text(p.updatedAt)||now());
    };
    function transaction(write){
      db.exec('BEGIN IMMEDIATE');
      try{const result=write();db.exec('COMMIT');return result;}
      catch(e){db.exec('ROLLBACK');throw e;}
    }
    const readCases=()=>db.prepare('SELECT * FROM cases ORDER BY created_at ASC, rowid ASC').all().map(c=>({
      id:c.id,code:c.code,alias:c.alias,region:c.region,
      answers:{motivo:c.motivo,inicio:c.inicio,intensidad:c.intensidad,adicionales:c.adicionales},
      summary:c.summary,priority:c.priority,status:c.status,createdAt:c.created_at,ackAt:c.ack_at,
      replies:db.prepare('SELECT author,message,created_at FROM case_replies WHERE case_code=? ORDER BY sequence').all(c.code).map(r=>({author:r.author,message:r.message,createdAt:r.created_at}))
    }));
    const readProfiles=()=>Object.fromEntries(db.prepare('SELECT id,payload_json FROM profiles').all().map(p=>[p.id,JSON.parse(p.payload_json)]));
    const saveCases=cases=>transaction(()=>{for(const c of cases)caseWrite(c);});
    const saveProfile=(id,profile)=>transaction(()=>profileWrite(id,profile));
    const stats=()=>({cases:db.prepare('SELECT COUNT(*) n FROM cases').get().n,profiles:db.prepare('SELECT COUNT(*) n FROM profiles').get().n,replies:db.prepare('SELECT COUNT(*) n FROM case_replies').get().n,events:db.prepare('SELECT COUNT(*) n FROM case_events').get().n});

    // Se importa UNA VEZ, sin borrar los JSON legados y sin sobrescribir datos SQLite.
    if(!db.prepare("SELECT value FROM schema_meta WHERE key='migration_v1_complete'").get()) {
      const legacyCases=await jsonIfExists(legacyCasesFile);
      const legacyProfiles=await jsonIfExists(legacyProfilesFile);
      if(legacyCases!==null&&!Array.isArray(legacyCases))throw new Error('runtime.json debe ser una lista de casos');
      if(legacyProfiles!==null&&(!legacyProfiles||Array.isArray(legacyProfiles)||typeof legacyProfiles!=='object'))throw new Error('profiles.json debe ser un objeto');
      transaction(()=>{
        if(db.prepare('SELECT COUNT(*) n FROM cases').get().n===0)
          for(const c of legacyCases||[])caseWrite(c);
        if(db.prepare('SELECT COUNT(*) n FROM profiles').get().n===0)
          for(const [id,p] of Object.entries(legacyProfiles||{}))profileWrite(id,p);
        db.prepare('INSERT INTO schema_meta(key,value) VALUES(?,?)').run('migration_v1_complete',now());
      });
    }
    return {readCases,readProfiles,saveCases,saveProfile,stats,close:()=>db.close(),dbFile};
  }catch(e){db.close();throw e;}
}
