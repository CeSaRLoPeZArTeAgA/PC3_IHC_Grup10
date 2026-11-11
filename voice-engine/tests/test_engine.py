import os,sys,unittest
sys.path.insert(0,os.path.dirname(os.path.dirname(__file__)))
from engine import Engine,classify,emergency
from prompts import PRESETS,build_prompt,validate_personality
from dialogues import all_examples,FIXED_PATIENT

class TestTaskOne(unittest.TestCase):
    def setUp(self):
        self.engine=Engine(); self.p=PRESETS['Cercana y comprensiva'];self.sid=self.engine.new(self.p)['session']
    def test_six_sliders(self):
        p=validate_personality({'amabilidad':15,'humor':-2,'empatia':8,'paciencia':5})
        self.assertEqual(len(p),6);self.assertEqual(p['amabilidad'],10);self.assertEqual(p['humor'],0)
    def test_prompt_contains_six_values(self):
        prompt=build_prompt(self.p)
        for label in ('Amabilidad','Formalidad','Humor','Entusiasmo','Empatía','Paciencia'):
            self.assertIn(label,prompt)
        self.assertIn('9/10',prompt)
    def test_three_fixed_dialogues(self):
        cases=all_examples();self.assertEqual(len(cases),3)
        for case in cases:
            self.assertEqual(len(case['dialogue']),4)
            self.assertEqual([r['paciente'] for r in case['dialogue']],FIXED_PATIENT)
        self.assertNotEqual(cases[0]['dialogue'][0]['asistente'],cases[1]['dialogue'][0]['asistente'])
    def test_personality_changes_intent(self):
        result1=self.engine.respond(self.sid,'Tengo tos',self.p)
        self.assertIn('gracias',result1['reply'].lower())
        fresh=self.engine.new(PRESETS['Profesional y precisa'])['session']
        result2=self.engine.respond(fresh,'Tengo tos',PRESETS['Profesional y precisa'])
        self.assertIn('presenta',result2['reply'])
    def test_safety_phrase(self):
        self.assertEqual(classify('No puedo respirar'),'seguridad')
        self.assertEqual(self.engine.respond(self.sid,'No puedo respirar')['route'],'seguridad')
        self.assertEqual(self.engine.respond(self.sid,'Tengo tos')['route'],'seguridad')
    def test_negative_does_not_alert(self):
        self.assertFalse(emergency('No tengo dolor en el pecho'))
        self.assertFalse(emergency('No me falta el aire'))
    def test_intents(self):
        self.assertEqual(self.engine.respond(self.sid,'ayuda')['route'],'intent')
        self.assertEqual(self.engine.respond(self.sid,'resumen')['route'],'intent')
    def test_dialogue_slots(self):
        for text in ['Tengo dolor de cabeza','Desde ayer','Moderada','Cansancio']:
            result=self.engine.respond(self.sid,text)
        self.assertIn('resumen',result['reply'].lower());self.assertEqual(len(result['slots']),4)
    def test_reset(self):
        self.engine.respond(self.sid,'Tengo tos');result=self.engine.respond(self.sid,'reiniciar')
        self.assertNotEqual(result['session'],self.sid);self.assertNotIn(self.sid,self.engine.sessions)
    def test_complex_without_consent(self):
        r=self.engine.respond(self.sid,'Explicame por que tengo fiebre',allow_provider=False)
        self.assertEqual(r['route'],'llm_sin_consentimiento')
    def test_no_sqlite_by_default(self):
        self.assertIsNone(self.engine.db_path)

if __name__=='__main__':unittest.main()
