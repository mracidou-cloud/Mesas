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
  } else {
    console.log('  GitHub auto-save: OFF (set GITHUB_TOKEN and GITHUB_REPO to turn it on)');
  }
  require('./server');
})();
