// Random bots play many games; checks the engine never breaks its own invariants.
const { Game } = require('../game');
const { SPACES } = require('../shared/board');
let seed = 1; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rng() * a.length)];
let finished = 0, turnsTotal = 0;
for (let g = 0; g < 300; g++) {
  const game = new Game('T', rng);
  const n = 2 + (g % 5);
  for (let i = 0; i < n; i++) game.join('p' + i, 'P' + i, ['owl','dolphin','cat','unicorn','butterfly','turtle'][i]);
  game.start({ jackpot: g % 2 === 0 });
  let steps = 0;
  while (game.phase === 'playing' && steps < 20000) {
    steps++;
    const cur = game.current;
    // random side actions
    const anyone = pick(game.active());
    const mine = game.owns(anyone.id);
    if (mine.length && rng() < 0.3) game.act(anyone.id, { type: pick(['build','build','build','sell','mortgage','unmortgage']), pos: pick(mine) });
    if (rng() < 0.02) { const o = pick(game.active()); if (o !== anyone) game.act(anyone.id, { type: 'trade', offer: { to: o.id, giveProps: mine.slice(0,1), getProps: game.owns(o.id).slice(0,1), giveCash: 10 } }); }
    if (game.trades.length && rng() < 0.5) { const t = game.trades[0]; game.act(t.to, { type: 'tradeReply', id: t.id, accept: rng() < 0.7 }); }
    switch (game.step) {
      case 'roll':
        if (cur.inJail && rng() < 0.3) game.act(cur.id, { type: cur.jailCards.length ? 'useCard' : 'payJail' });
        game.act(cur.id, { type: 'roll' }); break;
      case 'buy': game.act(cur.id, { type: rng() < 0.7 ? 'buy' : 'decline' }); if (game.step === 'buy') game.act(cur.id, { type: 'decline' }); break;
      case 'auction': { const a = game.auction; const b = game.P(pick(a.inIds)); if (rng() < 0.5 && b.cash > a.bid + 10) game.act(b.id, { type: 'bid', inc: 10 }); else game.act(b.id, { type: 'pass' }); break; }
      case 'debt': { const d = game.debts[0]; const p = game.P(d.from);
        if (p.cash >= d.amount) game.act(p.id, { type: 'payDebt' });
        else { const ps = game.owns(p.id); let did = false;
          for (const pos of ps) { if ((game.houses[pos]||0) && !game.act(p.id,{type:'sell',pos})) { did = true; break; } }
          if (!did) for (const pos of ps) { if (!game.act(p.id,{type:'mortgage',pos})) { did = true; break; } }
          if (!did) game.act(p.id, { type: 'bankrupt' }); }
        break; }
      case 'endturn': game.act(cur.id, { type: 'endTurn' }); turnsTotal++; break;
    }
    // invariants
    for (const p of game.players) if (p.cash < 0) throw new Error('negative cash ' + JSON.stringify(p));
    const houses = Object.values(game.houses).reduce((s,h)=>s+(h<5?h:0),0), hotels = Object.values(game.houses).filter(h=>h===5).length;
    if (houses + game.housesLeft !== 32 || hotels + game.hotelsLeft !== 12) throw new Error('building count off');
    for (const [pos, h] of Object.entries(game.houses)) if (h && !game.owners[pos]) throw new Error('house on unowned');
    if (game.current.bankrupt && game.phase === 'playing' && game.step !== 'debt' && game.step !== 'auction') throw new Error('bankrupt current ' + game.step);
    if (game.decks.chance.length + game.players.reduce((s,p)=>s+p.jailCards.filter(d=>d==='chance').length,0) !== 16) throw new Error('chance deck count');
  }
  if (game.phase === 'over') finished++;
}
console.log(`OK — 300 games, ${finished} finished by bankruptcy, ${turnsTotal} turns played, no invariant broken.`);
