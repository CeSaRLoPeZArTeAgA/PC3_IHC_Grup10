# Arquitectura C4 — TriageVoz Rural, versión PC2 revisada

> **Integrantes, Grupo 10:** Santa Cruz Basilio, Jesus Diego (20235005G); López Arteaga, César Omar (20236743A); Pumayauli Evangelista, Bryan José (20212209E).

## C1 — Contexto del sistema

```mermaid
flowchart LR
  P[Paciente ficticio] --> SYS[TriageVoz Rural]
  T[Técnico de posta - rol de apoyo] --> SYS
  M[Médico remoto - rol simulado] --> SYS
  SYS --> LL[Gemini opcional mediante backend]
```

La aplicación demuestra un **intercambio diferido de casos** entre dos vistas mediante un mismo servidor **local**. No implementa sesión audiovisual, chat en tiempo real, autenticación sanitaria ni telemedicina en producción.

## C2 — Contenedores

```mermaid
flowchart LR
  UI[Navegador / PWA HTML CSS JS] <-->|HTTP 127.0.0.1:4173| API[Servidor Node.js - REST]
  API <-->|lectura y escritura| DB[(JSON local - casos ficticios)]
  API -->|HTTPS, API key en backend| GEM[Gemini - opcional]
  UI -->|preferencias y código demo| LS[(localStorage)]
```

La ruta `GET /api/rooms` proporciona los **últimos 12 casos simulados**, enviados y recibidos; no constituye una lista de usuarios conectados. `GET /api/cases/by-code` consulta un caso; `POST /api/cases` lo registra; `POST /api/cases/ack` confirma recepción y `POST /api/cases/reply` añade una respuesta ficticia. `POST /api/llm` resume el relato mediante Gemini, o con un resumen determinista local.

## C3 — Componentes

```mermaid
flowchart TB
  subgraph Frontend
    A[Preferencias accesibles y perfil adaptativo]
    B[SVG frontal y posterior]
    C[Web Speech API y entrada textual]
    D[Entrevista, confirmación y resumen]
    E[Seguimiento de caso y rol médico simulado]
  end
  subgraph Backend
    F[Enrutador HTTP / rutas REST]
    G[Validación y limpieza de entradas]
    H[Persistencia JSON serializada]
    I[Adaptador Gemini con fallback local]
  end
  A --> D
  B --> D
  C --> D
  D --> F
  E --> F
  F --> G
  G --> H
  G --> I
```

## Decisiones verificables y restricciones

- Node.js escucha en `127.0.0.1` por defecto. Un segundo usuario en otra computadora **no puede conectarse** a ese localhost sin una infraestructura adicional.
- Los reintentos idénticos de una respuesta no duplican el último registro; un acuse repetido no modifica la marca temporal original. La persistencia se serializa para evitar conflictos entre escrituras.
- Las pruebas automáticas se ejecutan con archivos temporales y no deben modificar `data/runtime.json` del usuario.
- Los estados `enviado` y `recibido` corresponden a la **simulación**, no a la recepción por un profesional clínico real.
- No hay RBAC ni cifrado sanitario de historiales. **Prohibido utilizar datos reales de pacientes.**
