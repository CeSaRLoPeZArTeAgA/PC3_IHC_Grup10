import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Solo la bienvenida habilita el acceso al rol médico y las pantallas no se superponen',async()=>{
 const [html,nav,app,css]=await Promise.all([
  fs.readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/navigation.js',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  fs.readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
 ]);
 assert.match(html,/<nav hidden aria-hidden="true">/);
 assert.doesNotMatch(html,/Personal de salud \(demo\)/);
 assert.match(css,/header nav\{display:none!important\}/);
 assert.match(nav,/get\('doctor'\)\.hidden=next!=='doctor'/);
 assert.match(nav,/get\('entryDoctor'\)\.onclick=\(\)=>render\('doctor'\)/);
 assert.doesNotMatch(nav,/get\('doctorTab'\)\.click\(\)/);
 assert.doesNotMatch(app,/\$\('doctorTab'\)\.onclick=/);
});
