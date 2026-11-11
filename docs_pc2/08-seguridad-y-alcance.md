# Seguridad, limitaciones y alcance real — PC2

> **Integrantes, Grupo 10:** Santa Cruz Basilio, Jesus Diego (20235005G); López Arteaga, César Omar (20236743A); Pumayauli Evangelista, Bryan José (20212209E).

- **Prototipo académico no clínico.** No diagnostica, prescribe, clasifica urgencias ni ofrece recomendaciones médicas automáticas.
- Los ejemplos de `data/casos-ficticios.json` son inventados; las respuestas automáticas de ejemplo no indican tratamientos.
- **Multirol local no equivale a multiusuario distribuido:** el paciente y el médico simulado usan el mismo servicio Node.js en `127.0.0.1`; otra computadora no accede a este localhost por defecto.
- La bandeja `/api/rooms` muestra los últimos casos guardados, no salas audiovisuales o participantes conectados.
- Sin autenticación, autorización RBAC, consentimiento clínico, auditoría sanitaria o cifrado de historiales. Los códigos **no son credenciales**.
- La persistencia de JSON contiene casos ficticios en disco; `localStorage` guarda preferencias y último código demo. El borrador puede permanecer en el dispositivo ante error.
- El dictado Web Speech API requiere compatibilidad, permiso de micrófono y puede depender de servicios externos del navegador; texto siempre disponible.
- Quechua: selección simulada, sin traducción validada.
- Gemini: opcional mediante clave de entorno **solo en servidor**; no cargar datos de pacientes reales.
- El Service Worker utiliza caché de recursos web; no habilita sincronización de casos en desconexión.
- Pruebas automatizadas evitan contaminar `data/runtime.json` de usuarios.
- Para una implementación de salud real: análisis legal y privacidad, consentimiento, autenticación robusta, cifrado, validación clínica, redes seguras, respaldo, accesibilidad y evaluación formal con usuarios.
