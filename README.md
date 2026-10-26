# LabDiag - Diagnóstico Electrónico

Herramienta web para técnicos reparadores de PC, laptops y celulares. Registra el equipo bajo revisión, analiza fotos de placas, ordena las hipótesis por plausibilidad y guía las mediciones con multímetro paso a paso hasta cerrar el caso.

## Estructura de archivos

```text
chat-ia/
├── api/
│   ├── chat.js          # Endpoint HTTP POST /api/chat
│   ├── gemini.js        # Cliente de Gemini, reintentos ante 503 y unión de pasos
│   └── schema.js        # Prompt técnico y esquema JSON de respuesta
├── public/
│   ├── index.html       # Vista principal (Chat + Panel del caso)
│   ├── css/
│   │   └── styles.css   # Estilos
│   └── js/
│       ├── app.js       # Controlador principal y eventos
│       ├── storage.js   # Estado del caso y guardado en localStorage
│       ├── ui.js        # Renderizado del DOM y formato de mensajes
│       └── image.js     # Redimensionado y compresión de fotos en canvas
├── server.js            # Servidor Express local (http://localhost:3000)
├── package.json
└── vercel.json
```

## Ejecución local

1. Definir la clave en `.env`:
   ```env
   GEMINI_API_KEY=tu_clave
   ```
2. Iniciar el servidor:
   ```bash
   pnpm dev
   ```
3. Abrir `http://localhost:3000`.
