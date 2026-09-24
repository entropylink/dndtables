# Tablas D&D — extensión de Veil

Copia exacta de **Tablas D&D** (`entropylink/dndtables`, `index.html`) abierta dentro de cada mundo
de Veil, con el mismo patrón que el Creador de personajes 5e (`plugins/5ecb/`): la app va tal
cual en un solo archivo y un módulo pequeño hace de puente con el mundo.

## Instalar / actualizar

Desde el repo de dndtables:

```bash
node veil/install.mjs                      # en ../dnd-veil (el clon de al lado)
node veil/install.mjs C:\ruta\a\dnd-veil   # en otra carpeta
node veil/install.mjs --check              # solo comprueba el contrato, no escribe
```

Deja en `<veil>/plugins/dndtables/`:

| Archivo | Qué es |
|---|---|
| `app.html` | `index.html` de dndtables, **sin cambios**. La app detecta `?velo=<mundo>` sola. |
| `index.js` | La extensión: abre `app.html` en un marco y traduce sus mensajes a `ctx`. |
| `plugin.json` | Manifiesto (`docKind: "tablas-dnd"`), con `upstream` = commit de dndtables del que salió. |
| `README.md` | Este archivo. |

Después, recarga Veil: aparece **⚅ Tablas D&D** en la barra lateral de cada mundo. Se apaga y
se enciende en **Gestionar extensiones**, como cualquier otra.

## Qué hace dentro de Veil

- **Cada resultado guardado es un documento del mundo** (`multiverse/worlds/<mundo>/tablas-dnd/<id>.json`,
  con `{title, summary, tab, recordId, savedAt, record}`). Viaja en el respaldo, el paquete, la
  copia sin conexión y «Subir cambios». Cada mundo tiene sus propias ciudades.
- **▤ A la pantalla de DM**: el asentamiento entero (estado, evento de la semana, tenderos,
  pieza especial, rumores **con su veracidad**) o una sola tienda con todos sus precios. Llega
  como tarjeta `snap` con Markdown.
- **¶ Artículo del asentamiento**: crea el artículo con la plantilla `settlement` (tipo y
  población en la ficha, secciones de la plantilla) y pone el mercado en «Economía» dentro de
  un bloque `:::nota 🛒 …`. Repetirlo **solo reemplaza ese bloque**: lo que escribiste a mano
  no se toca. Si ya existe un artículo con ese nombre, pregunta antes de añadirle el mercado.
  El artículo **no** lleva la veracidad de los rumores (puede verlo un jugador).
- **Vista lector**: la app funciona, pero no escribe en el mundo.

## Cómo se sincroniza

La app guarda en el navegador con el prefijo `velo:<mundo>:` y habla con `index.js` por
`postMessage` (protocolo `dndtables` v1, detallado en `docs/VEIL.md` de dndtables). Al abrir:

1. La app manda `ready`; Veil responde `init` con los documentos del mundo.
2. La app mezcla: **gana el más reciente**. Lo que tiene solo ella y nunca llegó al mundo se
   sube; lo que el mundo tiene y ella nunca vio se baja. Si algo que ya estaba sincronizado
   falta de un lado, se interpreta como **borrado** y se borra del otro.
3. Cada cambio posterior se guarda (agrupado, ~0.7 s) y Veil confirma con `saved`.

«Abrir aparte» abre la app en su propia pestaña con el mismo mundo: lo que hagas ahí se sube
la próxima vez que abras la extensión.

## Límites conocidos

- No es extensión de casa (`builtin`): sin servidor (iPad sin conexión) necesita que el
  service worker de Veil ya tenga `app.html` en caché. `plugin.json` declara `offline` por si
  un día se añade a `plugins/builtin.json` y a `app/sw.js`.
- Las ciudades que ya tenías en la versión suelta (`entropy.com.mx/vendor-gen/` o `file://`)
  viven en otro origen: pásalas con **⬇ Exportar todas** allí e **⬆ Importar .json** aquí.
- El contrato que se comprueba al instalar está en `CONTRACT` (`install.mjs`). Si una versión
  nueva de la app lo rompe, la instalación falla diciendo qué pieza falta.
