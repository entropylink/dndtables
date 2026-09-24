#!/usr/bin/env node
/**
 * Pruebas de la app suelta (index.html), headless con Playwright.
 *
 *   node tests/app.test.mjs            → corre todo; sale con 1 si algo falla
 *   SHOTS=1 node tests/app.test.mjs    → además guarda capturas en tests/.shots/
 *
 * Playwright: en el entorno remoto está en /opt/node22/lib/node_modules/playwright.
 * En tu PC: `npm i -g playwright && npx playwright install chromium`, o ajusta PW_PATH.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const URL_APP = pathToFileURL(join(HERE, '..', 'index.html')).href;
const OUT = join(HERE, '.shots');
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright/index.mjs';
let chromium;
try { ({ chromium } = await import(PW)); } catch { ({ chromium } = await import('playwright')); }
if (process.env.SHOTS) mkdirSync(OUT, { recursive: true });

let fails = 0, total = 0;
const ok = (cond, name, info = '') => { total++; if (!cond) fails++; console.log(`${cond ? '✓' : '✖'} ${name}${cond ? '' : ' — ' + info}`); };
const IGNORE = /fonts\.googleapis|fonts\.gstatic|ERR_CERT|net::ERR/;

const browser = await chromium.launch();
async function fresh(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, acceptDownloads: true });
  if (opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.test(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(URL_APP + (opts.query || ''));
  await page.waitForFunction(() => window.DT && DT.started);
  return { ctx, page, errors };
}
const shot = async (page, name, full = false) => { if (process.env.SHOTS) await page.screenshot({ path: join(OUT, name + '.png'), fullPage: full }); };

/* ── 1. Motor de tablas (funciones puras) ─────────────────────────────── */
{
  const { ctx, page, errors } = await fresh();
  const r = await page.evaluate(() => {
    const out = {};
    const f = DT.faces([1, 1], 100);
    out.half = f[0].lo === 1 && f[0].hi === 50 && f[1].lo === 51 && f[1].hi === 100;
    // pesos aleatorios: siempre cubren 1..N sin huecos, cada fila ≥ 1 cara, peso 0 → sin rango
    let fine = true;
    for (let k = 0; k < 300; k++) {
      const n = 1 + Math.floor(Math.random() * 30), sides = [4, 6, 8, 10, 12, 20, 100][k % 7];
      if (n > sides) continue;
      const ws = Array.from({ length: n }, (_, i) => (i % 7 === 3 ? 0 : Math.random() * 10 + 0.01));
      const fr = DT.faces(ws, sides);
      let next = 1;
      fr.forEach((x, i) => { if (ws[i] === 0) { if (x) fine = false; return; } if (!x || x.lo !== next || x.hi < x.lo) fine = false; next = x ? x.hi + 1 : next; });
      if (ws.some((w) => w > 0) && next !== sides + 1) fine = false;
    }
    out.random = fine;
    try { DT.faces([1, 1, 1], 2, 'x'); out.throws = false; } catch { out.throws = true; }
    out.monotone = (() => { const fr = DT.faces([8, 1], 100); return (fr[0].hi - fr[0].lo) > (fr[1].hi - fr[1].lo); })();
    DT.seed(42); const a = [DT.rollDie(20), DT.rollDie(20), DT.rollDie(20)]; DT.seed(42); const b = [DT.rollDie(20), DT.rollDie(20), DT.rollDie(20)];
    out.seeded = a.join() === b.join();
    out.dice = JSON.stringify([DT.parseDice('1d4'), DT.parseDice('2d6+1'), DT.parseDice('1d8−2'), DT.parseDice('1')]);
    return out;
  });
  ok(r.half, 'faces: dos pesos iguales parten el d100 en 1–50 / 51–100');
  ok(r.random, 'faces: con pesos al azar siempre cubre el dado entero, sin huecos ni solapes');
  ok(r.throws, 'faces: más filas que caras es un error explícito');
  ok(r.monotone, 'faces: más peso → rango más ancho');
  ok(r.seeded, 'DT.seed repite las mismas tiradas');
  ok(r.dice === JSON.stringify([{ count: 1, die: 4, mod: 0 }, { count: 2, die: 6, mod: 1 }, { count: 1, die: 8, mod: -2 }, { count: 0, die: 1, mod: 1 }]), 'parseDice entiende 1d4, 2d6+1, 1d8−2 y "1"', r.dice);
  const i18n = await page.evaluate(() => {
    const en = Object.keys(DT.dict.en), es = Object.keys(DT.dict.es);
    const used = new Set();
    const scan = (root) => root.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-ph],[data-i18n-title]').forEach((el) => {
      for (const a of ['data-i18n', 'data-i18n-html', 'data-i18n-ph', 'data-i18n-title']) if (el.hasAttribute(a)) used.add(el.getAttribute(a)); });
    scan(document); document.querySelectorAll('template').forEach((t) => scan(t.content));
    return { onlyEn: en.filter((k) => !es.includes(k)), onlyEs: es.filter((k) => !en.includes(k)), missing: [...used].filter((k) => !(k in DT.dict.en) || !(k in DT.dict.es)) };
  });
  ok(!i18n.onlyEn.length && !i18n.onlyEs.length, 'i18n: EN y ES tienen exactamente las mismas claves', JSON.stringify(i18n));
  ok(!i18n.missing.length, 'i18n: toda clave usada en el HTML existe en los dos idiomas', i18n.missing.join());
  ok(!errors.length, 'sin errores de consola al cargar', errors.join(' | '));
  await ctx.close();
}

