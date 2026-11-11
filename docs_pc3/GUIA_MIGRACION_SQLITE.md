# Migración segura a SQLite — TriageVoz Rural PC3

## Alcance

Reemplaza el almacenamiento de producción en JSON por SQLite sin alterar la PWA, el avatar, la entrevista, el modelo híbrido de voz ni las rutas REST. **Solo datos ficticios.** No habilita autenticación ni cumplimiento regulatorio.

## Requisitos

Node.js **22.13 o superior** (`node --version`). Usa `node:sqlite` incluido en Node; puede mostrar advertencia `ExperimentalWarning` en algunas versiones. No hay dependencia npm adicional ni servidor externo.

## Actualización desde Windows / PowerShell

1. Haz copia de seguridad del repositorio y confirma `git status -sb`.
2. Descarga y descomprime `PC3_SQLITE_MIGRACION.zip`.
3. Copia las carpetas `db`, `scripts`, `tests` y `docs_pc3` del ZIP a la raíz del repositorio **sin reemplazar carpetas completas**; copia solo los archivos nuevos que contiene.
4. No copies ni compartas `.env`. Mantén comentadas `STORAGE_FILE` y `PROFILES_FILE` para utilizar SQLite.
5. Desde la raíz del repositorio ejecuta:

```powershell
node scripts/aplicar-sqlite.mjs
node --check server.mjs
npm test
node server.mjs
```

El primer arranque crea `data/triagevoz.db` y, **una única vez**, importa datos previos de `data/runtime.json` y `data/profiles.json` (si existen). Los archivos JSON originales NO se eliminan. Si no hay datos, carga el catálogo ficticio original. Se conservan códigos `SALA-...`, estados, respuestas y perfiles.

En otra terminal:

```powershell
npm run db:check
Invoke-RestMethod http://127.0.0.1:4173/api/health
```

Esperado: `storage = sqlite` en `/api/health`, `Integridad: ok` en `db:check`.

## Estructura de datos

- `cases`: código, alias ficticio, zona corporal, relato, estado y fechas.
- `case_replies`: respuestas revisadas y publicadas por personal sanitario simulado.
- `profiles`: idioma, estilo, accesibilidad, personalidad y preferencias.
- `case_events`: creación, recepción y publicación de respuesta (registro técnico).
- `schema_meta`: marca de migración inicial para impedir importaciones repetidas.

SQLite utiliza transacciones y modo WAL. El servidor opera en un proceso local; esta preparación **no habilita** operación clínica ni garantiza seguridad al exponerla a Internet.

## Comprobación manual

1. Crear un caso ficticio por voz o formulario, confirmar y anotar su código.
2. Consultar el código desde la bienvenida.
3. Abrir Personal de salud, confirmar recepción, revisar el borrador y publicar una respuesta ficticia.
4. Reiniciar el servidor y consultar otra vez el mismo código.
5. Cambiar las preferencias del perfil, reiniciar y comprobar que persisten.

## Restauración

Detén el servidor con `Ctrl+C`. El instalador conserva `server.mjs.pre-sqlite.bak`, y NO borra `data/runtime.json` ni `data/profiles.json`. Para volver a JSON, restaura el servidor original y la configuración anterior (o usa Git). Los registros creados **después de migrar** viven solo en SQLite: expórtalos antes de regresar a JSON si necesitas conservarlos.

## GitHub y seguridad

`data/*.db`, `data/*.db-*`, los JSON de ejecución y `.env` deben seguir ignorados. Sube el código, las pruebas y la documentación, **nunca** la base de datos local ni claves API. Comprueba con `git status --short` antes del commit.

La ruta `SQLITE_FILE` es opcional; por defecto `data/triagevoz.db`. Si alguna prueba define `STORAGE_FILE` o `PROFILES_FILE`, queda en el almacenamiento JSON temporal para conservar la compatibilidad de la suite original. Para pruebas SQLite aisladas se usa `tests/sqlite-migracion.test.mjs`.


## Corrección para Windows (CRLF)

El instalador inicial requería coincidencias textuales con saltos de línea LF.
En Windows, Git/PowerShell suelen trabajar con CRLF, por lo que daba el error
`No se reconoce persistencia de casos en server.mjs (coincidencias=0)`.
El instalador corregido normaliza LF/CRLF antes del análisis y luego
conserva el estilo del archivo original. Si la instalación anterior falló,
no se modificó `server.mjs`; ejecuta nuevamente el instalador corregido.
