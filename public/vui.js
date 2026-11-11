// Voz continua por turnos: VAD en navegador, transcripción servidor, intents/LLM y TTS.
// Una única PWA y un único servidor HTTP. No hay transcripción de micrófono persistente.
const el=id=>document.getElementById(id);
let session='',slots={},busy=false,voiceEnabled=false,micStream=null,ctx=null,recorder=null,monitor=null,source=null,playing=null;
const messages=el('vuiMessages');
// Avatar vectorial local: movimiento de boca sincronizado con el estado real de reproducción.
const avatar=document.createElement('div');avatar.className='doctor-avatar';avatar.dataset.state='idle';
avatar.setAttribute('aria-label','Avatar de la asistente médica virtual');
avatar.innerHTML=`<div class="doctor-avatar-art" aria-hidden="true"><svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg"><circle cx="75" cy="75" r="70" fill="#dff3f5"/><path d="M25 137 Q31 102 59 100 L91 100 Q119 102 125 137Z" fill="#fff" stroke="#36758b" stroke-width="2"/><path d="M61 98L75 119L89 98" fill="#f1b88d"/><path d="M65 108L75 122L85 108L81 137L69 137Z" fill="#11788c"/><path d="M50 111L41 137M100 111L109 137" stroke="#98bfca" stroke-width="3" fill="none"/><path d="M101 114 Q118 124 104 135 Q91 141 83 125" fill="none" stroke="#376579" stroke-width="3"/><circle cx="83" cy="125" r="5" fill="#e4edf1" stroke="#376579" stroke-width="2"/><ellipse cx="75" cy="67" rx="36" ry="40" fill="#f3c69e"/><path d="M39 63Q34 21 75 24Q115 20 112 66Q104 53 94 43Q67 57 40 52Z" fill="#263f53"/><path d="M50 71Q57 66 64 71M86 71Q93 66 100 71" stroke="#263f53" stroke-width="3" stroke-linecap="round" fill="none"/><circle cx="58" cy="72" r="2" fill="#263f53"/><circle cx="92" cy="72" r="2" fill="#263f53"/><path d="M74 75L70 87L77 88" stroke="#bf8a6d" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse class="doctor-avatar-mouth" cx="76" cy="95" rx="9" ry="2.5" fill="#914b53"/><path d="M43 28H106" stroke="#fff" stroke-width="8"/><path d="M44 28Q75 13 106 28" fill="none" stroke="#e5f3f4" stroke-width="5"/><rect x="69" y="17" width="13" height="21" rx="2" fill="#fff"/><rect x="65" y="21" width="21" height="13" rx="2" fill="#fff"/><path d="M72 20V35M66 27H85" stroke="#15859a" stroke-width="3"/></svg></div><div class="doctor-avatar-copy"><strong>Dra. TriageVoz</strong><span>Asistente médica virtual</span><span class="doctor-avatar-state" aria-live="polite">En espera</span><div class="doctor-avatar-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>`;
document.querySelector('.integrated-vui .vui-heading').after(avatar);
function setAvatarState(state){avatar.dataset.state=state;avatar.querySelector('.doctor-avatar-state').textContent=({idle:'En espera',listening:'Te escucho',thinking:'Preparando respuesta',speaking:'Hablando'})[state]||'En espera'}
const voiceFinish=document.createElement('button');voiceFinish.type='button';voiceFinish.className='vui-finish';voiceFinish.textContent='Culminar triaje';voiceFinish.hidden=true;
document.querySelector('.integrated-vui').append(voiceFinish);
voiceFinish.onclick=()=>{disableVoice();window.triageNavigate?.('welcome')};
const voiceReceipt=document.createElement('div');voiceReceipt.className='voice-receipt';voiceReceipt.hidden=true;voiceReceipt.setAttribute('role','status');
voiceFinish.before(voiceReceipt);
let voiceRegion='';
const voiceLayout=document.createElement('div');voiceLayout.className='vui-layout';
messages.parentElement.insertBefore(voiceLayout,messages);voiceLayout.append(messages);
const anatomy=document.createElement('section');anatomy.className='voice-anatomy';anatomy.setAttribute('aria-label','Ubicación de la molestia');
anatomy.innerHTML='<h3>¿Dónde sientes la molestia?</h3><p>Al mencionarla, la marcaré aquí. También puedes tocar la zona para corregirla.</p><div class="anatomy-switch"><button type="button" data-view="front" class="active">Frente</button><button type="button" data-view="back">Espalda</button></div><div id="voiceBodyMap"></div><strong id="voiceRegionLabel" role="status">Zona sin indicar</strong>';
voiceLayout.append(anatomy);
const voiceBody=anatomy.querySelector('#voiceBodyMap');
const drawings={front:el('frontView')?.querySelector('svg')?.cloneNode(true),back:el('backView')?.querySelector('svg')?.cloneNode(true)};
let bodyView='front';
function normalize(text){return String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function zoneFromSpeech(text){
 const t=normalize(text);
 const patterns=[['Cabeza',/cabeza|frente|umay|uma nanay/],['Tórax',/pecho|torax|sunqu/],['Abdomen',/abdomen|vientre|barriga|estomago|wiksa|wiksay/],['Espalda alta',/espalda|wasa/],['Nuca',/nuca|cuello|kunka/],['Brazo derecho',/brazo derecho|maki paña/],['Brazo izquierdo',/brazo izquierdo|maki lluq/],['Pierna derecha',/pierna derecha|chaki paña/],['Pierna izquierda',/pierna izquierda|chaki lluq/]];
 return patterns.find(([,p])=>p.test(t))?.[0]||'';
}
function paintBody(){
 voiceBody.replaceChildren();const draw=drawings[bodyView]?.cloneNode(true);if(!draw)return;
 draw.setAttribute('role','group');draw.setAttribute('aria-label',bodyView==='front'?'Silueta frontal':'Silueta posterior');
 draw.querySelectorAll('[data-zone]').forEach(zone=>{
  const selected=zone.dataset.zone===voiceRegion;
  zone.classList.toggle('voice-zone-selected',selected);
  zone.onclick=()=>selectRegion(zone.dataset.zone);
  zone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectRegion(zone.dataset.zone)}};
 });
 voiceBody.append(draw);anatomy.querySelector('#voiceRegionLabel').textContent=voiceRegion?'Zona marcada: '+voiceRegion:'Zona sin indicar';
 anatomy.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===bodyView));
}
function selectRegion(zone){voiceRegion=zone;bodyView=/Espalda|Nuca|Glúteo/.test(zone)?'back':'front';paintBody()}
anatomy.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{bodyView=b.dataset.view;paintBody()});
window.triageVoiceVisualUpdate=updated=>{if(!voiceRegion){const candidate=zoneFromSpeech(updated?.motivo);if(candidate)selectRegion(candidate)}};
paintBody();
// Presentación inicial sencilla: conversación primero, formulario táctil bajo demanda.
document.body.classList.add('form-hidden');
const manual=document.createElement('button');manual.type='button';manual.className='vui-manual';manual.textContent='Usar formulario y silueta corporal';
manual.onclick=()=>{document.body.classList.remove('form-hidden');window.triageNavigate?.('form');el('p0').scrollIntoView({behavior:'smooth',block:'start'})};
document.querySelector('.integrated-vui').append(manual);
function status(s){el('vuiStatus').textContent=s;if(s==='Escuchando')setAvatarState('listening');else if(['Procesando','Transcribiendo','Iniciando'].includes(s))setAvatarState('thinking');else if(s!=='Respondiendo por voz')setAvatarState('idle')}
function notice(s){el('vuiNotice').textContent=s}
async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo completar la solicitud');return data}
function append(role,text){messages.querySelector('.vui-empty')?.remove();const div=document.createElement('div');div.className='vui-bubble '+(role==='patient'?'from-patient':'from-assistant');const small=document.createElement('small');small.textContent=role==='patient'?'Tú':'TriageVoz';const p=document.createElement('p');p.textContent=text;div.append(small,p);messages.append(div);messages.scrollTop=messages.scrollHeight}
function lang(){return el('language').value==='qu'?'qu':'es'}
function persona(){return el('persona').value}
function renderResult(data){session=data.session;slots=data.slots||{};window.triageVoiceVisualUpdate(slots);append('assistant',data.reply);el('vuiProgress').textContent=`Pregunta ${Math.min(data.index+1,4)} de 4 · ${data.mode}`;el('vuiApply').disabled=!Object.keys(slots).length;voiceFinish.hidden=!data.caseCode;if(data.caseCode){voiceReceipt.hidden=false;voiceReceipt.replaceChildren();const label=document.createElement('p');label.textContent='Caso registrado. Guarda este código para consultar la respuesta médica:';const strong=document.createElement('strong');strong.textContent=data.caseCode;const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar código';copy.onclick=()=>navigator.clipboard?.writeText(data.caseCode);const review=document.createElement('button');review.type='button';review.textContent='Consultar mi caso';review.onclick=()=>window.triageNavigate?.('review',data.caseCode);voiceReceipt.append(label,strong,copy,review);notice('Tu entrevista fue confirmada y guardada. La IA te comunica el código en voz si está activada.');disableVoiceAfterReply=true;}else if(data.route==='confirmacion')notice('No se pudo verificar el registro; intenta nuevamente.');if(data.ended){voiceEnabled=false;el('vuiMic').textContent='🎙 Activar voz';status('Entrevista detenida')}else status('Esperando respuesta')}
let disableVoiceAfterReply=false;
async function start(){
  if(busy)return;busy=true;status('Iniciando');messages.replaceChildren();
  voiceFinish.hidden=true;
  voiceReceipt.hidden=true;disableVoiceAfterReply=false;
  voiceRegion='';paintBody();
  try{const data=await post('/api/assistant/start',{lang:lang(),persona:persona()});renderResult(data);el('vuiMic').disabled=false;el('vuiSend').disabled=false;await speak(data.reply)}
  catch(e){status('Error');notice(e.message)}finally{busy=false}
}
async function send(value){
  const text=String(value||'').trim();if(!text||busy||!session)return;
  busy=true;stopRecording();el('vuiSend').disabled=true;append('patient',text);el('vuiInput').value='';status('Procesando');
  try{const data=await post('/api/assistant/reply',{session,text,lang:lang(),persona:persona(),provider:el('vuiProvider').value,consent:true,region:voiceRegion});renderResult(data);await speak(data.reply);if(disableVoiceAfterReply){disableVoice();disableVoiceAfterReply=false}}
  catch(e){notice(e.message);status('Error')}
  finally{busy=false;el('vuiSend').disabled=false;if(voiceEnabled)listen()}
}
async function speak(text){
  if(!voiceEnabled&&!el('speak').checked)return;
  status('Respondiendo por voz');
  if(lang()==='qu'){
    try{
      const data=await post('/api/assistant/speak',{text});
      if(data.error)throw Error(data.error);
      await new Promise((resolve,reject)=>{const audio=new Audio('data:audio/wav;base64,'+data.audio);playing=audio;audio.onplaying=()=>setAvatarState('speaking');audio.onended=resolve;audio.onerror=()=>reject(Error('Audio no reproducible'));audio.play().catch(reject)});
      notice('Voz quechua experimental: comprueba la pronunciación con una persona quechuahablante.');
    }catch(e){notice('La voz quechua no está disponible: '+e.message+' Puedes continuar por texto.');}
    finally{playing=null;setAvatarState(voiceEnabled?'listening':'idle')}
    return;
  }
  if(!('speechSynthesis'in window)){notice('El navegador no ofrece lectura por voz.');return}
  await new Promise(resolve=>{const utterance=new SpeechSynthesisUtterance(text);utterance.lang='es-PE';utterance.rate=persona()==='breve'?1.07:0.89;utterance.onstart=()=>setAvatarState('speaking');utterance.onend=resolve;utterance.onerror=resolve;speechSynthesis.cancel();speechSynthesis.speak(utterance);setTimeout(resolve,22000)});
  setAvatarState('idle');
}
function stopRecording(){
  if(monitor)cancelAnimationFrame(monitor);monitor=null;
  if(recorder?.state==='recording')recorder.stop();recorder=null;
  try{source?.disconnect()}catch{}source=null;
}
async function enableVoice(){
  try{
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Este navegador no permite capturar audio.');
    micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();
    voiceEnabled=true;el('vuiMic').textContent='■ Detener voz';notice('Micrófono activo: habla normalmente; el envío es automático al terminar cada turno.');
    if(!busy)listen();
  }catch(e){voiceEnabled=false;notice('No se pudo activar el micrófono: '+e.message)}
}
function disableVoice(){voiceEnabled=false;stopRecording();playing?.pause();window.speechSynthesis?.cancel();micStream?.getTracks().forEach(t=>t.stop());micStream=null;ctx?.close();ctx=null;el('vuiMic').textContent='🎙 Activar voz';status('Modo texto');setAvatarState('idle')}
function listen(){
 if(!voiceEnabled||busy||!micStream||recorder?.state==='recording')return;
 const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';
 const parts=[];let heard=false,silentSince=0,started=performance.now();
 recorder=new MediaRecorder(micStream,mime?{mimeType:mime}:{});
 source=ctx.createMediaStreamSource(micStream);const analyser=ctx.createAnalyser();analyser.fftSize=2048;source.connect(analyser);
 const signal=new Float32Array(analyser.fftSize);const current=recorder;
 current.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
 current.onstop=async()=>{
   if(!voiceEnabled||!heard||!parts.length){if(voiceEnabled&&!busy)setTimeout(listen,300);return}
   status('Transcribiendo');busy=true;
   try{
     const blob=new Blob(parts,{type:current.mimeType||'audio/webm'});
     const audio=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result).split(',')[1]);rd.onerror=reject;rd.readAsDataURL(blob)});
     const data=await post('/api/assistant/transcribe',{audio,mime:blob.type,lang:lang()});
     if(data.error)throw Error(data.error);
     if(!data.text?.trim())throw Error('No se reconocieron palabras.');
     el('vuiInput').value=data.text;
   }catch(e){disableVoice();notice('Transcripción detenida: '+e.message+' Puedes escribir o volver a activar la voz después de corregir la configuración.');status('Puedes escribir');busy=false;return}
   busy=false;send(el('vuiInput').value);
 };
 current.start(250);status('Escuchando');
 function frame(){
   if(current.state!=='recording'||!voiceEnabled)return;
   analyser.getFloatTimeDomainData(signal);let sum=0;for(const v of signal)sum+=v*v;const rms=Math.sqrt(sum/signal.length);
   const now=performance.now();if(rms>0.022){heard=true;silentSince=0}
   else if(heard&&!silentSince)silentSince=now;
   if((heard&&silentSince&&now-silentSince>1150&&now-started>900)||now-started>14000){stopRecording();return}
   monitor=requestAnimationFrame(frame);
 }
 monitor=requestAnimationFrame(frame);
}
el('vuiStart').onclick=async()=>{disableVoice();await start()};
el('vuiSend').onclick=()=>send(el('vuiInput').value);
el('vuiInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send(el('vuiInput').value)}});
el('vuiMic').onclick=()=>voiceEnabled?disableVoice():enableVoice();
el('vuiApply').onclick=()=>{document.body.classList.remove('form-hidden');window.triageNavigate?.('form');window.triageVozApply?.(slots,voiceRegion);el('p1').scrollIntoView({behavior:'smooth',block:'start'})};
window.triageVoiceStop=()=>{if(voiceEnabled)disableVoice()};
el('language').addEventListener('change',()=>{if(voiceEnabled)disableVoice();session='';el('vuiStart').textContent='Iniciar en '+(lang()==='qu'?'quechua':'español');el('vuiSend').disabled=true;el('vuiMic').disabled=true;notice(lang()==='qu'?'Quechua sureño experimental: requiere Gemini para audio. Texto y respuestas asistidas disponibles; comprueba toda transcripción.':'Español: puedes conversar por voz con Groq configurado o por texto.');});
