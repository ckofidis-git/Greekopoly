# Game Hub 🎲

Family party games for the big screen. Open the site on a TV or laptop, pick a game, and everyone joins on their phone by scanning the QR code.

| Game | Address | What it is |
|---|---|---|
| 🏛️ Monopoly | `/monopoly/` | Official Monopoly rules with two themes: 🇬🇷 Greekopoly and 🌍 Worldopoly. 2–8 players. |
| 🌟 Maths Superstars | `/quiz/` | Times-tables quiz show for Year 5 (age 9–10): × ÷ facts to 12×12, missing numbers, × ÷ 10/100/1000. 1–40 players. |
| 🏝️ Treasure Island | `/island/` | Answer maths questions at your own pace to earn gold, spend it claiming (or stealing) squares of a shared island; hidden surprises; most land wins. 1–16 players. |
| 🐉 Monster Battle | `/monster/` | Team game: every right answer hits the monster (fast answers, streaks and ×2 criticals hit harder); beat as many tougher monsters as you can; most damage wins. 1–40 players. |
| 🎱 Times Table Bingo | `/bingo/` | The big screen calls questions; children tap the answer on their own card; lines, first BINGO and a full card score big; wrong taps cost points and lock you out of that call. 1–40 players. |
| 🎴 UNO | `/uno/` | The card game with the official 2022 rules: 108 cards, Skip/Reverse/Draw Two/Wild/Wild Draw Four (with challenges), calling UNO and catching, one round or classic 200/500-point scoring. Private hands on the phones. 2–10 players. |

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
