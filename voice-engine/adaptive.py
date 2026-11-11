"""Tarea 2: adaptación explicable del estilo de conversación.

No analiza voz emocional, no evalúa riesgo clínico y no diagnostica.
Las alarmas se activan en el motor determinista de intents.
"""
from __future__ import annotations
import re
from engine import Engine, QUESTIONS, emergency, normalize
from prompts import validate_personality, phrasing, build_prompt

MODES = {
    'rutina': ('Rutina: orientación normal, cercana y clara.', {}),
    'comprension': ('Dificultad para comprender: frases sencillas y mayor paciencia.',
                    {'amabilidad':8,'formalidad':2,'humor':0,'entusiasmo':2,'empatia':9,'paciencia':10}),
    'contencion': ('Preocupación expresada: escucha empática y tono calmado.',
                   {'amabilidad':9,'formalidad':3,'humor':0,'entusiasmo':1,'empatia':10,'paciencia':10}),
    'brevedad': ('Prisa explícita: priorizar claridad y respuestas cortas.',
                  {'amabilidad':5,'formalidad':5,'humor':0,'entusiasmo':1,'empatia':7,'paciencia':4}),
    'alarma': ('Señal de posible peligro: instrucción inmediata de buscar atención urgente.',
               {'amabilidad':6,'formalidad':7,'humor':0,'entusiasmo':0,'empatia':8,'paciencia':7}),
}

EASY = re.compile(r'\b(?:no entiendo|no comprendo|explica(?:me)?(?:\s+mas)?\s+facil|mas simple|palabras sencillas|que significa|no se que responder)\b')
DISTRESS = re.compile(r'\b(?:tengo miedo|estoy asustad[oa]|me preocupa|estoy nervios[oa]|estoy angustiad[oa]|siento panico|me da miedo)\b')
HURRY = re.compile(r'\b(?:tengo prisa|voy apurad[oa]|rapido por favor|no tengo tiempo|estoy de prisa|contesta rapido|necesito rapidez)\b')
RESET = re.compile(r'\b(?:ya estoy tranquil[oa]|me siento mas tranquil[oa]|estoy mas calmad[oa]|ahora entiendo|ya comprendo|sin prisa)\b')
SYMPTOMS = re.compile(r'\b(?:dolor|fiebre|tos|cansancio|mareo|nausea|vomito|hinchazon|sangre|molestia|respiracion|respirar)\b')


def context_decision(text: str, prior='rutina'):
    """Prioridad: peligro > confusión > temor > prisa > restablecimiento > memoria del contexto.

    Devuelve (modo, evento, es_intervencion_metaconversacional).
    """
    if emergency(text):
        return 'alarma','Alarma verbal detectada por regla determinista.',False
    norm = normalize(text)
    if EASY.search(norm): mode, why = 'comprension','Solicitud explícita de explicación sencilla.'
    elif DISTRESS.search(norm): mode, why = 'contencion','El paciente manifestó preocupación o miedo.'
    elif HURRY.search(norm): mode, why = 'brevedad','El paciente solicitó mayor rapidez.'
    elif RESET.search(norm): mode, why = 'rutina','El paciente indicó que volvió a estar tranquilo o comprendió.'
    else: mode, why = prior,'Se conserva el contexto conversacional anterior.'
    meta= mode in ('comprension','contencion','brevedad') and not SYMPTOMS.search(norm)
    return mode, why, meta


def effective_personality(base, mode):
    base=validate_personality(base)
    if mode not in MODES: mode='rutina'
    return {**base, **MODES[mode][1]}


def context_prompt(mode):
    meaning=MODES.get(mode,MODES['rutina'])[0]
    return ("\n\nCONTEXTO DE LA SESIÓN (Tarea 2): " + meaning +
            " No hagas inferencias médicas ni atribuyas estados psicológicos ocultos. "
            "Adapta solo el estilo lingüístico. La seguridad y el control humano tienen prioridad.")


class AdaptiveEngine(Engine):
    def new(self, personality=None, adaptive=True):
        answer=super().new(personality)
        s=self.sessions[answer['session']]
        s['base_personality']=validate_personality(personality)
        s['adaptive_enabled']=bool(adaptive)
        s['mode']='rutina'
        return self._annotate(answer,s,'Inicio de sesión; personalidad base seleccionada.')

    def _annotate(self, answer, session, reason):
        mode=session.get('mode','rutina')
        answer['adaptive']={
            'enabled':bool(session.get('adaptive_enabled',True)),
            'mode':mode,
            'description':MODES[mode][0],
            'reason':reason,
            'base':dict(session.get('base_personality',{})),
            'effective':dict(session.get('personality',{})),
            'notice':'La adaptación se basa únicamente en palabras explícitas del diálogo; no diagnostica emociones.'
        }
        return answer

    def respond(self, sid, text, personality=None, edited_prompt='', allow_provider=False,
                provider='groq', adaptive=True):
        if sid not in self.sessions:
            return self.new(personality,adaptive=adaptive)
        s=self.sessions[sid]
        base=validate_personality(personality if personality is not None else s.get('base_personality'))
        s['base_personality']=base
        s['adaptive_enabled']=bool(adaptive)
        mode,reason,meta=context_decision(text,s.get('mode','rutina')) if adaptive else ('rutina','Adaptación desactivada por el usuario.',False)
        s['mode']=mode
        effective=effective_personality(base,mode)
        s['personality']=effective
        if meta and not s['ended']:
            cleaned=str(text).strip()[:2000]
            if cleaned:
                self._log(sid,'paciente',cleaned)
                s['history'].append({'role':'user','content':cleaned})
            index=min(s['index'],len(QUESTIONS)-1)
            current=QUESTIONS[index][1] if s['index']<len(QUESTIONS) else '¿La información del resumen es correcta?'
            if mode=='comprension':
                answer='Por supuesto. Te lo explico de otra manera. '
                if 'intensidad' in normalize(text):
                    answer+='Intensidad quiere decir qué tan fuerte se siente una molestia: leve, moderada o fuerte. '
                if s['index']==2: current='¿Tu molestia es leve, moderada o fuerte?'
                answer+=phrasing(current,effective,first=True)
            elif mode=='contencion':
                answer='Entiendo que esto puede preocuparte. Puedes responder con calma. '+phrasing(current,effective,first=True)
            else:
                answer='Iré al punto. '+phrasing(current,effective,first=True)
            result=self._out(sid,answer,'intent_contextual')
        else:
            style=str(edited_prompt or build_prompt(effective))[:5500]+context_prompt(mode)
            result=super().respond(sid,text,effective,style,allow_provider,provider)
        session=self.sessions.get(result['session'],s)
        # Si la conversación fue reiniciada, se vuelve al estado de rutina.
        if result['session'] != sid:
            session['base_personality']=base
            session['adaptive_enabled']=bool(adaptive)
            session['mode']='rutina'
            reason='Entrevista reiniciada; contexto restablecido.'
        return self._annotate(result,session,reason)
