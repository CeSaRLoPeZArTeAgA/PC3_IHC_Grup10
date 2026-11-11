# TriageVoz Rural PC3 — Aplicación unificada

> **Integrantes, Grupo 10 — CC451:** Santa Cruz Basilio, Jesus Diego · López Arteaga, César Omar · Pumayauli Evangelista, Bryan José. Universidad Nacional de Ingeniería · CC451 · 2026-II.

Proyecto académico UNI CC451, Grupo 10. Se conserva la interfaz corporal, el flujo paciente–médico y la PWA de PC2; se integra el motor de intents y personalidad adaptativa del Lab11 dentro de **una sola interfaz**. El diseño conversacional toma como referencia la estructura centrada en voz de VaaniCare, sin copiar su código.

## Inicio manual en Windows

Requiere Node.js 20 o superior. Abre PowerShell en esta carpeta y ejecuta:

```powershell
Copy-Item .env.example .env
notepad .env
node server.mjs
```

Completa las variables `GROQ_API_KEY` y `GEMINI_API_KEY` con claves **nuevas** en `.env`. No publiques el archivo. Sin claves puedes probar el chat textual y los intents; las funciones remotas no se activarán.

Para la transcripción experimental de quechua, define `GEMINI_AUDIO_MODEL=gemini-3.8-flash`. El servidor consulta la lista de modelos de tu clave y, si recibe un 404, prueba otro modelo disponible. Puedes comprobar la configuración abriendo `http://127.0.0.1:4173/api/gemini/models` (solo muestra nombres y estados, nunca las claves). Si no hay ningún modelo compatible con audio, el programa lo informa y mantiene entrada por texto.

Abre **http://127.0.0.1:4173**. También puedes iniciar con `INICIAR_PC3.bat`. **No necesitas Python, `uvicorn` ni iniciar una segunda página en el puerto 8022.**

## Interacción

1. En la pantalla **TriageVoz Rural PC3**, elige **Paciente** o **Personal de salud**. Este último entra directamente a la bandeja de casos compartidos y puede atender cada registro.
2. Como paciente, selecciona **español o quechua sureño experimental**, contraste, tamaño del texto y lectura por voz. Luego escoge **Asistente de voz** o **Formulario táctil**. Ambos usan la misma PWA y el mismo servidor; hay un botón **Regresar** en las pantallas posteriores al inicio.
3. En voz, pulsa **Iniciar entrevista**; el asistente muestra una pregunta y espera respuesta. La silueta contigua marca la región si se reconoce de forma inequívoca en el relato; puedes tocar otra zona para corregirla.
4. Para voz, pulsa **Activar voz una sola vez** y acepta el permiso. El navegador detecta turnos mediante nivel de audio, envía el fragmento y el asistente intenta responder por voz. También puedes escribir si el entorno es ruidoso o una API falla.
5. Al finalizar las cuatro preguntas de voz, el asistente muestra el resumen y pregunta si es correcto. Responde **sí, confirmo** para registrar automáticamente el caso en el servidor. Aparece el código **SALA-XXXXXXXXXXXX** y el asistente lo lee si está activada la voz. También se puede transferir la información al formulario sin registrarla todavía.
6. Desde la bienvenida pulsa **Revisión de diagnóstico · Consultar mi caso**, ingresa el código y consulta si está **en espera de evaluación** o si hay una **respuesta profesional** disponible.
7. El personal de salud abre cada caso, confirma la recepción, elige la personalidad (Técnico, Profesional o Acompañante) y pulsa **Generar borrador de respuesta**. El sistema coloca en **Respuesta profesional simulada** un mensaje para el paciente con cuidados generales no farmacológicos, signos de alarma y datos a confirmar, tomados de un catálogo cerrado por zona; no diagnostica ni receta. El médico lo revisa, lo edita y pulsa **Enviar respuesta**, que pide confirmar antes de registrar: nunca se envía automáticamente.

Al confirmar el resumen de voz, el caso queda guardado antes de ofrecer **Culminar triaje**, que vuelve a la pantalla inicial. En el formulario, el mismo botón aparece después del envío. Los casos ficticios se almacenan en `data/runtime.json` y se mantienen al reiniciar el servidor.

La interfaz incluye un modo de **alto contraste** para las pantallas de inicio, selección, voz, silueta y bandeja, con contraste explícito en las burbujas del paciente y del asistente.

## Personalidad graduable (Tarea 1 · Lec-LAB 11)

- En la pantalla de voz, el panel **Personalidad del asistente** ofrece tres presets (**Técnico**, **Profesional**, **Acompañante**) y seis rasgos 0–10 en «Ajustar los rasgos». El cambio se aplica desde el siguiente turno sin perder lo declarado y se guarda en el perfil.
- En la bandeja médica, **Generar borrador de respuesta** redacta una respuesta para el paciente con la personalidad elegida y un catálogo cerrado de cuidados y signos de alarma por zona. **Enviar respuesta** pide confirmar («¿Registrar esta respuesta?») antes de guardar.
- `npm run prompt` imprime el prompt y un diálogo de ejemplo. Detalle completo: `docs_pc3/03-tarea1-personalidades-PC3.md`.

## Modelo híbrido

- Intents y seguridad determinista: `assistant.mjs` (adaptación de Lab11).
- Consultas complejas: Groq o Gemini, claves locales configuradas en el servidor.
- Español hablado: Groq Whisper STT; síntesis del navegador (`es-PE`).
- Quechua: Gemini multimodal experimental para transcripción de audio; respuesta textual quechua con frases guiadas; Gemini TTS experimental. La precisión de reconocimiento, traducción y pronunciación **no está validada**. No se usa una voz española como sustituto silencioso. Sin servicio disponible se muestra el error y se conserva la opción textual.
- Memoria de sesión: slots de síntomas en memoria; preferencias persistentes por pseudónimo en JSON. Las transcripciones de voz no se almacenan automáticamente.

## Pruebas

```powershell
npm test
```

El directorio `voice-engine/` conserva las fuentes y pruebas de Lab11 para consulta y trazabilidad, pero **no se ejecuta** en esta versión integrada.

## Seguridad y límites

Aplicación académica con **datos ficticios exclusivamente**. No hay autenticación médica ni validación clínica, y no sustituye un profesional. La IA no emite diagnósticos, hipótesis diagnósticas, recetas ni clasificación de urgencia; solo organiza el relato y propone borradores que una persona revisa. El código de caso sirve como identificador, **no como mecanismo seguro de acceso**; no introduzcas información clínica real. El reconocimiento de quechua exige pruebas con personas quechuahablantes antes de cualquier evaluación real. En una urgencia, contactar servicios de emergencia.

Documentación PC2: `docs_pc2/`. Entrega e informe PC3, flujo de trabajo y aportes en Word: `docs_pc3/`. Licencia MIT.
