# D&D Tables / Tablas D&D

*Single-file, dependency-free, offline HTML tool with table generators for a 5e tabletop campaign. Seven tabs: settlement vendors (weighted d100 tables, settlement state and weekly market events, shopkeepers with rumors, stock of the day, variable pricing, Persuasion haggling), a job board fed by your saved cities, quick NPCs, taverns, travel encounters, weather and loot. Fully bilingual EN/ES. Built to grow by tabs, and it plugs into [Veil](https://github.com/entropylink/dnd-veil) as a DM tool. Open `index.html` in any browser, or try it live at [entropy.com.mx/vendor-gen/](https://entropy.com.mx/vendor-gen/).*

Herramienta HTML autónoma (un solo archivo, sin dependencias ni conexión) con generadores de tablas para el DM. Abre `index.html` en cualquier navegador.

## Pestañas

| | Pestaña | Qué genera |
|---|---|---|
| ⚖️ | **Vendedores** | Los vendedores de un asentamiento (abajo, en detalle). |
| 📜 | **Tablón de encargos** | Quién paga, qué, dónde, plazo, complicación y recompensa según el asentamiento y el nivel. Con una ciudad guardada, sus tenderos pagan y sus rumores se vuelven encargos. Copia para el DM o para los jugadores. |
| 🧑 | **PNJ rápido** | Nombre según su pueblo, edad, oficio según el entorno, clase (si tiene; depende del oficio), aspecto, personalidad, manía, actitud (mueve la CD social), qué quiere, su secreto y un rumor con su veracidad. |
| 🍺 | **Taberna** | Nombre («La Jarra Dorada», «El Grifo y la Llave»), posadero, plato y bebida con precio, habitaciones según categoría, clientela, lo que pasa esta noche y lo que se oye en la barra. |
| 🐺 | **Encuentros de viaje** | ¿Hay encuentro?, tipo, criatura (SRD 5.1) y qué hace, gente, peligros naturales con su efecto, hallazgos, reacción y distancia — por bioma, nivel, hora y amenaza. |
| ⛅ | **Clima** | Temperatura, cielo, viento y algo fuera de lo común, por región y estación, con lo que significa en la mesa. |
| 💰 | **Botín** | Monedas, gemas u objetos de arte, objeto mágico (nombres y rarezas del SRD 5.1) y una curiosidad — para un bolsillo o un alijo, por desafío. |

**Lo útil primero.** Cada pestaña enseña arriba el resultado en limpio —el PNJ listo para
interpretarlo, la taberna, el encuentro, el botín con lo que vale, el asentamiento con una línea
por tienda— con un ↻ en cada línea. Los dados quedan debajo, plegados («🎲 Tiradas»), para
quien quiera verlos o tirar a mano.

**Pueblos y clases.** PNJ rápido, Taberna y Vendedores eligen de qué pueblos salen: *Clásicos*
(los nueve del Manual del Jugador), *Todos los de D&D* (61 más, de los otros libros) o *Todo*
(también Magic y Zelda). PNJ rápido añade la clase —las 12 del SRD y el artífice—, casi siempre
ninguna y según el oficio. Solo nombres: ni rasgos ni reglas de esos libros.

Cada pestaña guarda sus resultados, los exporta e importa, copia como Markdown y enseña sus
tablas de referencia con los rangos del dado, para tirar a mano.

## Pestaña ⚖️ Vendedores

Para cada tamaño de asentamiento —de **troupe errante** a **megalópolis**—:

1. **Estado del asentamiento** (d20, una vez): tiempos normales, prosperidad, fiestas, cosecha,
   peregrinación, fiebre del oro, mano dura, crisis, sequía, bloqueo, guerra, plaga, amenaza de
   monstruos. Mueve precios y existencias por categoría, cuántos ambulantes llegan y cuáles son
   más probables.
2. **Vendedores permanentes**
   - *Básicos*: los imprescindibles (mercader general, taberna, herrería, mercado, templo,
     boticario), garantizados según el tamaño.
   - *Variedad*: tabla **d100 con pesos** — los oficios cotidianos ocupan rangos anchos y las
     tiendas raras (encantador, importador de exóticos, casa de cambio) estrechos, que crecen en
     las ciudades grandes.
3. **Evento semanal del mercado** (d20): llega una caravana, feria, tormenta, redada, robo,
   guerra de precios, retraso de suministros, recién llegado, subasta, pelea en la taberna…
4. **Vendedores ambulantes**: cuántos (dado del tamaño ± estado ± evento, puede ser **0**) y
   quiénes (d100 con pesos, ajustado por el estado). Se permiten repetidos.

Y en cada ficha:

- **El tendero**: nombre y ascendencia, personalidad, manía, **actitud que sube o baja la CD de
  regateo** y un **rumor** con su veracidad (solo para el DM).
- **Existencias del día** (d6 por artículo): agotado, pocas unidades (+10 %), normal,
  abundante (−10 %). Los servicios nunca se agotan.
- **Pieza especial** (con 4+ en d6): algo fuera de catálogo según su categoría.
- **Precios**: nivel de precios (d12) × competencia (−10 %) × estado × evento × existencias ×
  regateo por **Persuasión**, con calculadora en la ficha.
- ↻ Precios · ↻ Existencias · ↻ Tendero · ↻ Cambiar vendedor.

**↻ Nueva semana** tira evento nuevo, ambulantes nuevos y repone las existencias de todos.

## Todo

- **Tira en vivo o digital.** Cada tabla de referencia muestra su dado y sus rangos (los de pesos
  ya repartidos), así que puedes tirar con dados físicos. Un **registro de tiradas** enseña qué salió.
- **Resultados persistentes.** Cada ciudad recibe un nombre aleatorio y se **guarda sola** en el
  navegador. Exporta la actual o todas a `.json` e impórtalas (también los `.json` de la versión 2).
  Las ciudades guardadas por la versión 2 se migran solas la primera vez.
- **📋 Copiar como Markdown** para pegar en tus notas.
- **Bilingüe EN/ES** en toda la interfaz y el contenido; recuerda tu elección.

## Dentro de Veil

`node veil/install.mjs ../dnd-veil` la instala como extensión de Veil (**⚅ Tablas D&D** en cada
mundo). Ahí los resultados se guardan **con el mundo**, cualquier cosa va a la **pantalla de DM**,
y un asentamiento, un PNJ o una taberna se vuelven su **artículo** (asentamiento, personaje o
edificio), actualizable sin tocar tu prosa. Detalles: [`veil/README.md`](veil/README.md) y
[`docs/VEIL.md`](docs/VEIL.md).

## Agregar pestañas

Una pestaña nueva es un bloque `<script>` que llama a `DT.simpleTableTab({...})` (solo datos) o
a `DT.registerTab({...})` (lógica propia). Guardado, biblioteca, exportar/importar, idioma, tablas
de referencia y Veil vienen del núcleo. Guía, contrato e ideas: [`docs/ADDING_TABS.md`](docs/ADDING_TABS.md).

## Pruebas

```bash
npm test                                  # sintaxis + contrato con Veil + pruebas headless (Playwright)
VEIL_DIR=../dnd-veil npm run test:veil    # integración real con un servidor de Veil
```

## Despliegue

La versión publicada vive en **[entropy.com.mx/vendor-gen/](https://entropy.com.mx/vendor-gen/)**,
registrada en el hub de herramientas del sitio (entropy-landing).

## License & attribution

Code is MIT-licensed (see `LICENSE`). Base item prices come from the SRD 5.1
by Wizards of the Coast LLC, used under CC-BY-4.0 — full attribution and the
Fan Content disclaimer are in `NOTICE`. This is unofficial Fan Content
permitted under the Fan Content Policy; not approved or endorsed by Wizards
of the Coast.
