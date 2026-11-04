# Plano de mesas con QR

Pantalla para tu evento: las mesas aparecen vacías, el invitado escanea el QR con su celular, busca su nombre y:

- **en la pantalla** su nombre aparece en grande y "vuela" hasta su silla, que se ilumina en dorado;
- **en su celular** ve su número de mesa y un mini-plano con su lugar marcado.

Todo se puede cambiar para otros eventos: nombre, cantidad de mesas, invitados por mesa, nombres de mesas y la lista de invitados.

---

## 1. Instalar (una sola vez)

1. Instala **Node.js** (versión 18 o más nueva) desde https://nodejs.org
2. Abre una terminal en esta carpeta y ejecuta:

```
npm install
```

## 2. Arrancar

```
npm start
```

La terminal te muestra tres direcciones:

| Página | Para qué |
|---|---|
| `http://localhost:3000/pantalla` | La pantalla / TV del evento. Presiona **F** para pantalla completa. |
| `http://localhost:3000/admin` | Configurar el evento y la lista (clave inicial: `cambiar123`). |
| `.../m` | La página del celular (a donde lleva el QR). |

## 3. Configurar tu evento (sin tocar código)

Entra a **/admin**:

- **Datos del evento:** nombre, subtítulo, **cantidad de mesas**, **invitados por mesa**, nombres opcionales de mesas ("Novios", "Familia"…) y cambiar la clave.
- **Lista de invitados:** edítala ahí mismo, o copia dos columnas desde Excel/Google Sheets (**nombre** | **mesa**) y usa "Pegar desde Excel". También puedes importar/descargar CSV.
  El resumen te marca en rojo las mesas con más gente que sillas.
- **Durante el evento:** "quitar llegada" si alguien eligió el nombre equivocado; "Reiniciar todas las llegadas" antes de un evento nuevo.

Al guardar, la pantalla se actualiza sola.

(Si prefieres editar archivos: `config.json` y `invitados.csv`, y reinicia con `npm start`.)

## 4. ¿Cómo llegan los celulares al sistema? (importante)

Los celulares de los invitados tienen que poder abrir la dirección del QR. Hay dos formas:

**Opción A — Wi‑Fi del salón (más simple).** La computadora y los celulares conectados a la misma red Wi‑Fi. El QR apunta automáticamente a la IP de la computadora. Desventaja: los invitados deben conectarse a ese Wi‑Fi.

**Opción B — Por internet (recomendada, funciona con datos móviles).**
- *Túnel desde tu computadora:* instala Cloudflare Tunnel (`cloudflared`) y ejecuta
  `cloudflared tunnel --url http://localhost:3000`. Te da una dirección `https://….trycloudflare.com`.
  Luego arranca así:
  ```
  PUBLIC_URL=https://xxxx.trycloudflare.com npm start
  ```
  (en Windows PowerShell: `$env:PUBLIC_URL="https://xxxx.trycloudflare.com"; npm start`)
- *O súbelo a un hosting de Node* (Render, Railway, etc.). En Render el QR se configura solo. Configura todo en /admin antes del evento.

## 5. Probar antes del evento

- En la pantalla presiona **D** para simular llegadas (no se guarda nada; recarga para limpiar).
- Escanea el QR con tu propio celular y regístrate; luego "quitar llegada" en /admin.

## Detalles

- Las llegadas se guardan en `data/llegadas.json`: si se apaga la computadora, al volver a arrancar todo sigue igual.
- Si llegan varios a la vez, las animaciones hacen fila y se aceleran.
- Si alguien escanea dos veces, su celular le vuelve a mostrar su mesa sin repetir la animación.
- Un celular puede registrar a varias personas (pareja, familia) con "Registrar a otra persona".
- Hasta 40 mesas y 20 invitados por mesa; el plano se reacomoda solo.
- Colores y tipografías: al inicio de `public/pantalla.html` y `public/movil.html` (variables `--oro`, `--fondo`, etc.).
