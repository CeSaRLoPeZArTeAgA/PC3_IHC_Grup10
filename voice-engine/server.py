"""Servidor de TriageVoz Rural: WebSocket, STT por Whisper y comparación de prompts."""
from __future__ import annotations
import os, asyncio, json, re
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from prompts import PRESETS, build_prompt, validate_personality, SAFETY
from dialogues import all_examples, FIXED_PATIENT
from adaptive import AdaptiveEngine, MODES
from version import BUILD, APP_NAME
from llm_clients import ask, ready, model_name, ProviderError

ROOT=Path(__file__).resolve().parent
load_dotenv(ROOT/'.env')
SAVE=os.getenv('SAVE_TRANSCRIPTS','0')=='1'
engine=AdaptiveEngine(str(ROOT/'registros_demo.sqlite3') if SAVE else None)
app=FastAPI(title=APP_NAME,version=BUILD)
app.mount('/static',StaticFiles(directory=ROOT/'static'),name='static')

@app.middleware('http')
async def disable_stale_asset_cache(request, call_next):
    response = await call_next(request)
    if request.url.path == '/' or request.url.path.startswith('/static/') or request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, max-age=0'
    return response

@app.get('/')
def index():
    return FileResponse(ROOT/'static'/'index.html', headers={'Cache-Control':'no-store'})

@app.get('/api/version')
def version():
    return {'project':APP_NAME,'build':BUILD,'task':'Tarea 2', 'adaptive_personality':True,
            'has_six_traits': True, 'has_three_examples': True, 'has_two_llm_providers': True}


@app.get('/api/config')
def config():
    return {'project':APP_NAME,'build':BUILD,'presets':PRESETS,'adaptive_modes':{k:v[0] for k,v in MODES.items()},'groq_ready':ready('groq'),'gemini_ready':ready('gemini'), 'providers':{'groq':{'ready':ready('groq'),'model':model_name('groq')},'gemini':{'ready':ready('gemini'),'model':model_name('gemini')}},
            'store_transcripts':SAVE,'stt_model':os.getenv('GROQ_STT_MODEL','whisper-large-v3-turbo'),
            'chat_model':os.getenv('GROQ_CHAT_MODEL','openai/gpt-oss-120b')}

@app.get('/api/prompt')
def prompt(amabilidad:int=9,formalidad:int=4,humor:int=1,entusiasmo:int=6,empatia:int=10,paciencia:int=10):
    values=validate_personality(locals())
    return {'personality':values,'prompt':build_prompt(values)}

@app.get('/api/adaptive-examples')
def adaptive_examples():
    """Escenarios ficticios sin LLM, reproducibles para evidencia de IHC."""
    scenarios=[
      {'title':'Cita de rutina y necesidad de aclaración', 'inputs':[
          'Tengo dolor de cabeza desde ayer.',
          'No entiendo qué significa intensidad.',
          'Me preocupa mucho y estoy nervioso.',
          'Ya estoy tranquilo, es leve.' ]},
      {'title':'Llamada de emergencia simulada', 'inputs':[
          'Tengo dolor fuerte en el pecho y no puedo respirar.' ]}
    ]
    results=[]
    for item in scenarios:
        demo=AdaptiveEngine()
        start=demo.new()
        sid=start['session']
        turns=[]
        for utterance in item['inputs']:
            ans=demo.respond(sid,utterance,adaptive=True)
            turns.append({'patient':utterance,'reply':ans['reply'],'route':ans['route'],
                          'adaptive':ans['adaptive']})
        results.append({'title':item['title'],'turns':turns})
    return {'examples':results,'source':'demostracion_determinista_con_datos_ficticios'}

@app.get('/api/examples')
def examples(): return {'examples':all_examples(),'patient_lines':FIXED_PATIENT,'mode':'ilustrativo'}

