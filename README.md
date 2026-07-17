# Tablas de Vendedores por Asentamiento (D&D)

Herramienta HTML autónoma (un solo archivo, sin dependencias ni conexión) para generar los vendedores de un asentamiento en una partida de D&D. Abre `index.html` en cualquier navegador.

## Qué hace

Para cada tamaño de asentamiento —de **troupe errante** a **megalópolis**— genera dos bloques:

1. **Vendedores permanentes**
   - *Básicos*: los puestos imprescindibles para que el asentamiento funcione (mercader general, taberna, herrería, mercado, templo, boticario). Cuántos hay garantizados depende del tamaño.
   - *Variedad*: puestos «no tan básicos» (armería, alquimista, joyería, cartógrafo, encantador…) que se tiran en una tabla d100 para que cada asentamiento se sienta distinto del anterior.

2. **Vendedores ambulantes**
   - Cambian cada semana/día. Primero se tira **cuántos** hay (puede ser **0**), luego **quiénes** en una tabla d100. Se permiten repetidos: a veces dos venden casi lo mismo (y compiten), a veces no aparece nadie de esa categoría.

## Características

- **Tira en vivo o digital.** Cada tabla muestra su dado (d100, d12, 1d20…) y su distribución, así que puedes tirar con dados físicos y buscar el resultado, o pulsar los botones para tirar en digital. Un **registro de tiradas** deja ver qué salió.
- **Precios variables y realistas.** Los precios base salen de las tablas de equipo de D&D 5e. Cada vendedor tira 1d12 para su nivel de precios (de carestía a liquidación), y si dos venden la misma categoría se aplica un **−10 % por competencia**.
- **Regateo por Persuasión.** Cada ficha indica su CD y su descuento máximo. Introduce (o tira) tu resultado de Persuasión y verás el precio negociado. Un fallo grande ofende al vendedor y sube el precio.
- **Ciudades persistentes.** Cada ciudad generada recibe un **nombre aleatorio** y se **guarda automáticamente en el navegador** con todo su contenido. Se listan en orden alfabético con su tipo (Town, City, Megalopolis…) y un resumen de lo que tienen (nº de vendedores, nº de artículos y las tiendas). Puedes **exportar la ciudad actual** o **todas las ciudades** a `.json`, e **importar** cualquiera de los dos formatos.

## Uso

1. Elige un tamaño de asentamiento.
2. Pulsa **Generar asentamiento** (o regenera solo permanentes / solo ambulantes).
3. Regatea, recambia precios o cambia vendedores en cada ficha.
4. Guarda o exporta el resultado.

Los precios base se dan en po (oro), pp (plata) y pc (cobre). Los ítems exóticos, mágicos o de dudosa procedencia usan valores estimados; ajústalos a tu mundo.
