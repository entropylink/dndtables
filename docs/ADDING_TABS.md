# Cómo agregar una pestaña

La app sigue siendo **un solo archivo** (`index.html`) sin build ni dependencias. Por dentro está
partida en bloques con un contrato claro, para que una pestaña nueva se agregue **sin tocar las
demás**:

```
index.html
├─ <style>            tokens de color en :root (marca entropy.com.mx) + componentes
├─ cascarón           cabecera, barra de pestañas, #panels, registro de tiradas
├─ <template id="tpl-…">   marcado de cada pestaña (opcional)
├─ <script> NÚCLEO    DT: idioma, dados y tablas, resultados guardados, biblioteca,
│                     exportar/importar, registro de pestañas, puente con Veil
├─ <script> PESTAÑA · VENDEDORES   (IIFE que llama a DT.registerTab)
├─ <script> PESTAÑA · …            ← las nuevas van aquí, una por bloque
├─ <script>DT.start();</script>
└─ <script> fondo de partículas
```

Hay dos caminos.

## A · Pestaña declarativa (solo datos)

Para generadores del tipo «tira en estas tablas y enséñame el resultado». No hay que escribir
interfaz: `DT.simpleTableTab` da selectores de contexto, «Tirar todo», tarjetas con ↻ por tabla,
guardado, biblioteca, exportar/importar, Markdown, la pantalla de DM y el artículo de Veil, y las
tablas de referencia con sus rangos. Cinco de las siete pestañas son así (PNJ rápido, Taberna,
Encuentros de viaje, Clima, Botín): úsalas de ejemplo.

```html
<!-- ===================== PESTAÑA · CLIMA ===================== -->
<script>
(function(){
"use strict";
const R = DT.row;   // R("texto ES|English text", {id, w, only, weight, note})
DT.simpleTableTab({
  id: "weather", icon: "⛅", order: 60,
  title:   { en: "Weather", es: "Clima" },
  tagline: { en: "…", es: "…" },
  // Selectores. Lo elegido se guarda con el resultado (data.ctx) y condiciona las filas.
  context: [
    { id: "season", title: { en: "Season", es: "Estación" }, options: [
      { id: "summer", text: { en: "Summer", es: "Verano" } },
      { id: "winter", text: { en: "Winter", es: "Invierno" } } ] } ],
  tables: [
    // Filas con peso (w) que cambia según el contexto: más peso = rango más ancho en el dado.
    { id: "temp", die: 20, title: { en: "Temperature", es: "Temperatura" }, rows: [
      R("Frío|Cold", { id: "cold", weight: { season: { summer: .2, winter: 3 } } }),
      R("Calor|Hot", { id: "hot", weight: { season: { summer: 3, winter: 0 } },
        note: { en: "Drink twice the water.", es: "Beber el doble de agua." } }) ] },
    // Filas que solo existen si una tabla ANTERIOR sacó cierto id.
    { id: "sky", die: 20, title: { en: "Sky", es: "Cielo" }, rows: [
      R("Despejado|Clear", { w: 6 }),
      R("Nieve|Snow", { w: 3, only: { temp: ["cold"] } }) ] },
    // Una tabla que solo se tira a veces, varias veces, y con dados dentro del texto.
    { id: "birds", die: 6, title: { en: "Birds", es: "Pájaros" }, when: { temp: ["hot"] }, count: "1d3",
      rows: DT.rowsFixed(["{1d6} cuervos|{1d6} crows", "Un halcón|A hawk", "Nada|Nothing", "Una bandada de {2d10} gorriones|A flock of {2d10} sparrows", "Buitres|Vultures", "Gaviotas|Gulls"]) }
  ],
  recordName: h => `${h.ctxText("season")} · ${h.text("temp")}`   // opcional
});
})();
</script>
```

