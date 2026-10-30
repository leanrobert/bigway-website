# Verificación de escenarios: coverage-map

Corrida local el 2026-10-30 sobre el build de producción (`pnpm build` + `node ./dist/server/entry.mjs` en :4400), con Chrome headless por CDP (1440×900 y 375×812) y `curl`/`fetch` contra la API. Las direcciones son calles reales resueltas por Georef. "Calle Ficticia 123/456" son direcciones inventadas: se inyectaron en la respuesta de Georef para elegir la coordenada.

| Requisito / escenario | Resultado |
|---|---|
| **Mapa inicial sin zonas.** Visitante llega sin buscar | ✅ Mapa del Gran Mendoza sin zonas, 0 llamadas a `/api/coverage`, sin `coverage.json` |
| **Mapa completo no se envía.** Carga de la página | ✅ Ninguna request trae geometrías antes de buscar |
| **Mapa completo no se envía.** Build | ✅ 4 coordenadas de muestra y la clave `"technology"`: 0 archivos en `dist/client`, presentes en `dist/server` (control) |
| **Cobertura alrededor.** Dirección en fibra ("Colón 200, Capital", "Godoy Cruz 300, Guaymallén") | ✅ Pin, fibra recortada y borde punteado de 500 m |
| **Cobertura alrededor.** Ninguna zona a más de 500 m | ✅ Vértice más lejano a 503 m medido con haversine en 4 puntos. Es error del modelo esférico frente a la proyección local (0,6 %), dentro de la tolerancia de ±1 % de los tests |
| **Cobertura alrededor.** Zona más grande que el radio | ✅ Las zonas wireless que exceden el círculo se ven cortadas en el borde |
| **Cobertura alrededor.** Nueva búsqueda | ✅ El pin y las zonas anteriores se reemplazan (5 búsquedas seguidas) |
| **Resultado.** Fibra y wireless a la vez | ✅ con respuesta simulada: con los datos actuales ninguna zona de fibra se superpone con una wireless (barrido del Gran Mendoza cada ~200 m). Se forzó `technologies: ["wireless","fibra"]` y la tarjeta muestra fibra |
| **Resultado.** Solo wireless ("Bandera de los Andes 2000, Guaymallén") | ✅ "Llegamos con Internet wireless" + Ver planes |
| **Resultado.** Sin cobertura, con zonas cercanas ("San Martín 1200, Godoy Cruz") | ✅ "Todavía no llegamos" + "Avisame cuando lleguen", zonas wireless cercanas recortadas |
| **Resultado.** Sin cobertura ni zonas cercanas ("Calle Ficticia 123" → -33.0, -68.73) | ✅ Solo el pin y el borde del radio |
| **Consulta por coordenada.** Válida | ✅ 200 con `technologies`, `radius: 500`, `zones`; las properties solo traen `technology` |
| **Consulta por coordenada.** Inválida (sin params, `lat=abc`, falta `lng`) | ✅ 400 `invalid_coordinates`, sin datos |
| **Consulta por coordenada.** Fuera de Mendoza (Buenos Aires) | ✅ 400 `outside_service_area`, sin datos |
| **Límite.** Uso normal | ✅ 30 consultas seguidas responden 200 |
| **Límite.** Barrido | ✅ La consulta 31 responde 429 `rate_limited`; la UI muestra "Hiciste muchas búsquedas seguidas…" y el buscador sigue habilitado |
| **No se guardan direcciones.** Logs | ✅ El log del server solo tiene la línea de arranque; 0 coordenadas después de todas las corridas |
| **No se guardan direcciones.** Cache | ✅ `Cache-Control: no-store` en 200 y 400 |
| **Fallo de la consulta.** Servidor no disponible | ✅ con fallo simulado: `fetch` a `/api/coverage` rechazado por red. Muestra "No pudimos verificar la dirección…" y la búsqueda siguiente, sin recargar, funciona |

**Pendiente:** verificación en staging (tarea 4.3). Hay que confirmar la IP que llega como `clientAddress` detrás del proxy, que el rate limit distinga entre clientes y los tiempos de respuesta.
