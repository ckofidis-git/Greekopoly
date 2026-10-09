# Greekopoly 🏛️🌊

A Monopoly-style board game set in Greece. One big screen shows the board; each player uses their phone or tablet as a controller (scan the QR code).

## Play
1. Open the site on the big screen (TV / laptop). A game is created with a QR code.
2. Each player scans the QR code, types a name and picks a character.
3. Press **Start the game!** on the big screen.

## Run locally
```
npm install
npm start        # http://localhost:3000
npm test         # 300 simulated bot games to check the rules engine
```
Phones on the same Wi-Fi can't reach "localhost": use the Render URL for real games.

## Deploy on Render
Push this folder to a GitHub repo, then in Render: **New → Blueprint** → pick the repo (uses `render.yaml`).
Or **New → Web Service**: Build `npm install`, Start `npm start`.

Games live in server memory, so a restart (redeploy, or the free plan sleeping after ~15 idle minutes) ends running games.