| En la tabla | Qué hace |
|---|---|
| `die`, `rows` | El dado y sus filas: `lo`/`hi` (rangos fijos, «de libro») **o** `w` (pesos; el núcleo reparte las caras). Cada fila posible recibe al menos una cara: con muchas filas en un dado chico los pesos dejan de notarse, así que para tablas con pesos y más de ~8 filas usa **d100** (hay una prueba que lo mide). |
| `only: {clave: [ids]}` | La fila solo vale si el contexto —o el `id` que salió en una tabla **anterior**— coincide. |
| `weight: {clave: {id: factor}}` | Multiplica el peso según lo mismo (0 la quita). Las filas condicionadas usan `w`, no `lo`/`hi`. |
| `when: {clave: [ids]}` | La tabla entera solo se tira si coincide. |
| `count` | `"1d4"`, `3` o `{clave: {id: "1d4", default: 1}}`: tira la tabla varias veces. |
| `{2d6*10}` en el texto | Se tira al salir la fila y se guarda. EN y ES deben llevar **los mismos dados en el mismo orden** (hay prueba). |
| `note` | Texto bajo el resultado (p. ej. el efecto en la mesa). |
| `hidden` | No sale como tarjeta: sirve para componer el nombre (`recordName`), como en Taberna. |
| `dm` | Sale en la tarjeta y en la pantalla de DM, pero no en el Markdown para jugadores ni en el artículo. |

| En la pestaña | Qué hace |
|---|---|
| `context` | Selectores `[{id, title, options:[{id, text}], default?}]`. |
| `recordName(h)` | Nombre del resultado. `h.text(tabla)`, `h.row(tabla)`, `h.ctxText(clave)`. Mientras nadie lo renombre a mano, sigue a las tablas de las que sale. El botón 🎲 vuelve a tirar `nameTables` (por omisión, las ocultas). |
| `nameTables` | Qué tablas vuelve a tirar 🎲 (p. ej. `["name"]` en PNJ rápido: otro nombre, misma ascendencia). |
| `sheet(h)` | Ficha: el resultado en limpio, **antes** de las tarjetas de tiradas (como en PNJ rápido). Devuelve `{sub: [texto…], lines: [h.line(tabla, {label?, text?}) …]}`; `h.line` pone la etiqueta (el título de la tabla o `label`), lo que salió, la nota y el color (`cls: good/bad`) de su fila, y marca DM si la tabla es `dm`. El núcleo escapa y pone la mayúscula inicial. Con ficha, el **Markdown** (copiar, pantalla de DM, bloque del artículo) es la ficha; las tablas que la ficha no lea van después, como lista. |
| `article(rec, h)` | Artículo de Veil: `{title, template, fields, subtitle, summary, marker, section, block: h.block(marker, etiqueta)}`. `marker` es un emoji que identifica su bloque (`:::nota 🧑 …`); `section`, la sección de la plantilla donde va la primera vez. Repetir solo reemplaza ese bloque. |

Al volver a tirar una tabla con ↻, se vuelven a tirar también las que dependen de ella.

**Datos compartidos**: lo que usan varias pestañas vive en el bloque `DATOS COMPARTIDOS` como
`DT.lib.*` (p. ej. `DT.lib.npc`: ascendencias con sus nombres, personalidad, manías, actitud,
rumores y veracidad, que usan Vendedores, PNJ rápido y Taberna; `DT.lib.npc.nameRows("tabla")`
da los nombres que dependen de la ascendencia que salió en esa tabla).

## B · Pestaña completa (`DT.registerTab`)

Para generadores con lógica propia (como Vendedores). Envuélvela en una IIFE para no ensuciar
el ámbito global:

