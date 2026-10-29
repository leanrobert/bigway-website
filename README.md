# Bigway · sitio web

Sitio de Bigway hecho con Astro. Las páginas se prerenderizan; un servidor Node (`@astrojs/node`)
sirve el sitio y renderiza on-demand las reseñas en vivo de Google (server island).

## Desarrollo

Requiere Node `>=22.23.4` (ver `.nvmrc`) y pnpm.

```sh
pnpm install
cp .env.example .env   # completar lo que haga falta
astro dev --background # http://localhost:4321  (astro dev stop | status | logs)
```

Sin variables de Google el sitio funciona igual: las reseñas salen de la lista curada en
`src/data/site.ts`.

## Contenido editable

Todo en `src/data/site.ts`: WhatsApp, dirección, stats, planes y precios, y las reseñas curadas
(fallback de las reseñas en vivo).

## Mapa de cobertura

1. Exportar las zonas desde Google Earth como `.kml` o `.kmz` y dejarlas en `data/coverage/`.
2. Ejecutar `pnpm coverage`. Genera `src/data/coverage.json`.
3. Commitear el JSON y desplegar.

Cada zona tiene que decir si es **fibra** o **wireless**: el script lo busca en el nombre de la
zona en Google Earth y, si no lo encuentra, en el nombre del archivo. Sirven "fibra"/"FTTH" y
"wireless"/"inalámbrico" (por ejemplo `fibra-guaymallen.kmz` o una zona llamada "Norte wireless").
Si alguna zona no se puede clasificar, el script se detiene y la lista. En el mapa la fibra va en
violeta y el wireless en dorado; donde se superponen, se ve la fibra.

El script **solo publica polígonos**: descarta puntos y líneas (NAPs, nodos, tendidos) y las
descripciones, para no exponer infraestructura. Si descarta algo, lo informa por consola.
La sección "Cobertura" se oculta sola mientras el JSON no tenga zonas.

El mapa usa [MapLibre GL](https://maplibre.org/) con el estilo *Positron* de
[OpenFreeMap](https://openfreemap.org/): gratis, apto para uso comercial y sin API key. La
atribución (OpenFreeMap, OpenMapTiles, OpenStreetMap) la agrega MapLibre y es obligatoria.
La librería se descarga recién cuando el usuario llega a la sección.

Arriba del mapa hay un buscador de direcciones y un botón "Usar mi ubicación". Ambos marcan el
punto y dicen si hay fibra, wireless o nada, comparándolo con las zonas en el navegador
(`src/lib/coverage-geo.ts`). Las direcciones se buscan en [Georef AR](https://datosgobar.github.io/georef-ar-api/)
(API pública del Estado argentino, sin key), limitado a la provincia de Mendoza. La ubicación del
navegador solo funciona con HTTPS (o en `localhost`).

## Reseñas en vivo (Google Business Profile API)

Muestra las 5 mejores reseñas (4–5 estrellas, más recientes primero) y la calificación promedio.
Se cachean 6 h en memoria; si Google falla se usa la última copia o, si no hay, la lista curada.

Pasos (una sola vez):

1. **Pedir acceso a la API**: el perfil debe estar verificado hace más de 60 días y tener el sitio
   web cargado. Completar el formulario de Google *Application for Basic API Access* con el número
   de proyecto y un email dueño/administrador del perfil. Aprobado = cuota de 300 QPM en la consola.
2. **Habilitar** My Business Account Management API, My Business Business Information API y
   Google My Business API.
3. **Cliente OAuth** de tipo *Aplicación web*, con redirect URI
   `https://developers.google.com/oauthplayground`. Publicar la pantalla de consentimiento
   (*En producción*): en modo *Prueba* el refresh token vence a los 7 días.
4. **Refresh token**: en [OAuth Playground](https://developers.google.com/oauthplayground), usar las
   credenciales propias (engranaje), autorizar el scope `https://www.googleapis.com/auth/business.manage`
   con la cuenta dueña del perfil e intercambiar el código por tokens.
5. Cargar `GBP_CLIENT_ID`, `GBP_CLIENT_SECRET` y `GBP_REFRESH_TOKEN` en `.env`, ejecutar
   `pnpm gbp:locations` y copiar el valor `accounts/…/locations/…` a `GBP_LOCATION`.

## Build y deploy

```sh
pnpm build   # genera dist/client (estáticos) y dist/server (servidor Node)
pnpm start   # node --env-file-if-exists=.env ./dist/server/entry.mjs
```

`HOST` y `PORT` definen dónde escucha (por defecto `localhost:4321`). En producción conviene
correrlo con systemd detrás de nginx como reverse proxy. Las variables `GBP_*` se leen en runtime,
así que se pueden rotar reiniciando el servicio sin rebuild.
