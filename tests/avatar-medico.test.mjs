import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Avatar médico habla únicamente con reproducción de voz y respeta movimiento reducido',async()=>{
 const [js,css]=await Promise.all([
  fs.readFile(new URL('../public/vui.js',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
 ]);
 assert.match(js,/Dra\. TriageVoz/);
 assert.match(js,/function setAvatarState\(state\)/);
 assert.match(js,/audio\.onplaying=\(\)=>setAvatarState\('speaking'\)/);
 assert.match(js,/utterance\.onstart=\(\)=>setAvatarState\('speaking'\)/);
 assert.match(js,/function disableVoice\(\).*setAvatarState\('idle'\)/);
 assert.match(css,/doctor-avatar\[data-state="speaking"\]/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
