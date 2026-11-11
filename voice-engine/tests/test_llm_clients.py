import os, sys, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from llm_clients import _gemini_output, ready, model_name, ProviderError, ask

class AdapterTests(unittest.TestCase):
    def test_gemini_new_interactions_response(self):
        data={'steps':[{'type':'model_output','content':[{'type':'text','text':'Primera '},{'type':'text','text':'parte'}]}]}
        self.assertEqual(_gemini_output(data),'Primera parte')
    def test_no_gemini_key_no_remote_call(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY':''}):
            self.assertFalse(ready('gemini'))
            with self.assertRaises(ProviderError):ask('gemini','seguridad','texto')
    def test_default_models(self):
        self.assertTrue(model_name('groq'))
        self.assertTrue(model_name('gemini'))
    def test_rest_providers_without_network(self):
        from llm_clients import ask
        calls=[]
        class Resp:
            def __init__(self,data):self.data=data
            def raise_for_status(self):pass
            def json(self):return self.data
        class Client:
            def __init__(self, **kwargs):pass
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def post(self,url,**kwargs):
                calls.append((url,kwargs))
                if 'api.groq.com' in url:return Resp({'choices':[{'message':{'content':'Respuesta de prueba Groq'}}]})
                return Resp({'steps':[{'type':'model_output','content':[{'type':'text','text':'Respuesta de prueba Gemini'}]}]})
        with patch.dict(os.environ, {'GROQ_API_KEY':'clave-falsa', 'GEMINI_API_KEY':'clave-falsa'}), patch('llm_clients.httpx.Client',Client):
            gr=ask('groq','reglas','pregunta')
            ge=ask('gemini','reglas','pregunta')
        self.assertIn('Groq',gr.text);self.assertIn('Gemini',ge.text)
        self.assertIn('/interactions',calls[-1][0])
        self.assertEqual(calls[1][1]['json']['system_instruction'],'reglas')
    def test_unknown_provider(self):
        with self.assertRaises(ProviderError):ask('no-existe','','')

if __name__=='__main__':unittest.main()
