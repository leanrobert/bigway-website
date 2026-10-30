# Tasks

## 1. Geometría: recorte a un círculo en `coverage-geo.ts`

- [x] 1.1 Agregar un script `"test": "node --test src/lib/"` en `package.json` y un `src/lib/coverage-geo.test.ts` mínimo que importe `technologiesAt`. Verificar que `pnpm test` corre con Node ≥ 22.23.4 (type stripping); si no levanta `.ts`, sumar `--experimental-strip-types` al script.
- [x] 1.2 Agregar `COVERAGE_RADIUS_M = 500` y `circle(center, radiusM, sides)` (polígono convexo, proyección equirectangular local). Verificar con un test que cada vértice queda a 500 m ± 1 % del centro (distancia haversine).
- [x] 1.3 Implementar `clipToCircle(geometry, circle)` con Sutherland–Hodgman por anillo (exterior y huecos), devolviendo `Polygon` / `MultiPolygon` / `null`. Verificar con tests:
  - un polígono que contiene el círculo devuelve el círculo;
  - uno totalmente afuera devuelve `null`;
  - uno parcialmente adentro tiene todos sus vértices a ≤ 500 m del centro;
  - un hueco recortado se conserva;
  - un `MultiPolygon` con una parte afuera devuelve solo la parte de adentro.
- [x] 1.4 Implementar `coverageAround(point, features, radiusM)`: descarte por bbox, recorte, y features con solo `{ technology }` en `properties`. Verificar con un test que la salida no incluye `name` y que las features lejanas no aparecen.

## 2. Endpoint `GET /api/coverage`

- [x] 2.1 Crear `src/pages/api/coverage.ts` (`prerender = false`) que valide `lat`/`lng` (números finitos dentro del bbox de la provincia de Mendoza) y responda `400 { error }` si no son válidos. Verificar con `curl` sobre `pnpm build && pnpm start`: sin params, con `lat=abc` y con un punto de Buenos Aires, todos responden 400 sin datos.
- [x] 2.2 Para coordenadas válidas, responder `{ technologies, radius, zones }` usando `technologiesAt` (contra todas las features) y `coverageAround`, con `Cache-Control: no-store`. Verificar con `curl -i`:
  - un punto conocido dentro de fibra en Guaymallén devuelve `["fibra"]` y features recortadas;
  - un punto rural sin zonas devuelve `[]` y `zones.features` vacío;
  - el header `no-store` está presente.
- [x] 2.3 Agregar el rate limit en memoria (30 consultas / 10 min por `clientAddress`, con poda de entradas vencidas) que responda `429 { error: "rate_limited" }`. Verificar que, con un loop de 31 `curl` desde la misma IP, la 31.ª responde 429 sin datos.
- [x] 2.4 Revisar que el endpoint no loguee la query ni la URL (solo el tipo de error en el catch). Verificar con grep en el archivo que ningún `console.*` recibe `lat`, `lng`, `url` ni `request`, y que `pnpm start` no imprime coordenadas al consultar.

## 3. Cliente: mapa sin zonas y cobertura por búsqueda

- [x] 3.1 En `Coverage.astro`, eliminar el `import('../data/coverage.json')` del `<script>` y el cálculo de bounds sobre las zonas. Encuadrar el mapa inicial con una constante `GREATER_MENDOZA` y crear las fuentes `coverage` (vacía) y `radius`, con sus capas. Verificar en `pnpm dev` que al llegar a la sección el mapa muestra el Gran Mendoza sin zonas y que la pestaña Network no pide `coverage.json`.
- [x] 3.2 Cambiar `check()` para pedir `/api/coverage` en paralelo con `loadMap()`, aplicar `setData` sobre `coverage` y `radius`, mover el pin y hacer `fitBounds` al círculo con `mapPadding()`. Verificar en el navegador que al buscar una dirección con fibra se ven el pin, el borde punteado de 500 m y solo la fibra recortada adentro, y que una segunda búsqueda reemplaza todo.
- [x] 3.3 Mantener la tarjeta de resultado (fibra > wireless > ninguna) con `technologies` de la respuesta, y agregar los mensajes de error para `429` y para fallo/timeout, dejando el buscador habilitado. Verificar cortando el servidor (o forzando un 429) que aparece el mensaje y que se puede volver a buscar sin recargar.
- [x] 3.4 Ajustar el copy de la sección ("Mirá el mapa." → algo que no prometa el mapa completo, p. ej. "Buscá tu dirección.") y dejar la leyenda como referencia de colores. Verificar visualmente en desktop (1440 px) y mobile (375 px).
- [x] 3.5 Si al revisar 3.2 el contorno muestra segmentos sobre el borde del círculo que la capa `radius` no tapa, documentarlo y migrar `clipToCircle` a `polygon-clipping` (confirmando antes la versión del paquete). Verificar que los tests del grupo 1 siguen pasando.
  - No hizo falta: en las capturas de 3.2 (desktop y mobile, Guaymallén y Godoy Cruz), los únicos trazos sobre el círculo son el borde real de las zonas recortadas. No aparecen aristas sueltas. Se queda con Sutherland–Hodgman.

## 4. Verificación integral

- [x] 4.1 Correr `pnpm build` y confirmar que `dist/client` no contiene geometrías de cobertura: `grep -rl` de una coordenada conocida de `src/data/coverage.json` sobre `dist/client` no devuelve resultados.
- [x] 4.2 Recorrer todos los escenarios de `specs/coverage-map/spec.md` sobre `pnpm start` (dirección con fibra, solo wireless, sin cobertura con y sin zonas cercanas, nueva búsqueda, coordenada inválida, rate limit, servidor caído) y anotar el resultado de cada uno en el PR.
  - Resultados en `verification.md`, listos para pegar en el PR (todavía no hay PR).
- [ ] 4.3 ⚠️ Antes de producción, desplegar en **staging** y verificar:
  - qué IP llega como `clientAddress` detrás del proxy (si es la del proxy, leer `X-Forwarded-For` solo desde el proxy de confianza y repetir 2.3);
  - que el rate limit discrimina entre dos clientes distintos;
  - tiempos de respuesta del endpoint aceptables.
  - Avance: en staging el límite resultó compartido (la IP de nginx). Se agregaron `clientIp()` + `COVERAGE_TRUSTED_PROXIES`, con tests unitarios y una prueba local con proxy simulado. Falta redesplegar en staging, configurar nginx (`X-Forwarded-For`, `access_log off`) y repetir la prueba con dos clientes.
