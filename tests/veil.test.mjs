#!/usr/bin/env node
/**
 * Integración con Veil: instala la extensión en un clon de Veil, levanta su servidor con un
 * mundo de ejemplo en una carpeta temporal y recorre la extensión de punta a punta.
 *
 *   VEIL_DIR=../dnd-veil node tests/veil.test.mjs     (por omisión: ../dnd-veil)
 *   KEEP=1 …    → deja la extensión instalada en el clon al terminar
 *   SHOTS=1 …   → capturas en tests/.shots/
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const VEIL = resolve(process.env.VEIL_DIR || join(REPO, '..', 'dnd-veil'));
const PORT = Number(process.env.PORT || 8797);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(HERE, '.shots');
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try { ({ chromium } = await import(PW)); } catch { ({ chromium } = await import('playwright')); }
if (!existsSync(join(VEIL, 'server.mjs'))) { console.error(`✖ No encuentro Veil en ${VEIL} (VEIL_DIR).`); process.exit(2); }
if (process.env.SHOTS) mkdirSync(OUT, { recursive: true });

let fails = 0, total = 0;
const ok = (cond, name, info = '') => { total++; if (!cond) fails++; console.log(`${cond ? '✓' : '✖'} ${name}${cond ? '' : ' — ' + info}`); };
const IGNORE = /fonts\.googleapis|fonts\.gstatic|ERR_CERT|net::ERR|cloudfront/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args, opts) => new Promise((ok, ko) => { const p = spawn(cmd, args, { stdio: 'inherit', ...opts }); p.on('exit', (c) => (c ? ko(new Error(`${cmd} ${args.join(' ')} → ${c}`)) : ok())); });

// 1. Instalar la extensión en el clon de Veil
const hadPlugin = existsSync(join(VEIL, 'plugins', 'dndtables'));
await run(process.execPath, [join(REPO, 'veil', 'install.mjs'), VEIL]);

// 2. Servidor de Veil con datos temporales y el mundo de ejemplo
const DATA = mkdtempSync(join(tmpdir(), 'veil-dndtables-'));
const server = spawn(process.execPath, ['server.mjs', String(PORT), '--datos', DATA], { cwd: VEIL, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', (d) => { serverLog += d; }); server.stderr.on('data', (d) => { serverLog += d; });
const cleanup = () => { try { server.kill(); } catch {} try { rmSync(DATA, { recursive: true, force: true }); } catch {}
  if (!hadPlugin && !process.env.KEEP) try { rmSync(join(VEIL, 'plugins', 'dndtables'), { recursive: true, force: true }); } catch {} };
process.on('exit', cleanup);
const api = async (method, path, body) => {
  const r = await fetch(`${BASE}/api/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status }); return j;
};
for (let i = 0; i < 50; i++) { try { await api('GET', 'plugins'); break; } catch { await sleep(200); } }
const plugins = (await api('GET', 'plugins')).plugins || [];
ok(plugins.some((p) => p.id === 'dndtables' && p.docKind === 'tablas-dnd'), 'Veil descubre la extensión (docKind tablas-dnd)');
const sample = await api('POST', 'sample', { lang: 'es' });
const W = sample.id;
ok(!!W, `mundo de ejemplo creado (${W})`);
const docs = async () => ((await api('GET', `worlds/${W}/tablas-dnd`)).docs || []);

// 3. La extensión dentro del mundo
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
await ctx.addInitScript("try{localStorage.setItem('velo.lang','es')}catch{}");
const page = await ctx.newPage();
const errors = [];
const watch = (p) => {
  p.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  p.on('dialog', (d) => d.accept());
};
watch(page);
page.setDefaultTimeout(15000);
const open = async () => {
  // Pasar por la portada del mundo obliga a Veil a desmontar y volver a montar la extensión.
  if (page.url().includes('/p/dndtables')) { await page.goto(`${BASE}/#/w/${W}`); await sleep(300); }
  await page.goto(`${BASE}/#/w/${W}/p/dndtables`);
  await page.waitForSelector('iframe.dtv-frame');
  const f = page.frameLocator('iframe.dtv-frame');
  await page.waitForFunction(() => { const fr = document.querySelector('iframe.dtv-frame'); return fr && fr.contentWindow && fr.contentWindow.DT && fr.contentWindow.DT.host.connected; });
  return f;
};
const fw = () => page.frames().find((x) => x.url().includes('/plugins/dndtables/app.html'));
const shot = async (n) => { if (process.env.SHOTS) await page.screenshot({ path: join(OUT, n + '.png') }); };

let f = await open();
const host = await fw().evaluate(() => ({ ...DT.host }));
ok(host.embedded && host.connected && host.canEdit && host.world === W, 'la app sabe que está en Veil, conectada y con permiso de escritura', JSON.stringify(host));
ok(host.caps.toScreen && host.caps.toArticle, 'Veil ofrece pantalla de DM y artículo');
ok(await fw().evaluate(() => getComputedStyle(document.getElementById('bg')).display === 'none'), 'dentro de Veil no se dibuja el fondo animado');
ok((await f.locator('#hostBar').textContent()).includes(W) || (await f.locator('#hostBar').textContent()).length > 0, 'barra de conexión visible');

// Generar → documento del mundo
await f.locator('[data-ref="genBtn"]').click();
await sleep(1500);
let d = await docs();
const cur = await fw().evaluate(() => DT.records.active('vendors'));
ok(d.length === 1 && d[0].record && d[0].record.id === cur.id && d[0].title === cur.name, 'generar una ciudad crea su documento en el mundo', JSON.stringify(d.map((x) => x.title)));
ok(/Vendedores|Settlement/.test(d[0].summary || ''), 'el documento lleva un resumen legible', d[0].summary);
const synced = await fw().evaluate(() => JSON.parse(localStorage.getItem(`velo:${DT.host.world}:dndtables.v3.synced`) || '[]'));
ok(synced.includes(cur.id), 'Veil confirma (saved) y la app lo marca como sincronizado');
await shot('veil-plugin');

// Cambios posteriores se guardan agrupados
await f.locator('#panel-vendors .vendor').first().locator('.hagRoll').click();
await f.locator('[data-ref="newWeek"]').click();
await sleep(1500);
d = await docs();
ok(d.length === 1 && d[0].record.data.week === 2, 'los cambios (nueva semana) llegan al mismo documento');

// Pantalla de DM
await f.locator('[data-ref="toScreen"]').click();
await page.locator('.modal .pick-list button').last().click();
await page.locator('.modal input.input').fill('Mesa de prueba');
await page.locator('.modal input.input').press('Enter');
await sleep(800);
const screens = (await api('GET', `worlds/${W}/screens`)).docs || [];
const mesa = screens.find((s) => s.title === 'Mesa de prueba');
const mesaDoc = mesa ? await api('GET', `worlds/${W}/screens/${mesa.id}`) : null;
const card = mesaDoc && (mesaDoc.objects || []).find((o) => o.kind === 'snap');
ok(!!card && card.md.includes(cur.name) && /DM: /.test(card.md), 'el asentamiento llega a la pantalla de DM como tarjeta con Markdown (con la veracidad para el DM)');
// una sola tienda
await f.locator('#panel-vendors .vendor').first().locator('.vScreen').click();
await page.locator('.modal .pick-list button', { hasText: 'Mesa de prueba' }).click();
await sleep(800);
const mesa2 = await api('GET', `worlds/${W}/screens/${mesa.id}`);
ok((mesa2.objects || []).filter((o) => o.kind === 'snap').length === 2, 'una tienda sola también va a la pantalla');

// Artículo del asentamiento
await f.locator('[data-ref="toArticle"]').click();
await page.locator('.modal .modal-f .btn.ghost').click();   // «¿Abrirlo?» → no
await sleep(600);
const linked = await fw().evaluate(() => DT.records.active('vendors').links);
const slug = linked && linked.article;
let art = slug ? (await api('GET', `worlds/${W}/articles/${slug}`)).article : null;
ok(!!art && art.template === 'settlement' && /:::nota 🛒/.test(art.body) && /## Econom/.test(art.body), 'se crea el artículo con plantilla de asentamiento y el mercado en Economía', slug);
ok(art && !/DM: /.test(art.body), 'el artículo no lleva secretos del DM');
// Prosa a mano + nueva semana + repetir → solo cambia el bloque
await api('PUT', `worlds/${W}/articles/${slug}`, { ...art, body: `Texto escrito a mano.\n\n${art.body}` });
await f.locator('[data-ref="newWeek"]').click();
await sleep(300);
await f.locator('[data-ref="toArticle"]').click();
await sleep(900);
art = (await api('GET', `worlds/${W}/articles/${slug}`)).article;
ok(art.body.startsWith('Texto escrito a mano.') && (art.body.match(/:::nota 🛒/g) || []).length === 1 && /(semana|week) 3/.test(art.body), 'repetir actualiza solo el bloque del mercado; la prosa se queda');

// Borrado en el mundo mientras la extensión estaba cerrada → al abrir se borra aquí
await f.locator('[data-ref="genBtn"]').click();
await sleep(1500);
d = await docs();
ok(d.length === 2, 'segunda ciudad → segundo documento');
const second = await fw().evaluate(() => DT.records.active('vendors').id);
await page.goto(`${BASE}/#/w/${W}`); await sleep(300);
await api('DELETE', `worlds/${W}/tablas-dnd/${d.find((x) => x.record.id === second).id}`);
f = await open(); await sleep(300);
ok(!(await fw().evaluate((id) => !!DT.records.get(id), second)), 'lo borrado en el mundo desaparece de la app al volver a abrirla');

// Creado «aparte» (pestaña suelta con el mismo mundo) → se sube al volver
const loose = await ctx.newPage(); watch(loose);
await loose.goto(`${BASE}/plugins/dndtables/app.html?velo=${W}&lang=es`);
await loose.waitForFunction(() => window.DT && DT.started);
await loose.locator('[data-ref="genBtn"]').click();
const looseId = await loose.evaluate(() => DT.records.active('vendors').id);
await sleep(1500);
d = await docs();
ok(d.some((x) => x.record.id === looseId), 'lo creado en «Abrir aparte» llega al mundo en seguida (la pestaña de Veil se entera)');
// Y con la extensión cerrada: se sube al volver a abrirla
await page.goto(`${BASE}/#/w/${W}`); await sleep(300);
await loose.locator('[data-ref="genBtn"]').click();
const looseId2 = await loose.evaluate(() => DT.records.active('vendors').id);
await loose.close();
f = await open(); await sleep(1500);
d = await docs();
ok(d.some((x) => x.record.id === looseId2), 'lo creado «aparte» con la extensión cerrada se sube al volver a abrirla');
ok(await fw().evaluate(() => DT.records.list('vendors').length) === d.length, 'la app y el mundo quedan con los mismos resultados', `${d.length}`);

// Borrar desde la app → se borra el documento
const n0 = (await docs()).length;
await f.locator('#panel-vendors .saved-item [data-act="delete"]').first().click();
await sleep(900);
ok((await docs()).length === n0 - 1, 'borrar en la app borra el documento del mundo');

// Cambio más reciente hecho en el mundo → gana al abrir
d = await docs();
const target = d[0];
await api('PUT', `worlds/${W}/tablas-dnd/${target.id}`, { ...target, title: 'Renombrada fuera', savedAt: Date.now() + 60000, record: { ...target.record, name: 'Renombrada fuera', savedAt: Date.now() + 60000 } });
await page.goto(`${BASE}/#/w/${W}`); await sleep(300);
f = await open(); await sleep(300);
ok(await fw().evaluate((id) => (DT.records.get(id) || {}).name, target.record.id) === 'Renombrada fuera', 'si el mundo tiene una versión más reciente, gana la del mundo');

// La extensión aparece en la barra lateral y en el gestor
await page.goto(`${BASE}/#/w/${W}/plugins`); await sleep(600);
ok(/Tablas D&D/.test(await page.locator('body').textContent()), 'aparece en «Gestionar extensiones»');

ok(!errors.length, 'sin errores de consola en Veil ni en la app', errors.slice(0, 4).join(' | '));
await browser.close();
console.log(`\n${total - fails}/${total} OK${fails ? `, ${fails} fallas` : ''}`);
if (fails) console.log(serverLog.split('\n').slice(-15).join('\n'));
process.exit(fails ? 1 : 0);
