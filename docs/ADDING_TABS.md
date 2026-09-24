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

Para generadores del tipo «tira en estas tablas y enséñame el resultado» (clima, nombres,
complicaciones…). No hay que escribir interfaz: `DT.simpleTableTab` da botón «Tirar todo»,
tarjetas con ↻ por tabla, guardado, biblioteca, exportar/importar, Markdown, la pantalla de DM
de Veil y las tablas de referencia con sus rangos.

```html
<!-- ===================== PESTAÑA · CLIMA ===================== -->
<script>
DT.simpleTableTab({
  id: "weather", icon: "⛅", order: 20,
  title:   { en: "Weather", es: "Clima" },
  tagline: { en: "Sky, temperature and wind for the day", es: "Cielo, temperatura y viento del día" },
  tables: [
    // Rangos fijos (como en un libro): lo/hi deben cubrir el dado entero, sin huecos.
    { id: "sky", die: 6, title: { en: "Sky", es: "Cielo" }, rows: [
      { lo: 1, hi: 3, text: { en: "Clear", es: "Despejado" } },
      { lo: 4, hi: 5, text: { en: "Cloudy", es: "Nublado" } },
      { lo: 6, hi: 6, text: { en: "Storm", es: "Tormenta" } } ] },
    // Pesos (w): el núcleo reparte las caras. Más peso = rango más ancho.
    { id: "wind", die: 20, title: { en: "Wind", es: "Viento" }, rows: [
      { w: 6, text: { en: "Calm", es: "Calma" } },
      { w: 3, text: { en: "Breeze", es: "Brisa" } },
      { w: 1, text: { en: "Gale", es: "Vendaval" } } ] }
  ]
});
</script>
```

Con dos o más pestañas aparece sola la barra de pestañas.

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

## Ideas de pestañas

En orden de valor por esfuerzo:

1. **PNJ rápido**: reutiliza las tablas del tendero (ascendencia, rasgo, manía, actitud,
   rumor) + oficio, motivación y secreto. Casi todo el contenido ya existe.
2. **Tablón de encargos**: patrón, trabajo, complicación y paga escalada al tamaño del
   asentamiento; se engancha con los rumores.
3. **Clima** por clima y estación: pestaña declarativa pura, sirve para estrenar el patrón A.
4. **Encuentros de viaje por bioma**, con el estado «amenaza de monstruos» subiendo la
   probabilidad.
5. **Taberna a fondo**: nombre, plato y bebida de la casa, parroquianos, lo que pasa esta noche.
6. **Botín por nivel**: cuidado con la licencia — las tablas de tesoro del DMG no están en el
   SRD 5.1; hay que escribir tablas propias.
