"""Pruebas de identidad del servidor, API y WebSocket sin servicios externos."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from server import app
from version import BUILD

class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client=TestClient(app)
    def tearDown(self):
        self.client.close()
    def test_build_identity(self):
        response=self.client.get('/api/version')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['build'],BUILD)
        self.assertTrue(response.json()['has_six_traits'])
        self.assertTrue(response.json()['has_three_examples'])
    def test_no_old_title(self):
        response=self.client.get('/')
        self.assertIn('TriageVoz Rural',response.text)
        self.assertNotIn('Opción B',response.text)
        self.assertIn('versionTag',response.text)
        self.assertIn('no-store',response.headers.get('cache-control',''))
        self.assertIn('no-store',self.client.get('/static/app.js').headers.get('cache-control',''))
    def test_six_profiles_and_prompt(self):
        conf=self.client.get('/api/config').json()
        self.assertEqual(len(conf['presets']),3)
        self.assertEqual(conf['build'], BUILD)
        body=self.client.get('/api/prompt', params={'amabilidad':2,'formalidad':9,'humor':0,
             'entusiasmo':8,'empatia':7,'paciencia':10}).json()
        for name,v in [('Amabilidad',2),('Formalidad',9),('Humor',0),('Entusiasmo',8),('Empatía',7),('Paciencia',10)]:
            self.assertIn(f'{name}: {v}/10',body['prompt'])
    def test_examples_are_parallel(self):
        examples=self.client.get('/api/examples').json()['examples']
        self.assertEqual(len(examples),3)
        patient=[[turn['paciente'] for turn in case['dialogue']] for case in examples]
        self.assertEqual(patient[0],patient[1]);self.assertEqual(patient[0],patient[2])
        for case in examples:self.assertEqual(len(case['dialogue']),4)
    def test_provider_needs_consent(self):
        response=self.client.post('/api/generate-examples',json={'allow_provider':False})
        self.assertEqual(response.status_code,403)
    def test_websocket_messages_and_alert(self):
        with self.client.websocket_connect('/ws') as ws:
            ws.send_json({'action':'start','personality':{'amabilidad':9,'formalidad':4,'humor':1,'entusiasmo':6,'empatia':10,'paciencia':10},'allow_provider':False})
            hello=ws.receive_json()
            self.assertEqual(hello['type'],'reply');self.assertEqual(hello['route'],'inicio')
            ws.send_json({'action':'settings','personality':{'formalidad':9},'allow_provider':False})
            updated=ws.receive_json()
            self.assertEqual(updated['type'],'settings_ok');self.assertEqual(updated['personality']['formalidad'],9)
            ws.send_json({'action':'message','text':'Tengo tos','personality':updated['personality'],'allow_provider':False})
            transcript=ws.receive_json();response=ws.receive_json()
            self.assertEqual(transcript['type'],'transcript')
            self.assertEqual(response['route'],'intent');self.assertIn('presenta',response['reply'])
            ws.send_json({'action':'message','text':'No puedo respirar','personality':updated['personality'],'allow_provider':False})
            ws.receive_json();alarm=ws.receive_json()
            self.assertEqual(alarm['route'],'seguridad');self.assertIn('urgente',alarm['reply'])
    def test_audio_requires_consent(self):
        with self.client.websocket_connect('/ws') as ws:
            ws.send_json({'action':'start','allow_provider':False})
            ws.receive_json()
            ws.send_bytes(b'Z'*5000)
            err=ws.receive_json()
            self.assertEqual(err['type'],'error');self.assertIn('consentimiento',err['text'])

    def test_binary_websocket_uses_whisper_route_mock(self):
        with patch('server.transcribe_audio',return_value='Tengo tos') as fake:
            with self.client.websocket_connect('/ws') as ws:
                ws.send_json({'action':'start','allow_provider':True})
                self.assertEqual(ws.receive_json()['route'],'inicio')
                ws.send_json({'action':'format','mime':'audio/webm'})
                ws.send_bytes(b'F'*5000)
                transcript=ws.receive_json()
                answer=ws.receive_json()
                self.assertEqual(transcript['type'],'transcript')
                self.assertEqual(transcript['text'],'Tengo tos')
                self.assertEqual(answer['route'],'intent')
                fake.assert_called_once()

    def test_wav_audio_route_and_format(self):
        with patch('server.transcribe_audio',return_value='Tengo fiebre') as fake:
            with self.client.websocket_connect('/ws') as ws:
                ws.send_json({'action':'start','allow_provider':True})
                self.assertEqual(ws.receive_json()['route'],'inicio')
                ws.send_json({'action':'format','mime':'audio/wav'})
                ws.send_bytes(b'RIFF'+b'W'*7000)
                self.assertEqual(ws.receive_json()['type'],'transcript')
                self.assertEqual(ws.receive_json()['route'],'intent')
                self.assertEqual(fake.call_args.args[1],'audio/wav')

    def test_audio_ui_has_recovery_controls(self):
        html=self.client.get('/').text
        js=self.client.get('/static/app.js').text
        for needle in ('id="voiceManual"','id="levelFill"','id="voiceIndicator"','value="0.018"'):
            self.assertIn(needle,html)
        for needle in ('AudioWorkletNode','PRE_ROLL_SECONDS=0.50','MAX_UTTERANCE_SECONDS=12','encodeWav','finalizeSpeech','manualCapture','startReplyTimer'):
            self.assertIn(needle,js)

    def test_llm_route_with_mock_provider(self):
        from engine import Engine
        from llm_clients import LLMReply
        engine=Engine();sid=engine.new()['session']
        with patch('engine.ready',return_value=True), patch('engine.ask',return_value=LLMReply('Puedo organizar tus síntomas en un resumen, pero no diagnosticarte.','groq','fake-model',40)):
            answer=engine.respond(sid,'Explícame por qué estoy enfermo',allow_provider=True)
        self.assertEqual(answer['route'],'llm_groq')
        self.assertIn('organizar tus síntomas',answer['reply'])
    def test_provider_selection_through_websocket(self):
        with patch('engine.ready',return_value=True), patch('engine.ask') as fake:
            from llm_clients import LLMReply
            fake.return_value=LLMReply('¿Puedes indicar la molestia?','gemini','modelo-demo',10)
            with self.client.websocket_connect('/ws') as ws:
                ws.send_json({'action':'start','provider':'gemini','allow_provider':True})
                ws.receive_json()
                ws.send_json({'action':'message','provider':'gemini','text':'Explícame por qué tengo dolor de cabeza','allow_provider':True})
                ws.receive_json();reply=ws.receive_json()
                self.assertEqual(reply['route'],'llm_gemini')
                self.assertEqual(fake.call_args.args[0],'gemini')
    def test_comparison_does_not_use_patient_session(self):
        from llm_clients import LLMReply
        def deterministic(provider,*args,**kwargs):return LLMReply('¿Desde cuándo tienes la molestia?',provider,'mock',31)
        with patch('server.ready',return_value=True), patch('server.ask',side_effect=deterministic):
            response=self.client.post('/api/compare-models',json={'allow_provider':True,'personality':{'amabilidad':8}})
        self.assertEqual(response.status_code,200)
        body=response.json();self.assertEqual({r['provider'] for r in body['results']},{'groq','gemini'})
        self.assertEqual({r['status'] for r in body['results']},{'ok'})
        self.assertIn('FICTICIA',body['input'])
    def test_comparison_requires_consent(self):
        self.assertEqual(self.client.post('/api/compare-models',json={'allow_provider':False}).status_code,403)
    def test_new_accessibility_and_provider_ui(self):
        html=self.client.get('/').text
        for id_ in ('provider','largeText','highContrast','compareLLM','sliderList','zone-buttons'):
            if id_=='zone-buttons':self.assertIn('zone-buttons',html)
            else:self.assertIn('id="'+id_+'"',html)
        self.assertIn('LEC11-T2-2026.11.10-R5',html)

if __name__=='__main__':unittest.main()
