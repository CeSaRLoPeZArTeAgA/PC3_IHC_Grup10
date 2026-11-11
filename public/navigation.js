// Navegación PC3: bienvenida > opciones > voz/formulario > revisión; personal de salud por separado.
const get=id=>document.getElementById(id);
const main=document.querySelector('main');
const home=document.createElement('section');home.id='welcome';home.className='entry-page';
home.innerHTML=`<div class="entry-symbol" aria-hidden="true">✚</div><p class="eyebrow">UNI · CC451 · PC3</p><h1>TriageVoz Rural</h1><p class="entry-version">Versión PC3 · Pre-triaje en telemedicina rural</p><p class="entry-description">Registra las molestias mediante voz, texto o selección corporal. El profesional de salud revisa el caso.</p><div class="entry-actions"><button id="entryPatient" class="primary" type="button">Soy paciente</button><button id="entryDoctor" type="button">Personal de salud</button></div><button id="entryReview" type="button" class="entry-review">Revisión de diagnóstico · Consultar mi caso</button><p class="entry-footnote">Prototipo académico con casos ficticios. No sustituye una evaluación médica.</p>`;
const choice=document.createElement('section');choice.id='patientOptions';choice.className='entry-page';
choice.innerHTML=`<p class="eyebrow">PASO 1 · PREFERENCIAS</p><h1>¿Cómo deseas comunicarte?</h1><p>Elige el idioma y las ayudas que necesites.</p><div class="choice-settings"><label>Idioma <select id="choiceLanguage"><option value="es">Español</option><option value="qu">Quechua sureño (experimental)</option></select></label><label><input type="checkbox" id="choiceContrast"> Alto contraste</label><label><input type="checkbox" id="choiceLarge"> Texto grande</label><label><input type="checkbox" id="choiceSpeak"> Lectura por voz</label></div><div class="mode-choices"><button id="chooseVoice" type="button"><span class="mode-icon">🎙</span><strong>Asistente de voz</strong><small>Habla y observa la zona del cuerpo en una silueta</small></button><button id="chooseForm" type="button"><span class="mode-icon">👤</span><strong>Formulario táctil</strong><small>Selecciona zonas y responde paso a paso</small></button></div><p class="helper">El modo quechua requiere pruebas de voz; siempre puedes responder por escrito.</p>`;
const review=document.createElement('section');review.id='caseReview';review.className='entry-page';
review.innerHTML='<p class="eyebrow">CONSULTA DE CASO</p><h1>Revisión de diagnóstico</h1><p>Escribe el código generado al confirmar tu triaje de voz o formulario.</p><label for="reviewCode">Código de tu caso</label><input id="reviewCode" maxlength="32" placeholder="SALA-XXXXXXXXXXXX" autocomplete="off"><button type="button" id="reviewSearch" class="primary">Consultar estado</button><p id="reviewStatus" role="status" aria-live="polite"></p><section id="reviewResponse" hidden><h2>Respuesta del personal de salud</h2><div id="reviewReplies"></div></section><p class="entry-footnote">La información proviene de una demostración académica; no constituye un diagnóstico médico verificado.</p>';
main.prepend(review);main.prepend(choice);main.prepend(home);
const back=document.createElement('button');back.id='globalBack';back.type='button';back.className='global-back';back.textContent='← Regresar';main.prepend(back);
const caseFinish=document.createElement('button');caseFinish.id='caseFinish';caseFinish.type='button';caseFinish.className='case-finish';caseFinish.textContent='Culminar triaje';
get('p5').append(caseFinish);
caseFinish.onclick=()=>{get('restart').click();render('welcome')};
let page='welcome';
function syncToChoice(){
 get('choiceLanguage').value=get('language').value;
 get('choiceContrast').checked=get('contrast').checked;
 get('choiceLarge').checked=get('large').checked;
 get('choiceSpeak').checked=get('speak').checked;
}
function render(next,code=''){
 if(page==='voice'&&next!=='voice')window.triageVoiceStop?.();
 page=next;document.body.dataset.screen=next;
 home.hidden=next!=='welcome';choice.hidden=next!=='options';review.hidden=next!=='review';
 get('globalBack').hidden=next==='welcome';
 // Navegación exclusiva: la consulta nunca comparte pantalla con la bandeja médica.
 get('patient').hidden=!['voice','form'].includes(next);
 get('doctor').hidden=next!=='doctor';
 if(next==='doctor')get('refreshRooms')?.click();
 if(next==='form')document.body.classList.remove('form-hidden');
 if(next==='voice')document.body.classList.add('form-hidden');
 if(next==='options')syncToChoice();
 if(next==='review'&&code)get('reviewCode').value=code;
 if(next==='form'&&get('p0').hidden&&get('p1').hidden&&get('p2').hidden&&get('p3').hidden&&get('p4').hidden&&get('p5').hidden)get('p0').hidden=false;
 window.scrollTo({top:0,behavior:'instant'});
}
get('entryPatient').onclick=()=>render('options');get('entryDoctor').onclick=()=>render('doctor');get('entryReview').onclick=()=>render('review');
get('reviewSearch').onclick=async()=>{
 const target=get('reviewCode').value.trim(),status=get('reviewStatus'),result=get('reviewResponse'),replies=get('reviewReplies');
 status.textContent='Consultando…';result.hidden=true;replies.replaceChildren();
 if(!target){status.textContent='Ingresa el código de tu caso.';return}
 try{
  const r=await fetch('/api/cases/by-code?code='+encodeURIComponent(target));const c=await r.json();
  if(!r.ok)throw Error('Código no encontrado. Verifica que esté escrito correctamente.');
  const responses=Array.isArray(c.replies)?c.replies:[];
  if(!responses.length){status.textContent='Caso SALA-'+c.code+': en espera de la evaluación del médico.';return}
  status.textContent='Caso SALA-'+c.code+': atendido por el personal de salud.';result.hidden=false;
  for(const response of responses){const p=document.createElement('p');p.className='review-message';p.textContent=response.message||'';replies.append(p)}
 }catch(e){status.textContent=e.message}
};
get('chooseVoice').onclick=()=>render('voice');get('chooseForm').onclick=()=>render('form');
back.onclick=()=>render(['voice','form'].includes(page)?'options':'welcome');
for(const [from,to] of [['choiceLanguage','language'],['choiceContrast','contrast'],['choiceLarge','large'],['choiceSpeak','speak']]){
 get(from).addEventListener('change',()=>{get(to)[from==='choiceLanguage'?'value':'checked']=get(from)[from==='choiceLanguage'?'value':'checked'];get(to).dispatchEvent(new Event('change',{bubbles:true}))});
}
// Los roles solo se eligen en la bienvenida; no hay atajos de rol en otras vistas.
window.triageNavigate=render;
const draftButton=document.createElement('button');draftButton.type='button';draftButton.id='draftDoctor';draftButton.textContent='Generar propuesta de evaluación con IA';
const draftStatus=document.createElement('p');draftStatus.id='draftStatus';draftStatus.className='helper';draftStatus.textContent='La IA propone hipótesis y exámenes posibles. El profesional debe verificar, editar y aprobar antes de enviar.';
get('message').closest('label').before(draftButton,draftStatus);
draftButton.onclick=async()=>{
 const code=window.currentDoctorCase?.code;
 if(!code){draftStatus.textContent='Selecciona primero un caso de la bandeja.';return}
 draftButton.disabled=true;draftStatus.textContent='Preparando borrador para revisión clínica…';
 try{const r=await fetch('/api/doctor/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});const data=await r.json();if(!r.ok)throw Error(data.error||'Error del servicio');get('message').value=data.draft;draftStatus.textContent=data.generated?'Borrador IA generado. Revísalo y corrígelo antes de enviarlo.':'Borrador básico: el modelo no está configurado o no respondió. Debes completar la evaluación clínica.'}
 catch(e){draftStatus.textContent='No se pudo preparar el borrador: '+e.message}finally{draftButton.disabled=false}
};
render('welcome');
