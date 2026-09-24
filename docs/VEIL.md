# Veil — cómo se conecta

Tablas D&D se conecta a [Veil](https://github.com/entropylink/dnd-veil) como **extensión**
(`plugins/dndtables/`), con el mismo patrón que el Creador de personajes 5e: la app entera va tal
cual en un `<iframe>` del mismo origen y un módulo pequeño (`veil/index.js`) hace de puente. La
app no sabe nada del almacenamiento de Veil; Veil no sabe nada de tablas.

Instalar y lo que se ve en Veil: [`veil/README.md`](../veil/README.md).

## Modo Veil

`app.html?velo=<mundo>&lang=es|en` activa el modo Veil (`DT.host`):

| | Suelta | `?velo=<mundo>` en pestaña propia | `?velo=<mundo>` dentro de Veil |
|---|---|---|---|
| Resultados | `dndtables.v3.records` | `velo:<mundo>:dndtables.v3.records` | igual |
| Preferencias (`dndtables.lang`, `.tab`, `.bgOff`) | compartidas | compartidas | compartidas |
| Migra las ciudades v2 | sí | no | no |
| Fondo animado | sí | sí | no (`html.embedded`) |
| Habla con Veil | no | no | sí (`postMessage`) |

## Protocolo `dndtables` v1

Todos los mensajes son `{ns:"dndtables", v:1, type, …}`. Solo entre ventanas del **mismo
origen**: la app comprueba `e.source === parent` y `e.origin === location.origin`; Veil
comprueba `e.source === frame.contentWindow` y el origen. Desde `file://` la app no habla con
nadie.

| Dirección | `type` | Campos | Qué pasa |
|---|---|---|---|
| app → Veil | `ready` | `app:{name, version, schema, tabs}` | La app arrancó. |
| Veil → app | `init` | `world:{id,name}`, `lang`, `canEdit`, `caps:{toScreen,toArticle}`, `ok`, `records:[…]`, `ids:[…]` | `records`: los documentos que quien mira puede ver; `ids`: los de **todos** (lo privado existe aunque no llegue). `ok:false` = Veil no pudo leer el mundo. La app mezcla. |
| app → Veil | `upsert` | `record`, `title`, `summary` | Crear o actualizar el documento de ese resultado. Veil agrupa (~0.7 s). |
| Veil → app | `saved` | `id` | Ese resultado ya está en el mundo. |
| app → Veil | `remove` | `id` | Borrar su documento. |
| app → Veil | `toScreen` | `card:{label, md, w, h}` | `ctx.toScreen({kind:"snap", md, …})`: Veil pregunta a qué pantalla. |
| app → Veil | `toArticle` | `requestId`, `recordId`, `link`, `article:{title, template, fields, subtitle, summary, block}` | Crear el artículo o actualizar su bloque `:::nota 🛒 … :::`. |
| Veil → app | `articleDone` | `requestId`, `recordId`, `slug` (o `null` si se canceló) | La app guarda el enlace en `record.links.article`. |
| Veil → app | `error` | `message` | Se enseña como aviso. |

Documento del mundo (`multiverse/worlds/<mundo>/tablas-dnd/<docId>.json`):

```json
{ "title": "Frostholm", "summary": "Settlement Vendors · Town · 12 vendors",
  "tab": "vendors", "recordId": "c…", "savedAt": 1790000000000, "record": { "id": "c…", "tab": "vendors", "name": "Frostholm", "data": { … } } }
```

## Mezcla

Al recibir `init`, la app compara lo del mundo con lo suyo usando `dndtables.v3.synced` (los
ids que ya sabe que están en el mundo). Si `ok` es `false`, **no mezcla ni escribe** en toda la
sesión (una lista vacía no significa «todo se borró»); lo que hagas queda en local y se sube la
próxima vez. Un id que está en `ids` pero no en `records` (privado) no se toca.

| Situación | Resultado |
|---|---|
| En los dos lados | gana el `savedAt` más reciente (se baja o se sube) |
| Solo en el mundo, nunca visto aquí | se baja |
| Solo en el mundo, pero estaba sincronizado | se borró aquí → se borra del mundo |
| Solo aquí, nunca subido | se sube |
| Solo aquí, pero estaba sincronizado | se borró en el mundo → se borra aquí |

Mientras está abierta, cada cambio se manda al momento. Si se borra un resultado mientras su
primer guardado va en camino, Veil lo borra en cuanto ese guardado termina. Si otra pestaña del mismo mundo
(«Abrir aparte») escribe, el evento `storage` avisa a la de Veil, que sube lo nuevo y borra lo
borrado. El almacén lee-cambia-escribe en cada guardado, así que dos pestañas no se pisan.

## Contrato comprobado

`veil/install.mjs` (y `tests/check.mjs`) exigen que `index.html` tenga las piezas de este
protocolo (`CONTRACT`). Si se renombra una, la instalación falla diciendo cuál.

## Pruebas

```bash
npm test                                   # app suelta (sin Veil)
VEIL_DIR=../dnd-veil npm run test:veil     # instala en el clon, levanta Veil con un mundo de ejemplo
                                           # en una carpeta temporal y recorre todo lo de arriba
```
