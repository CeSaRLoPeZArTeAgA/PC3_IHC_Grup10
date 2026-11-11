const $=id=>document.getElementById(id);
const keys=['motivo','inicio','intensidad','adicionales'];
const questions=[
['¿Qué molestia sientes?','Cuéntanos qué sientes, con tus propias palabras.'],
['¿Cuándo comenzó la molestia?','¿Hace cuánto tiempo empezó?'],
['¿Qué intensidad tiene la molestia?','¿Es leve, moderada o muy fuerte? Es una percepción personal.'],
['¿Notas alguna otra molestia?','¿Hay algo más que quieras contar? Si no, escribe "no".']];
let session={alias:'Paciente de prueba',region:'',answers:{motivo:'',inicio:'',intensidad:'',adicionales:''},summary:'',priority:''},question=0,step=0,sent=null;
const zones=['Cabeza','Tórax','Abdomen','Espalda alta','Espalda baja (lumbar)','Nuca','Glúteos','Brazo izquierdo','Brazo derecho','Pierna izquierda','Pierna derecha','Otra zona'];
let currentView='front';
function switchView(view,auto=false){
currentView=view;
const isFront=view==='front';
if($('tabFront'))$('tabFront').classList.toggle('active',isFront);
if($('tabBack'))$('tabBack').classList.toggle('active',!isFront);
if($('tabFront'))$('tabFront').setAttribute('aria-selected',isFront?'true':'false');
if($('tabBack'))$('tabBack').setAttribute('aria-selected',!isFront?'true':'false');
if($('frontView'))$('frontView').hidden=!isFront;
if($('backView'))$('backView').hidden=isFront;
if($('viewHint'))$('viewHint').textContent=(isFront?'Vista anterior (frente)':'Vista posterior (espalda)')+' · Toca una zona';
if(!auto)msg(isFront?'Mostrando vista frontal del cuerpo':'Mostrando vista posterior, espalda');
}
if($('tabFront'))$('tabFront').onclick=()=>switchView('front');
if($('tabBack'))$('tabBack').onclick=()=>switchView('back');
// Personalización continua: persistencia de preferencias, ritmo (>10s) y errores (umbral >=2)
let userProfile={
  language:'es',
  contrast:false,
  large:false,
  speak:false,
  rhythm:'normal',
  avgTimePerQuestion:0,
  questionTimes:[],
  errorCount:0,
  proactiveOffered:false
};

function saveProfile(){
  userProfile.language=$('language').value;
  userProfile.contrast=$('contrast').checked;
  userProfile.large=$('large').checked;
  userProfile.speak=$('speak').checked;
  document.body.classList.toggle('high',userProfile.contrast);
  document.body.classList.toggle('large',userProfile.large);
  localStorage.setItem('triagevoz_user_profile',JSON.stringify(userProfile));
  localStorage.setItem('triagevoz_prefs_demo',JSON.stringify({
    language:userProfile.language,
    contrast:userProfile.contrast,
    large:userProfile.large,
    speak:userProfile.speak
  }));
  updateProfileUI();
  scheduleRemoteProfileSave();
}
let profileTimer,profileReady=false;
function profileKey(){return ($('profileId')?.value||'').trim()}
function scheduleRemoteProfileSave(){
  if(!profileReady)return;
  clearTimeout(profileTimer);
  profileTimer=setTimeout(async()=>{
    if(!/^[a-zA-Z0-9_-]{3,45}$/.test(profileKey()))return;
    try{await fetch('/api/profiles',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({id:profileKey(),profile:{...userProfile,persona:$('persona').value}})});$('profileState').textContent='Preferencias guardadas en servidor'}catch{$('profileState').textContent='Preferencias locales; servidor no disponible'}
  },700);
}
async function loadRemoteProfile(){
  if(!/^[a-zA-Z0-9_-]{3,45}$/.test(profileKey())){$('profileState').textContent='Usa 3–45 letras, números, guiones o _';return}
  try{const r=await fetch('/api/profiles?id='+encodeURIComponent(profileKey()));const data=await r.json();if(!r.ok)throw Error();profileReady=true;if(data.profile){userProfile={...userProfile,...data.profile};$('language').value=userProfile.language||'es';$('contrast').checked=!!userProfile.contrast;$('large').checked=!!userProfile.large;$('speak').checked=!!userProfile.speak;$('persona').value=data.profile.persona||'calida';saveProfile();$('profileState').textContent='Perfil recuperado'}else{saveProfile();$('profileState').textContent='Perfil nuevo creado'}}catch{$('profileState').textContent='No se pudo cargar el perfil'}
}
$('loadProfile').onclick=loadRemoteProfile;
$('profileId').addEventListener('input',()=>{profileReady=false;$('profileState').textContent='Pulsa Cargar perfil'});
$('persona').addEventListener('change',saveProfile);

