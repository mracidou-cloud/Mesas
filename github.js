// Guarda y lee archivos del repositorio de GitHub (API de contenidos).
// Se activa solo si existen las variables de entorno GITHUB_TOKEN y GITHUB_REPO.
//   GITHUB_TOKEN  = token con permiso "Contents: Read and write" sobre el repositorio
//   GITHUB_REPO   = usuario/repositorio, ej. mracidou-cloud/Mesas
//   GITHUB_BRANCH = rama (opcional, por defecto "main")
// Los commits llevan "[skip render]" para que Render NO se reinicie al guardar.

const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = (process.env.GITHUB_REPO || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const activo = !!(TOKEN && REPO);
const API = process.env.GITHUB_API || 'https://api.github.com';
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

// Sube (crea o reemplaza) un archivo
async function subir(ruta, texto, mensaje) {
  if (!activo) return false;
  for (let intento = 0; intento < 2; intento++) {
    if (!shas[ruta] || intento > 0) { try { await bajar(ruta); } catch {} }
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

// Cola: un archivo a la vez, y agrupa cambios seguidos (para las llegadas)
const pendientes = {};
function subirLuego(ruta, obtenerTexto, mensaje, esperaMs = 8000) {
  if (!activo) return;
  clearTimeout(pendientes[ruta]);
  pendientes[ruta] = setTimeout(() => {
    subir(ruta, obtenerTexto(), mensaje).catch(e => console.warn('⚠  ' + e.message));
  }, esperaMs);
}

module.exports = { activo, REPO, BRANCH, bajar, subir, subirLuego };
