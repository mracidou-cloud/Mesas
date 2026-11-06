// Guarda y lee archivos del repositorio de GitHub (API de contenidos).
// Se activa solo si existen las variables de entorno GITHUB_TOKEN y GITHUB_REPO.
//   GITHUB_TOKEN  = token con permiso "Contents: Read and write" sobre el repositorio
//   GITHUB_REPO   = usuario/repositorio, ej. mracidou-cloud/Mesas
//   GITHUB_BRANCH = rama (opcional, por defecto "main")
// Los commits llevan "[skip render]" para que Render NO se reinicie al guardar.

const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = (process.env.GITHUB_REPO || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const API = process.env.GITHUB_API || 'https://api.github.com';
const activo = !!(TOKEN && REPO);
const shas = {};

async function api(metodo, ruta, cuerpo) {
  const r = await fetch(`${API}/repos/${REPO}/contents/${encodeURI(ruta)}` + (metodo === 'GET' ? `?ref=${BRANCH}` : ''), {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'mesas-qr', 'X-GitHub-Api-Version': '2022-11-28' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

// Lee un archivo; devuelve el texto o null si no existe
async function bajar(ruta) {
  if (!activo) return null;
  const { ok, status, d } = await api('GET', ruta);
  if (status === 404) return null;
  if (!ok) throw new Error(`GitHub ${status}: ${d.message || 'error'}`);
  shas[ruta] = d.sha;
  return Buffer.from(d.content || '', 'base64').toString('utf8');
}

// Lista los archivos de una carpeta (o [] si no existe)
async function listar(carpeta) {
  if (!activo) return [];
  const { ok, status, d } = await api('GET', carpeta);
  if (status === 404) return [];
  if (!ok) throw new Error(`GitHub ${status}: ${d.message || 'error'}`);
  return Array.isArray(d) ? d.filter(x => x.type === 'file').map(x => { shas[x.path] = x.sha; return x.path; }) : [];
}

// Todas las escrituras van en fila (una a la vez) para no chocar en la misma rama
let fila = Promise.resolve();
const enFila = fn => (fila = fila.then(fn, fn));

async function _subir(ruta, texto, mensaje) {
  for (let intento = 0; intento < 3; intento++) {
    if (intento > 0) { try { await bajar(ruta); } catch {} }
    const { ok, status, d } = await api('PUT', ruta, {
      message: `[skip render] ${mensaje}`,
      content: Buffer.from(texto, 'utf8').toString('base64'),
      branch: BRANCH,
      ...(shas[ruta] ? { sha: shas[ruta] } : {}),
    });
    if (ok) { shas[ruta] = d.content && d.content.sha; return true; }
    if (status !== 409 && status !== 422) throw new Error(`GitHub ${status}: ${d.message || 'error'}`);
  }
  throw new Error('GitHub: could not save (conflict)');
}
async function _borrar(ruta, mensaje) {
  for (let intento = 0; intento < 3; intento++) {
    if (!shas[ruta] || intento > 0) { try { if ((await bajar(ruta)) === null) return true; } catch {} }
    const { ok, status, d } = await api('DELETE', ruta, { message: `[skip render] ${mensaje}`, sha: shas[ruta], branch: BRANCH });
    if (ok || status === 404) { delete shas[ruta]; return true; }
    if (status !== 409 && status !== 422) throw new Error(`GitHub ${status}: ${d.message || 'error'}`);
  }
  throw new Error('GitHub: could not delete (conflict)');
}

// Sube (crea o reemplaza) un archivo
function subir(ruta, texto, mensaje) { return activo ? enFila(() => _subir(ruta, texto, mensaje)) : Promise.resolve(false); }
// Borra un archivo
function borrar(ruta, mensaje) { return activo ? enFila(() => _borrar(ruta, mensaje)) : Promise.resolve(false); }

// Agrupa cambios seguidos del mismo archivo (para las llegadas)
const pendientes = {};
function subirLuego(ruta, obtenerTexto, mensaje, esperaMs = 8000) {
  if (!activo) return;
  clearTimeout(pendientes[ruta]);
  pendientes[ruta] = setTimeout(() => {
    subir(ruta, obtenerTexto(), mensaje).catch(e => console.warn('⚠  ' + e.message));
  }, esperaMs);
}

module.exports = { activo, REPO, BRANCH, bajar, listar, subir, borrar, subirLuego };
