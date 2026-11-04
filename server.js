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
  if (!lineas.length) throw new Error('La lista de invitados está vacía');
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
    if (!Number.isInteger(mesa) || mesa < 1) { avisos.push(`Línea ${k + 1}: "${nombre}" no tiene una mesa válida — se omitió.`); continue; }
    let id = slug(nombre) || 'invitado', n = 2;
    while (ids.has(id)) id = `${slug(nombre)}-${n++}`;
    ids.add(id);
    lista.push({ id, nombre, mesa });
    porMesa[mesa] = (porMesa[mesa] || 0) + 1;
  }
  for (const [m, c] of Object.entries(porMesa)) {
    if (c > ASIENTOS) avisos.push(`La mesa ${m} tiene ${c} invitados pero solo ${ASIENTOS} asientos.`);
    if (Number(m) > (Number(config.mesas) || 0)) avisos.push(`Hay invitados en la mesa ${m}, pero el evento tiene ${config.mesas} mesas.`);
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
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public'), { index: false }));

app.get('/', (_, res) => res.redirect('/pantalla'));
app.get('/pantalla', (_, res) => res.sendFile(path.join(ROOT, 'public', 'pantalla.html')));
app.get('/m', (_, res) => res.sendFile(path.join(ROOT, 'public', 'movil.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(ROOT, 'public', 'admin.html')));

let qrCache = null;
app.get('/api/config', async (_, res) => {
  if (!qrCache) qrCache = await QRCode.toDataURL(URL_MOVIL, {
    margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark: '#141a2b', light: '#fbf7ee' },
  });
  res.json({
    evento: config.evento, subtitulo: config.subtitulo,
    mesas: NUM_MESAS, asientos: ASIENTOS, nombresMesas: config.nombresMesas || {},
    total: invitados.length, urlMovil: URL_MOVIL, qr: qrCache,
  });
});

app.get('/api/estado', (_, res) => res.json(invitados.filter(g => llegadas[g.id]).map(publico)));
app.get('/api/invitados', (_, res) => res.json(invitados.map(g => ({ id: g.id, nombre: g.nombre }))));

app.post('/api/llegada', (req, res) => {
  const g = porId.get(req.body && req.body.id);
  if (!g) return res.status(404).json({ error: 'No encontramos ese nombre.' });
  const ya = !!llegadas[g.id];
  if (!ya) {
    llegadas[g.id] = { asiento: asientoLibre(g.mesa), hora: Date.now(), mesa: g.mesa };
    guardar();
    io.emit('llegada', publico(g));
    console.log(`✓ ${g.nombre} → mesa ${g.mesa}`);
  }
  res.json({ ...publico(g), ya });
});

// ---- admin ----
const autorizado = req => req.body && req.body.clave === config.claveAdmin;
app.post('/api/admin/lista', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Clave incorrecta' });
  res.json({
    invitados: invitados.map(publico),
    config: { evento: config.evento, subtitulo: config.subtitulo, mesas: Number(config.mesas), asientosPorMesa: ASIENTOS, nombresMesas: config.nombresMesas || {} },
    csv: fs.readFileSync(GUESTS_FILE, 'utf8').replace(/^\uFEFF/, ''),
  });
});

// Guardar configuración del evento
app.post('/api/admin/config', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Clave incorrecta' });
  const c = req.body.config || {};
  const mesas = parseInt(c.mesas, 10), asientos = parseInt(c.asientosPorMesa, 10);
  if (!(mesas >= 1 && mesas <= 40)) return res.status(400).json({ error: 'Las mesas deben ser entre 1 y 40.' });
  if (!(asientos >= 1 && asientos <= 20)) return res.status(400).json({ error: 'Los asientos por mesa deben ser entre 1 y 20.' });
  const nombres = {};
  for (const [k, v] of Object.entries(c.nombresMesas || {})) {
    const n = parseInt(k, 10);
    if (n >= 1 && n <= mesas && String(v).trim()) nombres[n] = String(v).trim().slice(0, 40);
  }
  config = {
    ...config,
    evento: String(c.evento || '').trim().slice(0, 80) || 'Nuestro Evento',
    subtitulo: String(c.subtitulo || '').trim().slice(0, 120),
    mesas, asientosPorMesa: asientos, nombresMesas: nombres,
  };
  if (c.claveAdmin && String(c.claveAdmin).trim()) config.claveAdmin = String(c.claveAdmin).trim();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  ASIENTOS = asientos;
  const avisos = [];
  aplicarInvitados(cargarInvitados(undefined, avisos));
  limpiarLlegadas(); guardar(); io.emit('reinicio');
  res.json({ ok: true, avisos });
});

// Reemplazar la lista de invitados (texto CSV: nombre,mesa)
app.post('/api/admin/invitados', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Clave incorrecta' });
  const avisos = [];
  let lista;
  try { lista = cargarInvitados(String(req.body.csv || ''), avisos); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!lista.length) return res.status(400).json({ error: 'No se encontró ningún invitado válido.' });
  fs.writeFileSync(GUESTS_FILE, String(req.body.csv));
  aplicarInvitados(lista);
  limpiarLlegadas(); guardar(); io.emit('reinicio');
  res.json({ ok: true, total: lista.length, avisos });
});
app.post('/api/admin/quitar', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Clave incorrecta' });
  delete llegadas[req.body.id]; guardar(); io.emit('reinicio');
  res.json({ ok: true });
});
app.post('/api/admin/reiniciar', (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'Clave incorrecta' });
  llegadas = {}; guardar(); io.emit('reinicio');
  res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log(`\n  ${config.evento} — ${invitados.length} invitados en ${NUM_MESAS} mesas\n`);
  console.log(`  Pantalla del evento:  http://localhost:${PORT}/pantalla`);
  console.log(`  Celulares (QR):       ${URL_MOVIL}`);
  console.log(`  Administración:       http://localhost:${PORT}/admin\n`);
});
