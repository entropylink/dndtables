#!/usr/bin/env node
/**
 * Comprobación rápida sin navegador: cada bloque <script> de index.html compila, y el
 * contrato con Veil está completo. Extrae los bloques por líneas (<script> … </script> al
 * principio de línea), nunca partiendo el archivo con una expresión regular.
 */
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { missingContract } from '../veil/install.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const lines = html.split('\n');
let fails = 0, blocks = 0, open = -1;
lines.forEach((l, i) => {
  if (/^<script>/.test(l) && !/<\/script>\s*$/.test(l)) open = i;
  else if (/^<\/script>/.test(l) && open >= 0) {
    blocks++;
    const code = lines.slice(open + 1, i).join('\n');
    try { new Script(code, { filename: `index.html:${open + 2}` }); }
    catch (e) { fails++; console.log(`✖ bloque <script> en la línea ${open + 1}: ${e.message}`); }
    open = -1;
  }
});
const inline = lines.filter((l) => /^<script>.*<\/script>\s*$/.test(l)).length;
console.log(`${fails ? '✖' : '✓'} ${blocks} bloques <script> compilan (${inline} de una línea)`);
const missing = missingContract(html);
if (missing.length) { fails++; console.log(`✖ contrato con Veil incompleto: ${missing.join(', ')}`); }
else console.log('✓ contrato con Veil completo');
if (/localStorage\.(get|set|remove)Item\("(lang|bgOff)"/.test(html)) { fails++; console.log('✖ quedan claves de preferencias sin prefijo (lang/bgOff)'); }
process.exit(fails ? 1 : 0);