def make_dialogue(name, values, provider):
    task=(
        'Genera SOLO un objeto JSON con la propiedad "replies": una lista de EXACTAMENTE '
        '4 respuestas de un asistente académico de pretriaje, según los cuatro mensajes '
        'del paciente en orden. Misma información, mismo orden, cambia SOLO el estilo. '
        'No inventes síntomas, no diagnostiques, no recetes, no clasifiques urgencias. '
        'Una pregunta por respuesta como máximo, respuestas cortas para voz. '
        'La respuesta final aclara que es para revisión por profesional sanitario. '
        'Paciente (cuatro turnos): '+json.dumps(FIXED_PATIENT,ensure_ascii=False)
    )
    res=ask(provider,SAFETY+'\n'+build_prompt(values),task,temperature=.45)
    raw=res.text.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip()
    data=json.loads(raw)
    replies=data.get('replies',[])
    if len(replies)!=4 or not all(isinstance(v,str) and 3<len(v)<450 for v in replies):
        raise ValueError('El proveedor no devolvió cuatro respuestas correctas.')
    return {'name':name,'personality':values,'prompt':build_prompt(values),
            'dialogue':[{'turno':i+1,'paciente':u,'asistente':a} for i,(u,a) in enumerate(zip(FIXED_PATIENT,replies))],
            'source':'generado_con_'+provider, 'model':res.model,'elapsed_ms':res.elapsed_ms}

@app.post('/api/generate-examples')
async def generate_examples(body:dict):
    if body.get('allow_provider') is not True:raise HTTPException(403,'Confirma el envío de los diálogos sintéticos al proveedor.')
    provider=body.get('provider','groq')
    if provider not in ('groq','gemini'):raise HTTPException(400,'Proveedor desconocido.')
    if not ready(provider):raise HTTPException(400,f'Configura la API key de {provider.upper()} en .env.')
    try:
        outcomes=await asyncio.gather(*[asyncio.to_thread(make_dialogue,name,vals,provider) for name,vals in PRESETS.items()])
        return {'mode':'ia','provider':provider,'examples':outcomes}
    except Exception as ex:
        raise HTTPException(502,'No fue posible generar los tres diálogos. Revisa conexión, acceso al modelo y formato.') from ex

@app.post('/api/compare-models')
async def compare_models(body:dict):
    """Mismo texto sintético y mismo prompt para los dos proveedores.

    No usa los mensajes del paciente ni los registros de la sesión actual.
    """
    if body.get('allow_provider') is not True:raise HTTPException(403,'Se requiere consentimiento.')
    person=validate_personality(body.get('personality'))
    system=SAFETY+'\n'+build_prompt(person)
    example=('PRUEBA FICTICIA. Un paciente comunica: Tengo dolor de cabeza desde ayer y algo de cansancio. '
             'Responde como asistente de registro de síntomas, con una sola pregunta, '
             'sin diagnosticar ni dar tratamiento, en máximo 55 palabras.')
    def call(provider):
        if not ready(provider):return {'provider':provider,'model':model_name(provider),'status':'no_configurado'}
        try:
            r=ask(provider,system,example,temperature=.3)
            return {'provider':provider,'model':r.model,'status':'ok','elapsed_ms':r.elapsed_ms,'text':r.text[:1200]}
        except ProviderError as ex:
            return {'provider':provider,'model':model_name(provider),'status':'error','detail':str(ex)}
    results=await asyncio.gather(*[asyncio.to_thread(call,p) for p in ('groq','gemini')])
    return {'input':example,'results':results,'notice':'Latencias observadas en esta prueba, no benchmarks clínicos. No se enviaron datos de tu conversación.'}

def transcribe_audio(blob:bytes,mime:str):
    if not os.getenv('GROQ_API_KEY'):
        raise ValueError('Falta GROQ_API_KEY en .env. Para probar sin clave, inicia en modo texto.')
    from groq import Groq
    ext='wav' if 'wav' in mime else ('ogg' if 'ogg' in mime else 'webm')
    client=Groq(api_key=os.environ['GROQ_API_KEY'],timeout=25)
    answer=client.audio.transcriptions.create(file=(f'voz.{ext}',blob),
        model=os.getenv('GROQ_STT_MODEL','whisper-large-v3-turbo'),language='es',response_format='json')
    return (answer.text or '').strip()[:1800]