/* ── 2. Datos de la pestaña de vendedores ─────────────────────────────── */
{
  const { ctx, page } = await fresh();
  const r = await page.evaluate(() => {
    const A = DT.tabs.get('vendors').api, out = {};
    const cover = (tb) => { const seen = new Array(tb.die + 1).fill(0); tb.ranges().forEach((x) => { for (let n = x.lo; n <= x.hi; n++) seen[n]++; }); return seen.slice(1).every((c) => c === 1); };
    out.fixed = ['STOCK', 'STATES', 'EVENTS', 'ANCESTRY', 'TRAIT', 'QUIRK', 'ATTITUDE', 'RUMOR', 'TRUTH'].filter((k) => !cover(A[k]));
    const cats = [...new Set(Object.values(A.CATALOG).map((c) => c.cat))];
    out.missingSpecial = cats.filter((c) => !A.SPECIALS[c] || A.SPECIALS[c].length !== 6);
    const keys = new Set(Object.keys(A.CATALOG));
    const refs = [];
    [...A.STATES.rows, ...A.EVENTS.rows].forEach((r) => { Object.keys(r.weights || {}).forEach((k) => refs.push(k)); (r.remove || []).forEach((k) => refs.push(k)); if (r.force) refs.push(r.force); Object.keys(r.dcKey || {}).forEach((k) => refs.push(k)); });
    out.badRefs = refs.filter((k) => !keys.has(k));
    const priceCats = new Set([...A.STATES.rows, ...A.EVENTS.rows].flatMap((r) => [...Object.keys(r.price || {}), ...Object.keys(r.stock || {})]));
    out.badCats = [...priceCats].filter((c) => c !== 'all' && !cats.includes(c));
    out.noWeight = [...A.VARIETY_KEYS, ...A.TRAVEL_KEYS].filter((k) => !A.VENDOR_W[k]);
    out.sizes = A.SIZES.map((s) => { const v = A.varietyTable(s); return v.pool.length ? cover({ die: 100, ranges: () => v.table.ranges(v.wf) }) : true; }).every(Boolean);
    const w = (sizeKey, key) => { const s = A.SIZES.find((x) => x.key === sizeKey); const v = A.varietyTable(s); const r = v.table.ranges(v.wf).find((x) => x.row.key === key); return r ? r.hi - r.lo + 1 : 0; };
    out.enchCity = w('city', 'enchanter'); out.enchMega = w('megalopolis', 'enchanter');
    out.herbCity = w('city', 'herbalist');
    const trav = (stateId) => A.TRAVEL_T.ranges(A.travelWF(A.STATES.byId(stateId), A.EVENTS.byId('quiet'))).map((x) => x.row.key);
    out.crackdown = trav('crackdown').includes('blackMarket');
    out.embargo = trav('embargo').includes('caravan');
    out.warWidth = (() => { const g = (s) => { const r = A.TRAVEL_T.ranges(A.travelWF(A.STATES.byId(s), A.EVENTS.byId('quiet'))).find((x) => x.row.key === 'mercRecruiter'); return r.hi - r.lo + 1; }; return g('war') > g('normal'); })();
    const d = { state: { id: 'war' }, event: { id: 'shortage' } };
    out.warArms = A.catMult('armas', d);
    out.warFood = A.catMult('comida', { state: { id: 'normal' }, event: { id: 'quiet' } });
    const v = { key: 'blacksmith', npc: { att: 1 }, hagRoll: null, factor: 1, comp: 0 };
    out.hostileDC = A.effHaggle(v, { state: { id: 'crackdown' } }).dc;   // 15 + 3 (hostil) + 1 (mano dura)
    out.tavernBrawl = A.effHaggle({ key: 'tavern', npc: { att: 3 } }, { event: { id: 'brawl' } }).dc;   // 16 + 2
    return out;
  });
  ok(!r.fixed.length, 'tablas fijas cubren su dado exactamente una vez', r.fixed.join());
  ok(!r.missingSpecial.length, 'cada categoría del catálogo tiene su tabla d6 de piezas especiales', r.missingSpecial.join());
  ok(!r.badRefs.length, 'estados y eventos solo nombran vendedores que existen', r.badRefs.join());
  ok(!r.badCats.length, 'estados y eventos solo nombran categorías que existen', r.badCats.join());
  ok(!r.noWeight.length, 'cada vendedor tiene peso en su d100', r.noWeight.join());
  ok(r.sizes, 'el d100 de variedad cubre 1–100 en cada tamaño');
  ok(r.enchMega > r.enchCity && r.herbCity > r.enchCity, `pesos: el encantador es raro y crece con el tamaño (ciudad ${r.enchCity}, megalópolis ${r.enchMega}, herbolario ${r.herbCity})`);
  ok(!r.crackdown && !r.embargo, 'mano dura quita al contrabandista; bloqueo quita la caravana');
  ok(r.warWidth, 'guerra ensancha el rango del reclutador de mercenarios');
  ok(Math.abs(r.warArms - 1.25 * 1.10) < 1e-9 && r.warFood === 1, `precio por categoría: guerra × retraso = ×1.375 (${r.warArms})`);
  ok(r.hostileDC === 19, `CD efectiva: herrería 15 + hostil 3 + mano dura 1 = 19 (${r.hostileDC})`);
  ok(r.tavernBrawl === 18, `pelea en la taberna: CD 16 + 2 = 18 (${r.tavernBrawl})`);
  await ctx.close();
}

