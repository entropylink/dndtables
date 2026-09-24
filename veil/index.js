/**
 * Veil — Tablas D&D (entropylink/dndtables) como extensión.
 *
 * La app es un solo archivo (`app.html`, copia exacta de `index.html` de dndtables que pone
 * `install.mjs`). No se reescribe: se abre en un marco con `?velo=<mundo>` y ella misma sabe
 * que está dentro de Veil —guarda con prefijo de mundo, apaga su fondo animado— y habla con
 * este módulo por `postMessage` (protocolo `dndtables` v1, ver `docs/VEIL.md` en dndtables):
 *
 *   · `ready`    → se leen los documentos del mundo (`tablas-dnd`) y se le mandan en `init`.
 *                  La app mezcla (gana el más reciente) y devuelve lo que el mundo no tiene.
 *   · `upsert` / `remove` → cada resultado guardado (una ciudad, una tirada…) es un documento
 *                  del mundo, así viaja en el respaldo, el paquete y la copia sin conexión.
 *                  `saved {id}` le confirma a la app qué ya está en el mundo.
 *   · `toScreen` → cualquier cosa a una pantalla de DM, como tarjeta `snap` con Markdown.
 *   · `toArticle` → un asentamiento se vuelve su artículo (plantilla `settlement`). Repetirlo
 *                  solo reemplaza el bloque del mercado (`:::nota 🛒 …`); la prosa no se toca.
 *
 * Aquí no hay reglas ni tablas: todo eso vive en la app. Este archivo solo traduce mensajes a
 * llamadas de `ctx`.
 */
export const id = 'dndtables';

const APP = '/plugins/dndtables/app.html';
const NS = 'dndtables', V = 1;
const I18N = {
  es: {
    dtvSaved: 'Guardado en el mundo', dtvSaving: 'Guardando en el mundo…', dtvNoWorld: 'No se pudo leer el mundo',
    dtvCount1: 'resultado en este mundo', dtvCountN: 'resultados en este mundo', dtvOpen: 'Abrir aparte',
    dtvReader: 'Vista lector: lo que cambies aquí no se guarda en el mundo.',
    dtvClash: 'Ya hay un artículo «{t}». ¿Añadirle el mercado? Solo se añade (o se actualiza) el bloque del mercado; lo demás no se toca.',
    dtvArticleOpen: 'Artículo listo. ¿Abrirlo?', dtvArticleUpdated: 'Mercado actualizado en el artículo.',
  },
  en: {
    dtvSaved: 'Saved to the world', dtvSaving: 'Saving to the world…', dtvNoWorld: 'Could not read the world',
    dtvCount1: 'result in this world', dtvCountN: 'results in this world', dtvOpen: 'Open separately',
    dtvReader: 'Reader view: changes made here are not saved to the world.',
    dtvClash: 'There is already an article “{t}”. Add the market to it? Only the market block is added (or updated); nothing else is touched.',
    dtvArticleOpen: 'Article ready. Open it?', dtvArticleUpdated: 'Market updated in the article.',
  },
};

let cssDone = false;
function css() {
  if (cssDone) return; cssDone = true;
  const s = document.createElement('style'); s.dataset.module = 'dndtables';
  s.textContent = `
.dtv-wrap{height:100dvh;display:flex;flex-direction:column;background:var(--void)}
.dtv-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 16px;min-height:44px;flex:none;border-bottom:1px solid var(--stone);background:var(--deep);font-size:14px;color:var(--ink)}
.dtv-bar strong{color:var(--bone-b);font-weight:600}
.dtv-g{color:var(--glow);font-size:18px;line-height:1}
.dtv-count,.dtv-status{color:var(--faint);font-size:13px}
.dtv-spacer{flex:1}
.dtv-frame{flex:1;min-height:0;width:100%;border:0;background:var(--void)}
@media(max-width:960px){.dtv-wrap{height:calc(100dvh - 54px)}}
`;
  document.head.appendChild(s);
}

