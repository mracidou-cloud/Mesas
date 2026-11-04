// Geometría compartida del plano de mesas (pantalla y celular)
function calcularPlano(nMesas, asientos) {
  const filas = nMesas <= 5 ? 1 : nMesas <= 12 ? 2 : Math.ceil(nMesas / 6);
  const cols = Math.ceil(nMesas / filas);
  const celW = 210, celH = 230, R = 50, rAsientos = 79;
  const rSilla = Math.min(14, Math.PI * rAsientos / Math.max(asientos, 1) * 0.82);
  const mesas = [];
  for (let t = 0; t < nMesas; t++) {
    const fila = Math.floor(t / cols), col = t % cols;
    const enFila = fila === filas - 1 ? nMesas - cols * (filas - 1) : cols;
    const desfase = (cols - enFila) * celW / 2;
    const cx = desfase + col * celW + celW / 2, cy = fila * celH + celH / 2;
    const sillas = [];
    for (let s = 0; s < asientos; s++) {
      const a = -Math.PI / 2 + s * 2 * Math.PI / asientos;
      sillas.push({ x: cx + rAsientos * Math.cos(a), y: cy + rAsientos * Math.sin(a) });
    }
    mesas.push({ numero: t + 1, cx, cy, sillas });
  }
  return { W: cols * celW, H: filas * celH, R, rSilla, mesas };
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iniciales = n => String(n).trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
const normalizar = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