```html
<script>
(function(){
"use strict";
const L = DT.t, tx = DT.tx, esc = DT.esc;
const MOOD = DT.table({ id: "npc-mood", die: 6, rows: [
  { lo: 1, hi: 2, name: { en: "grumpy", es: "gruñón" } },
  { lo: 3, hi: 6, name: { en: "cheerful", es: "alegre" } } ] });
let cur = null, refs = null;

DT.registerTab({
  id: "npc", icon: "🧑", order: 30,
  title: { en: "Quick NPC", es: "PNJ rápido" },
  tagline: { en: "…", es: "…" },
  strings: { en: { "npc.roll": "🎲 New NPC" }, es: { "npc.roll": "🎲 Nuevo PNJ" } },
  template: "tpl-npc",                  // opcional: <template id="tpl-npc"> con data-ref y data-i18n
  mount(panel) {                        // una sola vez, la primera vez que se abre la pestaña
    refs = DT.refs(panel);              // todos los [data-ref] del panel
    refs.roll.onclick = () => {
      const r = MOOD.roll();
      DT.log("d6", r.roll, tx(r.row.name));
      cur = { id: DT.uid(), tab: "npc", name: "…", data: { v: 1, mood: r.roll } };  // guarda la TIRADA, no el texto
      DT.records.upsert(cur); DT.records.setActive("npc", cur.id); render();
    };
    DT.library(refs.saved, "npc");      // lista de guardados con cargar / exportar / borrar
    cur = DT.records.active("npc"); render();
  },
  onLang() { render(); },               // el idioma cambió: vuelve a pintar
  current: () => cur,                   // lo que está abierto (para enterarse si se borra fuera)
  load(rec) { cur = rec; DT.records.setActive("npc", rec.id); render(); },
  onRemoved(rec) { if (cur && cur.id === rec.id) { cur = null; render(); } },
  validate: (data) => !!(data && data.mood),          // al importar y al recibir de Veil
  summary: (rec) => ({ chips: [tx(MOOD.lookup(rec.data.mood).row.name)], meta: [], detail: "" }),
  toMarkdown: (rec, { dm } = {}) => `### ${DT.mdEsc(rec.name)}\n…\n`,  // copiar y pantalla de DM
});
function render() { /* … usa esc() para TODO lo que venga de datos guardados … */ }
})();
</script>
```

### Contrato

| Campo | Obligatorio | Qué hace |
|---|---|---|
| `id` | sí | `[a-z0-9-]+`, único. Es el `tab` de cada resultado guardado. |
| `title`, `tagline` | sí | `{en, es}`. `heading` opcional: título largo si es la única pestaña. |
| `mount(panel, DT)` | sí | Dibuja la pestaña. Si lanza un error, la pestaña enseña el error y el resto sigue. |
| `strings` | — | `{en:{…}, es:{…}}` con **las mismas claves** en los dos (hay prueba). Prefija las tuyas (`npc.…`). |
| `template` | — | id de un `<template>`; se clona en el panel antes de `mount` y se le aplica el idioma. |
| `onShow`, `onLang` | — | Al enseñar la pestaña / al cambiar de idioma. |
| `load`, `current`, `onRemoved` | — | Cargar un resultado, cuál está abierto, y qué hacer si se borra (aquí, en Veil o en otra pestaña). |
| `validate(data)` | recomendado | Rechaza datos rotos al importar o al llegar de Veil. |
| `summary(rec)` | recomendado | `{chips, meta, detail}` en texto plano para la biblioteca y el documento de Veil. |
| `toMarkdown(rec, {dm})` | recomendado | Para «Copiar como Markdown» y la pantalla de DM. |
| `adoptForeign(obj)` | — | Convierte JSON de formatos viejos o ajenos en resultados (`[{tab, name, data}]`). |

### Lo que da el núcleo

| API | Para |
|---|---|
| `DT.t(key, vars)`, `DT.tx({en,es})`, `DT.lang`, `DT.addStrings`, `DT.onLang` | Idioma. |
| `DT.table({id, die, rows})` → `.roll(pesoFn?)`, `.lookup(n)`, `.ranges(pesoFn?)`, `.byId(id)` | Tablas tirables con rangos fijos o pesos; `pesoFn(row)` permite pesos calculados (tamaño, estado…). |
| `DT.faces(pesos, caras)` | El reparto de caras por pesos (resto mayor, cada fila ≥ 1 cara). |
| `DT.rollDie`, `DT.rollDice`, `DT.parseDice`, `DT.seed(n)` | Dados; `seed` fija el azar en las pruebas. |
| `DT.refTableHTML(tabla, columnas, pesoFn?)` | Tabla de referencia «para tirar a mano». |
| `DT.log(dado, resultado, texto)` | Registro de tiradas. |
| `DT.records` (`all/list/get/upsert/remove/active/setActive/onChange`) | Resultados guardados; seguros con varias pestañas abiertas. |
| `DT.library(el, tabId)`, `DT.io.exportRecord/exportMany/pickFile` | Guardados, exportar e importar. |
| `DT.bridge.toScreen({label, md, w, h})`, `DT.host.caps` | Pantalla de DM de Veil (solo si `caps.toScreen`). |
| `DT.esc`, `DT.mdEsc`, `DT.money`, `DT.refs`, `DT.toast`, `DT.copyText`, `DT.uid` | Utilidades. |

### Reglas de la casa

1. **Guarda tiradas o ids, nunca el texto**: así el resultado se traduce al cambiar de idioma y
   sobrevive a que corrijas una tabla.
2. **Escapa todo** lo que venga de un resultado guardado con `DT.esc` (entra por importar y por
   Veil). En Markdown, `DT.mdEsc`.
3. **Colores solo por tokens** (`var(--gold)`, `var(--muted)`…). Tipografía Ubuntu (ver `CLAUDE.md`).
4. **`data.v`**: pon versión a tus datos. Si cambias la forma, normaliza al cargar (como
   `normalize()` en Vendedores) en lugar de romper lo guardado.
5. **Pruebas**: añade un bloque a `tests/app.test.mjs` (datos que cubren su dado, generar con
   varias semillas, sin errores de consola). `npm test` y, si tocaste el puente, `npm run test:veil`.
6. Después, `node veil/install.mjs` para llevar la versión nueva a Veil.

Todo resultado guardado de cualquier pestaña **viaja solo a Veil** (documento `tablas-dnd` del
mundo). La pantalla de DM funciona con cualquier `toMarkdown`. El artículo de Veil hoy solo lo
hace Vendedores (`articlePayload`); otra pestaña puede hacer el suyo con `DT.bridge.toArticle`.

## Pestañas que hay

| Pestaña | Tipo | Nota |
|---|---|---|
| ⚖️ Vendedores | completa | La original: estado, evento semanal, tenderos, existencias, regateo. |
| 📜 Tablón de encargos | completa | Lee las ciudades guardadas en Vendedores: sus tenderos pagan y sus rumores se vuelven encargos. |
| 🧑 PNJ rápido | declarativa | Usa `DT.lib.npc`. Artículo de personaje en Veil. |
| 🍺 Taberna | declarativa | Nombre compuesto con tablas ocultas y concordancia de género. Artículo de edificio en Veil. |
| 🐺 Encuentros de viaje | declarativa | 9 biomas × 3 niveles × día/noche × amenaza. Criaturas del SRD 5.1. |
| ⛅ Clima | declarativa | Región × estación; efectos de frío y calor extremos, lluvia, niebla, viento. |
| 💰 Botín | declarativa | Tablas propias (las del DMG no están en el SRD 5.1); objetos mágicos con nombre y rareza del SRD 5.1. |

## Ideas para después

- **Facciones y gremios**: qué quieren, a quién odian, qué ofrecen.
- **Complicaciones de tiempo libre** (entre sesiones).
- **Nombres de lugares** (pueblos, ríos, montañas) con la misma técnica que el nombre de la taberna.
- **Rumores por asentamiento**: una tabla que lea los rumores de una ciudad guardada, como el Tablón.
