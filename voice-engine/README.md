# TriageVoz Rural — LEC-LAB 11 — Tarea 2

**Versión:** `LEC11-T2-2026.11.10-R5` · Basada en la versión estable R4 de la Tarea 1.

## Objetivo

Adaptar la **personalidad efectiva** según expresiones explícitas del usuario, conservando el contexto de síntomas y aplicando seis principios de VUI. El prototipo no interpreta emociones a partir del audio, no hace diagnósticos, no clasifica urgencias y no reemplaza a profesionales de salud.

## Iniciar en Windows (VSCode / PowerShell)

1. Extrae el proyecto en una **carpeta nueva** y ábrela en VSCode.
2. En la terminal ejecuta:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
.\.venv\Scripts\python.exe start.py
```

3. Abre la URL que imprima la consola (por defecto `http://127.0.0.1:8022`). El puerto 8022 evita confundirlo con R3/R4 (8011).
4. Verifica la etiqueta **LEC11-T2-2026.11.10-R5**.
5. Para probar sin claves usa **Iniciar solo texto**. Para voz se necesita `GROQ_API_KEY` y consentimiento para la transcripción.
6. Para detener, pulsa `Ctrl+C`. Alternativa: doble clic en `INICIAR_TRIAGEVOZ.bat`.

## Configuración de proveedores

En `.env` se configuran las claves, **nunca en el HTML, ni en GitHub**:

```env
GROQ_API_KEY=
GROQ_CHAT_MODEL=openai/gpt-oss-120b
GROQ_STT_MODEL=whisper-large-v3-turbo
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
SAVE_TRANSCRIPTS=0
```

`openai/gpt-oss-120b` reemplaza al antiguo `llama-3.3-70b-versatile`, retirado del nivel gratuito/developer de Groq en agosto de 2026. El modelo puede cambiarse si tu cuenta tiene otros habilitados. Gemini usa el endpoint Interactions; prueba el acceso real con tu clave. Las respuestas básicas por intents y las demostraciones de escenarios no requieren API key. **No se guardan transcripciones por defecto.**

## Tarea 2: principios y funcionamiento

- **Reconocer intención:** reglas locales detectan confusión, inquietud verbal, petición de rapidez y frases de alarma.
- **Aprovechar contexto:** el estado por sesión conserva los datos comunicados y el último estilo conversacional.
- **Cooperar y responder:** una duda de comprensión no se guarda equivocadamente como síntoma: se explica y se retoma la pregunta pendiente.
- **Divulgación progresiva:** una pregunta por turno cuando corresponde.
- **Variedad:** el estilo efectivo cambia según el evento sin cambiar los hechos registrados.
- **Tomar turnos:** WebSocket entrega transcripción y respuesta; el frontend tiene entrada por texto y modo voz con captura manual de respaldo.

En la pestaña **Adaptación Tarea 2** se observan el modo, su explicación, los seis valores efectivos y dos escenarios **ficticios** reproducibles: cita de rutina y llamada con alarma. La barra lateral conserva los seis valores **base** configurados manualmente; los efectivos no alteran los deslizadores, para que puedas comparar antes/después. La opción “Adaptar personalidad” permite desactivar la función.

## Prueba del flujo de conversación

Inicia por texto y envía (en este orden):

1. `Tengo dolor de cabeza desde ayer.` → rutina.
2. `No entiendo qué significa intensidad.` → explicación sencilla, sin perder la pregunta pendiente.
3. `Tengo miedo y estoy nervioso.` → apoyo emocional.
4. `Ya estoy tranquilo, es leve.` → rutina.

Inicia **otra** sesión y escribe `No puedo respirar y tengo dolor fuerte en el pecho.` → respuesta de seguridad y detención. **Es una prueba con datos inventados**, no un diagnóstico clínico.

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Los tests incluyen motor, seguridad, proveedores simulados, REST y WebSocket. En el entorno de desarrollo se ejecutaron **44 pruebas**. Las imágenes del informe se generaron con la interfaz real y el motor de reglas real, simulando únicamente el transporte del navegador (no son pruebas de audio físico ni de llamadas externas a LLM).

## Estructura

- `start.py`: arranque en puerto independiente.
- `server.py`: servidor FastAPI, rutas HTTP y WebSocket.
- `engine.py`: motor de registro de síntomas e intents.
- `adaptive.py`: decisiones de contexto y personalidad adaptativa.
- `prompts.py`: perfiles y seguridad.
- `llm_clients.py`: Groq/Gemini opcionales.
- `static/`: interfaz, estilos y lógica de audio.
- `tests/`: pruebas automáticas.

**Seguridad:** solo para uso académico con pacientes ficticios, sin evaluación clínica. Los avisos de alarma son ilustrativos y pueden ser incompletos. En una emergencia real, acudir a servicios de salud.
