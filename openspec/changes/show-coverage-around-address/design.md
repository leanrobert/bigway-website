# Design

## Context

- Las páginas se prerenderizan. El adapter `@astrojs/node` (standalone) ya está configurado y se usa para la isla de reseñas (`server:defer`). En producción el sitio corre con `node ./dist/server/entry.mjs`, así que hay un servidor disponible para lógica on-demand.
- [Coverage.astro](../../../src/components/Coverage.astro) hoy:
  - en el frontmatter (build) importa `coverage.json` solo para decidir si mostrar la sección y qué ítems lleva la leyenda. Eso no viaja al cliente y puede quedar;
  - en el `<script>` (cliente) hace `import('../data/coverage.json')`, encuadra el mapa con el bbox de todas las zonas, dibuja todas las capas y resuelve `technologiesAt()` en el navegador. Esto es lo que expone el mapa.
- [coverage-geo.ts](../../../src/lib/coverage-geo.ts) tiene helpers puros (ray casting, parseo de direcciones de Georef) sin imports de DOM ni de MapLibre. Es el lugar natural para la geometría nueva.
- `coverage.json` tiene 1064 features (Polygon / MultiPolygon, coordenadas redondeadas a 5 decimales, ~675 KB) y lo genera `pnpm coverage`.
- No hay framework de tests configurado. Los helpers están pensados para probarse con Node pelado.

## Goals / Non-Goals

**Goals:**
- Que la única geometría de cobertura que sale del servidor sea la recortada a 500 m alrededor de un punto consultado.
- Mantener sin cambios el flujo de búsqueda: Georef AR, la lista de coincidencias y la tarjeta de resultado.
- No sumar dependencias de runtime al cliente.

**Non-Goals:**
- Impedir por completo la reconstrucción del mapa. El rate limit la encarece pero no la hace imposible (ver Risks).
- Mover la geocodificación al servidor. Georef sigue llamándose desde el navegador.
- Cambiar el script `pnpm coverage` o el formato de `coverage.json`.
- Rate limiting distribuido (Redis, etc.). El sitio corre en un solo proceso Node.

## Decisions

### 1. Endpoint `GET /api/coverage?lat=..&lng=..` on-demand

`src/pages/api/coverage.ts` con `export const prerender = false`. Importa `coverage.json` a nivel de módulo, así queda en el bundle del servidor y se parsea una vez al arrancar. También precalcula el bbox de cada feature para descartar rápido las que no están cerca.

Respuesta `200`:
```json
{ "technologies": ["fibra"], "radius": 500, "zones": { "type": "FeatureCollection", "features": [ ... ] } }
```
- `technologies` se calcula con `technologiesAt()` contra todas las features, no solo las recortadas.
- Cada feature de `zones` lleva solo `properties.technology`. No se envía el `name`, porque nombres como "KM11 - ARIOSTO" son información interna de la red.
- Errores: `400` (parámetros inválidos o fuera de Mendoza) y `429` (rate limit), con body `{ "error": "<code>" }` sin datos.
- Headers: `Cache-Control: no-store`.

*Alternativa descartada:* hacer la consulta como server island (`server:defer`). El resultado depende de una búsqueda del usuario, no del render de la página, y una isla devuelve HTML. Un endpoint JSON encaja mejor con MapLibre.

### 2. Recorte a un círculo de 500 m con Sutherland–Hodgman, sin dependencias

En `coverage-geo.ts`:
- `circle(center, radiusM, sides = 64)`: polígono convexo que aproxima el círculo. Para pasar de metros a grados usa una proyección equirectangular local (`dLng = m / (111320 · cos(lat))`, `dLat = m / 110540`), con error despreciable a 500 m.
- `clipToCircle(geometry, circle)`: recorta cada anillo (exterior y huecos) contra el polígono convexo con Sutherland–Hodgman, descarta los anillos con menos de 3 vértices y los polígonos que se quedan sin anillo exterior, y devuelve `Polygon`, `MultiPolygon` o `null`.
- `coverageAround(point, features, radiusM)`: filtra por bbox, recorta y arma la `FeatureCollection` de la respuesta.

Por qué así:
- El área de recorte siempre es convexa (un círculo), justo el caso en que Sutherland–Hodgman es correcto para cualquier polígono a recortar.
- Son ~40 líneas, puras y testeables, y siguen el estilo del ray casting que ya existe.

*Alternativa:* agregar `polygon-clipping` (operaciones booleanas robustas, solo en el servidor). Se adopta si Sutherland–Hodgman genera artefactos que no se puedan tapar (ver Risks). Habría que confirmar la versión antes de agregarla.

### 3. Cliente: mapa base fijo, una fuente vacía y datos por búsqueda

