"""Adaptadores de dos proveedores. No se envían credenciales al navegador.

El servicio remoto sólo se utiliza con consentimiento expreso. No se registra
contenido clínico ni se hacen reintentos automáticos sobre transcripciones.
"""
from __future__ import annotations
import os, time
from dataclasses import dataclass
import httpx

PROVIDERS=("groq", "gemini")

class ProviderError(RuntimeError):
    pass

@dataclass(frozen=True)
class LLMReply:
    text: str
    provider: str
    model: str
    elapsed_ms: int

def ready(provider: str) -> bool:
    return bool(os.getenv("GROQ_API_KEY" if provider=="groq" else "GEMINI_API_KEY")) if provider in PROVIDERS else False

def model_name(provider: str) -> str:
    if provider == "groq":
        return os.getenv("GROQ_CHAT_MODEL", "openai/gpt-oss-120b")
    if provider == "gemini":
        return os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    raise ProviderError("Proveedor desconocido")

def _gemini_output(payload: dict) -> str:
    # La API Interactions (2026) devuelve 'steps', no 'outputs'.
    chunks=[]
    for step in payload.get("steps", []):
        if step.get("type") == "model_output":
            chunks=[part.get("text", "") for part in step.get("content", []) if part.get("type")=="text"]
    return "".join(chunks).strip()

def ask(provider: str, system: str, user_text: str, *, temperature: float=.35) -> LLMReply:
    if provider not in PROVIDERS: raise ProviderError("Proveedor desconocido")
    if not ready(provider): raise ProviderError(f"Falta la clave API para {provider} en .env")
    model=model_name(provider)
    started=time.perf_counter()
    try:
        with httpx.Client(timeout=httpx.Timeout(22.0, connect=8.0),follow_redirects=False) as client:
            if provider=="groq":
                resp=client.post("https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization":f"Bearer {os.environ['GROQ_API_KEY']}"},
                    json={"model":model,"temperature":temperature,"max_tokens":700,
                          "messages":[{"role":"system","content":system},
                                      {"role":"user","content":user_text}]})
                resp.raise_for_status()
                text=resp.json()["choices"][0]["message"].get("content","") or ""
            else:
                resp=client.post("https://generativelanguage.googleapis.com/v1beta/interactions",
                    headers={"x-goog-api-key":os.environ['GEMINI_API_KEY']},
                    json={"model":model,"system_instruction":system,"input":user_text,
                          "generation_config":{"temperature":temperature}})
                resp.raise_for_status()
                text=_gemini_output(resp.json())
    except (httpx.HTTPError, KeyError, ValueError, IndexError, TypeError) as ex:
        raise ProviderError(f"No se pudo completar la llamada a {provider} ({type(ex).__name__}).") from ex
    text=text.strip()
    if not text:raise ProviderError(f"{provider} devolvió una respuesta vacía o no textual")
    return LLMReply(text,provider,model,round((time.perf_counter()-started)*1000))
