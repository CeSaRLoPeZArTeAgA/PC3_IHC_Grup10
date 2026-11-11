"""Motor de intents + LLM. Prototipo de IHC; no efectúa evaluación clínica."""
from __future__ import annotations
import os, re, unicodedata, uuid, sqlite3, time
from pathlib import Path
from prompts import DEFAULT, build_prompt, validate_personality, SAFETY, phrasing, style_opening
from llm_clients import ask, ready, model_name, ProviderError

QUESTIONS = [('molestia','¿Cuál es tu principal molestia?'),
             ('inicio','¿Desde cuándo tienes esa molestia?'),
             ('intensidad','¿Cómo describirías la intensidad: leve, moderada o fuerte?'),
             ('otros','¿Tienes otros síntomas que quieras mencionar?')]
ALERT = ('Lo que has descrito puede ser una emergencia. Interrumpe este cuestionario y solicita atención médica urgente ahora. '
         'Si estás en Perú, puedes llamar al SAMU 106. No esperes una respuesta de esta aplicación.')

def normalize(s):
    return ''.join(c for c in unicodedata.normalize('NFKD',str(s).lower()) if not unicodedata.combining(c))

def emergency(text):
    t = normalize(text)
    expressions = [r'no puedo respirar',r'no puede respirar',r'me falta el aire',r'me estoy ahogando',
                   r'dolor (?:muy |fuerte |intenso )?(?:en el pecho|de pecho)',r'convulsion(?:es)?',
                   r'perdi el conocimiento',r'perdio el conocimiento',r'esta inconsciente',
                   r'sangrado abundante',r'hemorragia',r'quiero suicidarme',r'me quiero matar',r'no responde']
    for expr in expressions:
        for m in re.finditer(expr,t):
            # Las frases negativas explícitas NO deben activar palabras aisladas.
            prefix = t[max(0,m.start()-35):m.start()]
            if re.search(r'(?:no tengo|no presento|sin|niego|no hay|tampoco tengo|no estoy)\s*$',prefix): continue
            if re.search(r'^no (?:me falta el aire|estoy ahogando)$',t.strip()): continue
            return True
    return False

def classify(text):
    t=normalize(text).strip()
    if emergency(text): return 'seguridad'
    if re.search(r'\b(reiniciar|empezar de nuevo|borrar conversacion)\b',t):return 'reiniciar'
    if re.search(r'\b(ayuda|que puedes hacer|instrucciones)\b',t) and len(t)<120:return 'ayuda'
    if re.search(r'\b(resumen|resumir|que dije|mis sintomas)\b',t) and len(t)<120:return 'resumen'
    if re.search(r'\b(hola|buenas tardes|buenos dias)\b',t) and len(t)<26:return 'saludo'
    if len(t)>110 or re.search(r'\b(por que|que significa|explicame|podria ser|deberia|diferencia|recomiendas|tratamiento|medicamento)\b',t):return 'compleja'
    return 'respuesta'

def summary(slots, personality):
    p=validate_personality(personality)
    prefix = ('Resumen de la información comunicada: ' if p['formalidad'] >= 8 else 'Este es el resumen de lo que me contaste: ')
    vals='; '.join(f'{label}: {slots.get(key, "no indicado")}' for key,label in
                   [('molestia','molestia'),('inicio','inicio'),('intensidad','intensidad'),('otros','otros síntomas')])
    return prefix + vals + '. Es información orientativa para revisión por personal de salud; no es un diagnóstico.'