/* ── 3. Generar en todos los tamaños (semilla fija) ───────────────────── */
{
  const { ctx, page, errors } = await fresh();
  const r = await page.evaluate(() => {
    const A = DT.tabs.get('vendors').api, out = [];
    for (let seed = 1; seed <= 25; seed++) {
      for (const s of A.SIZES) {
        DT.seed(seed * 97 + s.key.length);
        A.select(s.key); A.generateAll(); A.newWeek(); A.newWeek();
        const d = A.current().data;
        const all = [...d.permanent, ...d.traveling];
        const bad = all.filter((v) => !v.npc || !Array.isArray(v.stock) || v.stock.length !== A.CATALOG[v.key].goods.length || !v.special);
        const expectedPerm = s.core.length + Math.min(s.variety, A.varietyTable(s).pool.length);
        if (bad.length || d.permanent.length !== expectedPerm || d.week !== 3 || !d.state || !d.event) out.push({ seed, size: s.key, bad: bad.length, perm: d.permanent.length, expectedPerm, week: d.week });
        const dup = d.permanent.map((v) => v.key); if (new Set(dup).size !== dup.length) out.push({ seed, size: s.key, dup: true });
        const ev = A.EVENTS.byId(d.event.id);
        if (ev.remove && d.traveling.some((v) => ev.remove.includes(v.key))) out.push({ seed, size: s.key, raidFail: true });
      }
    }
    return { problems: out, records: DT.records.list('vendors').length };
  });
  ok(!r.problems.length, 'generar + 2 semanas × 8 tamaños × 25 semillas: tenderos, existencias, sin repetidos, la redada funciona', JSON.stringify(r.problems.slice(0, 3)));
  ok(r.records === 200, `cada generación queda guardada (${r.records})`);
  ok(!errors.length, 'sin errores de consola tras 200 generaciones', errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ── 4. Interfaz: generar, regatear, cambiar idioma, persistir ─────────── */
{
  const { ctx, page, errors } = await fresh();
  await page.click('[data-ref="genBtn"]');
  const cards = await page.locator('#panel-vendors .vendor').count();
  ok(cards >= 9, `Villa: ≥ 9 fichas (${cards})`);
  ok(await page.locator('#panel-vendors .scard').count() === 2, 'estado del asentamiento y evento semanal visibles');
  ok(await page.locator('#panel-vendors .vendor .npc .who').count() === cards, 'cada ficha tiene su tendero');
  await page.click('[data-ref="genBtn"]');
  const curMark = await page.evaluate(() => ({ active: DT.records.active('vendors').id, marked: document.querySelector('#panel-vendors .saved-item.current').dataset.id }));
  ok(curMark.active === curMark.marked, 'tras generar otra ciudad, la biblioteca marca como «actual» la nueva', JSON.stringify(curMark));
  const first = page.locator('#panel-vendors .vendor').first();
  const before = await first.locator('.note').textContent();
  await first.locator('.hagInput').fill('30');
  await first.locator('.hagApply').click();
  const after = await page.locator('#panel-vendors .vendor').first().locator('.note').textContent();
  ok(before !== after && /(Deal|Trato)/.test(after), 'la calculadora de regateo aplica el descuento', after);
  await page.locator('#panel-vendors .vendor').first().locator('.rerollNpc').click();
  ok(await page.locator('#panel-vendors .vendor').first().locator('.npc .who').count() === 1, '↻ Tendero vuelve a tirar el PNJ');
  const name = await page.inputValue('[data-ref="saveName"]');
  await page.click('#langToggle');
  ok((await page.textContent('#appTitle')).includes('Tablas D&D') && (await page.textContent('#tabBar')).includes('Vendedores'), 'EN → ES cambia la cabecera y las pestañas');
  ok((await page.textContent('#panel-vendors [data-ref="genBtn"]')).includes('Generar'), 'EN → ES cambia los botones');
  ok(/semana/.test(await page.textContent('#panel-vendors .scard.event')), 'EN → ES cambia las tarjetas de estado');
  await shot(page, 'app-es');
  await page.reload(); await page.waitForFunction(() => window.DT && DT.started);
  ok(await page.inputValue('[data-ref="saveName"]') === name, 'al recargar vuelve la ciudad activa', name);
  ok((await page.textContent('#tabBar')).includes('Vendedores'), 'al recargar recuerda el idioma');
  ok(await page.locator('#panel-vendors .saved-item').count() === 2, 'las ciudades aparecen en «Ciudades guardadas»');
  // copiar como Markdown
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const md = await page.evaluate(() => { const t = DT.tabs.get('vendors'); return t.toMarkdown(DT.records.active('vendors'), { dm: true }); });
  ok(md.includes('| ') && md.includes(name) && /\*DM: /.test(md), 'Markdown del asentamiento: tabla, nombre y veracidad de rumores para el DM');
  const art = await page.evaluate(() => DT.tabs.get('vendors').api.articlePayload(DT.records.active('vendors')));
  ok(art.block.startsWith(':::nota 🛒') && art.block.trimEnd().endsWith(':::') && !/DM: /.test(art.block), 'bloque del artículo: :::nota 🛒 … ::: sin secretos del DM');
  // exportar
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-ref="exportBtn"]')]);
  const exported = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  ok(exported.type === 'dndtables-record' && exported.record.name === name && exported.record.data.v === 3, 'exportar actual → dndtables-record v3');
  // borrar la actual limpia la vista
  await page.locator('#panel-vendors .saved-item.current [data-act="delete"]').click();
  ok(await page.locator('#panel-vendors .vendor').count() === 0 && await page.locator('#panel-vendors .saved-item').count() === 1, 'borrar la ciudad actual la quita de la lista y de la vista');
  ok(!errors.length, 'sin errores de consola en la interfaz', errors.join(' | '));
  await ctx.close();
}

/* ── 5. Migración de la v2 y formatos viejos ──────────────────────────── */
{
  const v2 = [{ id: 'c1', name: 'Oldport', date: '1/2/2026', data: { sizeKey: 'city', permanent: [
    { key: 'generalStore', tier: 'basic', factor: 1.1, priceLabel: 'Algo caro (+10%)', hagRoll: null },
    { key: 'tavern', tier: 'basic', factor: 1, priceLabel: 'Precio estándar', hagRoll: '18' },
    { key: 'nope', tier: 'variety', factor: 1 }], traveling: [{ key: 'fortune', tier: 'travel', factor: 0.9, hagRoll: null }] } }];
  const init = `if(!localStorage.getItem('dnd_vendor_cities_v2')){ localStorage.setItem('dnd_vendor_cities_v2', ${JSON.stringify(JSON.stringify(v2))}); localStorage.setItem('lang','es'); }`;
  const { ctx, page, errors } = await fresh({ init });
  const r = await page.evaluate(() => ({ recs: DT.records.list('vendors').map((x) => x.name), old: localStorage.getItem('dnd_vendor_cities_v2') !== null, lang: DT.lang }));
  ok(r.recs.length === 1 && r.recs[0] === 'Oldport', 'las ciudades v2 pasan a la v3 al primer arranque');
  ok(r.old, 'la clave vieja no se borra');
  ok(r.lang === 'es', 'la preferencia de idioma vieja se respeta');
  await page.locator('#panel-vendors .saved-item [data-act="load"]').click();
  const cards = await page.locator('#panel-vendors .vendor').count();
  ok(cards === 3, `una ciudad v2 carga (la clave desconocida se ignora): ${cards} fichas`);
  ok(await page.locator('#panel-vendors [data-act="rollNpc"]').count() === 3, 'sin tendero en la v2 → botón «Tirar tendero»');
  // precio igual al de la v2: factor 1.1, sin competencia, existencias normales → antorcha 1 pc × 1.1
  const price = await page.locator('#panel-vendors .vendor').first().locator('tr', { hasText: 'Saco de dormir' }).locator('td.price').textContent();
  ok(price.trim() === '1 po 1 pp', `los precios de una ciudad v2 no cambian (saco de dormir 1 po × 1.1 = ${price.trim()})`);
  await page.locator('#panel-vendors [data-act="rollNpc"]').first().click();
  ok(await page.locator('#panel-vendors .vendor').first().locator('.npc .who').count() === 1, 'se le puede tirar tendero a una ciudad vieja');
  // importar un JSON de la v2 (una ciudad) por el selector de archivos
  const single = { type: 'dnd-vendor-settlement', version: 2, name: '<img src=x onerror=window.__xss=1>', data: { sizeKey: 'hamlet', permanent: [{ key: 'generalStore', tier: 'basic', factor: 1 }], traveling: [] } };
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#panel-vendors [data-ref="importBtn"]')]);
  await chooser.setFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(single)) });
  await page.waitForTimeout(300);
  const x = await page.evaluate(() => ({ xss: !!window.__xss, imgs: document.querySelectorAll('#panel-vendors .saved-item img').length, n: DT.records.list('vendors').length, name: document.querySelector('#panel-vendors [data-ref="saveName"]').value }));
  ok(x.n === 2 && x.name.startsWith('<img'), 'importar una ciudad v2 la guarda y la carga');
  ok(!x.xss && x.imgs === 0, 'un nombre malicioso importado se muestra escapado (sin XSS)');
  const coll = await page.evaluate(() => { const r = DT.io.parse({ type: 'dnd-vendor-collection', cities: [{ id: 'c1', name: 'Dup', data: { sizeKey: 'town', permanent: [] } }, { name: 'Bad' }] }); const added = DT.io.importRecords(r.records); return { added: added.length, skipped: r.skipped, newId: added[0].id !== 'c1' }; });
  ok(coll.added === 1 && coll.skipped === 0 && coll.newId, 'colección v2: un id repetido recibe uno nuevo (no pisa); lo inválido se descarta');
  const unknown = await page.evaluate(() => DT.io.parse({ type: 'dndtables-collection', records: [{ id: 'z', tab: 'nope', name: 'X', data: {} }] }));
  ok(unknown.records.length === 0 && unknown.skipped === 1, 'resultados de una pestaña desconocida se omiten al importar');
  ok(!errors.length, 'sin errores de consola en la migración', errors.join(' | '));
  await ctx.close();
}