@app.websocket('/ws')
async def ws_chat(ws:WebSocket):
    await ws.accept()
    sid=None;personality=validate_personality();mime='audio/webm';allow_provider=False;prompt_edit='';provider='groq';adaptive=True
    try:
        while True:
            data=await ws.receive()
            if data.get('type')=='websocket.disconnect':break
            if data.get('text') is not None:
                try: msg=json.loads(data['text'])
                except json.JSONDecodeError:
                    await ws.send_json({'type':'error','text':'Formato de mensaje no válido.'});continue
                action=msg.get('action')
                if action=='start':
                    if sid:engine.drop(sid)
                    personality=validate_personality(msg.get('personality'))
                    allow_provider=msg.get('allow_provider') is True
                    provider=msg.get('provider','groq') if msg.get('provider','groq') in ('groq','gemini') else 'groq'
                    prompt_edit=str(msg.get('prompt_edit',''))[:6000]
                    adaptive=msg.get('adaptive',True) is True
                    result=engine.new(personality,adaptive=adaptive);sid=result['session']
                    await ws.send_json({'type':'reply',**result})
                elif action=='settings':
                    personality=validate_personality(msg.get('personality'))
                    allow_provider=msg.get('allow_provider') is True
                    provider=msg.get('provider','groq') if msg.get('provider','groq') in ('groq','gemini') else 'groq'
                    prompt_edit=str(msg.get('prompt_edit',''))[:6000]
                    adaptive=msg.get('adaptive',True) is True
                    await ws.send_json({'type':'settings_ok','personality':personality,'adaptive':adaptive})
                elif action=='format':
                    candidate=str(msg.get('mime','audio/webm'))
                    mime=candidate if any(fmt in candidate for fmt in ('webm', 'ogg', 'wav')) else 'audio/webm'
                elif action=='message' and sid:
                    text=str(msg.get('text',''))[:2000]
                    personality=validate_personality(msg.get('personality',personality))
                    allow_provider=msg.get('allow_provider') is True
                    provider=msg.get('provider','groq') if msg.get('provider','groq') in ('groq','gemini') else 'groq'
                    prompt_edit=str(msg.get('prompt_edit',''))[:6000]
                    adaptive=msg.get('adaptive',True) is True
                    await ws.send_json({'type':'transcript','text':text})
                    reply=await asyncio.to_thread(engine.respond,sid,text,personality,prompt_edit,allow_provider,provider,adaptive)
                    sid=reply['session']
                    await ws.send_json({'type':'reply',**reply})
                else:
                    await ws.send_json({'type':'error','text':'Inicia la sesión antes de enviar mensajes.'})
            elif data.get('bytes') is not None and sid:
                audio=data['bytes']
                if not allow_provider:
                    await ws.send_json({'type':'error','text':'Activa el consentimiento para enviar audio a Groq.'});continue
                if len(audio)<1500 or len(audio)>12_000_000:
                    await ws.send_json({'type':'error','text':'Audio vacío o demasiado largo (máximo 12 MB).'});continue
                try:
                    phrase=await asyncio.to_thread(transcribe_audio,audio,mime)
                    if not phrase:
                        await ws.send_json({'type':'error','text':'No se detectó habla clara. Puedes repetirla o escribirla.'});continue
                    await ws.send_json({'type':'transcript','text':phrase})
                    reply=await asyncio.to_thread(engine.respond,sid,phrase,personality,prompt_edit,allow_provider,provider,adaptive)
                    sid=reply['session']
                    await ws.send_json({'type':'reply',**reply})
                except Exception:
                    await ws.send_json({'type':'error','text':'Falló la transcripción. Revisa tu conexión y la API key.'})
    except WebSocketDisconnect:pass
    finally:
        if sid:engine.drop(sid)
