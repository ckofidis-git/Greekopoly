# Game Hub 🎲

Family party games for the big screen. Open the site on a TV or laptop, pick a game, and everyone joins on their phone by scanning the QR code.

| Game | Address | What it is |
|---|---|---|
| 🏛️ Monopoly | `/monopoly/` | Official Monopoly rules with two themes: 🇬🇷 Greekopoly and 🌍 Worldopoly. 2–8 players. |
| 🌟 Maths Superstars | `/quiz/` | Times-tables quiz show for Year 5 (age 9–10): × ÷ facts to 12×12, missing numbers, × ÷ 10/100/1000. 1–40 players. |

## Layout
- `server.js` — the hub: game picker page (`public/`), QR codes, and mounts each game
- `games/<name>/server.js` — each game's pages and its own Socket.IO namespace
- `test/` — rule simulations for each game

## Run
```
npm install
npm start     # http://localhost:3000
npm test
```

## Adding a game
Create `games/<name>/` with a `server.js` that exports `(app, io) => {}`, serve its pages under `/<name>/`, use `io.of('/<name>')`, then add one line in `server.js` and a card in `public/index.html`.

Games live in server memory: a restart (redeploy, or the free plan sleeping after ~15 idle minutes) ends running games.
