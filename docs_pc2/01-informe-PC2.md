# Informe técnico PC2 — TriageVoz Rural

> **Integrantes, Grupo 10 — CC451 PC2:** Santa Cruz Basilio, Jesus Diego — 20235005G | López Arteaga, César Omar — 20236743A | Pumayauli Evangelista, Bryan José — 20212209E.

**CC451 Interacción Humano-Computador · UNI 2026-II**

**Autor del aporte individual:** César Omar López Arteaga (20236743A).

## 1. Dominio y problema

Las postas rurales pueden disponer de poco personal especializado y conectividad inestable. Se propone una herramienta de **apoyo al pre-triaje**, no diagnóstico, que permita relatar síntomas mediante voz, texto o silueta corporal, confirmar interpretaciones y remitir un resumen a un médico remoto. LEC06 define RF-01 a RF-17, RNF-01 a RNF-10, HU-01 a HU-10; LEC07 formula CU-07-01-M y el rediseño SCAMPER de interacción multimodal, reducción de carga cognitiva y seguimiento de entrega.

## 2. Stakeholders (análisis manual)

| Stakeholder | Participación | Influencia sobre el diseño |
|---|---|---|
| Paciente rural | Primario | Inicia, expresa relato y necesita claridad y confianza. |
| Adulto mayor/baja alfabetización | Primario | Controles grandes; interacción incremental y ayuda. |
| Discapacidad visual | Primario | Lectura por voz; texto semántico compatible con lector. |
| Discapacidad auditiva | Primario | Equivalencia textual; no depender de audio. |
| Discapacidad motora | Primario | Alternativa verbal y objetivos táctiles amplios. |
| Dificultades cognitivas | Primario | Una pregunta por vez, retroceso, frases breves. |
| Quechuahablante | Primario | Preferencia de idioma; traducción real no implementada. |
| Técnico/enfermero de posta | Primario | Apoyo al registro y remisión verificable. |
| Médico remoto | Primario | Resumen separado de inferencias y respuesta profesional. |
| Administrador | Secundario | Cuentas, roles, protección de datos; pendiente. |
| Instituciones sanitarias | Secundario | Requisitos de seguridad, consentimiento y validación. |
| ANPD/peritos UX | Secundario | Cumplimiento de privacidad y accesibilidad. |

Usuarios invisibilizados: personas con discapacidad múltiple, bajos recursos de datos, lenguaje no estándar, entornos ruidosos, estrés y necesidad de asistencia de un familiar. El diseño no equipara tener micrófono a poder usarlo, ni presupone alfabetización clínica.

## 3. Análisis PACT

| Dimensión | Aplicación al proyecto |
|---|---|
| **Personas** | Pacientes rurales, adultos mayores, pacientes con discapacidad visual/auditiva/motora/cognitiva, quechuahablantes, personal de posta, médicos remotos y administradores; niveles heterogéneos de lectura, digitalización y confianza. |
| **Actividades** | Inicio, preferencia lingüística/accesible, indicación de molestia, entrevista, confirmación, corrección, resumen, remisión, consulta, acuse y respuesta profesional. |
| **Contextos** | Postas rurales, equipos compartidos, interrupciones eléctricas y de red, privacidad reducida, estrés y limitada presencia de especialistas; no incorporar expedientes médicos reales. |
| **Tecnologías** | Celular/tablet/laptop, navegador con Web Speech API opcional, silueta SVG, HTML accesible, PWA, Node.js, Gemini por API opcional, almacenamiento demostrativo y fallback textual. |

**Implicaciones:** una pregunta por pantalla; equivalencia texto/voz/tacto; confirmación antes de registrar; botones amplios; estado real de recepción; recuperación sin prometer sincronización clínica; aviso visible de límites de IA.

## 4. Requisitos funcionales y no funcionales

El alcance formal figura en [la matriz de trazabilidad](05-trazabilidad.csv): **22 funcionales** y **13 no funcionales**, incluidos requerimientos nuevos para PC2. Las etiquetas de estado distinguen **demo, parcial, pendiente y no apto para producción**; una función solicitada no implica función clínicamente validada.

## 5. Historias de usuario con aceptación

Ver [historias de usuario](11-historias-usuario.md). Se preservan las 10 historias de LEC06 y se amplían con continuidad, colaboración, personalización y evaluación de diseño. Cada requisito se asocia a HU y a un criterio verificable.

