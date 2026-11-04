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

## Files

- `config.json`: event settings
- `invitados.csv`: guest list (`name,table`)
- `public/fondo.jpg`: background image
- `data/llegadas.json`: who has checked in (resets on Render restarts)

## Notes

- Free Render instances sleep after inactivity. Open the screen a few minutes before the event so it wakes up.
- If several guests check in at once, the animations queue up and speed up.
- One phone can check in several people (“Check in someone else”).
