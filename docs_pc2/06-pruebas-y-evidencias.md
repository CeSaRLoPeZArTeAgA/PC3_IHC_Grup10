# Plan y registro de pruebas — PC2 Grupo 10

> **Integrantes, Grupo 10:** Santa Cruz Basilio, Jesus Diego (20235005G); López Arteaga, César Omar (20236743A); Pumayauli Evangelista, Bryan José (20212209E).

## Matriz funcional

| ID | Prueba | Criterio verificable | Automatización |
|---|---|---|---|
| P-01 | `GET /api/health` | HTTP 200 y `ok=true` | Sí |
| P-02 | Interfaz y recursos PWA | HTML y módulos accesibles | Sintaxis y revisión estática |
| P-03 | Selección corporal frontal/posterior | Zonas y pestañas integradas | Revisión estática; interacción manual |
| P-04 | Voz no disponible | Sigue disponible entrada escrita | Manual |
| P-05 | Entrevista/revisión | Cuatro preguntas, ayudas adaptativas | Estático y manual |
| P-06 | `POST /api/llm` sin clave | Resumen local, no diagnóstico | Sí |
| P-07 | Crear caso sin zona/motivo | HTTP 422 | Sí |
| P-08 | Crear/consultar/recibir | `enviado` → `recibido` tras acuse | Sí |
| P-09 | Respuesta médica simulada | Contenido preservado e historial visible | Sí y manual |
| P-10 | Preferencias de accesibilidad | Persistencia local | Manual |
| P-11 | Corte durante envío | Se conserva borrador, no aparece recibido | Manual |
| P-12 | Datos de prueba | Únicamente ficticios | Inspección de contenido |
| P-13 | Bandeja de casos | 6 ejemplos iniciales; últimos 12 registros | Sí |
| P-14 | Escrituras concurrentes | 8 registros simultáneos sin pérdidas | Sí |
| P-15 | Acuse y respuesta repetidos | Acuse conserva timestamp; respuesta no duplicada | Sí |
| P-16 | Errores HTTP y JSON | HTTP 400/404/422 según corresponda | Sí |
| P-17 | Recuperación tras recarga | Reconsulta el último código ficticio | Revisión estática; pendiente de ensayo visual |
| P-18 | Límites de colaboración | No se presenta como tiempo real | Estático |

## Ejecución reproducible

```powershell
git switch main
git pull origin main
npm test
npm start
```

Las pruebas automatizadas se ejecutan con Node.js 22 en GitHub Actions. El registro de la rama `revision-pc2-compatibilidad-20261014` reportó **12 pruebas satisfactorias** tras corregir una aserción de título desactualizada. Verificar nuevamente el estado final en [Actions](https://github.com/CeSaRLoPeZArTeAgA/PC2_IHC_Grup10/actions).

## Evidencias visuales

Las capturas previamente publicadas se encuentran en `assets/01` a `assets/08`; reflejan versiones anteriores del prototipo. Deben actualizarse con **capturas nuevas tomadas del software ejecutándose** para acreditar la bandeja de casos revisada, el historial y la recuperación tras recarga. No se generan ni presentan capturas sintéticas como prueba de funcionamiento.

## Límites

Los tests no prueban compatibilidad de micrófono en todos los navegadores, evaluación con usuarios, conectividad interdispositivos ni seguridad para datos clínicos. La plataforma se mantiene como demostración educativa en localhost.
