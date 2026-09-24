#!/usr/bin/env node
/**
 * Instala (o actualiza) Tablas D&D como extensión de Veil.
 *
 *   node veil/install.mjs                     → en ../dnd-veil (el clon de al lado)
 *   node veil/install.mjs C:\ruta\a\dnd-veil  → en esa carpeta
 *   node veil/install.mjs --check [ruta]      → solo comprueba el contrato; no escribe nada
 *
 * Copia `index.html` → `<veil>/plugins/dndtables/app.html` tal cual, más `plugin.json`,
 * `index.js` y `README.md` de esta carpeta. Anota en `plugin.json → upstream` el commit de
 * dndtables del que salió (`abc1234+local` si había cambios sin commitear) y la versión de la app.
 *
 * Antes de escribir comprueba el CONTRATO: las piezas del protocolo que `index.js` espera
 * encontrar en la app. Si una versión nueva las renombra, falla diciendo cuál en vez de
 * dejar una extensión que abre pero no guarda.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// Lo que veil/index.js necesita de la app. Si cambia aquí, cambia allá.
export const CONTRACT = [
  ['protocolo "dndtables" v1', /const NSP = "dndtables", V = 1;/],
  ['modo Veil por ?velo=<mundo>', /DT\.params\.get\("velo"\)/],
  ['datos con prefijo de mundo', /"velo:"\+DT\.host\.world\+":"/],
  ['mensaje ready', /send\("ready"/],
  ['mensaje init', /m\.type==="init"/],
  ['mensaje upsert', /send\("upsert"/],
  ['mensaje remove', /send\("remove"/],
  ['mensaje saved', /m\.type==="saved"/],
  ['mensaje toScreen', /send\("toScreen"/],
  ['mensaje toArticle', /send\("toArticle"/],
  ['mensaje articleDone', /m\.type==="articleDone"/],
  ['bloque del mercado (:::nota 🛒)', /:::nota \$\{L\("marketLabel"\)\}/],
  ['etiqueta del mercado empieza por 🛒', /marketLabel:"🛒/],
];
export const missingContract = (html) => CONTRACT.filter(([, re]) => !re.test(html)).map(([name]) => name);

function upstream() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
    const dirty = execSync('git status --porcelain -- index.html veil', { cwd: REPO }).toString().trim();
    return dirty ? `${sha}+local` : sha;
  } catch { return 'unknown'; }
}

function main(argv) {
  const check = argv.includes('--check');
  const target = resolve(argv.filter((a) => !a.startsWith('--'))[0] || join(REPO, '..', 'dnd-veil'));
  const html = readFileSync(join(REPO, 'index.html'), 'utf8');
  const missing = missingContract(html);
  if (missing.length) {
    console.error(`✖ index.html no cumple el contrato con Veil. Falta:\n  · ${missing.join('\n  · ')}`);
    process.exit(1);
  }
  const version = (html.match(/DT\.VERSION = "([^"]+)"/) || [])[1] || '0.0.0';
  console.log(`✓ contrato con Veil (${CONTRACT.length} piezas) · app ${version}`);
  if (check) return;
  if (!existsSync(join(target, 'plugins')) || !existsSync(join(target, 'server.mjs'))) {
    console.error(`✖ ${target} no parece un clon de Veil (falta server.mjs o plugins/).`);
    process.exit(1);
  }
  const out = join(target, 'plugins', 'dndtables');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'app.html'), html);
  copyFileSync(join(HERE, 'index.js'), join(out, 'index.js'));
  copyFileSync(join(HERE, 'README.md'), join(out, 'README.md'));
  const manifest = JSON.parse(readFileSync(join(HERE, 'plugin.json'), 'utf8'));
  manifest.version = version;
  manifest.upstream = upstream();
  writeFileSync(join(out, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✓ instalado en ${out} (upstream ${manifest.upstream}). Recarga Veil.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
