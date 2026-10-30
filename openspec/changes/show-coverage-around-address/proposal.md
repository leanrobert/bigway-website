# Proposal

## Why

Hoy la sección de cobertura dibuja todas las zonas de fibra y wireless, y además descarga el `coverage.json` completo en el navegador: 1064 polígonos, ~675 KB. Así cualquiera, incluida la competencia, puede ver o copiar el mapa entero de la red de Bigway. La empresa quiere que el mapa público muestre solo lo que le sirve al cliente: su dirección y la cobertura inmediata alrededor.

## What Changes

- **BREAKING (comportamiento visible):** el mapa deja de mostrar la cobertura completa. Antes de buscar se ve el mapa base del Gran Mendoza **sin zonas**, con el buscador encima.
- Cuando el cliente busca una dirección, el mapa muestra el pin y **solo la cobertura dentro de un radio de 500 m** alrededor del punto, recortada a ese círculo.
- Nuevo endpoint en el servidor, `GET /api/coverage`, renderizado on-demand con el adapter Node que ya está instalado. Recibe la coordenada del punto y devuelve:
  - qué tecnologías cubren el punto (fibra / wireless / ninguna);
  - la cobertura recortada a 500 m, como GeoJSON.
- La verificación "¿hay fibra/wireless en mi dirección?" pasa del navegador al servidor.
- `coverage.json` deja de enviarse al cliente: ya no hay `import()` del JSON en el script del componente, y el build no lo copia a `dist/client`.
- El endpoint no guarda ni loguea las coordenadas consultadas (el sitio promete "Bigway no guarda la dirección que busques"). Además limita la cantidad de consultas por IP, para que no se pueda reconstruir el mapa barriendo una grilla de puntos.
- La geocodificación sigue igual: Georef AR desde el navegador, con el mismo flujo de "varias coincidencias".

## Capabilities

### New Capabilities

- `coverage-map`: consulta pública de cobertura por dirección. Define qué ve el visitante en el mapa antes y después de buscar, cuánta cobertura se revela (radio de 500 m), cómo se informa el resultado y qué datos de la red pueden salir del servidor.

### Modified Capabilities

<!-- No hay specs existentes en openspec/specs/. -->

## Impact

- **Código:**
  - [src/components/Coverage.astro](../../../src/components/Coverage.astro): el script del cliente deja de importar `coverage.json`, el encuadre inicial pasa a ser fijo (Gran Mendoza) y los resultados se piden al endpoint.
  - [src/lib/coverage-geo.ts](../../../src/lib/coverage-geo.ts): suma el recorte de polígonos a un círculo y el cálculo de distancias. Sigue sin imports de DOM ni de mapas.
  - Nuevo `src/pages/api/coverage.ts`.
- **Datos:** `src/data/coverage.json` pasa a ser solo del servidor. El script `pnpm coverage` no cambia.
- **Despliegue:** el sitio ya corre con `node ./dist/server/entry.mjs` (adapter standalone). La sección de cobertura pasa a depender de que ese servidor esté arriba. Hay que validar en staging antes de producción.
- **Infra (a confirmar):** el rate limit por IP necesita la IP real del cliente. Si hay un reverse proxy delante (Proxmox / nginx), tiene que pasar `X-Forwarded-For` y el endpoint tiene que confiar solo en ese proxy.
- **Dependencias:** ninguna nueva en el plan base (el recorte se implementa en `coverage-geo.ts`). Ver alternativa en design.md.
- **Leyenda y contenido:** el texto de la sección ("Mirá el mapa") se ajusta para que no prometa un mapa completo.