const enc = encodeURIComponent;
// El mismo slug que usa Veil (lib/markdown.mjs), para encontrar un artículo por su título.
const slugify = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// El bloque del mercado dentro de un artículo: de `:::nota 🛒…` hasta su `:::`.
const BLOCK_RE = /^:::nota 🛒[^\n]*\n[\s\S]*?^:::[ \t]*$/m;
export const withBlock = (body, block) => (BLOCK_RE.test(body) ? body.replace(BLOCK_RE, () => block) : `${String(body || '').trimEnd()}\n\n${block}\n`);
export function sectionsBody(sections, block) {
  let placed = false;
  const parts = (sections || []).map((s) => {
    let x = `## ${s}\n\n`;
    if (!placed && /econom/i.test(s)) { x += `${block}\n\n`; placed = true; }
    return x;
  });
  if (!placed) parts.push(`${block}\n`);
  return parts.join('');
}

export function mount(container, ctx) {
  const { el, t } = ctx;
  ctx.i18n(I18N);
  css();
  const api = ctx.plugin.api;
  const src = `${APP}?velo=${enc(ctx.world.id)}&lang=${enc(ctx.lang || 'es')}`;

  const status = el('span', { class: 'dtv-status' });
  const count = el('span', { class: 'dtv-count' });
  const frame = el('iframe', { class: 'dtv-frame', title: ctx.plugin.name });
  const bar = el('div', { class: 'dtv-bar' },
    el('span', { class: 'dtv-g' }, ctx.plugin.glyph), el('strong', {}, ctx.plugin.name), count,
    el('span', { class: 'dtv-spacer' }), status,
    el('a', { class: 'btn sm ghost', href: src, target: '_blank', rel: 'noopener' }, '↗ ' + t('dtvOpen')));
  container.append(el('div', { class: 'dtv-wrap' }, bar, frame));
  if (!ctx.canEdit) status.textContent = t('dtvReader');

  const byRec = new Map();      // id del resultado (el de la app) → id del documento (el que da el mundo)
  const setCount = () => { const n = byRec.size; count.textContent = n ? `· ${n} ${t(n === 1 ? 'dtvCount1' : 'dtvCountN')}` : ''; };
  const post = (type, payload) => { try { frame.contentWindow?.postMessage({ ns: NS, v: V, type, ...payload }, location.origin); } catch { /* el marco ya no está */ } };

  // ok:false si no se pudo leer: la app NO debe tomar una lista vacía por «todo borrado».
  // ids lleva también lo que quien mira no puede ver, para que tampoco lo tome por borrado.
  async function worldRecords() {
    let docs;
    try { docs = (await api.list()).docs || []; } catch (e) { status.textContent = t('dtvNoWorld'); return { ok: false, records: [], ids: [] }; }
    byRec.clear();
    const records = [], ids = [];
    for (const d of docs) {
      if (!d || !d.record || !d.record.id) continue;
      const rid = d.recordId || d.record.id;
      byRec.set(rid, d.id); ids.push(rid);
      if (ctx.visible(d)) records.push({ ...d.record, savedAt: d.savedAt || d.record.savedAt || 0 });
    }
    setCount();
    return { ok: true, records, ids };
  }

  // Guardar: la app avisa en cada cambio (hasta en cada tirada de regateo); aquí se agrupa.
  const queue = new Map();
  const tomb = new Set();       // borrados mientras su primer guardado iba en camino
  let timer = null, busy = false, again = false;
  const schedule = (ms = 700) => { clearTimeout(timer); timer = setTimeout(flush, ms); };
  async function flush() {
    clearTimeout(timer);
    if (!ctx.canEdit) { queue.clear(); return; }
    if (busy) { again = true; return; }
    busy = true;
    let wrote = false;
    for (const [rid, item] of [...queue]) {
      queue.delete(rid);
      const r = item.record;
      const body = { title: item.title || r.name || rid, summary: item.summary || '', tab: r.tab, recordId: rid, savedAt: r.savedAt || Date.now(), record: r };
      const docId = byRec.get(rid);
      if (!wrote) { status.textContent = t('dtvSaving'); wrote = true; }
      try {
        const res = docId ? await api.put(docId, body) : await api.post({ ...body, id: rid });
        byRec.set(rid, res.doc.id);
        if (tomb.has(rid)) { tomb.delete(rid); await remove(rid); continue; }   // lo borraron mientras se guardaba
        post('saved', { id: rid });
      } catch (e) {
        // Borrado desde otra pestaña: se vuelve a crear en la siguiente vuelta.
        if (docId && e.status === 404) { byRec.delete(rid); queue.set(rid, item); again = true; }
        else { status.textContent = '⚠ ' + e.message; post('error', { message: e.message }); }
      }
    }
    setCount();
    if (wrote && !status.textContent.startsWith('⚠')) status.textContent = `${t('dtvSaved')} · ${new Date().toLocaleTimeString(ctx.lang === 'en' ? 'en' : 'es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    busy = false;
    if (again || queue.size) { again = false; schedule(300); }
  }
  async function remove(rid) {
    queue.delete(rid);
    if (!ctx.canEdit) return;
    const docId = byRec.get(rid);
    // Sin documento todavía: o nunca se guardó, o su primer guardado va en camino (flush lo borra al terminar).
    if (!docId) { if (busy) tomb.add(rid); return; }
    try { await api.del(docId); } catch (e) { if (e.status !== 404) { status.textContent = '⚠ ' + e.message; return; } }
    byRec.delete(rid); setCount();
  }

  async function toArticle(m) {
    const a = m.article || {};
    if (!ctx.canEdit || !a.title || !a.block) return { slug: null };
    const addBlock = async (slug) => {
      const full = await ctx.api.get(`articles/${slug}`).then((r) => r.article);
      await ctx.api.put(`articles/${slug}`, { ...full, body: withBlock(full.body || '', a.block) });
      return slug;
    };
    // Ya enlazado: se actualiza el mercado y nada más.
    if (m.link && ctx.article?.(m.link)) { await addBlock(m.link); ctx.toast(t('dtvArticleUpdated')); return { slug: m.link }; }
    // Un artículo con ese nombre casi siempre es esta misma ciudad escrita a mano: se pregunta.
    const clash = ctx.article?.(slugify(a.title));
    if (clash) {
      if (!await ctx.confirm(t('dtvClash').replace('{t}', clash.title), { danger: false })) return { slug: null };
      return { slug: await addBlock(clash.slug), open: true };
    }
    const sections = ctx.templateOf?.(a.template || 'settlement')?.sections || [];
    const r = await ctx.api.post('articles', { slug: slugify(a.title), title: a.title, template: a.template || 'settlement',
      fields: a.fields || {}, subtitle: a.subtitle || '', summary: a.summary || '', body: sectionsBody(sections, a.block) });
    return { slug: r.article?.slug || slugify(a.title), open: true };
  }

  const onMessage = async (e) => {
    if (e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const m = e.data;
    if (!m || m.ns !== NS || m.v !== V) return;
    try {
      if (m.type === 'ready') {
        const w = await worldRecords();
        const canScreen = ctx.canEdit && typeof ctx.toScreen === 'function';
        post('init', { world: { id: ctx.world.id, name: ctx.world.name }, lang: ctx.lang, canEdit: ctx.canEdit,
          caps: { toScreen: canScreen, toArticle: !!ctx.canEdit }, ok: w.ok, records: w.records, ids: w.ids });
      } else if (m.type === 'upsert' && m.record && m.record.id) {
        if (!ctx.canEdit) return;
        tomb.delete(m.record.id);
        queue.set(m.record.id, { record: m.record, title: m.title, summary: m.summary });
        schedule();
      } else if (m.type === 'remove' && m.id) {
        await remove(m.id);
      } else if (m.type === 'toScreen' && m.card) {
        const c = m.card;
        await ctx.toScreen({ kind: 'snap', label: String(c.label || ctx.plugin.name), w: c.w || 420, h: c.h || 520, md: String(c.md || ''), source: ctx.plugin.name });
      } else if (m.type === 'toArticle') {
        let res = { slug: null };
        try { res = await toArticle(m); } catch (err) { ctx.toast(err.message, true); }
        post('articleDone', { requestId: m.requestId, recordId: m.recordId, slug: res.slug });
        if (res.slug && res.open && await ctx.confirm(t('dtvArticleOpen'), { danger: false })) ctx.navigate(ctx.href.article(res.slug));
      }
    } catch (err) { ctx.toast(err.message, true); }
  };
  addEventListener('message', onMessage);
  frame.src = src;

  return { unmount() { removeEventListener('message', onMessage); flush(); container.innerHTML = ''; } };
}
