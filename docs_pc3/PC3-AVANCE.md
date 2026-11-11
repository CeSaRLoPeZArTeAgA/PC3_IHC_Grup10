# PC3 — Avance funcional y evidencia de implementación

## Base conservada

Se mantiene la interfaz PC2: selección de idioma/accesibilidad, silueta corporal frontal y posterior, entrevista secuencial, confirmación, resumen, envío de casos y bandeja del médico. Los datos son ficticios. Se preservan las historias de usuario, RF/RNF y trazabilidad de `docs/` como antecedente para completar y actualizar el informe PC3.

## Módulos integrados

1. **PWA y flujo de caso** (`public/`, `server.mjs`): conserva las cinco etapas, servicio offline parcial y la interfaz táctil.
   `public/navigation.js` agrega bienvenida, selección de rol, configuración del paciente y elección de modalidad con navegación de regreso. `public/vui.js` muestra silueta durante la entrevista hablada, resalta la zona mencionada cuando se puede reconocer y permite corrección táctil antes de transferir la información al formulario.
2. **VUI unificada** (`assistant.mjs`, `public/vui.js`): adapta los intents y estados de personalidad del Lab11 al mismo servidor Node de la PWA. Integra reconocimiento Whisper para español, Gemini experimental para audio quechua y síntesis TTS experimental en quechua. La Tarea 2 original se conserva como referencia en `voice-engine/`, pero ya no necesita ejecutarse.
   La transcripción quechua utiliza `gemini-api.mjs`: consulta el catálogo de modelos disponible para la clave y prioriza la API Interactions de Gemini 3.8, con alternativa `generateContent` para modelos antiguos. Un HTTP 404 deja de confundirse con un problema del micrófono.
3. **Personalización persistente** (`/api/profiles`): preferencias, ritmo, correcciones y estilo conversacional se guardan en JSON por identificador ficticio. El estilo del selector PC3 se almacena, pero la personalidad efectiva del asistente Lab11 se configura dentro de su propio módulo.
4. **Colaboración asíncrona de demostración** (`/api/rooms`, `/api/cases/*`): dos navegadores conectados al mismo servidor pueden compartir casos, confirmaciones y respuestas; la vista se refresca cada seis segundos. No equivale a salas con autenticación o voz simultánea.
5. **Diseño emocional**: nivel visceral (jerarquía visual, contrastes), conductual (una pregunta por turno, corrección, información de estado y confirmación), reflexivo (resumen revisable, acuse del profesional y control de preferencias). Lab11 adapta tono y ritmo a declaraciones textuales de inquietud o confusión; no infiere emociones clínicas desde audio.

## Estado frente a la rúbrica

| Requisito | Evidencia / limitación |
| --- | --- |
| VUI | Web Speech API PC2 + módulo WebSocket/Whisper Lab11 |
| LLM intercambiable | `voice-engine/llm_clients.py`: Groq y Gemini, opción de intents sin clave |
| PWA | `public/manifest.webmanifest`, `public/sw.js` |
| Personalización continua | `server.mjs` perfiles JSON y adaptación en `voice-engine/adaptive.py` (persistencias independientes) |
| Multiusuario | Bandeja de casos compartida con respuestas y actualización periódica; sin autenticación |
| Diseño emocional | Elementos PC2 y reglas Lab11; evaluación con usuarios pendiente |
| Repositorio y licencia | README, MIT, documentación, datos simulados y C4 previos; actualizar C4 de PC3 |

No se declara demostrado el 70% sin una ejecución verificada y capturas nuevas. Tampoco se han validado llamadas reales de LLM/Whisper/Gemini TTS ni pruebas físicas de micrófono en este entorno. La precisión del quechua (variante cusqueña) requiere evaluación por hablantes competentes, especialmente en síntomas médicos.

## Evidencias necesarias para entregar

- Capturas PC3: pestaña paciente, silueta y entrevista, asistente de voz, perfil recuperado después de recargar, bandeja médica en segundo navegador, confirmación/acuse.
- Ensayo de voz y transcripción con permisos del micrófono y API autorizada.
- Ejecución de pruebas `npm test` y `python -m unittest discover -s tests -v` dentro de `voice-engine`.
- Video grupal: máximo 3 minutos por integrante; respetar duración máxima y hora del enunciado.
- Actualizar matriz de trazabilidad vinculando nuevos requisitos PC3 a pantalla, código, prueba y captura.

## Seguridad

Solo datos inventados. Claves siempre en variables de entorno o `.env` local ignorado por Git. Los perfiles son seudónimos y la demostración no implementa autenticación, protección de datos clínicos ni validación de triaje. No usar con pacientes reales.