/* ── 6. Pestañas nuevas: registro y pestaña declarativa ────────────────── */
{
  const { ctx, page, errors } = await fresh();
  const r = await page.evaluate(() => {
    const out = {};
    DT.simpleTableTab({ id: 'test-weather', icon: '⛅', order: 50, title: { en: 'Weather', es: 'Clima' }, tagline: { en: 'Test', es: 'Prueba' },
      tables: [
        { id: 'sky', die: 6, title: { en: 'Sky', es: 'Cielo' }, rows: [{ lo: 1, hi: 3, text: { en: 'Clear', es: 'Despejado' } }, { lo: 4, hi: 6, text: { en: 'Cloudy', es: 'Nublado' } }] },
        { id: 'wind', die: 20, title: { en: 'Wind', es: 'Viento' }, rows: [{ w: 3, text: { en: 'Calm', es: 'Calma' } }, { w: 1, text: { en: 'Gale', es: 'Vendaval' } }] }] });
    out.bar = document.querySelectorAll('#tabBar .tabbtn').length; out.tabs = DT.tabList().length;
    out.hidden = document.getElementById('tabBar').hidden;
    try { DT.registerTab({ id: 'vendors', mount() {} }); out.dupThrows = false; } catch { out.dupThrows = true; }
    try { DT.registerTab({ id: 'Bad Id', mount() {} }); out.badThrows = false; } catch { out.badThrows = true; }
    DT.registerTab({ id: 'test-broken', title: { en: 'Broken', es: 'Rota' }, mount() { throw new Error('boom'); } });
    return out;
  });
  ok(r.bar === r.tabs && r.tabs >= 8 && !r.hidden, `barra de pestañas con todas las registradas (${r.bar})`);
  ok(r.dupThrows && r.badThrows, 'registerTab rechaza ids repetidos o inválidos');
  await page.click('#tabBar [data-tab="test-weather"]');
  await page.click('#panel-test-weather [data-ref="rollAll"]');
  const rc = await page.locator('#panel-test-weather .rcard').count();
  const saved = await page.evaluate(() => DT.records.list('test-weather').length);
  ok(rc === 2 && saved === 1, 'pestaña declarativa: «Tirar todo» tira cada tabla y guarda el resultado');
  ok(await page.locator('#panel-test-weather .saved-item').count() === 1, 'la biblioteca genérica lista el resultado');
  const md = await page.evaluate(() => DT.tabs.get('test-weather').toMarkdown(DT.records.list('test-weather')[0]));
  ok(/\*\*Sky\*\* \(d6: \d\)/.test(md), 'la pestaña declarativa exporta Markdown', md);
  await page.click('#tabBar [data-tab="test-broken"]');
  ok(await page.locator('#panel-test-broken .tab-error').count() === 1, 'una pestaña que falla al montar muestra su error sin tumbar la app');
  await page.click('#tabBar [data-tab="vendors"]');
  await page.click('#panel-vendors [data-ref="genBtn"]');
  ok(await page.locator('#panel-vendors .vendor').count() > 0, 'las demás pestañas siguen funcionando');
  await page.click('#langToggle');
  ok((await page.textContent('#tabBar')).includes('Clima'), 'las pestañas registradas también cambian de idioma');
  ok((await page.textContent('#appTitle')).includes('Tablas D&D'), 'con varias pestañas la cabecera es la de la app');
  const errs = errors.filter((e) => !/boom/.test(e));
  ok(!errs.length, 'sin errores de consola (salvo el de la pestaña rota a propósito)', errs.join(' | '));
  await ctx.close();
}

