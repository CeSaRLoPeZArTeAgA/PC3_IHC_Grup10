#!/usr/bin/env node
/**
 * tools/prompt.mjs — Tarea 1 (Lec-LAB 11): imprime el prompt de personalidad y un diálogo de ejemplo.
 * TriageVoz Rural PC3 · CC451 IHC · Grupo 10
 *
 * Uso:
 *   npm run prompt                                   · los tres presets (prompt + diálogo local)
 *   npm run prompt -- --preset=tecnico
 *   npm run prompt -- --target=caso --preset=acompanante --region=Abdomen
 *   npm run prompt -- --amabilidad=3 --formalidad=9 --humor=0 --entusiasmo=2 --empatia=1 --paciencia=4
 * Opciones:
 *   --target=vui|caso   prompt del asistente del paciente (defecto) o del borrador del rol médico
 *   --preset=KEY        tecnico | profesional | acompanante
 *   --region=TEXTO      zona del caso cuando --target=caso (defecto: Abdomen)
 *   --json              salida JSON
 */
import {AXES,PERSONALITY_PRESETS,normalizePersonality,buildCaseReplyPrompt,localCaseReply,localGreeting,localTurn} from '../public/personality.js';
import {assistantSystemPrompt} from '../assistant.mjs';

const args={target:'vui',region:'Abdomen',json:false,axis:{}};
for(const raw of process.argv.slice(2)){
  const m=/^--([a-z]+)(?:=(.*))?$/.exec(raw);if(!m)continue;
  const [,k,v]=m;
  if(k==='json')args.json=true;else if(['target','preset','region'].includes(k))args[k]=v;
  else if(AXES.includes(k))args.axis[k]=v;
}
const PATIENT=['Siento un dolor tipo cólico en el abdomen desde ayer.','Desde ayer por la tarde.','Moderada, va y viene.','Solo náuseas leves.'];
const fakeCase=region=>({region,answers:{motivo:'Dolor abdominal tipo cólico',inicio:'Ayer por la tarde',intensidad:'Moderada, 6 de 10',adicionales:'Náuseas leves'},summary:`Zona: ${region}. Motivo: Dolor abdominal tipo cólico.`});

function dialogue(p){
  const lines=['Asistente: '+localGreeting(p)];
  PATIENT.forEach((u,i)=>{lines.push('Paciente:  '+u);if(i<3)lines.push('Asistente: '+localTurn(p,i+1))});
  return lines.join('\n');
}
function render(name,p){
  const c=fakeCase(args.region);
  const prompt=args.target==='caso'?buildCaseReplyPrompt(p,c):assistantSystemPrompt(p);
  const sample=args.target==='caso'?localCaseReply(p,c):dialogue(p);
  if(args.json)return {preset:name,objetivo:args.target,personality:p,prompt,ejemplo:sample};
  const values=AXES.map(k=>`${k} ${p[k]}`).join(' · ');
  return [`══ ${name} (${values})`,'',prompt,'',args.target==='caso'?'── Borrador local (sin clave de API)':'── Diálogo local (sin clave de API)','',sample].join('\n');
}
const targets=args.preset?[[args.preset,normalizePersonality(args.axis,args.preset)]]
  :Object.keys(args.axis).length?[['personalizada',normalizePersonality(args.axis,'profesional')]]
  :Object.keys(PERSONALITY_PRESETS).map(k=>[k,normalizePersonality(null,k)]);
const out=targets.map(([n,p])=>render(n,p));
process.stdout.write(args.json?JSON.stringify(out,null,2)+'\n':out.join('\n\n')+'\n');


