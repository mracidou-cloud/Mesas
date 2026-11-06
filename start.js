// Arranque: si GitHub está configurado, primero trae la versión más reciente
// de la configuración, la lista de invitados y las llegadas; luego inicia el servidor.
const fs = require('fs');
const path = require('path');
const gh = require('./github');

const ARCHIVOS = ['config.json', 'invitados.csv', 'data/llegadas.json'];

(async () => {
  if (gh.activo) {
    console.log(`  GitHub auto-save: ON (${gh.REPO}, branch ${gh.BRANCH})`);
    for (const f of ARCHIVOS) {
      try {
        const txt = await gh.bajar(f);
        if (txt !== null) {
          fs.mkdirSync(path.dirname(path.join(__dirname, f)), { recursive: true });
          fs.writeFileSync(path.join(__dirname, f), txt);
          console.log(`  ↓ ${f} loaded from GitHub`);
        }
      } catch (e) { console.warn(`  ⚠  Could not load ${f} from GitHub: ${e.message}`); }
    }
    // mensajes del mural (un archivo por invitado)
    try {
      const dir = path.join(__dirname, 'data', 'mensajes');
      fs.mkdirSync(dir, { recursive: true });
      const lista = await gh.listar('data/mensajes');
      for (const f of lista) {
        const txt = await gh.bajar(f);
        if (txt !== null) fs.writeFileSync(path.join(__dirname, f), txt);
      }
      if (lista.length) console.log(`  ↓ ${lista.length} wishes loaded from GitHub`);
    } catch (e) { console.warn(`  ⚠  Could not load wishes from GitHub: ${e.message}`); }
  } else {
    console.log('  GitHub auto-save: OFF (set GITHUB_TOKEN and GITHUB_REPO to turn it on)');
  }
  require('./server');
})();