function updateProfileUI(){
  const rEl=$('profRhythm'),eEl=$('profErrors'),aEl=$('profAdaptation');
  if(rEl)rEl.textContent=userProfile.rhythm==='pausado'?'Ritmo: Pausado (>10s) · Voz lenta':'Ritmo: Normal (≤10s)';
  if(eEl)eEl.textContent='Correcciones: '+userProfile.errorCount;
  if(aEl){
    if(userProfile.errorCount>=2)aEl.textContent='Asistencia adaptativa activada';
    else if(userProfile.rhythm==='pausado')aEl.textContent='Modo paciente activo';
    else aEl.textContent='Modo estándar';
  }
}

try{
  const saved=JSON.parse(localStorage.getItem('triagevoz_user_profile')||localStorage.getItem('triagevoz_prefs_demo')||'{}');
  userProfile={...userProfile,...saved};
  $('language').value=userProfile.language||'es';
  $('contrast').checked=!!userProfile.contrast;
  $('large').checked=!!userProfile.large;
  $('speak').checked=!!userProfile.speak;
}catch{}
saveProfile();

['language','contrast','large','speak'].forEach(k=>$(k).addEventListener('change',saveProfile));

function msg(s){
  if(userProfile.speak&&'speechSynthesis'in window){
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(s);
    u.lang='es-PE';
    // Adaptación del ritmo de habla: si el ritmo detectado es pausado (>10s), hablar más lento
    u.rate=userProfile.rhythm==='pausado'?0.82:1.0;
    speechSynthesis.speak(u);
  }
}

function recordCorrection(reason){
  userProfile.errorCount=(userProfile.errorCount||0)+1;
  saveProfile();
  if(userProfile.errorCount>=2&&!userProfile.proactiveOffered){
    userProfile.proactiveOffered=true;
    const b=$('adaptiveBanner');
    if(b)b.hidden=false;
    msg('Hemos notado varias correcciones. Puedes activar ayudas de lectura o letra más grande.');
  }
}

$('actEnableVoice').onclick=()=>{
  $('speak').checked=true;
  userProfile.speak=true;
  saveProfile();
  $('adaptiveBanner').hidden=true;
  msg('Lectura por voz activada.');
};
$('actLargeText').onclick=()=>{
  $('large').checked=true;
  userProfile.large=true;
  saveProfile();
  $('adaptiveBanner').hidden=true;
};
$('actSimplify').onclick=()=>{
  if(step===3){
    $('questionLabel').textContent=questions[question][1];
    msg(questions[question][1]);
  }
  $('adaptiveBanner').hidden=true;
};
$('actDismiss').onclick=()=>{
  $('adaptiveBanner').hidden=true;
};

let questionStartTime=0,questionTimer=null;

