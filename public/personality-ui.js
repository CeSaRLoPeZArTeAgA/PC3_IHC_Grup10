// Panel reutilizable de personalidad graduable (Tarea 1 · Lec-LAB 11).
// Divulgación progresiva: primero los tres presets; los seis ejes quedan dentro de «Ajustar los rasgos».
import {AXES,AXIS_LABELS,PERSONALITY_PRESETS,normalizePersonality,matchPreset} from './personality.js';

let counter=0;
export function mountPersonalityPanel(host,{title='Personalidad del asistente',hint='',initial,preset='acompanante',onChange}={}){
  const uid='pers'+(++counter);
  let value=normalizePersonality(initial,preset);
  const box=document.createElement('section');box.className='personality-panel';box.setAttribute('aria-label',title);
  const head=document.createElement('div');head.className='personality-head';
  const h=document.createElement('strong');h.textContent=title;
  const badge=document.createElement('span');badge.className='personality-badge';badge.setAttribute('role','status');
  head.append(h,badge);
  const presets=document.createElement('div');presets.className='personality-presets';presets.setAttribute('role','radiogroup');presets.setAttribute('aria-label','Personalidades predefinidas');
  const buttons={};
  for(const [key,p] of Object.entries(PERSONALITY_PRESETS)){
    const b=document.createElement('button');b.type='button';b.dataset.preset=key;b.setAttribute('role','radio');
    const name=document.createElement('span');name.textContent=p.label;
    const desc=document.createElement('small');desc.textContent=p.desc;
    b.append(name,desc);b.onclick=()=>set(PERSONALITY_PRESETS[key]);
    buttons[key]=b;presets.append(b);
  }
  const details=document.createElement('details');details.className='personality-traits';
  const summary=document.createElement('summary');summary.textContent='Ajustar los rasgos (0–10)';
  details.append(summary);
  const sliders={};
  for(const axis of AXES){
    const [label,range]=AXIS_LABELS[axis];
    const row=document.createElement('div');row.className='trait-row';
    const lab=document.createElement('label');lab.htmlFor=uid+'-'+axis;lab.textContent=label;
    const input=document.createElement('input');input.type='range';input.min='0';input.max='10';input.step='1';input.id=uid+'-'+axis;input.dataset.axis=axis;
    const out=document.createElement('output');out.htmlFor=input.id;
    const small=document.createElement('small');small.textContent=range;
    input.oninput=()=>set({...value,[axis]:Number(input.value)});
    row.append(lab,input,out,small);details.append(row);
    sliders[axis]={input,out};
  }
  box.append(head,presets);
  if(hint){const p=document.createElement('p');p.className='helper';p.textContent=hint;box.append(p)}
  box.append(details);
  host.append(box);
  function paint(){
    const key=matchPreset(value);
    badge.textContent=key==='personalizada'?'Personalizada':PERSONALITY_PRESETS[key].label;
    for(const [k,b] of Object.entries(buttons)){const on=k===key;b.classList.toggle('active',on);b.setAttribute('aria-checked',String(on))}
    for(const axis of AXES){sliders[axis].input.value=value[axis];sliders[axis].out.textContent=value[axis]}
  }
  function set(next,{silent=false}={}){value=normalizePersonality(next,preset);paint();if(!silent)onChange?.(get())}
  function get(){return {personality:{...value},preset:matchPreset(value)}}
  paint();
  return {get,set,element:box};
}