/* ── 6b. Pestañas declarativas reales: todas las combinaciones de contexto ─ */
{
  const { ctx, page, errors } = await fresh();
  const r = await page.evaluate(() => {
    const out = { tabs: [], problems: [], worstTV: 0 };
    const bad = (m) => { if (out.problems.length < 12) out.problems.push(m); };
    const product = (ctxDefs) => ctxDefs.reduce((acc, c) => acc.flatMap((o) => c.options.map((opt) => ({ ...o, [c.id]: opt.id }))), [{}]);
    const TOKEN = /\{(\d*)d(\d+)(?:([+-])(\d+))?(?:[*x×](\d+))?\}/g;
    for (const tab of DT.tabList()) {
      if (!tab.tables || !tab.api || !tab.api.rollAll) continue;
      if (tab.id.startsWith('test-')) continue;
      const tables = tab.tables, ctxDefs = tab.context, A = tab.api;
      const combos = product(ctxDefs);
      out.tabs.push(`${tab.id}:${combos.length}`);
      const optIds = Object.fromEntries(ctxDefs.map((c) => [c.id, c.options.map((o) => o.id)]));
      // 1) Textos: EN y ES con los mismos dados; claves de contexto y de tablas que existen.
      tables.forEach((t, idx) => {
        const earlier = Object.fromEntries(tables.slice(0, idx).map((x) => [x.id, x.rows.map((r) => r.id).filter((v) => v != null)]));
        const known = { ...optIds, ...earlier };
        for (const row of t.rows) {
          const tt = row.text != null ? row.text : row.name;
          if (tt && typeof tt === 'object') {
            if (!tt.en || !tt.es) bad(`${tab.id}/${t.id}: fila sin EN o ES`);
            const a = (tt.en.match(TOKEN) || []).join(), b = (tt.es.match(TOKEN) || []).join();
            if (a !== b) bad(`${tab.id}/${t.id}: dados distintos EN/ES «${tt.en}» / «${tt.es}»`);
          }
          for (const [k, ids] of Object.entries(row.only || {})) { if (!known[k]) bad(`${tab.id}/${t.id}: only.${k} no existe`); else ids.forEach((v) => { if (!known[k].includes(v)) bad(`${tab.id}/${t.id}: only.${k}=${v} no existe`); }); }
          for (const [k, m] of Object.entries(row.weight || {})) { if (!known[k]) bad(`${tab.id}/${t.id}: weight.${k} no existe`); else Object.keys(m).forEach((v) => { if (!known[k].includes(v)) bad(`${tab.id}/${t.id}: weight.${k}.${v} no existe`); }); }
        }
        for (const [k, ids] of Object.entries(t.when || {})) { if (!known[k]) bad(`${tab.id}/${t.id}: when.${k} no existe`); else ids.forEach((v) => { if (!known[k].includes(v)) bad(`${tab.id}/${t.id}: when.${k}=${v} no existe`); }); }
      });
      // 2) Cobertura exhaustiva: en cada combinación, y para cada valor posible de la tabla de la que
      //    depende, la tabla tiene filas (si le toca tirarse) y caben en su dado.
      for (const combo of combos) {
        tables.forEach((t, idx) => {
          const depKeys = [...t.deps].filter((k) => tables.slice(0, idx).some((x) => x.id === k));
          const depVals = depKeys.length ? depKeys.reduce((acc, k) => { const dep = tables.find((x) => x.id === k);
            const live = dep.rows.filter((row) => row.id != null && (!dep.conds || A.weightFn({ ...combo })(row) > 0)).map((row) => row.id);
            return acc.flatMap((e) => live.map((v) => ({ ...e, [k]: v }))); }, [{}]) : [{}];
          for (const dv of depVals) {
            const env = { ...combo, ...dv };
            if (t.when && !Object.entries(t.when).every(([k, ids]) => env[k] != null && ids.includes(env[k]))) continue;
            try { const n = t.ranges(t.conds ? A.weightFn(env) : undefined).length; if (!n) bad(`${tab.id}/${t.id} sin filas en ${JSON.stringify(env)}`); }
            catch (e) { bad(`${tab.id}/${t.id}: ${e.message} en ${JSON.stringify(env)}`); }
          }
        });
        // 2b) Los pesos se notan: lo que da el dado no se aleja de lo que dicen los pesos
        //     (con muchas filas en un dado chico, «al menos una cara» los aplana).
        tables.forEach((t, idx) => {
          if (!t.conds && !t.rows.some((row) => row.w != null && row.w !== 1)) return;
          if (t.fixed) return;
          const depKeys = [...t.deps].filter((k) => tables.slice(0, idx).some((x) => x.id === k));
          const envs = depKeys.length ? depKeys.reduce((acc, k) => { const dep = tables.find((x) => x.id === k);
            return acc.flatMap((e) => dep.rows.filter((row) => row.id != null).map((row) => ({ ...e, [k]: row.id }))); }, [{}]) : [{}];
          for (const dv of envs) {
            const env = { ...combo, ...dv }, wf = A.weightFn(env);
            const ws = t.rows.map((row) => { const w = t.conds ? wf(row) : (row.w == null ? 1 : row.w); return w > 0 ? w : 0; });
            const W = ws.reduce((a, b) => a + b, 0); if (!W) continue;
            let faces; try { faces = DT.faces(ws, t.die); } catch { continue; }
            const tv = ws.reduce((acc, w, i) => acc + Math.abs(w / W - (faces[i] ? (faces[i].hi - faces[i].lo + 1) / t.die : 0)), 0) / 2;
            out.worstTV = Math.max(out.worstTV || 0, tv);
            if (tv > 0.12) bad(`${tab.id}/${t.id}: el d${t.die} aplana los pesos (distancia ${tv.toFixed(2)}) en ${JSON.stringify(env)}`);
          }
        });
        // 3) Tiradas reales con semillas: nada revienta, nada queda con dados sin tirar.
        for (let seed = 1; seed <= 6; seed++) {
          DT.seed(seed * 131 + combos.indexOf(combo));
          let data; try { data = A.rollAll(combo); } catch (e) { bad(`${tab.id} ${JSON.stringify(combo)}: ${e.message}`); continue; }
          const rec = { name: 'x', data };
          for (const t of tables) {
            const rs = data.rolls[t.id]; if (!rs) continue;
            if (!rs.length) bad(`${tab.id}/${t.id}: tocaba tirarla y no salió nada (${JSON.stringify(combo)})`);
            for (const lang of ['en', 'es']) { DT.lang = lang; rs.forEach((x) => { const txt = A.resText(t, x); if (TOKEN.test(txt) || /\{\d*d\d/.test(txt)) bad(`${tab.id}/${t.id}: dados sin tirar «${txt}»`); }); }
            DT.lang = 'en';
          }
          const mdx = A.markdown(rec, { dm: false });
          const dmTables = tables.filter((t) => t.dm && data.rolls[t.id] && data.rolls[t.id].length);
          dmTables.forEach((t) => { if (mdx.includes(`**${DT.tx(t.title)}**`)) bad(`${tab.id}: la tabla DM ${t.id} sale en el Markdown para jugadores`); });
        }
      }
    }
    return out;
  });
  ok(r.tabs.length === 5, `pestañas declarativas revisadas: ${r.tabs.join(', ')} (peor distancia pesos/dado: ${(r.worstTV || 0).toFixed(3)})`);
  ok(!r.problems.length, 'datos: EN/ES con los mismos dados, condiciones que apuntan a algo que existe, ninguna tabla vacía en ninguna combinación, sin dados sin tirar, lo del DM fuera del Markdown de jugadores', r.problems.join(' | '));
  // Taberna: el adjetivo concuerda en español
  const tav = await page.evaluate(() => {
    const T = DT.tabs.get('tavern'), out = [];
    DT.lang = 'es';
    for (let seed = 1; seed <= 300; seed++) {
      DT.seed(seed); const data = T.api.rollAll({ quality: 'common' }); const h = T.api.helpers({ name: '', data });
      const A = h.row('nameA'), J = h.row('adj'), P = h.row('pattern');
      const name = T.tables && DT.tabs.get('tavern').api && (DT.tabs.get('tavern').api.helpers ? null : null);
      if (P.id === 'adj') { const expect = (A.text.es.charAt(0).toUpperCase() + A.text.es.slice(1)) + ' ' + J[A.g]; out.push(expect); }
    }
    DT.lang = 'en';
    return out;
  });
  ok(tav.length > 50 && tav.every((n) => /^(El|La) /.test(n)) && !tav.some((n) => /^La .* (Dorado|Borracho|Tuerto|Oxidado|Negro|Rojo|Viejo)$/.test(n)), `taberna: «La Jarra Dorada», nunca «La Jarra Dorado» (${tav.slice(0, 3).join(' · ')})`);
  ok(!errors.length, 'sin errores de consola revisando las pestañas', errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ── 6c. Pestañas en la interfaz y Tablón de encargos ──────────────────── */
{
  const { ctx, page, errors } = await fresh();
  await page.click('#panel-vendors [data-ref="genBtn"]');
  const city = await page.evaluate(() => DT.records.active('vendors'));
  for (const id of ['npc', 'tavern', 'encounters', 'weather', 'loot']) {
    await page.click(`#tabBar [data-tab="${id}"]`);
    await page.click(`#panel-${id} [data-ref="rollAll"]`);
  }
  const counts = await page.evaluate(() => Object.fromEntries(['npc', 'tavern', 'encounters', 'weather', 'loot'].map((id) => [id, DT.records.list(id).length])));
  ok(Object.values(counts).every((n) => n === 1), 'cada pestaña guarda su resultado', JSON.stringify(counts));
  const names = await page.evaluate(() => ({ npc: DT.records.active('npc').name, tavern: DT.records.active('tavern').name }));
  ok(names.npc.length > 1 && !/Quick NPC/.test(names.npc) && /^The /.test(names.tavern), `nombres compuestos: PNJ «${names.npc}», taberna «${names.tavern}»`);
  // PNJ: 🎲 cambia el nombre (misma ascendencia); ↻ en Ascendencia arrastra el nombre; renombrar a mano manda
  await page.click('#tabBar [data-tab="npc"]');
  const nm = await page.evaluate(async () => {
    const out = {}, get = () => DT.records.active('npc');
    const anc0 = get().data.rolls.ancestry[0].i; const names = new Set([get().name]);
    for (let k = 0; k < 8; k++) { document.querySelector('#panel-npc [data-ref="nameDice"]').click(); names.add(get().name); }
    out.diceChanges = names.size > 1; out.sameAncestry = get().data.rolls.ancestry[0].i === anc0;
    out.nameMatches = get().name === DT.tabs.get('npc').api.helpers(get()).text('name');
    document.querySelector('#panel-npc .rcard[data-t="ancestry"] [data-act="roll"]').click();
    out.followsAncestry = get().name === DT.tabs.get('npc').api.helpers(get()).text('name');
    const inp = document.querySelector('#panel-npc [data-ref="name"]'); inp.value = 'Doña Mía'; document.querySelector('#panel-npc [data-ref="rename"]').click();
    document.querySelector('#panel-npc .rcard[data-t="ancestry"] [data-act="roll"]').click();
    out.manualKept = get().name === 'Doña Mía';
    return out;
  });
  ok(nm.diceChanges && nm.sameAncestry && nm.nameMatches, 'PNJ: 🎲 da otro nombre de la misma ascendencia', JSON.stringify(nm));
  ok(nm.followsAncestry, 'PNJ: ↻ en Ascendencia actualiza también el nombre guardado');
  ok(nm.manualKept, 'PNJ: un nombre puesto a mano no se pisa al volver a tirar');
  // Clima: cambiar el contexto cambia la tabla de referencia
  await page.click('#tabBar [data-tab="weather"]');
  await page.selectOption('#panel-weather select[data-ctx="climate"]', 'tropical');
  const tropicalHasFreezing = await page.evaluate(() => [...document.querySelectorAll('#panel-weather details')][0].textContent.includes('Freezing'));
  ok(!tropicalHasFreezing, 'clima tropical: la tabla de referencia ya no ofrece «Helada»');
  // Tablón: con la ciudad guardada, el primer encargo sale de un rumor de sus tenderos
  await page.click('#tabBar [data-tab="jobs"]');
  await page.selectOption('#panel-jobs [data-ref="where"]', `city:${city.id}`);
  await page.selectOption('#panel-jobs [data-ref="tier"]', 't2');
  await page.click('#panel-jobs [data-ref="roll"]');
  const board = await page.evaluate(() => { const T = DT.tabs.get('jobs'); const b = DT.records.active('jobs'); return { b, dm: T.toMarkdown(b, { dm: true }), pl: T.toMarkdown(b, { dm: false }), rewards: b.data.jobs.map((j) => T.api.reward(j)) }; });
  const shopNames = city.data.permanent.concat(city.data.traveling).map((v) => v.npc.name);
  ok(board.b.data.city.id === city.id && board.b.data.jobs[0].rumorJob && shopNames.includes(board.b.data.jobs[0].shop.name), 'tablón de una ciudad guardada: el primer encargo es el rumor de uno de sus tenderos');
  ok(board.b.data.jobs.length >= 1 && board.b.data.jobs.length <= 5, `villa: 1d4 encargos (${board.b.data.jobs.length})`);
  ok(board.rewards.every((n) => n >= 50 && n <= 1200), `niveles 5–10: recompensas entre 2d6×50 × ½ y × 2 (${board.rewards.join(', ')})`);
  ok(/\(DM\)/.test(board.dm) && !/\(DM\)/.test(board.pl), 'Markdown del tablón: complicaciones solo en la versión del DM');
  ok(/(Is the rumor true\?|¿Es cierto el rumor\?) \(DM\): (false|half-true|true|falso|medio cierto|cierto)/.test(board.dm), 'el encargo del rumor dice si el rumor es cierto (DM)', board.dm.split('\n').filter((l) => /DM/.test(l)).join(' / '));
  ok(!/: \?(\n|$)|: $/m.test(board.dm), 'ningún campo del tablón sale vacío o con «?»');
  ok(await page.locator('#panel-jobs .rcard').count() === board.b.data.jobs.length, 'una tarjeta por encargo');
  await page.locator('#panel-jobs .rcard').first().locator('[data-act="reroll"]').click();
  ok(await page.evaluate(() => DT.records.active('jobs').data.jobs[0].rumorJob), '↻ en el encargo del rumor saca otro rumor');
  await page.click('#langToggle');
  ok((await page.textContent('#panel-jobs')).includes('Encargo 1'), 'el tablón cambia de idioma');
  await shot(page, 'app-jobs');
  ok(!errors.length, 'sin errores de consola en las pestañas nuevas', errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ── 7. Puente con Veil: la mezcla (sin Veil) ─────────────────────────── */
{
  const { ctx, page } = await fresh();
  const r = await page.evaluate(() => {
    const rec = (id, savedAt, name) => ({ id, tab: 'vendors', name: name || id, savedAt, data: { sizeKey: 'town', permanent: [], traveling: [] } });
    DT.records.all().splice(0); DT.records.upsert(rec('a', 100), { keepTime: true }); DT.records.upsert(rec('b', 100), { keepTime: true }); DT.records.upsert(rec('c', 300, 'local-newer'), { keepTime: true });
    localStorage.setItem('dndtables.v3.synced', JSON.stringify(['a', 'b', 'c', 'd']));
    DT.records.reload();
    // Veil tiene: b (más nuevo), c (más viejo), d (ya no está aquí → se borró aquí), e (nuevo del mundo). Falta a (se borró en el mundo).
    const res = DT.bridge.merge([rec('b', 200, 'world-newer'), rec('c', 200), rec('d', 100), rec('e', 50)]);
    const names = Object.fromEntries(DT.records.all().map((x) => [x.id, x.name]));
    return { names, upload: res.upload.map((x) => x.id), removeWorld: res.removeWorld };
  });
  ok(!('a' in r.names), 'mezcla: lo que el mundo borró se borra aquí');
  ok(r.names.b === 'world-newer', 'mezcla: gana la versión más reciente del mundo');
  ok(r.names.c === 'local-newer' && r.upload.includes('c'), 'mezcla: la versión local más reciente se sube');
  ok(r.removeWorld.includes('d') && !('d' in r.names), 'mezcla: lo borrado aquí se borra del mundo');
  ok(r.names.e === 'e', 'mezcla: lo nuevo del mundo baja');
  await ctx.close();
}

/* ── 8. Pantallas: sin desbordes en móvil, modo Veil sin fondo ─────────── */
{
  const { ctx, page, errors } = await fresh({ viewport: { width: 390, height: 844 } });
  await page.click('#panel-vendors [data-ref="genBtn"]');
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `móvil 390 px: sin scroll horizontal (${over}px de más)`);
  const overs = [];
  for (const id of ['jobs', 'npc', 'tavern', 'encounters', 'weather', 'loot']) {
    await page.click(`#tabBar [data-tab="${id}"]`);
    await page.click(id === 'jobs' ? '#panel-jobs [data-ref="roll"]' : `#panel-${id} [data-ref="rollAll"]`);
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (o > 0) overs.push(`${id}: ${o}px`);
    await shot(page, `mobile-${id}`, true);
  }
  ok(!overs.length, 'móvil 390 px: ninguna pestaña desborda', overs.join(', '));
  await page.click('#tabBar [data-tab="vendors"]');
  await shot(page, 'app-mobile', true);
  ok(!errors.length, 'sin errores de consola en móvil', errors.join(' | '));
  await ctx.close();
  const v = await fresh({ query: '?velo=mundo-x' });
  const s = await v.page.evaluate(() => { DT.tabs.get('vendors').api.generateAll(); return { keys: Object.keys(localStorage).filter((k) => k.startsWith('velo:mundo-x:')).length, plain: localStorage.getItem('dndtables.v3.records') }; });
  ok(s.keys >= 1 && s.plain === null, 'con ?velo=<mundo> los datos se guardan con prefijo de mundo');
  await v.ctx.close();
}

/* ── 9. Protocolo con un anfitrión falso (mismo origen, sin Veil) ─────── */
{
  const { createServer } = await import('node:http');
  const html = readFileSync(join(HERE, '..', 'index.html'));
  // El anfitrión contesta a "ready" con lo que la prueba le pida (window.__init) y apunta lo que recibe.
  const harness = `<!doctype html><body><script>
    window.__got = [];
    addEventListener('message', (e) => { const m = e.data; if (!m || m.ns !== 'dndtables') return; window.__got.push(m);
      if (m.type !== 'ready') return;
      const reply = () => e.source.postMessage(Object.assign({ ns: 'dndtables', v: 1, type: 'init' }, window.__init), location.origin);
      if (window.__hold) window.__release = reply; else reply(); });
  </script></body>`;
  const srv = createServer((req, res) => {
    if (req.url.startsWith('/index.html')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(harness);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const rec = (id, savedAt) => ({ id, tab: 'vendors', name: id, savedAt, data: { sizeKey: 'town', permanent: [], traveling: [] } });
  // Estado local: 'a' y 'b' ya sincronizados con el mundo w1.
  const seed = async () => {
    await page.goto(`${base}/index.html?velo=w1`);
    await page.evaluate((recs) => { localStorage.setItem('velo:w1:dndtables.v3.records', JSON.stringify(recs)); localStorage.setItem('velo:w1:dndtables.v3.synced', JSON.stringify(['a', 'b'])); localStorage.setItem('velo:w1:dndtables.v3.active', JSON.stringify({ vendors: 'a' })); }, [rec('a', 10), rec('b', 10)]);
  };
  const embed = async (init) => {
    await page.goto(`${base}/harness.html`);
    await page.evaluate((i) => { window.__init = i; const f = document.createElement('iframe'); f.src = '/index.html?velo=w1'; document.body.appendChild(f); }, init);
    const frame = await (await page.waitForSelector('iframe')).contentFrame();
    await frame.waitForFunction(() => window.DT && DT.host.connected);
    await page.waitForTimeout(200);
    return frame;
  };
  await seed();
  let fr = await embed({ ok: false, canEdit: true, caps: { toScreen: true }, records: [], ids: [], world: { id: 'w1', name: 'W1' } });
  let st = await fr.evaluate(() => ({ ids: DT.records.all().map((r) => r.id), canEdit: DT.host.canEdit, bar: document.getElementById('hostBar').textContent }));
  let got = await page.evaluate(() => window.__got.map((m) => m.type));
  ok(st.ids.join() === 'a,b', 'si Veil no puede leer el mundo (ok:false), no se borra nada local', st.ids.join());
  ok(!st.canEdit && /(couldn't|no pudo)/.test(st.bar) && !got.includes('remove') && !got.includes('upsert'), 'y no se escribe en el mundo en esa sesión; la barra lo dice', JSON.stringify(got));
  const ready = await page.evaluate(() => window.__got.find((m) => m.type === 'ready'));
  ok(ready && !('records' in ready) && ready.app.name === 'dndtables', '"ready" no manda los resultados locales al anfitrión');
  await seed();
  fr = await embed({ ok: true, canEdit: true, caps: {}, records: [rec('b', 10)], ids: ['a', 'b'], world: { id: 'w1', name: 'W1' } });
  st = await fr.evaluate(() => DT.records.all().map((r) => r.id));
  got = await page.evaluate(() => window.__got.map((m) => m.type));
  ok(st.join() === 'a,b' && !got.includes('remove'), 'un documento que existe pero no es visible (ids) no se toma por borrado', `${st.join()} / ${got.join()}`);
  await seed();
  fr = await embed({ ok: true, canEdit: true, caps: {}, records: [rec('b', 10)], ids: ['b'], world: { id: 'w1', name: 'W1' } });
  st = await fr.evaluate(() => DT.records.all().map((r) => r.id));
  ok(st.join() === 'b', 'lo que de verdad ya no está en el mundo sí se borra aquí', st.join());
  // Pestaña declarativa con resultado activo: el botón de pantalla de DM aparece al conectar.
  await page.goto(`${base}/index.html?velo=w2`);
  await page.evaluate(() => { localStorage.setItem('velo:w2:dndtables.v3.records', JSON.stringify([{ id: 's1', tab: 'test-sky', name: 'S1', savedAt: 5, data: { v: 1, rolls: {} } }])); localStorage.setItem('velo:w2:dndtables.v3.active', JSON.stringify({ 'test-sky': 's1' })); localStorage.setItem('dndtables.tab', 'test-sky'); });
  await page.goto(`${base}/harness.html`);
  await page.evaluate(() => { window.__hold = true; window.__init = { ok: true, canEdit: true, caps: { toScreen: true }, records: [], ids: ['s1'], world: { id: 'w2', name: 'W2' } };
    const f = document.createElement('iframe'); f.src = '/index.html?velo=w2'; document.body.appendChild(f); });
  const f2 = await (await page.waitForSelector('iframe')).contentFrame();
  await f2.waitForFunction(() => window.DT && DT.started);
  // La pestaña ya está abierta (con su resultado activo) cuando llega el init: antes no hay botón.
  await f2.evaluate(() => { DT.simpleTableTab({ id: 'test-sky', title: { en: 'Sky', es: 'Cielo' }, tables: [{ id: 't', die: 2, title: { en: 'T', es: 'T' }, rows: [{ lo: 1, hi: 1, text: { en: 'a', es: 'a' } }, { lo: 2, hi: 2, text: { en: 'b', es: 'b' } }] }] }); DT.showTab('test-sky'); });
  ok(await f2.evaluate(() => document.querySelector('#panel-test-sky [data-ref="screen"]').hidden), 'sin Veil conectado todavía, no hay botón ▤');
  await page.waitForFunction(() => typeof window.__release === 'function');
  await page.evaluate(() => window.__release());
  await f2.waitForFunction(() => DT.host.connected);
  await page.waitForTimeout(200);
  ok(await f2.evaluate(() => !document.querySelector('#panel-test-sky [data-ref="screen"]').hidden), 'pestaña declarativa: el botón ▤ aparece en cuanto Veil conecta');
  ok(!errors.length, 'sin errores en el protocolo', errors.join(' | '));
  await ctx.close(); srv.close();
}

await browser.close();
console.log(`\n${total - fails}/${total} OK${fails ? `, ${fails} fallas` : ''}`);
process.exit(fails ? 1 : 0);