## 6. Aplicaciones y sistemas similares

| Referencia de diseño | Funciones típicas | Diferencia o cautela en TriageVoz Rural |
|---|---|---|
| Chatbots generales de salud | Conversación por texto/voz | Se limita a estructurar datos explícitos; no diagnostica. |
| Plataformas de teleconsulta | Comunicación médico–paciente | Simulación local de transferencia, no videollamada clínica. |
| Formularios de síntomas | Cuestionario guiado | Se incorpora silueta táctil y voz equivalente. |

Estos son **arquetipos funcionales de comparación**, no una auditoría verificada de productos comerciales ni una evaluación clínica.

## 7. Criterios de usabilidad (objetivos de validación, no resultados medidos)

1. **Eficacia:** al menos 90 % de los participantes en pruebas simuladas completan el flujo sin perder datos.
2. **Aprendizaje:** al menos 85 % reconoce qué hacer sin explicación externa tras la pantalla inicial.
3. **Errores:** al menos 95 % puede corregir una zona seleccionada incorrectamente.
4. **Accesibilidad:** todas las preguntas pueden contestarse sin micrófono; navegación usable por teclado.
5. **Comprensión:** al menos 90 % distingue «resumen IA» de «valoración médica».
6. **Estado:** el 100 % de los cortes simulados no muestra «recibido» sin acuse verificable.
7. **Satisfacción:** encuesta SUS objetivo >= 68 sobre 100; medir con personas voluntarias y no extrapolar.

## 8. Tres alternativas propuestas y evaluación

| Alternativa | Estructura | Fortalezas | Debilidades |
|---|---|---|---|
| A, formulario secuencial | Campos escritos por etapas | Fácil seguimiento y revisión | Dependencia de lectura y teclado |
| B, conversación guiada | Voz con transcripción visible | Interacción natural y menor escritura | Ruido, permisos y errores STT |
| C, multimodal integrada | Silueta + voz + texto + confirmación | Redundancia accesible, control y corrección | Mayor complejidad de desarrollo |

**Se elige C** porque combina modalidades sin excluir a quienes no pueden hablar, leer con fluidez o pulsar regiones pequeñas. Se preservan alternativas A/B como prototipos navegables para evaluación.

### SCAMPER (LEC07)

**S:** sustituir formulario exclusivo por modalidades equivalentes. **C:** combinar silueta y transcripción. **A:** adaptar lenguaje y accesibilidad. **M:** ampliar controles y simplificar pantalla. **P:** reutilizar resumen para remisión. **E:** eliminar confirmaciones redundantes sin omitir las críticas. **R:** empezar por relato libre y permitir corrección antes de envío.

## 9. Arquitectura, navegación y Gantt

- [C4](02-arquitectura-C4.md): PWA, API Node.js, persistencia ficticia y adaptador LLM.
- [Diagrama de pantallas](03-flujo-pantallas.md): flujo principal y excepciones.
- [Gantt](04-gantt.md): cronograma planificado, no certificado como histórico.

## 10. Simulación y pruebas

La demostración recorre preferencia, región, confirmación, preguntas, resumen, envío, consulta, acuse y respuesta. [Plan y evidencias verificables](06-pruebas-y-evidencias.md). No se presenta como sistema de salud desplegado o validado con participantes. El reconocimiento depende del soporte del navegador.

## 10.1. Actualización posterior a la integración del Grupo 10

La versión posterior añade silueta corporal frontal/posterior, personalización adaptativa, historial de respuestas y una bandeja de los últimos casos ficticios. La comunicación entre roles es **diferida y local**, no videollamada ni teleconsulta con autenticación clínica. Consulte [anexo técnico](14-anexo-version-actual.md), [C4 actualizado](02-arquitectura-C4.md) y [pruebas](06-pruebas-y-evidencias.md).

## 11. Conclusión y riesgo

La redundancia multimodal y los estados explícitos son decisiones de IHC fundamentales. La prioridad clínica no se calcula automáticamente: requiere valoración del personal de salud. El despliegue real exigiría protección de datos de salud, identidad verificable, controles de acceso, privacidad, accesibilidad probada, infraestructura confiable y validación clínica independiente.
