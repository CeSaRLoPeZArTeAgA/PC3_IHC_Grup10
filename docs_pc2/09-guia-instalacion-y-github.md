# Instalación y despliegue local

> **Integrantes, Grupo 10 — CC451 PC2:** Santa Cruz Basilio, Jesus Diego — 20235005G | López Arteaga, César Omar — 20236743A | Pumayauli Evangelista, Bryan José — 20212209E.

1. Instalar Node.js 20 o superior, VS Code y Chrome/Edge.
2. Clonar: git clone https://github.com/CeSaRLoPeZArTeAgA/PC2_IHC_Grup10.git
3. Entrar: cd PC2_IHC_Grup10
4. Ejecutar: npm start
5. Abrir: http://127.0.0.1:4173
6. Ejecutar tests: npm test
7. Para LLM remoto, configurar GEMINI_API_KEY mediante variable de entorno en la terminal, NUNCA en archivos ni en GitHub. El modelo se selecciona mediante GEMINI_MODEL.

No se requiere npm install: módulos nativos de Node.js. Localhost es apto para instalar PWA en navegadores compatibles. El navegador puede requerir permiso de micrófono. Sin ese permiso la entrada por texto debe ser viable.

Prueba de los roles: enviar caso ficticio, copiar código, abrir «Médico remoto (demo)», confirmar recepción, responder y refrescar estado.

No exponer servidor a la red ni cargar datos personales clínicos.
