# Atlas Vivo de Desastres Naturales

Aplicacion educativa e interactiva para explorar desastres naturales globales con datos publicos cercanos al tiempo real.

## Fuentes

- NASA EONET API v3: eventos naturales globales activos o recientes.
- USGS Earthquake GeoJSON Feeds: terremotos recientes.
- OpenStreetMap: tiles del mapa base.

No usa API keys ni secretos locales.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

## Seguridad

La app incluye una Content Security Policy en `index.html` que limita scripts a recursos locales y conexiones a NASA EONET, USGS y OpenStreetMap. Los enlaces externos se abren con `rel="noreferrer"` y los textos de las APIs se renderizan con React, sin insertar HTML remoto.
