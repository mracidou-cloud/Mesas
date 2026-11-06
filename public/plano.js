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

// Mesas en anillo (elipse) alrededor de un centro libre para el QR.
// Reparte las mesas a igual distancia a lo largo de la elipse, empezando arriba y en sentido horario.
function calcularAnillo(nMesas, asientos) {
  const rAsientos = 79, R = 50, PASO = 220, RAZON = 2.15;
  const rSilla = Math.min(14, Math.PI * rAsientos / Math.max(asientos, 1) * 0.82);
  const perim = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  let ry = 335;
  while (perim(ry * RAZON, ry) < nMesas * PASO) ry += 10;
  const rx = ry * RAZON, m = 100, cx = rx + m, cy = ry + m;
  // muestreo para repartir por longitud de arco
  const N = 4000, pts = [{ t: -Math.PI / 2, l: 0 }];
  let px = cx, py = cy - ry, L = 0;
  for (let i = 1; i <= N; i++) {
    const t = -Math.PI / 2 + i * 2 * Math.PI / N, x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t);
    L += Math.hypot(x - px, y - py); pts.push({ t, l: L }); px = x; py = y;
  }
  const mesas = []; let j = 0;
  for (let k = 0; k < nMesas; k++) {
    const objetivo = L * k / nMesas;
    while (j < N && pts[j + 1].l < objetivo) j++;
    const t = pts[j].t, mcx = cx + rx * Math.cos(t), mcy = cy + ry * Math.sin(t);
    const sillas = [];
    for (let s = 0; s < asientos; s++) {
      const a = -Math.PI / 2 + s * 2 * Math.PI / asientos;
      sillas.push({ x: mcx + rAsientos * Math.cos(a), y: mcy + rAsientos * Math.sin(a) });
    }
    mesas.push({ numero: k + 1, cx: mcx, cy: mcy, sillas });
  }
  return { W: 2 * cx, H: 2 * cy, R, rSilla, mesas, cx, cy, centro: { w: 2 * (rx - 115), h: 2 * (ry - 105) } };
}

// Escena 1920x1080 para el fondo con el rombo dorado en el centro.
// Las mesas van en dos arcos a los lados del rombo, con simetría girada (como las hojas del fondo):
// el arco izquierdo un poco más abajo y el derecho un poco más arriba.
// pos (opcional) = posiciones guardadas desde el editor: { mesas: { "1": {x, y}, ... }, qr: {x, y} }
function calcularEscena(nMesas, asientos, pos) {
  const W = 1920, H = 1080, cx = 960, cy = 540;
  const nIzq = Math.floor(nMesas / 2), nDer = nMesas - nIzq;
  const nMax = Math.max(nDer, 1);
  const s = Math.min(0.85, 900 / Math.max((nMax - 1) * 190, 1));   // escala de cada mesa
  const R = 50 * s, rAs = 79 * s;
  const rSilla = Math.min(14, Math.PI * 79 / Math.max(asientos, 1) * 0.82) * s;
  const span = Math.min(680, (nMax - 1) * 172 * s / 0.85);
  const mesas = [];
  const lado = (n, signo, yc) => {
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : -1 + 2 * i / (n - 1);
      const d = 470 - 150 * u * u;
      mesas.push({ cx: cx + signo * d, cy: yc + u * span / 2 });
    }
  };
  lado(nDer, +1, 430);          // derecha: de arriba hacia abajo
  const izq = []; const tmp = mesas.length;
  lado(nIzq, -1, 650);          // izquierda
  // numerar en sentido del reloj: derecha de arriba a abajo, luego izquierda de abajo a arriba
  const der = mesas.slice(0, tmp), izqs = mesas.slice(tmp).reverse();
  const orden = der.concat(izqs);
  const fija = k => pos && pos.mesas && pos.mesas[k] && isFinite(pos.mesas[k].x) && isFinite(pos.mesas[k].y) ? pos.mesas[k] : null;
  const qr = pos && pos.qr && isFinite(pos.qr.x) && isFinite(pos.qr.y) ? { x: +pos.qr.x, y: +pos.qr.y } : { x: cx, y: cy };
  return {
    W, H, R, rSilla, escala: s, cx, cy, qr, alcance: rAs + rSilla,
    mesas: orden.map((m, k) => {
      const f = fija(k + 1), mx = f ? +f.x : m.cx, my = f ? +f.y : m.cy;
      return {
        numero: k + 1, cx: mx, cy: my, auto: { x: m.cx, y: m.cy },
        sillas: Array.from({ length: asientos }, (_, j) => {
          const a = -Math.PI / 2 + j * 2 * Math.PI / asientos;
          return { x: mx + rAs * Math.cos(a), y: my + rAs * Math.sin(a) };
        }),
      };
    }),
  };
}
