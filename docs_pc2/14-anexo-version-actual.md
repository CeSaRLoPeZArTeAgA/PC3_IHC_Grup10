# Anexo técnico de integración — actualización de la PC2

> **Grupo 10 UNI:** Santa Cruz Basilio, Jesus Diego — 20235005G; López Arteaga, César Omar — 20236743A; Pumayauli Evangelista, Bryan José — 20212209E.

## Alcance del anexo

Este anexo complementa el informe original `01-informe-PC2.docx` y su PDF. No atribuye aportes individuales sin evidencia. Se mantiene el título original **TriageVoz Rural**, pero se describe el alcance actual después de integrar silueta corporal frontal/posterior, personalización adaptativa, historial médico simulado y bandeja de casos.

### A. Implementación realmente disponible

1. **PWA:** interfaz HTML/CSS/JS adaptable, manifiesto y Service Worker.
2. **Interacción multimodal:** región anatómica por silueta SVG, texto y dictado opcional.
3. **Perfil adaptativo:** preferencias persistentes, ritmo de respuesta y ayudas de corrección.
4. **Entrevista:** cuatro preguntas, confirmación y edición.
5. **Resumen:** fallback local; Gemini solo cuando el servidor tiene clave y conexión.
6. **Bandeja:** registros de casos ficticios que pueden consultarse con un segundo rol en el mismo servidor local; sin videollamada, sesión simultánea o login.
7. **Acuse y respuestas:** estado enviado/recibido y respuestas persistidas, consultables por el paciente. Los reintentos idénticos no duplican la última respuesta.
8. **Persistencia:** JSON serializado y caso reciente recuperable al recargar el navegador.

### B. Diferencia frente al enunciado y trabajos LEC06/LEC07

La solución preserva los requerimientos iniciales como **objetivos de diseño**, pero no implica que todos estén implementados plenamente. El multiusuario es una simulación de roles locales. Las funciones de priorización sanitaria, traducción quechua real, privacidad clínica, despliegue interdispositivos y videollamada son **trabajo futuro**. No se inventan resultados de evaluación de usabilidad ni se confunden con pruebas automatizadas.

### C. Evaluación de integración

Se amplió la suite a 12 pruebas automáticas que incluyen 8 solicitudes concurrentes, duplicados de respuesta, conservación del acuse, bandeja y errores HTTP. La evaluación clínica y las pruebas con usuarios voluntarios siguen pendientes.

### D. Evidencias

Las capturas anteriores siguen archivadas como históricas. Para la presentación final se recomienda grabar o capturar nuevamente la interfaz vigente mediante el procedimiento del archivo `06-pruebas-y-evidencias.md`.

**Carácter del documento:** apéndice de actualización, sin sustituir las fuentes originales de LEC06, LEC07 o el enunciado de la PC2.
