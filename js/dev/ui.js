// Small helpers shared by the dev pages: formatting, nested paths, inputs,
// and remembering which expandable sections are open.

export const esc = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export const fmt = (n, d = 2) => Number(n).toFixed(d);
export const num = (n) => (Math.abs(n) >= 100 ? fmt(n, 0) : String(Number(Number(n).toPrecision(3))));

// ---------- nested paths ("actions.0.dot.base") ----------
const parts = (path) => String(path).split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p));
export function getP(obj, path) {
  let o = obj;
  for (const p of parts(path)) { if (o == null) return undefined; o = o[p]; }
  return o;
}
export function setP(obj, path, v) {
  const ps = parts(path);
  let o = obj;
  for (const p of ps.slice(0, -1)) o = (o[p] ??= {});
  o[ps.at(-1)] = v;
}
// Delete, and drop parent objects left empty (e.g. base, dot).
export function delP(obj, path, keep = 0) {
  const ps = parts(path);
  const chain = [obj];
  for (const p of ps.slice(0, -1)) { const n = chain.at(-1)?.[p]; if (n == null) return; chain.push(n); }
  delete chain.at(-1)[ps.at(-1)];
  for (let i = chain.length - 1; i > keep; i--) {
    const o = chain[i];
    if (!Array.isArray(o) && !Object.keys(o).length) delete chain[i - 1][ps[i - 1]];
  }
}
export function move(list, j, d) {
  const k = j + d;
  if (k < 0 || k >= list.length) return;
  [list[j], list[k]] = [list[k], list[j]];
}
export function nextId(list, prefix, width) {
  let n = 1;
  const ids = new Set(list.map((x) => x.id));
  while (ids.has(`${prefix}${String(n).padStart(width, '0')}`)) n++;
  return `${prefix}${String(n).padStart(width, '0')}`;
}

// ---------- open/closed state of expandable sections ----------
const OPEN_KEY = 'isfw.dev.open';
export const open = (() => {
  try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY)) || []); } catch { return new Set(); }
})();
export const saveOpen = () => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...open])); } catch {} };
export const od = (key) => (open.has(key) ? ' open' : '');
export function renameOpen(oldPrefix, newPrefix) {
  for (const k of [...open]) {
    if (k === oldPrefix || k.startsWith(`${oldPrefix}:`)) { open.delete(k); open.add(newPrefix + k.slice(oldPrefix.length)); }
  }
  saveOpen();
}

// ---------- inputs ----------
// Every input carries data-i (item index) and data-p (path inside the item);
// data-t says how to read it.
export function numInput(i, path, v, { cls = '', int = false } = {}) {
  return `<input type="number" step="${int ? 1 : 'any'}" class="${cls}" data-i="${i}" data-p="${path}" data-t="${int ? 'int' : 'num'}" value="${esc(v ?? '')}">`;
}
export function textInput(i, path, v, cls = '') {
  return `<input type="text" class="${cls}" data-i="${i}" data-p="${path}" data-t="text" value="${esc(v ?? '')}">`;
}
export function boolInput(i, path, v) {
  return `<input type="checkbox" data-i="${i}" data-p="${path}" data-t="bool" ${v ? 'checked' : ''}>`;
}
export function select(attrs, options, value) {
  return `<select ${attrs}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}
export const btn = (label, act, data = '', cls = '') => `<button class="${cls}" data-act="${act}" ${data}>${label}</button>`;
export const xBtn = (act, data) => `<button class="x" title="remove" data-act="${act}" ${data}>×</button>`;
export const field = (key, title, info, body, cls = 'fld') =>
  `<details class="${cls}" data-key="${esc(key)}"${od(key)}><summary><b>${title}</b> ${info}</summary><div class="body">${body}</div></details>`;

// Reads an input into the item (by data-p / data-t). Returns false if not handled.
export function readInput(item, el) {
  const path = el.dataset.p;
  const t = el.dataset.t;
  if (t === 'bool') setP(item, path, el.checked);
  else if (t === 'num' || t === 'int') {
    const v = t === 'int' ? parseInt(el.value, 10) : parseFloat(el.value);
    setP(item, path, Number.isFinite(v) ? v : 0);
  } else if (t === 'text') setP(item, path, el.value);
  else return false;
  return true;
}

// Two-click confirm for destructive buttons. Returns true on the second click.
export function confirmed(el, label) {
  if (el.classList.contains('armed')) return true;
  const orig = el.textContent;
  el.classList.add('armed');
  el.textContent = label;
  setTimeout(() => { el.classList.remove('armed'); el.textContent = orig; }, 3000);
  return false;
}

// Wire a page root: inputs, selects, buttons and section toggles.
// handlers: { input(el) -> bool rerender?, action(el) }
export function wire(root, { input, action, rerender, status }) {
  root.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.p && el.tagName === 'INPUT' && el.type !== 'checkbox') { input(el); status(); }
  });
  root.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.act) { action(el); return; }
    if (el.dataset.p) { input(el); rerender(); }
  });
  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button[data-act], a[data-act]');
    if (el) { ev.preventDefault(); action(el); }
  });
  root.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (!d.dataset || !d.dataset.key) return;
    if (d.open) open.add(d.dataset.key); else open.delete(d.dataset.key);
    saveOpen();
  }, true);
}
