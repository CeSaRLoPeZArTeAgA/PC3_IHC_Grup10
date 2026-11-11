// Voz continua por turnos: VAD en navegador, transcripción servidor, intents/LLM y TTS.
// Una única PWA y un único servidor HTTP. No hay transcripción de micrófono persistente.
const el=id=>document.getElementById(id);
let session='',slots={},busy=false,voiceEnabled=false,micStream=null,ctx=null,recorder=null,monitor=null,source=null,playing=null;
const messages=el('vuiMessages');
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
function status(s){el('vuiStatus').textContent=s}
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
      await new Promise((resolve,reject)=>{const audio=new Audio('data:audio/wav;base64,'+data.audio);playing=audio;audio.onended=resolve;audio.onerror=()=>reject(Error('Audio no reproducible'));audio.play().catch(reject)});
      notice('Voz quechua experimental: comprueba la pronunciación con una persona quechuahablante.');
    }catch(e){notice('La voz quechua no está disponible: '+e.message+' Puedes continuar por texto.');}
    finally{playing=null}
    return;
  }
  if(!('speechSynthesis'in window)){notice('El navegador no ofrece lectura por voz.');return}
  await new Promise(resolve=>{const utterance=new SpeechSynthesisUtterance(text);utterance.lang='es-PE';utterance.rate=persona()==='breve'?1.07:0.89;utterance.onend=resolve;utterance.onerror=resolve;speechSynthesis.cancel();speechSynthesis.speak(utterance);setTimeout(resolve,22000)});
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
function disableVoice(){voiceEnabled=false;stopRecording();playing?.pause();window.speechSynthesis?.cancel();micStream?.getTracks().forEach(t=>t.stop());micStream=null;ctx?.close();ctx=null;el('vuiMic').textContent='🎙 Activar voz';status('Modo texto')}
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