function show(n){
  if(n!==3)clearTimeout(questionTimer);
  step=n;
  for(let i=0;i<6;i++)$('p'+i).hidden=i!==n;
  $('stage').textContent=n===5?'Estado de envío':('Paso '+(Math.min(n+1,5))+' de 5');
  if(n===3)renderQuestion();
  if(n===4)renderReview();
}
function showTab(which){for(const id of ['patient','doctor']){$(id).hidden=id!==which;$(id+'Tab').classList.toggle('active',id===which)}if(which==='doctor')loadRooms()}
function patientTab(active){showTab(active?'patient':'doctor')}
// Los botones heredados se mantienen como referencias internas, sin navegación de roles.
// navigation.js gestiona todas las pantallas exclusivamente desde la bienvenida.
zones.forEach(z=>{const b=document.createElement('button');b.type='button';b.textContent=z;b.onclick=()=>{$('region').value=z;session.region=z;paintZone();msg('Seleccionaste '+z)};$('zones').append(b)});
function paintZone(){
const region=$('region').value.trim();
$('zoneHint').textContent=region?'Región declarada: '+region:'Falta seleccionar una región.';
const lower=region.toLowerCase();
const isBackKeyword=lower.includes('espalda')||lower.includes('lumbar')||lower.includes('nuca')||lower.includes('glúteo')||lower.includes('gluteo')||lower.includes('cintura')||lower.includes('omoplato');
const isFrontKeyword=lower.includes('tórax')||lower.includes('torax')||lower.includes('pecho')||lower.includes('abdomen')||lower.includes('vientre')||lower.includes('barriga');
if(isBackKeyword&&currentView!=='back')switchView('back',true);
else if(isFrontKeyword&&currentView!=='front')switchView('front',true);
Array.from($('zones').children).forEach(b=>{
const bLower=b.textContent.toLowerCase();
const isSel=(bLower===lower)||(lower==='espalda'&&bLower.includes('espalda'));
b.classList.toggle('selected',isSel);
});
document.querySelectorAll('.body-part').forEach(p=>{
const pZone=(p.dataset.zone||'').toLowerCase();
const isSel=(pZone===lower)||(lower==='espalda'&&pZone.includes('espalda'));
p.classList.toggle('selected',isSel);
});
}
$('region').oninput=paintZone;
document.querySelectorAll('.body-part').forEach(part=>{
const select=()=>{const z=part.dataset.zone;if(!z)return;$('region').value=z;session.region=z;paintZone();msg('Seleccionaste '+z)};
part.onclick=select;
part.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}};
});
function dictate(target){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert('Este navegador no dispone de dictado. Puedes escribir sin perder información.');return;}
  let r=new SR();
  r.lang='es-PE';
  r.interimResults=false;
  r.onresult=e=>{
    const transcript=Array.from(e.results).filter(res=>res.isFinal).map(res=>res[0].transcript).join(' ').trim();
    if(!transcript)return;
    target.value=[target.value.trim(),transcript].filter(Boolean).join(' ');
    target.dispatchEvent(new Event('input'));
  };
  r.onerror=()=>{
    recordCorrection('Dictado por voz con error o cancelado');
    alert('El dictado no fue reconocido. Puedes continuar por escrito.');
  };
  try{r.start()}catch{alert('No fue posible iniciar el micrófono. Usa el teclado.')}
}
document.querySelectorAll('[data-saytarget]').forEach(b=>b.onclick=()=>dictate($(b.dataset.saytarget)));
$('begin').onclick=()=>{session.alias=$('alias').value.trim().slice(0,35)||'Paciente de prueba';show(1);msg('Puedes tocar o escribir dónde sientes la molestia.')};
$('zoneNext').onclick=()=>{
  session.region=$('region').value.trim().slice(0,90);
  if(!session.region){
    $('zoneHint').textContent='Indica una zona antes de continuar.';
    recordCorrection('Avanzar sin zona seleccionada');
    return;
  }
  $('confirmRegion').textContent=session.region;
  show(2);
  msg('Has señalado '+session.region+'. ¿Es correcto?');
};
$('regionOk').onclick=()=>{question=0;show(3)};

$('btnCorrectRegion').onclick=()=>{
  recordCorrection('Corrección de región anatómica');
  show(1);
};

document.querySelectorAll('[data-back]').forEach(b=>{
  if(b.id!=='btnCorrectRegion'){
    b.onclick=()=>show(Number(b.dataset.back));
  }
});

