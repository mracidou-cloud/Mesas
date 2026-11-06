// Seating chart con QR — servidor
// Pantalla:  http://<servidor>:3000/pantalla
// Celular:   http://<servidor>:3000/m   (a donde apunta el QR)
// Admin:     http://<servidor>:3000/admin

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const gh = require('./github');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const CONFIG_FILE = path.join(ROOT, 'config.json');
const GUESTS_FILE = path.join(ROOT, 'invitados.csv');
let config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
let ASIENTOS = Number(config.asientosPorMesa) || 10;
const STATE_FILE = path.join(ROOT, 'data', 'llegadas.json');

// ---------- utilidades ----------
const normalizar = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = s => normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parseLinea(linea, d) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (q) {
      if (c === '"') { if (linea[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// ---------- invitados ----------
function cargarInvitados(txt = fs.readFileSync(GUESTS_FILE, 'utf8'), avisos = []) {
  txt = txt.replace(/^\uFEFF/, '');
  const lineas = txt.split(/\r?\n/).filter(l => l.trim());
  if (!lineas.length) throw new Error('The guest list is empty');
  // Excel en español suele guardar con ";"
  const d = (lineas[0].split(';').length > lineas[0].split(',').length) ? ';' : ',';
  const cab = parseLinea(lineas[0], d).map(slug);
  let iNom = cab.findIndex(h => /nombre|name|invitado/.test(h));
  let iMesa = cab.findIndex(h => /mesa|table/.test(h));
  let inicio = 1;
  if (iNom < 0 && iMesa < 0) { iNom = 0; iMesa = 1; inicio = 0; } // sin encabezado
  if (iNom < 0) iNom = 0;
  if (iMesa < 0) iMesa = 1;

  const lista = [], ids = new Set(), porMesa = {};
  for (let k = inicio; k < lineas.length; k++) {
    const cols = parseLinea(lineas[k], d);
    const nombre = (cols[iNom] || '').replace(/\s+/g, ' ').trim();
    const mesa = parseInt(cols[iMesa], 10);
    if (!nombre) continue;
    if (!Number.isInteger(mesa) || mesa < 1) { avisos.push(`Line ${k + 1}: "${nombre}" has no valid table — skipped.`); continue; }
    let id = slug(nombre) || 'invitado', n = 2;
    while (ids.has(id)) id = `${slug(nombre)}-${n++}`;
    ids.add(id);
    lista.push({ id, nombre, mesa });
    porMesa[mesa] = (porMesa[mesa] || 0) + 1;
  }
  for (const [m, c] of Object.entries(porMesa)) {
    if (c > ASIENTOS) avisos.push(`Table ${m} has ${c} guests but only ${ASIENTOS} seats.`);
    if (Number(m) > (Number(config.mesas) || 0)) avisos.push(`There are guests at table ${m}, but the event only has ${config.mesas} tables.`);
  }
  avisos.forEach(a => console.warn('⚠  ' + a));
  return lista;
}

let invitados = [], porId = new Map(), NUM_MESAS = 0;
function aplicarInvitados(lista) {
  invitados = lista;
  porId = new Map(invitados.map(g => [g.id, g]));
  NUM_MESAS = Math.max(Number(config.mesas) || 1, ...invitados.map(g => g.mesa));
}
aplicarInvitados(cargarInvitados());

// ---------- estado (quién llegó) ----------
let llegadas = {};
try { llegadas = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { llegadas = {}; }
function limpiarLlegadas() {
  for (const id of Object.keys(llegadas)) {
    const g = porId.get(id);
    if (!g || llegadas[id].asiento >= ASIENTOS || (llegadas[id].mesa && llegadas[id].mesa !== g.mesa)) delete llegadas[id];
  }
}
limpiarLlegadas();

function guardar() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(llegadas, null, 1));
  fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
  gh.subirLuego('data/llegadas.json', () => JSON.stringify(llegadas, null, 1), 'Update check-ins');
}
// sube un archivo a GitHub y devuelve un texto de estado para la página de admin
async function aGitHub(ruta, texto, mensaje) {
  if (!gh.activo) return 'off';
  try { await gh.subir(ruta, texto, mensaje); return 'saved'; }
  catch (e) { console.warn('⚠  ' + e.message); return 'error: ' + e.message; }
}

// ---------- mural de deseos (un archivo por invitado) ----------
const DIR_MSG = path.join(ROOT, 'data', 'mensajes');
fs.mkdirSync(DIR_MSG, { recursive: true });
let mensajes = {};
for (const f of fs.readdirSync(DIR_MSG)) {
  if (!f.endsWith('.json')) continue;
  try { const m = JSON.parse(fs.readFileSync(path.join(DIR_MSG, f), 'utf8')); mensajes[f.slice(0, -5)] = m; } catch {}
}
// ---------- diseños de la pantalla (cada uno es un archivo independiente en public/disenos/) ----------
const DISENOS = [
  { id: 'elegant', nombre: 'Elegant', descripcion: 'Purple & gold, tilted QR in a diamond frame', mural: true, editable: true, fondo: '/fondo.jpg' },
  { id: 'clay', nombre: 'Soft clay', descripcion: 'Pastel, rounded and playful', mural: true, editable: true, fondo: 'linear-gradient(160deg,#f9f2e8,#f3e8da)' },
  { id: 'ring', nombre: 'Navy ring', descripcion: 'Navy & gold, tables in a ring around the QR, dancing couple', mural: false },
  { id: 'classic', nombre: 'Classic', descripcion: 'Navy & gold, table grid, side panel with QR, counter and recent arrivals', mural: false },
];
const disenoActual = () => DISENOS.find(d => d.id === config.tema) || DISENOS[0];
// el mural solo funciona si está encendido Y el diseño elegido lo muestra
const mensajesActivos = () => config.mensajes !== false && disenoActual().mural;
function mensajePublico(id) {
  const g = porId.get(id), m = mensajes[id];
  if (!g || !m || !llegadas[id]) return null;
  return { id, nombre: g.nombre, mesa: g.mesa, asiento: llegadas[id].asiento, img: m.img, hora: m.hora };
}
function borrarMensaje(id) {
  if (!mensajes[id]) return;
  delete mensajes[id];
  try { fs.unlinkSync(path.join(DIR_MSG, id + '.json')); } catch {}
  gh.borrar(`data/mensajes/${id}.json`, 'Delete wish').catch(e => console.warn('⚠  ' + e.message));
  io.emit('mensaje-borrado', { id });
}

function asientoLibre(mesa) {
  const ocupados = new Set(
    invitados.filter(g => g.mesa === mesa && llegadas[g.id]).map(g => llegadas[g.id].asiento)
  );
  for (let i = 0; i < ASIENTOS; i++) if (!ocupados.has(i)) return i;
  return -1; // mesa llena (sobrecupo)
}

const nombreMesa = m => (config.nombresMesas && config.nombresMesas[m]) || '';
const publico = g => ({
  id: g.id, nombre: g.nombre, mesa: g.mesa, nombreMesa: nombreMesa(g.mesa),
  asiento: llegadas[g.id] ? llegadas[g.id].asiento : null,
  hora: llegadas[g.id] ? llegadas[g.id].hora : null,
});

// ---------- URL pública para el QR ----------
function ipLocal() {
  for (const ifs of Object.values(os.networkInterfaces()))
    for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  return 'localhost';
}
const URL_BASE = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://${ipLocal()}:${PORT}`).replace(/\/$/, '');
const URL_MOVIL = `${URL_BASE}/m`;

// ---------- app ----------
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json({ limit: '600kb' }));
app.use(express.static(path.join(ROOT, 'public'), { index: false }));

app.get('/', (_, res) => res.redirect('/pantalla'));
app.get('/pantalla', (_, res) => res.sendFile(path.join(ROOT, 'public', 'disenos', disenoActual().id + '.html')));
app.get('/pantalla/:diseno', (req, res) => DISENOS.some(d => d.id === req.params.diseno)
  ? res.sendFile(path.join(ROOT, 'public', 'disenos', req.params.diseno + '.html')) : res.redirect('/pantalla'));
app.get('/m', (_, res) => res.sendFile(path.join(ROOT, 'public', 'movil.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(ROOT, 'public', 'admin.html')));

let qrCache = null;
app.get('/api/config', async (_, res) => {
  if (!qrCache) qrCache = await QRCode.toDataURL(URL_MOVIL, {
    margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark: '#141a2b', light: '#fbf7ee' },
  });
  res.json({
    evento: config.evento, subtitulo: config.subtitulo, video: config.video || '', decoracion: config.decoracion !== false, videoFondo: config.videoFondo || '', opacidadFondo: config.opacidadFondo ?? 40, imagenFondo: config.imagenFondo || 'fondo.jpg', mensajes: mensajesActivos(), tema: disenoActual().id, posiciones: config.posiciones || {},
    mesas: NUM_MESAS, asientos: ASIENTOS, nombresMesas: config.nombresMesas || {},
    total: invitados.length, urlMovil: URL_MOVIL, qr: qrCache,
  });
});

app.get('/api/estado', (_, res) => res.json(invitados.filter(g => llegadas[g.id]).map(publico)));
app.get('/api/invitados', (_, res) => res.json(invitados.map(g => ({ id: g.id, nombre: g.nombre }))));

app.post('/api/llegada', (req, res) => {
  const g = porId.get(req.body && req.body.id);
  if (!g) return res.status(404).json({ error: 'We couldn’t find that name.' });
  const ya = !!llegadas[g.id];
  if (!ya) {
    llegadas[g.id] = { asiento: asientoLibre(g.mesa), hora: Date.now(), mesa: g.mesa };
    guardar();
    io.emit('llegada', publico(g));
    console.log(`✓ ${g.nombre} → table ${g.mesa}`);
  }
  res.json({ ...publico(g), ya });
});

// ---- mural de deseos ----
app.get('/api/mensajes', (_, res) => {
  if (!mensajesActivos()) return res.json([]);
  res.json(Object.keys(mensajes).map(mensajePublico).filter(Boolean).sort((a, b) => a.hora - b.hora));
});
app.post('/api/mensaje', (req, res) => {
  if (!mensajesActivos()) return res.status(403).json({ error: 'The wishes wall is turned off.' });
  const id = req.body && req.body.id, img = String((req.body && req.body.img) || '');
  if (!porId.has(id)) return res.status(404).json({ error: 'We couldn’t find that name.' });
  if (!llegadas[id]) return res.status(400).json({ error: 'Please check in first.' });
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 450000) return res.status(400).json({ error: 'Invalid drawing.' });
  mensajes[id] = { img, hora: Date.now() };
  const txt = JSON.stringify(mensajes[id]);
  fs.writeFileSync(path.join(DIR_MSG, id + '.json'), txt);
  gh.subir(`data/mensajes/${id}.json`, txt, 'New wish').catch(e => console.warn('⚠  ' + e.message));
  io.emit('mensaje', mensajePublico(id));
  console.log(`✎ wish from ${porId.get(id).nombre}`);
  res.json({ ok: true });
});

// ---- admin ----
const autorizado = req => req.body && req.body.clave === config.claveAdmin;
app.post('/api/admin/lista', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  res.json({
    invitados: invitados.map(publico),
    config: { evento: config.evento, subtitulo: config.subtitulo, video: config.video || '', decoracion: config.decoracion !== false, videoFondo: config.videoFondo || '', opacidadFondo: config.opacidadFondo ?? 40, imagenFondo: config.imagenFondo || 'fondo.jpg', tema: disenoActual().id, mesas: Number(config.mesas), asientosPorMesa: ASIENTOS, nombresMesas: config.nombresMesas || {} },
    csv: fs.readFileSync(GUESTS_FILE, 'utf8').replace(/^\uFEFF/, ''),
    github: { activo: gh.activo, repo: gh.REPO },
    disenos: DISENOS, posiciones: config.posiciones || {},
  });
});

// Guardar configuración del evento
app.post('/api/admin/config', async (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  const c = req.body.config || {};
  const mesas = parseInt(c.mesas, 10), asientos = parseInt(c.asientosPorMesa, 10);
  if (!(mesas >= 1 && mesas <= 40)) return res.status(400).json({ error: 'Tables must be between 1 and 40.' });
  if (!(asientos >= 1 && asientos <= 20)) return res.status(400).json({ error: 'Seats per table must be between 1 and 20.' });
  const nombres = {};
  for (const [k, v] of Object.entries(c.nombresMesas || {})) {
    const n = parseInt(k, 10);
    if (n >= 1 && n <= mesas && String(v).trim()) nombres[n] = String(v).trim().slice(0, 40);
  }
  config = {
    ...config,
    evento: String(c.evento || '').trim().slice(0, 80) || 'Our Event',
    subtitulo: String(c.subtitulo || '').trim().slice(0, 120),
    video: String(c.video || '').trim().slice(0, 500),
    decoracion: c.decoracion !== false,
    videoFondo: String(c.videoFondo || '').trim().slice(0, 500),
    imagenFondo: String(c.imagenFondo || '').trim().slice(0, 500) || 'fondo.jpg',
    tema: DISENOS.some(d => d.id === c.tema) ? c.tema : 'elegant',
    opacidadFondo: Math.max(0, Math.min(100, parseInt(c.opacidadFondo, 10) || 0)),
    mesas, asientosPorMesa: asientos, nombresMesas: nombres,
  };
  if (c.claveAdmin && String(c.claveAdmin).trim()) config.claveAdmin = String(c.claveAdmin).trim();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  ASIENTOS = asientos;
  const avisos = [];
  aplicarInvitados(cargarInvitados(undefined, avisos));
  limpiarLlegadas(); guardar(); io.emit('reinicio');
  const github = await aGitHub('config.json', JSON.stringify(config, null, 2), 'Update event settings');
  res.json({ ok: true, avisos, github });
});

// Reemplazar la lista de invitados (texto CSV: nombre,mesa)
app.post('/api/admin/invitados', async (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  const avisos = [];
  let lista;
  try { lista = cargarInvitados(String(req.body.csv || ''), avisos); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!lista.length) return res.status(400).json({ error: 'No valid guests were found.' });
  fs.writeFileSync(GUESTS_FILE, String(req.body.csv));
  aplicarInvitados(lista);
  limpiarLlegadas(); guardar(); io.emit('reinicio');
  const github = await aGitHub('invitados.csv', String(req.body.csv), 'Update guest list');
  res.json({ ok: true, total: lista.length, avisos, github });
});

// Guardar dónde va cada mesa y el QR en un diseño (editor de distribución)
app.post('/api/admin/posiciones', async (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  const d = DISENOS.find(x => x.id === req.body.diseno && x.editable);
  if (!d) return res.status(400).json({ error: 'This design can’t be edited.' });
  const lim = (v, a, b) => Math.round(Math.max(a, Math.min(b, Number(v))));
  config.posiciones = config.posiciones || {};
  const p = req.body.posiciones;
  if (!p) delete config.posiciones[d.id];              // volver a la distribución automática
  else {
    const mesas = {};
    for (const [k, v] of Object.entries(p.mesas || {})) {
      const n = parseInt(k, 10);
      if (n >= 1 && n <= 60 && v && isFinite(v.x) && isFinite(v.y)) mesas[n] = { x: lim(v.x, 40, 1880), y: lim(v.y, 40, 1040) };
    }
    const qr = p.qr && isFinite(p.qr.x) && isFinite(p.qr.y) ? { x: lim(p.qr.x, 150, 1770), y: lim(p.qr.y, 150, 930) } : undefined;
    config.posiciones[d.id] = { mesas, ...(qr ? { qr } : {}) };
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  io.emit('reinicio');
  const github = await aGitHub('config.json', JSON.stringify(config, null, 2), 'Update layout of ' + d.nombre);
  res.json({ ok: true, github });
});

// Descargar config.json (para subirlo a GitHub y que no se pierda)
app.post('/api/admin/config.json', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  res.json(config);
});
app.post('/api/admin/quitar', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  delete llegadas[req.body.id]; borrarMensaje(req.body.id); guardar(); io.emit('reinicio');
  res.json({ ok: true });
});
app.post('/api/admin/mensajes', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  res.json({ activo: config.mensajes !== false, disenoMural: disenoActual().mural, disenoNombre: disenoActual().nombre, lista: Object.keys(mensajes).map(mensajePublico).filter(Boolean).sort((a, b) => b.hora - a.hora) });
});
app.post('/api/admin/mensajes-activar', async (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  config.mensajes = !!req.body.activo;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  io.emit('reinicio');
  const github = await aGitHub('config.json', JSON.stringify(config, null, 2), 'Turn wishes wall ' + (config.mensajes ? 'on' : 'off'));
  res.json({ ok: true, activo: config.mensajes !== false, github });
});
app.post('/api/admin/mensaje-borrar', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  if (req.body.todos) Object.keys(mensajes).forEach(borrarMensaje); else borrarMensaje(req.body.id);
  res.json({ ok: true });
});
app.post('/api/admin/reiniciar', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Wrong password' });
  llegadas = {}; Object.keys(mensajes).forEach(borrarMensaje); guardar(); io.emit('reinicio');
  res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log(`\n  ${config.evento} — ${invitados.length} guests at ${NUM_MESAS} tables\n`);
  console.log(`  Event screen:   http://localhost:${PORT}/pantalla`);
  console.log(`  Phones (QR):    ${URL_MOVIL}`);
  console.log(`  Admin:          http://localhost:${PORT}/admin\n`);
});
