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

**Render free plan:** changes made in /admin are lost when the service restarts or sleeps. After setting up, use **💾 Save permanently** to download `config.json` and `invitados.csv`, and upload them to your GitHub repository.

## Files

- `config.json`: event settings
- `invitados.csv`: guest list (`name,table`)
- `public/fondo.jpg`: background image
- `data/llegadas.json`: who has checked in (resets on Render restarts)

## Notes

- Free Render instances sleep after inactivity. Open the screen a few minutes before the event so it wakes up.
- If several guests check in at once, the animations queue up and speed up.
- One phone can check in several people (“Check in someone else”).
