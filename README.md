# Seating chart with QR code

An event screen: the tables start empty. A guest scans the QR code with their phone and looks up their name. Then:

- **on the big screen**, their name appears large and flies to their seat, which lights up in gold;
- **on their phone**, they see their table number and a mini map with their seat marked.

## Pages

| Page | Use |
|---|---|
| `/pantalla` | The event screen (press **F** for full screen, **D** to simulate an arrival) |
| `/m` | The phone page (where the QR code leads) |
| `/admin` | Event settings and guest list (default password: `cambiar123`) |

## Screen designs

Each design is saved as its own file in `public/disenos/` (one doesn’t affect the others). Pick one in /admin → **Screen design**; the screen switches right away.

| Design | Look | Wishes wall |
|---|---|---|
| **Elegant** (`elegant`) | Purple & gold background, tilted QR in a diamond frame | ✓ |
| **Soft clay** (`clay`) | Pastel, rounded “clay” style, colorful tables | ✓ |
| **Frosted slate** (`frost`) | Cool blue-gray frosted glass, navy & teal | ✓ |
| **Navy ring** (`ring`) | Navy & gold, tables in a ring around the QR, dancing couple | — |
| **Classic** (`classic`) | Navy & gold, table grid, side panel with QR, counter and recent arrivals | — |

**Layout editor** (/admin → 4. Layout): drag each table and the QR code to where you want them in the Elegant, Soft clay and Frosted slate designs, then press *Save layout*. Tables that overlap something turn red. *Reset to automatic* puts everything back. Classic and Navy ring arrange their tables automatically.

Preview any design at `/pantalla/<id>` (e.g. `/pantalla/clay`). The phone page follows the chosen design.

## Run locally

```
npm install
npm start
```

## Set up an event (no code needed)

Open **/admin**:

- **Event details:** name, subtitle, number of tables, guests per table, table names, background image/video, password.
- **Guest list:** edit it there, or paste two columns from Excel / Google Sheets (**name** | **table**).
- **During the event:** “undo check-in” for wrong picks; “Reset all check-ins” before a new event.

## Auto-save to GitHub (recommended)

On Render’s free plan, files changed on the server are lost when it restarts or sleeps. With auto-save ON, every change made in /admin (event details, guest list, check-ins) is saved to your GitHub repository automatically, and loaded back when the service starts.

1. GitHub → your photo → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Repository access: **Only select repositories** → your repo. Permissions → **Contents: Read and write**. Generate and copy the token.
3. Render → your service → **Environment** → add:
   - `GITHUB_TOKEN` = the token
   - `GITHUB_REPO` = `your-user/your-repo`
   - (optional) `GITHUB_BRANCH` if your branch isn’t `main`
4. Save. Render restarts; /admin shows “Auto-save to GitHub is ON”.

Commits made by the app include `[skip render]`, so saving does not restart the service.

Without auto-save, use **💾 Save permanently** to download `config.json` and `invitados.csv` and upload them to GitHub yourself.

## Wishes wall ✍️

After checking in, guests can tap **“Leave a wish”** and either type a message (with an emoji bar) or draw/write it with their finger. It appears big on the screen with their name, then joins a column on the right. Each wish moves to the middle, stays large for about 2 seconds, then the column steps to the next one.

In /admin → **4. Wishes wall**: turn it on/off, see all wishes, and delete any of them (it disappears from the screen right away).

## Files

- `config.json`: event settings
- `invitados.csv`: guest list (`name,table`)
- `public/fondo.jpg`: background image
- `data/llegadas.json`: who has checked in
- `data/mensajes/`: the guests’ wishes (one file per guest)

## Notes

- Free Render instances sleep after inactivity. Open the screen a few minutes before the event so it wakes up.
- If several guests check in at once, the animations queue up and speed up.
- One phone can check in several people (“Check in someone else”).