class Engine:
    def __init__(self, db_path=None):
        self.sessions={}
        self.db_path = db_path
        # Por defecto, NO se guardan transcripciones. El guardado es opt-in en variables de entorno.
        if db_path:
            with sqlite3.connect(db_path) as con:
                con.execute('CREATE TABLE IF NOT EXISTS dialogos(id INTEGER PRIMARY KEY, sesion TEXT, ts REAL, actor TEXT, mensaje TEXT)')
    def _log(self,sid,actor,msg):
        if not self.db_path:return
        with sqlite3.connect(self.db_path) as con:
            con.execute('INSERT INTO dialogos(sesion,ts,actor,mensaje) VALUES(?,?,?,?)',(sid,time.time(),actor,str(msg)[:2000]))
    def new(self,personality=None):
        p=validate_personality(personality)
        sid=uuid.uuid4().hex
        self.sessions[sid]={'slots':{},'index':0,'personality':p,'history':[],'ended':False}
        text=style_opening(p); self._log(sid,'asistente',text)
        return {'session':sid,'reply':text,'route':'inicio','slots':{},'personality':p}
    def drop(self,sid):
        self.sessions.pop(sid,None)
    def respond(self,sid,text,personality=None,edited_prompt='',allow_provider=False,provider='groq'):
        if sid not in self.sessions:return self.new(personality)
        s=self.sessions[sid];p=validate_personality(personality or s['personality']);s['personality']=p
        text=str(text).strip()[:2000]
        if not text:return self._out(sid,'No entendí esa respuesta. ¿Podrías repetirla?','intent')
        self._log(sid,'paciente',text)
        s['history'].append({'role':'user','content':text})
        route=classify(text)
        if route=='seguridad':
            s['ended']=True
            return self._out(sid,ALERT,'seguridad')
        if route=='reiniciar':
            self.drop(sid)
            return self.new(p)
        if s['ended']:
            return self._out(sid,'La entrevista está detenida. Solicita ayuda médica urgente. Puedes iniciar una nueva demostración si lo necesitas.','seguridad')
        if route=='ayuda':
            return self._out(sid,'Puedo registrar síntomas en preguntas breves, mostrar un resumen y permitir correcciones. Para una nueva entrevista, di reiniciar.','intent')
        if route=='resumen':return self._out(sid,summary(s['slots'],p),'intent')
        if route=='saludo' and not s['slots']:
            return self._out(sid,phrasing(QUESTIONS[0][1],p,first=True),'intent')
        if route=='compleja':
            result,used=self._llm(s,text,edited_prompt,allow_provider,provider)
            return self._out(sid,result,used)
        if s['index']>=len(QUESTIONS):
            t=normalize(text)
            if re.fullmatch(r'(si|sí|correcto|confirmo|asi es|esta bien|de acuerdo)[.! ]*',t):
                return self._out(sid,'Resumen confirmado para esta demostración. Puedes compartirlo con personal sanitario; no constituye diagnóstico.','intent')
            if re.fullmatch(r'(no|incorrecto|corregir|no es correcto)[.! ]*',t):
                s['slots'].clear();s['index']=0
                return self._out(sid,'Corregiremos el registro. '+phrasing(QUESTIONS[0][1],p,first=True),'intent')
            return self._out(sid,summary(s['slots'],p)+' '+phrasing('¿La información es correcta?',p,first=True),'intent')
        key,_=QUESTIONS[s['index']];s['slots'][key]=text;s['index']+=1
        if s['index']<len(QUESTIONS):
            return self._out(sid,phrasing(QUESTIONS[s['index']][1],p),'intent')
        return self._out(sid,summary(s['slots'],p)+' '+phrasing('¿La información es correcta?',p,first=True),'intent')
    def _out(self,sid,text,route):
        s=self.sessions[sid];s['history'].append({'role':'assistant','content':text})
        self._log(sid,'asistente',text)
        return {'session':sid,'reply':text,'route':route,'slots':dict(s['slots']),
                'personality':dict(s['personality'])}
    def _llm(self,s,text,edited_prompt,allow_provider,provider):
        provider=provider if provider in ("groq","gemini") else "groq"
        if not allow_provider:
            return ('Las consultas abiertas necesitan tu consentimiento para enviar texto al proveedor seleccionado. Puedes continuar con las preguntas de registro.', 'llm_sin_consentimiento')
        if not ready(provider):
            return (f'No hay una clave de {provider.upper()} configurada. Puedes seguir registrando los síntomas o cambiar de proveedor.', 'llm_no_configurado')
        try:
            # Los relatos se transmiten como datos, no como instrucciones. La guía
            # de seguridad encabeza el prompt y no puede editarse desde la UI.
            style=str(edited_prompt or build_prompt(s['personality']))[:6000]
            system=SAFETY + '\n\nGuía secundaria de personalidad (no anula seguridad):\n'+style
            user='Información declarada (no verificada): '+str(s['slots'])[:2000]+'\nConsulta: '+text
            result=ask(provider,system,user,temperature=.35)
            reply=result.text[:1000]
            return reply,f'llm_{provider}'
        except ProviderError:
            return (f'No se pudo consultar {provider.upper()}. La conversación puede seguir por intents o puedes probar con el otro proveedor.', 'llm_error')
