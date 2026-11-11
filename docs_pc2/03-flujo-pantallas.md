# Navegación e interacciones — versión revisada

> **Integrantes, Grupo 10:** Santa Cruz Basilio, Jesus Diego (20235005G); López Arteaga, César Omar (20236743A); Pumayauli Evangelista, Bryan José (20212209E).

```mermaid
flowchart TD
 A[Preferencias accesibles e inicio] --> B[Región corporal: silueta frontal/posterior, texto o voz]
 B --> C{¿Confirma región?}
 C -->|No| B
 C -->|Sí| D[Entrevista de cuatro preguntas]
 D --> E[Revisión de respuestas]
 E --> F[Resumen determinista o Gemini opcional]
 F --> G[Crear caso ficticio en servidor local]
 G -->|éxito| H[Código SALA- y estado enviado]
 G -->|fallo| L[Borrador local; NO recibido]
 H --> I[Bandeja de últimos casos simulados]
 I --> J[Rol médico demo consulta código]
 J --> K[Confirma recepción]
 K --> M[Envía respuesta no clínica]
 M --> N[Historial de respuestas]
 N --> O[Paciente actualiza estado y lee respuesta]
 H -->|recargar página| R[Recupera último caso ficticio por código]
 R --> O
```

**Nota:** El prefijo `SALA-` es una etiqueta visual para consultar casos; no indica una sesión de videollamada, canal en tiempo real o autenticación de participantes. La bandeja permite consultar registros locales enviados y recibidos.