function renderQuestion(){
  clearTimeout(questionTimer);
  $('questionCount').textContent='Pregunta '+(question+1)+' de '+questions.length;
  $('questionLabel').textContent=questions[question][0];
  $('answer').value=session.answers[keys[question]]||'';
  $('answerError').textContent='';
  $('rhythmHint').hidden=true;
  $('simplify')?.classList.remove('highlight-pulse');
  msg(questions[question][0]);

  questionStartTime=Date.now();
  // Temporizador de 10 segundos: ritmo pausado detectado si se superan los 10s
  questionTimer=setTimeout(()=>{
    userProfile.rhythm='pausado';
    saveProfile();
    const hint=$('rhythmHint');
    if(hint){
      hint.hidden=false;
      hint.textContent='💡 Has demorado más de 10 segundos. Si lo deseas, pulsa "Explicar más fácil" o usa el micrófono con calma.';
    }
    $('simplify')?.classList.add('highlight-pulse');
    if(userProfile.speak){
      msg('Tómate el tiempo que necesites. Si lo deseas, pulsa explicar más fácil.');
    }
  },10000);
}

function record(){
  const t=$('answer').value.trim();
  if(!t){
    $('answerError').textContent='Por favor, responde o escribe "no".';
    recordCorrection('Respuesta vacía en pregunta');
    return false;
  }
  session.answers[keys[question]]=t.slice(0,700);
  return true;
}

$('qNext').onclick=()=>{
  if(!record())return;
  clearTimeout(questionTimer);
  const elapsed=(Date.now()-questionStartTime)/1000;
  userProfile.questionTimes.push(elapsed);
  const avg=userProfile.questionTimes.reduce((a,b)=>a+b,0)/userProfile.questionTimes.length;
  userProfile.avgTimePerQuestion=Math.round(avg*10)/10;
  if(elapsed>10||avg>10){
    userProfile.rhythm='pausado';
  }
  saveProfile();
  if(question<3){question++;renderQuestion()}else show(4);
};

$('qBack').onclick=()=>{
  clearTimeout(questionTimer);
  recordCorrection('Retroceso en entrevista guiada');
  if($('answer').value.trim())session.answers[keys[question]]=$('answer').value.trim();
  if(question>0){question--;renderQuestion()}else show(2);
};