En el `<script>` de `Coverage.astro`:
- Se elimina el `import('../data/coverage.json')`, junto con el bbox calculado a partir de las zonas.
- El encuadre inicial pasa a una constante `GREATER_MENDOZA` (bounds fijos del Gran Mendoza).
- En el `load` se crean una fuente `coverage` vacía (`FeatureCollection` sin features), las mismas capas fill/outline por tecnología y una fuente/capa `radius` (línea punteada con el borde de los 500 m).
- `check(position, place)` hace en paralelo `loadMap()` y `fetch('/api/coverage?...')` con timeout. Al responder, hace `setData` en `coverage` y `radius`, mueve el pin y hace `fitBounds` al bbox del círculo, con el `mapPadding()` actual.
- El mapeo `technologies → tono/título/CTA` no cambia, solo cambia la fuente del dato.
- Errores: `429` muestra "Hiciste muchas búsquedas seguidas. Probá de nuevo en unos minutos."; cualquier otro fallo muestra "No pudimos verificar la dirección en este momento…". En los dos casos el buscador sigue habilitado.

La constante del radio (`COVERAGE_RADIUS_M = 500`) vive en `coverage-geo.ts`, y el cliente usa el `radius` que devuelve la respuesta para dibujar el borde. Así servidor y mapa no se pueden desincronizar.

### 4. Rate limit en memoria por IP

Ventana fija en un `Map<ip, { count, resetAt }>` dentro del módulo del endpoint: **30 consultas cada 10 minutos por IP**. Las entradas vencidas se podan en cada request, cuando el mapa pasa de un umbral, para que la memoria no crezca sin límite. La IP sale de `context.clientAddress`.

*Alternativa descartada:* rate limit en el reverse proxy (nginx `limit_req`). Es más robusto, pero no está en este repo y depende de cómo esté armada la infra. Se puede sumar después sin cambiar nada de esto.

### 5. Privacidad

- El endpoint no hace `console.*` con la query ni con la URL completa. En errores loguea solo el tipo de error.
- `Cache-Control: no-store` en todas las respuestas del endpoint.
- El disclaimer de la sección ("Bigway no guarda la dirección que busques") sigue siendo cierto.

### 6. Verificación de que el JSON no llega al cliente

Se agrega un chequeo post-build (tarea manual en este cambio, eventualmente un paso de CI): buscar en `dist/client` una coordenada conocida de `coverage.json`, y fallar si aparece.

## Risks / Trade-offs

- **[Reconstrucción del mapa con muchas IPs o mucha paciencia]** → El Gran Mendoza (~40 × 40 km) se cubre con unas 1600 consultas de 1 km de diámetro. Con 30 consultas cada 10 minutos, una sola IP tarda horas, pero un atacante con varias IPs lo puede hacer. Es un disuasivo, no una garantía. Si hace falta más, se puede sumar rate limit en el proxy, achicar el radio o pedir un captcha.
- **[Rate limit inútil detrás de un proxy]** → Si hay un reverse proxy delante del proceso Node, `clientAddress` puede ser la IP del proxy, y entonces todos los visitantes comparten el mismo límite. Hay que verificarlo en staging antes de producción (ver Open Questions).
- **[Artefactos de Sutherland–Hodgman]** → Si una zona cóncava sale y vuelve a entrar al círculo, el recorte genera aristas de área cero sobre el borde del círculo. El relleno no se ve afectado, pero el contorno dibuja un segmento sobre el borde. Mitigación: la capa `radius` dibuja ese mismo borde y los tapa. Si igual se notan, se migra a `polygon-clipping` (Decisión 2).
- **[La sección depende del servidor]** → Hoy el mapa funciona aunque el proceso Node esté caído, porque todo es estático. Con este cambio, la consulta de cobertura falla si el servidor no responde. Mitigación: el mensaje de error de la spec y monitoreo del proceso. La isla de reseñas ya depende del mismo servidor.
- **[Memoria del rate limit]** → El `Map` crece con IPs únicas. Se mitiga podando las entradas vencidas. El consumo es acotado por la ventana de 10 minutos.
- **[Respuesta grande en zonas densas]** → Guaymallén tiene 276 polígonos. Recortados a 500 m quedan pocas decenas, unos KB. No hace falta comprimir aparte del gzip del server/proxy.

## Migration Plan

1. Implementar en una rama. Correr `pnpm build` y `pnpm preview` (o `pnpm start`) localmente y validar los escenarios de la spec.
2. ⚠️ **Impacta producción:** cambia el comportamiento público del mapa y suma un endpoint. Desplegar primero en **staging** y verificar ahí:
   - el `clientAddress` real detrás del proxy (rate limit);
   - que `dist/client` no contenga `coverage.json`;
   - los tiempos de respuesta del endpoint.
3. Desplegar a producción con el flujo habitual. El build trae el endpoint y el cliente nuevo juntos, así que no hay estado intermedio.
4. **Rollback:** revertir el commit y redeployar. No hay migraciones de datos ni estado persistente.

## Open Questions

- ¿Hay un reverse proxy (nginx, Proxmox, Cloudflare) delante del proceso Node en producción? Si lo hay, hay que confirmar qué IP llega como `clientAddress` y, si hace falta, tomar `X-Forwarded-For` **solo** cuando la conexión viene del proxy. No cambia el enfoque, solo de dónde se lee la IP.
- Los valores exactos del rate limit (30 / 10 min) se pueden ajustar después de ver el uso real.
