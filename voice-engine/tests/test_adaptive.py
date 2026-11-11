"""Tarea 2: pruebas reproducibles del cambio de personalidad por contexto."""
import unittest
from fastapi.testclient import TestClient
from adaptive import AdaptiveEngine, context_decision, effective_personality
from prompts import DEFAULT
from server import app


class AdaptiveTests(unittest.TestCase):
    def setUp(self):
        self.eng=AdaptiveEngine()
        self.sid=self.eng.new(DEFAULT)['session']
    def say(self,text,**kw):
        return self.eng.respond(self.sid,text,personality=DEFAULT,adaptive=True,**kw)
    def test_routine_starts_with_base(self):
        r=self.say('Tengo dolor de cabeza desde ayer.')
        self.assertEqual(r['adaptive']['mode'],'rutina')
        self.assertEqual(r['adaptive']['effective'],DEFAULT)
    def test_confusion_changes_style_without_losing_slot(self):
        self.say('Tengo dolor de cabeza desde ayer.')
        r=self.say('No entiendo qué significa intensidad.')
        self.assertEqual(r['adaptive']['mode'],'comprension')
        self.assertEqual(r['adaptive']['effective']['formalidad'],2)
        self.assertEqual(self.eng.sessions[self.sid]['index'],1)
        self.assertNotIn('inicio',self.eng.sessions[self.sid]['slots'])
    def test_anxiety_more_empathic(self):
        r=self.say('Tengo miedo y estoy nervioso.')
        self.assertEqual(r['adaptive']['mode'],'contencion')
        self.assertEqual(r['adaptive']['effective']['empatia'],10)
        self.assertNotIn('molestia',self.eng.sessions[self.sid]['slots'])
    def test_urgency_makes_response_brief_not_emergency(self):
        r=self.say('Tengo prisa, responde rápido por favor.')
        self.assertEqual(r['adaptive']['mode'],'brevedad')
        self.assertFalse(self.eng.sessions[self.sid]['ended'])
    def test_alarm_safety_has_priority(self):
        r=self.say('No puedo respirar y tengo dolor fuerte en el pecho.')
        self.assertEqual(r['adaptive']['mode'],'alarma')
        self.assertEqual(r['route'],'seguridad')
        self.assertTrue(self.eng.sessions[self.sid]['ended'])
        self.assertIn('atención médica urgente',r['reply'])
    def test_explicit_negation_no_alert(self):
        r=self.say('No tengo dolor en el pecho. Tengo dolor de cabeza.')
        self.assertNotEqual(r['adaptive']['mode'],'alarma')
    def test_reset_mode_after_comfort(self):
        self.say('Me preocupa mucho.')
        r=self.say('Ya estoy tranquilo, la molestia es leve.')
        self.assertEqual(r['adaptive']['mode'],'rutina')
    def test_adaptation_can_be_turned_off(self):
        r=self.eng.respond(self.sid,'Tengo miedo.',personality=DEFAULT,adaptive=False)
        self.assertEqual(r['adaptive']['mode'],'rutina')
        self.assertFalse(r['adaptive']['enabled'])
    def test_context_persistence(self):
        self.say('Me preocupa mucho.')
        r=self.say('Desde ayer.')
        self.assertEqual(r['adaptive']['mode'],'contencion')
    def test_context_detector_emergency_first(self):
        self.assertEqual(context_decision('Tengo miedo porque no puedo respirar.')[0],'alarma')
    def test_effective_does_not_mutate_base(self):
        p=dict(DEFAULT)
        effective_personality(p,'comprension')
        self.assertEqual(p,DEFAULT)
    def test_api_examples(self):
        with TestClient(app) as c:
            resp=c.get('/api/adaptive-examples')
            self.assertEqual(resp.status_code,200)
            examples=resp.json()['examples']
            self.assertEqual(len(examples),2)
            self.assertEqual(examples[-1]['turns'][0]['route'],'seguridad')
    def test_websocket_switch(self):
        with TestClient(app) as c:
            with c.websocket_connect('/ws') as ws:
                ws.send_json({'action':'start','personality':DEFAULT,'adaptive':True})
                first=ws.receive_json();self.assertEqual(first['type'],'reply')
                ws.send_json({'action':'message','text':'No entiendo qué es intensidad.','personality':DEFAULT,'adaptive':True})
                self.assertEqual(ws.receive_json()['type'],'transcript')
                ans=ws.receive_json()
                self.assertEqual(ans['adaptive']['mode'],'comprension')
                ws.send_json({'action':'message','text':'Tengo prisa.','personality':DEFAULT,'adaptive':False})
                ws.receive_json();r=ws.receive_json()
                self.assertEqual(r['adaptive']['mode'],'rutina')

if __name__=='__main__':unittest.main()
