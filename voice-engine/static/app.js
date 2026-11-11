'use strict';
const $ = id => document.getElementById(id);
const TRAITS = [
  ['amabilidad','Amabilidad','0 = directo · 10 = cálido'],
  ['formalidad','Formalidad','0 = cotidiano · 10 = muy formal'],
  ['humor','Humor','Nunca bromear sobre síntomas'],
  ['entusiasmo','Entusiasmo','0 = sobrio · 10 = enérgico'],
  ['empatia','Empatía','0 = neutro · 10 = comprensivo'],
  ['paciencia','Paciencia','0 = conciso · 10 = pausado']
];
let presets = {}, custom = false, basePrompt = '', editedPrompt = false, promptSeq = 0, groqReady = false, providers = {}; 
let ws = null, active = false, withMic = false, stream = null, audioCtx = null,
    sending = false, speaking = false, lastReply = '';

function status(text){ $('status').textContent=text; }
function addMessage(role,text){
  const empty = document.querySelector('.empty-chat'); if(empty) empty.remove();
  const msg = document.createElement('div');msg.className='msg '+role;
  const avatar=document.createElement('div');avatar.className='avatar';avatar.textContent=role==='user'?'☺':'✚';
  const bubble=document.createElement('div');bubble.className='bubble';
  const name=document.createElement('span');name.className='who';name.textContent=role==='user'?'Paciente':'TriageVoz Rural';
  const body=document.createElement('span');body.textContent=text;
  bubble.append(name,body);msg.append(avatar,bubble);$('messages').append(msg);$('messages').scrollTop=$('messages').scrollHeight;
}
function setTab(id){
  document.querySelectorAll('.tab').forEach(tab=>{
    const on=tab.dataset.tab===id;tab.classList.toggle('active',on);tab.setAttribute('aria-selected',String(on));
  });
  document.querySelectorAll('.page').forEach(page=>{
    const on=page.id==='page-'+id;page.classList.toggle('active',on);page.hidden=!on;
  });
}
function currentPersonality(){const p={};for(const [name] of TRAITS)p[name]=Number($('trait-'+name).value);return p;}
function loadValues(values){
  for(const [name] of TRAITS){$('trait-'+name).value=Number(values[name]??5);$('value-'+name).textContent=$('trait-'+name).value;}
  editedPrompt=false;refreshPrompt();syncSettings();
}
function setupSliders(){
  for(const [name,label,help] of TRAITS){
    const block=document.createElement('div');block.className='slider-block';
    const line=document.createElement('div');line.className='slider-line';
    const l=document.createElement('label');l.htmlFor='trait-'+name;l.textContent=label;
    const value=document.createElement('span');value.className='slider-value';value.id='value-'+name;value.textContent='0';
    line.append(l,value);
    const slider=document.createElement('input');slider.type='range';slider.id='trait-'+name;
    slider.min='0';slider.max='10';slider.step='1';slider.value='5';slider.setAttribute('aria-label',label);
    const hint=document.createElement('div');hint.className='slider-help';hint.textContent=help;
    block.append(line,slider,hint);$('sliderList').appendChild(block);
    slider.addEventListener('input',()=>{
      value.textContent=slider.value;custom=true;$('preset').value='__custom__';
      editedPrompt=false;refreshPrompt();syncSettings();
    });
  }
}
function paramsFromPersonality(){return new URLSearchParams(currentPersonality()).toString();}
async function refreshPrompt(){
  const seq=++promptSeq;
  try{
    const res=await fetch('/api/prompt?'+paramsFromPersonality());if(!res.ok)throw Error('No se pudo cargar el prompt');
    const result=await res.json();if(seq!==promptSeq)return;
    basePrompt=result.prompt;
    if(!editedPrompt)$('promptText').value=basePrompt;
    $('promptState').textContent='Perfil: '+$('preset').selectedOptions[0].textContent;
    syncSettings();
  }catch(error){$('promptSaved').textContent='No se pudo recuperar el prompt del servidor.';}
}
function effectivePrompt(){return $('promptText').value||basePrompt;}
function settingsPacket(action){return {action,personality:currentPersonality(),adaptive:$('adaptiveEnabled').checked,allow_provider:$('consent').checked,provider:$('provider').value,prompt_edit: editedPrompt ? effectivePrompt() : ''};}
function syncSettings(){
  if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(settingsPacket('settings')));
}
async function bootstrap(){
  setupSliders();
  for(const tab of document.querySelectorAll('.tab'))tab.addEventListener('click',()=>setTab(tab.dataset.tab));
  const config=await fetch('/api/config').then(r=>r.json());
  if(!config.build || config.build!=='LEC11-T2-2026.11.10-R5')throw Error('VERSIÓN INCOMPATIBLE: ejecuta INICIAR_TRIAGEVOZ.bat desde la carpeta nueva.');
  $('versionTag').textContent=config.build;
  $('buildNotice').textContent=config.build+' · app actualizada';
  presets=config.presets; groqReady=Boolean(config.groq_ready); providers=config.providers||{};
  for(const name of Object.keys(presets)){$('preset').add(new Option(name,name));}
  $('preset').add(new Option('Personalizada','__custom__'));
  const initial='Cercana y comprensiva';$('preset').value=initial;loadValues(presets[initial]);
  refreshProviderInfo();
  $('preset').addEventListener('change',()=>{const name=$('preset').value;if(presets[name]){custom=false;loadValues(presets[name]);}});
  $('resetProfile').onclick=()=>{const name=presets[$('preset').value]?$('preset').value:'Cercana y comprensiva';$('preset').value=name;loadValues(presets[name]);};
  $('promptText').addEventListener('input',()=>{editedPrompt=true;$('promptSaved').textContent='Prompt modificado: se aplicará solo en respuestas del LLM.';syncSettings();});
  $('restorePrompt').onclick=()=>{editedPrompt=false;$('promptText').value=basePrompt;$('promptSaved').textContent='Restaurado.';syncSettings();};
  $('copyPrompt').onclick=async()=>{try{await navigator.clipboard.writeText(effectivePrompt());$('promptSaved').textContent='Prompt copiado al portapapeles.';}catch{ $('promptText').select();$('promptSaved').textContent='Seleccionado. Usa Ctrl+C para copiar.'; }};
  $('adaptiveEnabled').addEventListener('change',()=>{syncSettings();status('Preferencia de adaptación actualizada. Se aplicará en el siguiente mensaje.');});
  $('consent').addEventListener('change',syncSettings);$('provider').addEventListener('change',()=>{refreshProviderInfo();syncSettings();});
  $('sens').addEventListener('input',()=>{$('sensValue').textContent=Number($('sens').value).toFixed(3);});
  $('voiceManual').onclick=manualCapture;
  $('startVoice').onclick=()=>startSession(true);$('startText').onclick=()=>startSession(false);
  $('stop').onclick=stopSession;$('repeat').onclick=()=>{if(lastReply)readAloud(lastReply);};
  $('send').onclick=sendTyped;$('textInput').addEventListener('keydown',e=>{if(e.key==='Enter')sendTyped();});
  $('generate').onclick=generateDialogues;$('compareLLM').onclick=compareModels;
  for(const id of ['largeText','highContrast']) {const el=$(id);try{el.checked=localStorage.getItem('triagevoz_ui_'+id)==='true';}catch{}el.addEventListener('change',()=>{try{localStorage.setItem('triagevoz_ui_'+id,String(el.checked));}catch{}applyAccessibility();});}applyAccessibility();
  document.querySelectorAll('.zone-button').forEach(button=>button.addEventListener('click',()=>{if(!active){status('Inicia por texto o voz antes de seleccionar una zona.');return;}$('textInput').value='Siento una molestia en '+button.dataset.zone+'. ';$('textInput').focus();status('Zona agregada como borrador. Completa la molestia y pulsa Enviar.');}));
  await loadExamples();
  await loadAdaptiveExamples();
  renderAdaptive(null);
}
async function loadExamples(){
  try{const d=await fetch('/api/examples').then(r=>r.json());renderExamples(d.examples,'ilustrativo');}
  catch{$('originExamples').textContent='No se pudieron cargar los ejemplos.';}
}
function renderExamples(examples,mode){
  $('examples').replaceChildren();
  for(const ex of examples){
    const card=document.createElement('article');card.className='example';
    const head=document.createElement('div');head.className='example-header';
    const title=document.createElement('h3');title.textContent=ex.name;head.append(title);
    const tags=document.createElement('div');tags.className='trait-tags';
    const abbrev={amabilidad:'Am',formalidad:'Fo',humor:'Hu',entusiasmo:'En',empatia:'Em',paciencia:'Pa'};
    for(const key of Object.keys(abbrev)){const tag=document.createElement('span');tag.className='trait-tag';tag.textContent=abbrev[key]+' '+ex.personality[key];tags.append(tag);}
    const source=document.createElement('div');source.className='source-chip';source.textContent=ex.source?.startsWith('generado_con_')?'Generado con '+ex.source.replace('generado_con_','')+' · '+(ex.model||''):'Ejemplo ilustrativo precargado';
    head.append(tags,source);card.append(head);
    for(const line of ex.dialogue){const sample=document.createElement('div');sample.className='sample';
      for(const [kind,name,text] of [['person','Paciente',line.paciente],['agent','VUI',line.asistente]]){
        const para=document.createElement('p');para.className=kind;
        const nameEl=document.createElement('b');nameEl.textContent=name+': ';
        const content=document.createTextNode(text);para.append(nameEl,content);sample.append(para);
      }card.append(sample);
    }
    const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent=ex.source?.startsWith('generado_con_')?'Ver prompt utilizado':'Ver prompt para este perfil';
    const pre=document.createElement('pre');pre.textContent=ex.prompt;detail.append(summary,pre);card.append(detail);$('examples').append(card);
  }
  $('originExamples').textContent=mode==='ia'?'Las tres versiones fueron generadas con el LLM usando las mismas cuatro frases del paciente.':'Ejemplos ilustrativos precargados. Usa el botón para generarlos con la IA.';
}
async function generateDialogues(){
  if(!$('consent').checked){$('originExamples').textContent='Activa el consentimiento antes de enviar el ejemplo sintético al proveedor.';return;}
  const button=$('generate');button.disabled=true;button.textContent='Generando tres versiones…';
  try{const response=await fetch('/api/generate-examples',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({allow_provider:true,provider:$('provider').value})});
      const d=await response.json();if(!response.ok)throw Error(d.detail||'No fue posible generar los diálogos');renderExamples(d.examples,'ia');
  }catch(e){$('originExamples').textContent='No se pudo generar con IA: '+e.message+' Los ejemplos precargados siguen disponibles.';}
  finally{button.disabled=false;button.textContent='✦ Generar tres diálogos con IA';}
}
function applyAccessibility(){document.body.classList.toggle('text-large',$('largeText').checked);document.body.classList.toggle('contrast-high',$('highContrast').checked);}
function refreshProviderInfo(){const selected=$('provider').value;const value=providers[selected];const details=value?`${value.model} · ${value.ready?'clave configurada':'sin clave'}`:'Proveedor no configurado';$('modelInfo').textContent=details+' · Whisper (Groq) solo para entrada de audio.';$('apiNote').textContent=groqReady?'Whisper listo si autorizas el audio.':'Para usar micrófono con Whisper debes configurar GROQ_API_KEY. El texto y los intents siguen disponibles.';}
async function compareModels(){
  const el=$('compareResults'),btn=$('compareLLM');if(!$('consent').checked){el.textContent='Activa primero el consentimiento del panel izquierdo.';return;}
  btn.disabled=true;el.textContent='Consultando modelos con un ejemplo ficticio…';
  try{const r=await fetch('/api/compare-models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({allow_provider:true,personality:currentPersonality()})});const d=await r.json();if(!r.ok)throw Error(d.detail||'Error de comparación');
      el.replaceChildren();for(const v of d.results){const card=document.createElement('article');card.className='compare-result';const title=document.createElement('strong');title.textContent=v.provider.toUpperCase()+' · '+v.model;const meta=document.createElement('small');meta.textContent=v.status==='ok'?'Tiempo observado: '+v.elapsed_ms+' ms':v.status==='no_configurado'?'Clave no configurada':v.detail;const result=document.createElement('p');result.textContent=v.text||'Sin respuesta';card.append(title,meta,result);el.append(card);}const foot=document.createElement('small');foot.textContent=d.notice;el.append(foot);
  }catch(e){el.textContent='Error: '+e.message;}finally{btn.disabled=false;}
}
const ADAPT_LABELS={rutina:'Rutina',comprension:'Explicación sencilla',contencion:'Apoyo emocional',brevedad:'Respuesta breve',alarma:'Alarma declarada'};
function renderAdaptive(info){
  if(!info){
    $('sideMode').textContent='Modo: rutina';$('sideReason').textContent='A la espera de la siguiente intervención.';
    $('adaptMode').textContent='Modo: rutina';$('adaptWhy').textContent='Sin eventos de adaptación aún.';
    $('adaptStatus').hidden=false;$('modeExplanation').textContent='Inicia la sesión para observar la personalidad efectiva.';
    renderTraitChart(currentPersonality());return;
  }
  const label=ADAPT_LABELS[info.mode]||info.mode;
  $('sideMode').textContent='Modo: '+label;
  $('sideReason').textContent=info.reason;
  $('adaptMode').textContent=(info.enabled?'Adaptación activa: ':'Adaptación desactivada: ')+label;
  $('adaptWhy').textContent=info.reason;
  $('adaptStatus').hidden=false;
  $('modeExplanation').textContent=info.description+' · '+info.notice;
  renderTraitChart(info.effective);
}
function renderTraitChart(traits){
  $('adaptiveTraits').replaceChildren();
  for(const [key,label] of TRAITS){
    const value=Number(traits?.[key]??0);
    const row=document.createElement('div');row.className='trait-chart-row';
    const title=document.createElement('span');title.textContent=label;
    const track=document.createElement('div');track.className='trait-bar';
    const fill=document.createElement('span');fill.style.width=(value*10)+'%';track.append(fill);
    const number=document.createElement('b');number.textContent=value+'/10';
    row.append(title,track,number);$('adaptiveTraits').append(row);
  }
}
async function loadAdaptiveExamples(){
  try{
    const r=await fetch('/api/adaptive-examples');if(!r.ok)throw Error('No se pudo recuperar la demostración');
    const data=await r.json();$('adaptiveExamples').replaceChildren();
    for(const sample of data.examples){
      const card=document.createElement('article');card.className='adapt-example';
      const h=document.createElement('h3');h.textContent=sample.title;card.append(h);
      for(const turn of sample.turns){
        const block=document.createElement('div');block.className='adapt-example-turn';
        const patient=document.createElement('p');patient.textContent='Paciente: '+turn.patient;
        const response=document.createElement('p');response.textContent='Asistente: '+turn.reply;
        const trace=document.createElement('small');trace.textContent='→ '+(ADAPT_LABELS[turn.adaptive.mode]||turn.adaptive.mode)+' · '+turn.adaptive.reason;
        block.append(patient,response,trace);card.append(block);
      }
      $('adaptiveExamples').append(card);
    }
  }catch(e){$('adaptiveExamples').textContent='No fue posible cargar las demostraciones: '+e.message;}
}
// Audio estable R4: captura PCM continua, preroll, VAD acotado y modo manual de respaldo.
let audioSource=null, audioProcessor=null, audioWorkletUrl=null;
let preRoll=[], preRollSamples=0, recordingChunks=[], recordingSamples=0;
let inSpeech=false, manualMode=false, speechEvidenceMs=0, voiceMs=0, silenceMs=0;
let noiseFloor=0.002, lastLevelUpdate=0, lastSpeechAt=0, replyTimer=null;
const PRE_ROLL_SECONDS=0.50, MAX_UTTERANCE_SECONDS=12, END_SILENCE_MS=780;

function setActive(on){
  active=on;$('startVoice').disabled=on;$('startText').disabled=on;$('stop').disabled=!on;
  $('send').disabled=!on;$('textInput').disabled=!on;$('repeat').disabled=!on;
  $('voiceManual').disabled=!on||!withMic;
  $('micLamp').textContent=withMic&&on?'● Micrófono activo':'Micrófono inactivo';$('micLamp').classList.toggle('on',withMic&&on);
  $('modeText').textContent=on?(withMic?'Voz con detección automática y respaldo manual':'Sesión por texto'):'Esperando inicio de sesión';
}
function resetAudioBuffers(){
  preRoll=[];preRollSamples=0;recordingChunks=[];recordingSamples=0;
  inSpeech=false;manualMode=false;voiceMs=0;speechEvidenceMs=0;silenceMs=0;
  if($('voiceManual'))$('voiceManual').textContent='🎙 Captura manual';
}
function clearReplyTimer(){if(replyTimer){clearTimeout(replyTimer);replyTimer=null;}}
function startReplyTimer(){
  clearReplyTimer();
  replyTimer=setTimeout(()=>{
    if(active&&sending)stopSession('La transcripción o la respuesta demoró demasiado. Reinicia la sesión o utiliza el modo texto.');
  },80000);
}
async function releaseAudio(){
  if(audioProcessor){try{audioProcessor.port?.close?.();audioProcessor.disconnect();}catch{}audioProcessor=null;}
  if(audioSource){try{audioSource.disconnect();}catch{}audioSource=null;}
  if(stream){for(const track of stream.getTracks()){try{track.stop();}catch{}}stream=null;}
  if(audioCtx){const context=audioCtx;audioCtx=null;try{await context.close();}catch{}}
  if(audioWorkletUrl){URL.revokeObjectURL(audioWorkletUrl);audioWorkletUrl=null;}
  $('levelFill').style.width='0%';
  resetAudioBuffers();
}
async function setupAudio(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('El navegador no permite acceder al micrófono en este sitio.');
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
  const track=stream.getAudioTracks()[0];
  track.addEventListener('ended',()=>{
    if(active&&withMic){withMic=false;setActive(true);status('El micrófono se desconectó. Continúa por texto o reinicia para volver a habilitarlo.');}
  });
  audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  await audioCtx.resume();
  audioSource=audioCtx.createMediaStreamSource(stream);
  // AudioWorklet recopila bloques de 2048 muestras. El fallback ScriptProcessor es para Edge antiguos.
  if(audioCtx.audioWorklet&&window.AudioWorkletNode){
    try{
      const code=`class TriageCapture extends AudioWorkletProcessor {
        constructor(){super();this.buf=new Float32Array(2048);this.off=0;}
        process(inputs, outputs){
          const src=inputs[0]&&inputs[0][0];
          if(src){let p=0;while(p<src.length){let n=Math.min(src.length-p,2048-this.off);this.buf.set(src.subarray(p,p+n),this.off);p+=n;this.off+=n;if(this.off===2048){const packet=this.buf;this.port.postMessage(packet,[packet.buffer]);this.buf=new Float32Array(2048);this.off=0;}}}
          for(const out of outputs[0]||[])out.fill(0);
          return true;
        }
      } registerProcessor('triage-capture-r4',TriageCapture);`;
      audioWorkletUrl=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
      await audioCtx.audioWorklet.addModule(audioWorkletUrl);
      audioProcessor=new AudioWorkletNode(audioCtx,'triage-capture-r4', {numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
      audioProcessor.port.onmessage=e=>onAudioFrame(e.data);
    }catch(error){console.warn('AudioWorklet no disponible, usando compatibilidad.',error);audioProcessor=null;}
  }
  if(!audioProcessor){
    audioProcessor=audioCtx.createScriptProcessor(2048,1,1);
    audioProcessor.onaudioprocess=e=>{
      onAudioFrame(new Float32Array(e.inputBuffer.getChannelData(0)));
      e.outputBuffer.getChannelData(0).fill(0);
    };
  }
  audioSource.connect(audioProcessor);
  audioProcessor.connect(audioCtx.destination); // La salida es silencio: evita reproducir tu micrófono.
  noiseFloor=0.002;lastSpeechAt=performance.now();resetAudioBuffers();
}
function onAudioFrame(frame){
  if(!active||!withMic||!audioCtx||!ws||ws.readyState!==WebSocket.OPEN||sending)return;
  if(!(frame instanceof Float32Array))frame=new Float32Array(frame);
  if(!frame.length)return;
  const dt=frame.length/audioCtx.sampleRate*1000;
  let power=0;for(let i=0;i<frame.length;i++)power+=frame[i]*frame[i];
  const rms=Math.sqrt(power/frame.length);
  const userThreshold=Number($('sens').value);
  const threshold=Math.max(userThreshold,noiseFloor*(speaking?3.2:2.0));
  const voiced=rms>threshold*(speaking?1.7:1);
  const now=performance.now();
  if(now-lastLevelUpdate>95){
    lastLevelUpdate=now;
    $('levelFill').style.width=Math.min(100,Math.round(rms/0.085*100))+'%';
    $('voiceIndicator').textContent=inSpeech?'Grabando tu intervención':(voiced?'Voz detectada':'Esperando voz');
    $('levelFill').classList.toggle('level-active',voiced);
  }
  if(!inSpeech){
    preRoll.push(frame);preRollSamples+=frame.length;
    while(preRollSamples>audioCtx.sampleRate*PRE_ROLL_SECONDS&&preRoll.length>1){preRollSamples-=preRoll.shift().length;}
    if(!voiced&&!speaking)noiseFloor=0.98*noiseFloor+0.02*rms;
    speechEvidenceMs=voiced?speechEvidenceMs+dt:Math.max(0,speechEvidenceMs-dt*1.7);
    if(speechEvidenceMs>=105){
      interruptSpeech();
      inSpeech=true;manualMode=false;recordingChunks=preRoll.slice();recordingSamples=preRollSamples;
      voiceMs=speechEvidenceMs;silenceMs=0;
      status('Voz detectada. Habla con normalidad; se enviará al terminar una pausa.');
    }else if(now-lastSpeechAt>9000){
      lastSpeechAt=now;
      status('Micrófono conectado, pero no detecto voz. Baja el umbral o utiliza «Captura manual».');
    }
    return;
  }
  recordingChunks.push(frame);recordingSamples+=frame.length;
  if(voiced){silenceMs=0;voiceMs+=dt;}else{silenceMs+=dt;}
  const duration=recordingSamples/audioCtx.sampleRate;
  if(duration>=MAX_UTTERANCE_SECONDS){finalizeSpeech('límite de 12 segundos');}
  else if(!manualMode&&silenceMs>=END_SILENCE_MS){finalizeSpeech('pausa detectada');}
}
function encodeWav(chunks,sampleRate){
  const samples=chunks.reduce((total,chunk)=>total+chunk.length,0);
  const buffer=new ArrayBuffer(44+samples*2),view=new DataView(buffer);
  const tag=(offset,string)=>{for(let i=0;i<string.length;i++)view.setUint8(offset+i,string.charCodeAt(i));};
  tag(0,'RIFF');view.setUint32(4,36+samples*2,true);tag(8,'WAVE');tag(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,samples*2,true);
  let p=44;for(const frame of chunks)for(let i=0;i<frame.length;i++){
    const sample=Math.max(-1,Math.min(1,frame[i]));
    view.setInt16(p,sample<0?sample*32768:sample*32767,true);p+=2;
  }
  return buffer;
}
function finalizeSpeech(reason='pausa'){ 
  if(!inSpeech||!active||!audioCtx||sending)return;
  const chunks=recordingChunks;const length=recordingSamples;
  const voicedMs=voiceMs;const manual=manualMode;resetAudioBuffers();
  const seconds=length/audioCtx.sampleRate;
  if(seconds<0.35||(!manual&&voicedMs<130)){
    status('La intervención fue demasiado breve. Repite o utiliza «Captura manual».');return;
  }
  if(!ws||ws.readyState!==WebSocket.OPEN){status('La conexión se perdió. Reinicia la sesión.');return;}
  sending=true;lastSpeechAt=performance.now();
  const wav=encodeWav(chunks,audioCtx.sampleRate);
  status(`Enviando ${seconds.toFixed(1)} s de audio (${reason}). Transcribiendo con Whisper…`);
  $('liveText').textContent='Procesando la intervención de voz…';
  try{
    ws.send(JSON.stringify({action:'format',mime:'audio/wav'}));
    ws.send(wav);
    startReplyTimer();
  }catch(error){sending=false;status('No se pudo enviar el audio: '+error.message);}
}
function manualCapture(){
  if(!active||!withMic||sending)return;
  if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
  if(manualMode){finalizeSpeech('envío manual');return;}
  if(inSpeech){finalizeSpeech('envío manual');return;}
  interruptSpeech();
  manualMode=true;inSpeech=true;
  recordingChunks=preRoll.slice();recordingSamples=preRollSamples;voiceMs=500;silenceMs=0;
  $('voiceManual').textContent='✓ Enviar audio';
  status('Grabación manual activada. Habla y pulsa «Enviar audio» cuando termines.');
}
async function startSession(useMicrophone){
  if(active)return;
  if(useMicrophone&&!groqReady){status('Configura GROQ_API_KEY para transcribir. También puedes usar el modo texto.');return;}
  if(useMicrophone&&!$('consent').checked){status('Marca el consentimiento antes de enviar voz a Groq.');return;}
  withMic=useMicrophone;
  $('messages').innerHTML='';lastReply='';renderAdaptive(null);$('routeName').textContent='—';$('routePill').textContent='Sin iniciar';
  let fallbackReason='';
  if(useMicrophone){
    try{await setupAudio();}
    catch(e){withMic=false;await releaseAudio();fallbackReason='Micrófono no disponible: '+e.message+'. Continúa por texto.';}
  }
  const protocol=location.protocol==='https:'?'wss://':'ws://';
  ws=new WebSocket(protocol+location.host+'/ws');setActive(true);status('Conectando con el servidor…');
  ws.onopen=()=>{
    ws.send(JSON.stringify(settingsPacket('start')));
    status(fallbackReason || (withMic?'Escucha activada. Puedes hablar y utilizar «Captura manual» si no reconoce la voz.':'Conectado. Puedes responder por texto.'));
  };
  ws.onmessage=e=>{
    let msg;try{msg=JSON.parse(e.data);}catch{return;}
    if(msg.type==='transcript'){
      addMessage('user',msg.text);$('liveText').textContent='Paciente: '+msg.text;
      status('Transcripción recibida. Preparando la respuesta…');
    }
    if(msg.type==='reply'){
      clearReplyTimer();sending=false;resetAudioBuffers();lastSpeechAt=performance.now();
      addMessage('bot',msg.reply);$('routeName').textContent=msg.route;$('routePill').textContent=msg.route;
      lastReply=msg.reply;$('liveText').textContent='Asistente: '+msg.reply;
      renderAdaptive(msg.adaptive||null);
      status(msg.route==='seguridad'?'Posible alarma: busca atención médica urgente.':(withMic?'Listo para escuchar tu siguiente intervención.':'Listo para tu siguiente mensaje.'));
      readAloud(msg.reply);
    }
    if(msg.type==='error'){
      clearReplyTimer();sending=false;resetAudioBuffers();lastSpeechAt=performance.now();
      status('Atención: '+msg.text+' Puedes repetir o utilizar texto.');$('liveText').textContent=msg.text;
    }
  };
  ws.onerror=()=>status('WebSocket no disponible; revisa dependencias y conexión.');
  ws.onclose=()=>{if(active)stopSession('La conexión WebSocket se cerró. Vuelve a iniciar la sesión.');};
}
function interruptSpeech(){if(speaking&&'speechSynthesis' in window){speechSynthesis.cancel();speaking=false;status('Respuesta de voz interrumpida; escuchando al paciente…');}}
function readAloud(text){
  if(!active||!$('tts').checked||!('speechSynthesis' in window))return;
  speechSynthesis.cancel();speaking=false;const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='es-PE';utterance.rate=1;utterance.pitch=1;
  speaking=true;
  utterance.onend=()=>{speaking=false;lastSpeechAt=performance.now();};
  utterance.onerror=()=>{speaking=false;};
  speechSynthesis.speak(utterance);
}
function sendTyped(){
  const value=$('textInput').value.trim();if(!value)return;
  if(!active||!ws||ws.readyState!==WebSocket.OPEN){status('Inicia primero la sesión.');return;}
  if(sending){status('Todavía se procesa la intervención anterior.');return;}
  interruptSpeech();$('textInput').value='';sending=true;
  ws.send(JSON.stringify({...settingsPacket('message'),text:value}));
  status('Procesando respuesta…');startReplyTimer();
}
function stopSession(message='Sesión detenida. Micrófono apagado.'){
  active=false;clearReplyTimer();
  if('speechSynthesis' in window)speechSynthesis.cancel();speaking=false;
  withMic=false;setActive(false);resetAudioBuffers();sending=false;
  if(ws){try{ws.close();}catch{}ws=null;}
  releaseAudio();status(message);
}
document.addEventListener('visibilitychange',()=>{
  if(active&&withMic&&audioCtx?.state==='suspended')status('El navegador suspendió el audio. Pulsa «Captura manual» o «Detener» y reinicia para reactivarlo.');
});
document.addEventListener('DOMContentLoaded',()=>bootstrap().catch(e=>status('Error al preparar la aplicación: '+e.message)));