$('dictate').onclick=()=>dictate($('answer'));
$('repeat').onclick=()=>msg(questions[question][0]);
$('simplify').onclick=()=>{
  $('questionLabel').textContent=questions[question][1];
  msg(questions[question][1]);
  $('simplify')?.classList.remove('highlight-pulse');
};
function details(root,entries){root.replaceChildren();for(const [key,value] of entries){let dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value||'Sin dato';root.append(dt,dd)}}
function renderReview(){details($('review'),[['Paciente',session.alias],['Zona confirmada',session.region],['Molestia',session.answers.motivo],['Inicio',session.answers.inicio],['Intensidad declarada',session.answers.intensidad],['Síntomas adicionales',session.answers.adicionales],['Ritmo de respuesta',userProfile.rhythm==='pausado'?'Pausado (>10s por pregunta)':'Normal (≤10s)'],['Correcciones registradas',userProfile.errorCount]])}
async function api(url,options){const r=await fetch(url,options);let d=await r.json();if(!r.ok)throw Error(d.error||'No fue posible completar la acción');return d}
const jsonPost=(url,data)=>api(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
$('summarize').onclick=async()=>{const b=$('summarize');b.disabled=true;try{const d=await jsonPost('/api/llm',session);session.summary=d.summary;session.priority=d.priority;$('summaryText').textContent=d.summary;$('summaryMode').textContent='Procedencia: '+(d.mode==='gemini'?'LLM remoto':'simulación local')+'. '+(d.warning||d.disclaimer||'');$('result').hidden=false;msg('Ya está disponible el resumen del relato ficticio.')}catch(e){alert(e.message)}finally{b.disabled=false}};
$('edit').onclick=()=>{
  recordCorrection('Regreso a editar entrevista desde el resumen');
  question=0;
  $('result').hidden=true;
  show(3);
};
$('send').onclick=async()=>{
  if(!session.summary)return;
  const button=$('send');
  if(button.disabled)return;
  button.disabled=true;
  try{
    sent=await jsonPost('/api/cases',session);
    localStorage.setItem('triagevoz_ultimo_caso_demo',sent.code);
    localStorage.removeItem('triagevoz_borrador_ficticio');
    $('code').textContent='SALA-'+sent.code;
    $('delivery').textContent='Caso ficticio almacenado en el servidor local.';
    $('receipt').textContent='Estado: enviado. Pendiente de confirmación del rol médico simulado.';
    $('result').hidden=true;show(5);
  }catch(e){
    $('delivery').textContent='Pendiente de envío: '+e.message;
    localStorage.setItem('triagevoz_borrador_ficticio',JSON.stringify(session));
    alert('No fue posible enviar. Se conserva el borrador ficticio en este navegador; no se marcará como recibido.');
  }finally{button.disabled=false}
};
async function refresh(){if(!sent)return;try{sent=await api('/api/cases/by-code?code='+encodeURIComponent(sent.code));$('receipt').textContent=sent.status==='recibido'?'🟢 Estado verificado: El médico remoto se ha unido a la sala y confirmó la recepción.':'🟡 Estado: Sala enviada, pendiente de acuse del médico remoto.';$('doctorResponse').replaceChildren();for(const r of sent.replies){const p=document.createElement('p');p.className='confirm';p.textContent=r.author+': '+r.message;$('doctorResponse').append(p)}}catch(e){$('receipt').textContent='No es posible comprobar recepción: '+e.message}}
$('refresh').onclick=refresh;$('restart').onclick=()=>{localStorage.removeItem('triagevoz_ultimo_caso_demo');session={alias:'Paciente de prueba',region:'',answers:{motivo:'',inicio:'',intensidad:'',adicionales:''},summary:'',priority:''};sent=null;$('region').value='';$('doctorResponse').replaceChildren();$('result').hidden=true;show(0)};
let doctorCase=null;function docRender(c){if(doctorCase&&doctorCase.code!==c.code)$('message').value='';doctorCase=c;window.currentDoctorCase=c;$('caseView').hidden=false;$('caseTitle').textContent='Caso SALA-'+c.code+' · '+c.alias;details($('caseDetails'),[['Zona',c.region],['Relato',c.answers.motivo],['Inicio',c.answers.inicio],['Intensidad',c.answers.intensidad],['Adicionales',c.answers.adicionales],['Resumen generado',c.summary]]);$('caseState').textContent='Estado confirmado por servidor: '+c.status;$('ack').disabled=c.status==='recibido';$('replyState').textContent='Respuestas registradas: '+c.replies.length;
const history=$('replyHistory');
history.replaceChildren();
for(const response of c.replies){
 const item=document.createElement('li');
 const author=document.createElement('strong');
 author.textContent=response.author||'Rol médico simulado';
 const message=document.createElement('p');
 message.textContent=response.message||'';
 item.append(author,message);
 history.append(item);
}
$('replyHistorySection').hidden=c.replies.length===0;
}
async function loadRooms(){
 const listContainer=$('roomList');
 if(!listContainer)return;
 try{
  const rooms=await api('/api/rooms');
  listContainer.replaceChildren();
  if(!rooms.length){
   const empty=document.createElement('p');
   empty.className='helper';
   empty.textContent='No hay casos simulados para mostrar. Al enviar un pre-triaje aparecerá en esta bandeja.';
   listContainer.append(empty);
   return;
  }
  for(const r of rooms){
   const card=document.createElement('button');
   card.type='button';
   card.className='room-card';
   const head=document.createElement('div');
   head.className='room-card-head';
   const alias=document.createElement('span');
   alias.className='room-alias';
   alias.textContent=r.alias||'Paciente de demostración';
   const badge=document.createElement('span');
   badge.className='room-badge '+(r.status==='recibido'?'recibido':'enviado');
   badge.textContent=r.status==='recibido'?'Recibido (acuse registrado)':'Enviado (pendiente de acuse)';
   head.append(alias,badge);
   const details=document.createElement('div');
   details.className='room-details';
   details.textContent='Zona: '+(r.region||'No especificada')+' · '+(r.motivo?r.motivo.slice(0,55):'Pre-triaje general');
   const code=document.createElement('div');
   code.className='room-code';
   code.textContent='Caso SALA-'+r.code+' · '+(r.repliesCount?r.repliesCount+' respuesta(s)':'Sin respuesta');
   card.append(head,details,code);
   card.onclick=()=>{
    $('lookupCode').value=r.code;
    $('lookup').click();
   };
   listContainer.append(card);
  }
 }catch(e){
  listContainer.replaceChildren();
  const err=document.createElement('p');
  err.className='helper';
  err.textContent='Error cargando salas: '+e.message;
  listContainer.append(err);
 }
}
if($('refreshRooms'))$('refreshRooms').onclick=loadRooms;
$('lookup').onclick=async()=>{try{const c=await api('/api/cases/by-code?code='+encodeURIComponent($('lookupCode').value));$('doctorErr').textContent='';docRender(c)}catch(e){$('caseView').hidden=true;$('doctorErr').textContent=e.message}};
$('ack').onclick=async()=>{if(!doctorCase)return;try{docRender(await jsonPost('/api/cases/ack',{code:doctorCase.code}));loadRooms();}catch(e){$('doctorErr').textContent=e.message}};
$('reply').onclick=async()=>{
 if(!doctorCase)return;
 const response=$('message').value.trim();
 if(!response){$('doctorErr').textContent='Escribe una respuesta antes de enviarla.';return;}
 if(doctorCase.replies.at(-1)?.message===response){
  $('replyState').textContent='Esta respuesta ya está registrada. Modifica el texto para enviar otra.';
  return;
 }
 const button=$('reply');button.disabled=true;
 try{
  const saved=await jsonPost('/api/cases/reply',{code:doctorCase.code,message:response});
  docRender(saved);
  loadRooms();
  $('doctorErr').textContent='';
  $('replyState').textContent='Respuesta guardada y visible en el historial. Respuestas registradas: '+saved.replies.length;
 }catch(e){$('doctorErr').textContent=e.message}
 finally{button.disabled=false}
};
// Recuperación del último caso de prueba tras recargar el navegador.
try{
 const previous=localStorage.getItem('triagevoz_ultimo_caso_demo');
 if(previous)api('/api/cases/by-code?code='+encodeURIComponent(previous)).then(c=>{
   if(sent)return;
   sent=c;
   $('code').textContent='SALA-'+c.code;
   $('delivery').textContent='Caso ficticio recuperado del servidor local.';
   show(5);
   refresh();
 }).catch(()=>localStorage.removeItem('triagevoz_ultimo_caso_demo'));
}catch{}
if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}
// El motor conversacional único puede completar el formulario PC2 sin abrir otra página.
window.triageVozApply=(slots,selectedRegion='')=>{
  if(!slots||typeof slots!=='object')return;
  for(const key of keys)if(typeof slots[key]==='string')session.answers[key]=slots[key].slice(0,700);
  session.alias=$('alias').value.trim().slice(0,35)||'Paciente de prueba';
  const motivo=(slots.motivo||'').toLowerCase();
  let zone='';
  if(/cabeza|uma/.test(motivo))zone='Cabeza';
  else if(/pecho|torax|tórax/.test(motivo))zone='Tórax';
  else if(/abdomen|vientre|barriga/.test(motivo))zone='Abdomen';
  else if(/espalda/.test(motivo))zone='Espalda alta';
  zone=selectedRegion||zone;
  if(zone){$('region').value=zone;session.region=zone;paintZone()}
  show(1);
  $('zoneHint').textContent=zone?'Zona sugerida: '+zone+'. Confírmala o corrígela.':'Selecciona la zona corporal y confirma para continuar.';
};
import './vui.js';
import './navigation.js';
// Actualización colaborativa entre dos navegadores/sesiones de demostración.
setInterval(()=>{if(!$('doctor').hidden)loadRooms();if(sent&&!$('patient').hidden)refresh()},6000);
