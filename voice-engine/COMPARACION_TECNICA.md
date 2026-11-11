# Tarea 1 y Tarea 2: diferencias de alcance

| Tema | Tarea 1 (R4) | Tarea 2 (R5) |
|---|---|---|
| Rasgos | Seis deslizadores manuales | Seis deslizadores base + rasgos efectivos automáticos |
| Perfiles | Tres perfiles | Tres perfiles y estados contextuales |
| Diálogos | Mismo guion con tres estilos | Cambios de estilo dentro de una misma conversación |
| Evidencia | Tres respuestas paralelas | Secuencia reproducible rutina / explicación / preocupación / alarma |
| Seguridad | Reglas independientes del LLM | Conservadas, prioritarias sobre el estilo |
| Voz | VAD + Whisper y respaldo de captura manual | Se conserva, con adaptador de estilo en el backend |
| Modelo recomendado | Antes Llama 3.3 70B | Actualizado: Groq GPT-OSS 120B; Gemini 3.8 Flash opcional |

### Alcance de pruebas
Las 44 pruebas de R5 son pruebas unitarias y de integración **simuladas**, no validación de uso clínico ni medición física de audio. El informe incorpora capturas de la interfaz y el motor real con transporte simulado para casos ficticios.
