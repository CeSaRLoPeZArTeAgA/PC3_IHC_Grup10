# Historias de usuario — derivadas de LEC06 y ampliadas para PC2

> **Integrantes, Grupo 10 — CC451 PC2:** Santa Cruz Basilio, Jesus Diego — 20235005G | López Arteaga, César Omar — 20236743A | Pumayauli Evangelista, Bryan José — 20212209E.

## HU-01 · Inicio, idioma, accesibilidad y preferencias

Como paciente, quiero configurar idioma, texto, contraste y voz para usar la interfaz según mis capacidades.

**Criterio de aceptación:** Dado inicio del sistema; cuando elijo Español o alto contraste; entonces se actualiza y se conserva mi preferencia.

## HU-02 · Selección de zona

Como paciente, quiero señalar mi molestia en una silueta corporal para no depender de términos clínicos.

**Criterio de aceptación:** Dado el mapa; cuando elijo una región; entonces aparece destacada y puedo corregirla.

## HU-03 · Zona mediante voz

Como usuario con discapacidad visual o motora, quiero dictar la zona de dolor para no depender del tacto.

**Criterio de aceptación:** Dada compatibilidad de voz; cuando digo «brazo izquierdo»; entonces la transcripción editable solicita confirmación.

## HU-04 · Entrevista por voz/texto

Como paciente, quiero responder preguntas cortas mediante voz o texto para comunicar síntomas.

**Criterio de aceptación:** Dada una pregunta; cuando respondo; entonces la respuesta se almacena y puedo volver y corregirla.

## HU-05 · Lenguaje accesible

Como paciente con bajo nivel lector, quiero explicaciones sencillas para comprender la entrevista.

**Criterio de aceptación:** Cuando selecciono «Explicar más fácil», el sistema reformula sin introducir nuevo significado clínico.

## HU-06 · Resumen estructurado

Como médico remoto, quiero revisar un resumen del relato confirmado para entender el caso.

**Criterio de aceptación:** Dada entrevista completa; cuando se genera resumen; entonces muestra zona, motivo, inicio, intensidad y adicionales con procedencia indicada.

## HU-07 · Prioridad orientativa

Como personal de posta, quiero distinguir el resultado automático de la valoración sanitaria.

**Criterio de aceptación:** Cuando aparece resultado; entonces se indica que cualquier prioridad requiere valoración profesional; no hay clasificación validada.

## HU-08 · Consulta y respuesta de médico

Como médico remoto, quiero consultar un caso ficticio y responder a la posta.

**Criterio de aceptación:** Dado código generado; cuando lo consulto; entonces puedo confirmar recepción y responder como rol simulado.

## HU-09 · Advertencia sobre IA

Como paciente, quiero saber que la IA no diagnostica para decidir acudir a personal de salud.

**Criterio de aceptación:** En la primera pantalla y el resumen se declara que no sustituye diagnóstico.

## HU-10 · Administración de usuarios

Como administrador, quiero gestionar cuentas y permisos para restringir operaciones.

**Criterio de aceptación:** Pendiente: se requiere autenticación y RBAC verificables; no se presenta como implementado.

## HU-11 · Reanudación

Como paciente con Internet inestable, quiero conservar un borrador para no reiniciar.

**Criterio de aceptación:** Si falla el envío, se conserva borrador ficticio local y no se informa «recibido».

## HU-12 · Colaboración

Como técnico, quiero distinguir enviado de recibido para dar continuidad sin falsas garantías.

**Criterio de aceptación:** Tras enviar, se muestra «enviado»; solamente un acuse validado del servidor cambia a «recibido».

## HU-13 · Personalización continua

Como paciente, quiero que el sistema recuerde opciones de accesibilidad para reducir esfuerzo.

**Criterio de aceptación:** Tras recargar página, contraste, tamaño e idioma seleccionados se mantienen.

## HU-14 · Comparar alternativas

Como diseñador de IHC, quiero evaluar tres prototipos para elegir la mejor interacción.

**Criterio de aceptación:** Puedo recorrer cuatro pantallas simuladas de las alternativas A, B y C y justificar la preferencia por C.
