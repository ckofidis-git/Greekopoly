// Every word UNO shows, in English and Greek.
(function (root) {
  const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const L = {
    en: {
      title: '<span>UNO</span> 🎴', titlePlain: 'UNO', bigScreen: 'Big Screen', player: 'Player',
      tagline: 'The classic card game — match the colour or number, and be the first to empty your hand! 🌈',
      subtitle: 'Match colours and numbers!',
      rules: "🎴 Match the top card by colour, number or symbol — or play a Wild<br>🃏 Can't (or don't want to) play? Draw one card — you may play it if it fits<br>🚫 Skip · 🔁 Reverse · +2 next player draws 2 · 🌈 Wild picks the colour · +4 only if you have no card of the current colour (it can be challenged!)<br>📣 Tap UNO! before you play your second-to-last card — if someone catches you, you draw 2!",
      scan: '📱 Scan to join!', orLink: 'or open the link and type the code', waitingKids: 'Waiting for players to join… 🎴', remove: 'Remove',
      hTarget: '🏆 How to win', target0: 'One round: first to empty their hand', target200: 'First to 200 points (shorter)', target500: 'First to 500 points (classic)',
      hHelp: '💡 Help for young players', helpOn: 'Light up the cards you can play', helpOff: 'No help',
      start: (p) => `🎴 Deal the cards! (${pl(p.n, 'player', 'players')})`, waitingPlayers: 'Waiting for at least 2 players… (2–10 can play)',
      newCode: '🔄 New game code', allGames: '🏠 All games', newCodeQ: 'Make a new game code? Everyone will need to scan again.', newCodeYes: 'Yes, new code', cancel: 'Cancel',
      lateJoin: 'Code', soundOn: '🔊 Sound on', soundOff: '🔇 Sound off', fullScreen: '⛶ Full screen', end: '🏁 End game', next: '▶️ Next round',
      endQ: 'End the game now? The player with the fewest cards (or the most points) wins.',
      'c.r': 'Red', 'c.y': 'Yellow', 'c.g': 'Green', 'c.b': 'Blue',
      'v.skip': 'Skip', 'v.rev': 'Reverse', 'v.d2': 'Draw Two', 'v.wild': 'Wild', 'v.wd4': 'Wild Draw Four',
      turnOf: "{who}'s turn", deckN: (p) => pl(p.n, 'card', 'cards'), colorNow: 'Colour: {c}', roundN: 'Round {n}', targetN: 'First to {n} points wins',
      deciding: '{who} is deciding: draw 4 or challenge…', catchable: '🚨 {who} has 1 card and forgot UNO! Catch them!',
      'ev.round': '🎴 Round {n}! {who} goes first.', 'ev.play': '{who} played {card}', 'ev.uno': '📣 {who}: UNO!', 'ev.skipped': '🚫 {who} is skipped!',
      'ev.reversed': '🔁 The direction changed!', 'ev.drew2': '+2 for {who}!', 'ev.drew': '🃏 {who} drew a card', 'ev.drew4': '+4 for {who}!',
      'ev.challengeWon': '⚖️ {who} challenged and won! {from} draws 4.', 'ev.challengeLost': '⚖️ {who} challenged and lost — draws 6!',
      'ev.caught': '🚨 {who} caught {target} without UNO! +2 cards', 'ev.out': '🎉 {who} went out! +{n} points', 'ev.winner': '👑 {who} wins!',
      'ev.reshuffle': '🔀 The played cards were shuffled into a new deck',
      roundOver: '🎉 {who} won round {n}!', scoresH: '📊 Scores', handLeft: 'cards left',
      winnerT: '👑 {name} wins UNO! 👑', everyoneH: '🏅 Everyone', cardsLeft: (p) => `${pl(p.n, 'card', 'cards')} left`, pointsN: (p) => pl(p.n, 'point', 'points'),
      again: '🔁 Play again (same players)',
      gameCode: 'Game code (on the big screen)', name: "What's your name?", namePh: 'Your name', pickAvatar: 'Pick your avatar', join: 'Join UNO! 🎴',
      typeCode: 'Type the game code from the big screen.', typeName: 'Type your name first! ✏️', pickAv: 'Pick an avatar! 🦄',
      youreIn: "You're in! 🎉", lookBig: 'Look at the big screen — the cards will be dealt soon!', playersN: (p) => `👫 ${pl(p.n, 'player', 'players')}`,
      yourTurn: '✨ Your turn!', tapCard: 'Tap a card to play it', noMatch: 'No card fits — draw one!', drawBtn: '🃏 Draw a card',
      drewPlayable: 'You drew a card you can play! Play it or keep it.', keepBtn: '👍 Keep it', pickColor: '🌈 Pick a colour',
      unoBtn: '📣 UNO!', unoHint: 'You will have 1 card left — tap UNO! first!', unoSaid: '📣 UNO said! Now play your card.', unoLate: 'Quick! Tap UNO! before someone catches you!',
      catchBtn: '🚨 Catch {who}! (no UNO)', wd4Hit: '{who} played +4 on you!',
      wd4Q: 'Draw 4 — or challenge? If they had a card of the colour, they draw 4. If they did not, you draw 6!',
      accept: '🃏 Draw 4', challenge: '⚖️ Challenge!', myCards: (p) => pl(p.n, 'card', 'cards'),
      roundOverPh: 'Round over! Look at the big screen. 👀', youWon: '👑 You won!', cameRank: 'You came {ord}!',
      'err.started': 'This game already started — wait for the next one!', 'err.full': 'The game is full (10 players).', 'err.name': 'Please type your name.',
      'err.nameTaken': 'Someone already has that name — add a letter!', 'err.running': 'Already running.', 'err.need2': 'You need at least 2 players.',
      'err.rejoin': 'Please join again.', 'err.notPlaying': 'The game is not running.', 'err.notYourTurn': 'Wait for your turn!',
      'err.respondFirst': 'Wait — someone is deciding about a +4.', 'err.pickColor': 'Pick a colour first!', 'err.noCard': "That card isn't in your hand.",
      'err.onlyDrawn': 'You can only play the card you just drew (or keep it).', 'err.cantPlay': "That card doesn't match!", 'err.alreadyDrew': 'You already drew a card.',
      'err.notNow': 'Not now.', 'err.nobodyToCatch': 'Too late — nobody to catch!', 'err.nothost': 'Not the host.', 'err.nogame': 'No game with that code. Check the big screen!',
    },
    el: {
      title: '<span>UNO</span> 🎴', titlePlain: 'UNO', bigScreen: 'Μεγάλη Οθόνη', player: 'Παίκτης',
      tagline: 'Το κλασικό παιχνίδι με κάρτες — ταίριαξε χρώμα ή αριθμό και άδειασε το χέρι σου πριν από όλους! 🌈',
      subtitle: 'Ταίριαξε χρώματα και αριθμούς!',
      rules: '🎴 Ταίριαξε την πάνω κάρτα στο χρώμα, στον αριθμό ή στο σύμβολο — ή παίξε μπαλαντέρ<br>🃏 Δεν μπορείς (ή δεν θέλεις) να παίξεις; Τράβηξε μία κάρτα — αν ταιριάζει, μπορείς να την παίξεις<br>🚫 Πάσο · 🔁 Αλλαγή φοράς · +2 ο επόμενος τραβάει 2 · 🌈 Ο μπαλαντέρ διαλέγει χρώμα · +4 μόνο αν δεν έχεις κάρτα στο τωρινό χρώμα (μπορεί να αμφισβητηθεί!)<br>📣 Πάτα UNO! πριν παίξεις την προτελευταία σου κάρτα — αν σε πιάσουν, τραβάς 2!',
      scan: '📱 Σκάναρε για να μπεις!', orLink: 'ή άνοιξε τον σύνδεσμο και γράψε τον κωδικό', waitingKids: 'Περιμένουμε παίκτες… 🎴', remove: 'Αφαίρεση',
      hTarget: '🏆 Πώς κερδίζεις', target0: 'Ένας γύρος: νικά όποιος αδειάσει πρώτα το χέρι', target200: 'Μέχρι τους 200 πόντους (πιο σύντομο)', target500: 'Μέχρι τους 500 πόντους (κλασικό)',
      hHelp: '💡 Βοήθεια για μικρούς παίκτες', helpOn: 'Φώτισε τις κάρτες που μπορείς να παίξεις', helpOff: 'Χωρίς βοήθεια',
      start: (p) => `🎴 Μοίρασε τις κάρτες! (${pl(p.n, 'παίκτης', 'παίκτες')})`, waitingPlayers: 'Περιμένουμε τουλάχιστον 2 παίκτες… (παίζουν 2–10)',
      newCode: '🔄 Νέος κωδικός', allGames: '🏠 Όλα τα παιχνίδια', newCodeQ: 'Νέος κωδικός παιχνιδιού; Όλοι θα πρέπει να σκανάρουν ξανά.', newCodeYes: 'Ναι, νέος κωδικός', cancel: 'Άκυρο',
      lateJoin: 'Κωδικός', soundOn: '🔊 Ήχος: ναι', soundOff: '🔇 Ήχος: όχι', fullScreen: '⛶ Πλήρης οθόνη', end: '🏁 Τέλος παιχνιδιού', next: '▶️ Επόμενος γύρος',
      endQ: 'Να τελειώσει τώρα το παιχνίδι; Νικά όποιος έχει τις λιγότερες κάρτες (ή τους περισσότερους πόντους).',
      'c.r': 'Κόκκινο', 'c.y': 'Κίτρινο', 'c.g': 'Πράσινο', 'c.b': 'Μπλε',
      'v.skip': 'Πάσο', 'v.rev': 'Αλλαγή φοράς', 'v.d2': 'Τράβα δύο', 'v.wild': 'Μπαλαντέρ', 'v.wd4': 'Μπαλαντέρ +4',
      turnOf: 'Σειρά: {who}', deckN: (p) => pl(p.n, 'κάρτα', 'κάρτες'), colorNow: 'Χρώμα: {c}', roundN: 'Γύρος {n}', targetN: 'Νικά όποιος φτάσει τους {n} πόντους',
      deciding: '{who}: αποφασίζει — τραβάει 4 ή αμφισβητεί…', catchable: '🚨 {who}: έχει 1 κάρτα και ξέχασε να πει UNO! Πατήστε «Πιάσε»!',
      'ev.round': '🎴 Γύρος {n}! Ξεκινά: {who}.', 'ev.play': '{who}: έπαιξε {card}', 'ev.uno': '📣 {who}: UNO!', 'ev.skipped': '🚫 {who}: χάνει τη σειρά!',
      'ev.reversed': '🔁 Άλλαξε η φορά!', 'ev.drew2': '+2 για {who}!', 'ev.drew': '🃏 {who}: τράβηξε κάρτα', 'ev.drew4': '+4 για {who}!',
      'ev.challengeWon': '⚖️ {who}: αμφισβήτησε και κέρδισε! {from}: τραβάει 4.', 'ev.challengeLost': '⚖️ {who}: αμφισβήτησε και έχασε — τραβάει 6!',
      'ev.caught': '🚨 {who}: έπιασε {target} χωρίς UNO! +2 κάρτες', 'ev.out': '🎉 {who}: άδειασε το χέρι! +{n} πόντοι', 'ev.winner': '👑 Νίκη για: {who}!',
      'ev.reshuffle': '🔀 Οι κάρτες που παίχτηκαν ανακατεύτηκαν σε νέα τράπουλα',
      roundOver: '🎉 Γύρος {n}: νίκη για {who}!', scoresH: '📊 Βαθμολογία', handLeft: 'κάρτες έμειναν',
      winnerT: '👑 Νίκη για: {name}! 👑', everyoneH: '🏅 Όλοι', cardsLeft: (p) => `${pl(p.n, 'κάρτα έμεινε', 'κάρτες έμειναν')}`, pointsN: (p) => pl(p.n, 'πόντος', 'πόντοι'),
      again: '🔁 Ξανά (με τους ίδιους παίκτες)',
      gameCode: 'Κωδικός παιχνιδιού (στη μεγάλη οθόνη)', name: 'Πώς σε λένε;', namePh: 'Το όνομά σου', pickAvatar: 'Διάλεξε φατσούλα', join: 'Μπαίνω στο UNO! 🎴',
      typeCode: 'Γράψε τον κωδικό από τη μεγάλη οθόνη.', typeName: 'Γράψε πρώτα το όνομά σου! ✏️', pickAv: 'Διάλεξε φατσούλα! 🦄',
      youreIn: 'Είσαι μέσα! 🎉', lookBig: 'Κοίτα τη μεγάλη οθόνη — σε λίγο μοιράζονται οι κάρτες!', playersN: (p) => `👫 ${pl(p.n, 'παίκτης', 'παίκτες')}`,
      yourTurn: '✨ Η σειρά σου!', tapCard: 'Πάτα μια κάρτα για να την παίξεις', noMatch: 'Καμία κάρτα δεν ταιριάζει — τράβηξε μία!', drawBtn: '🃏 Τράβηξε κάρτα',
      drewPlayable: 'Τράβηξες κάρτα που ταιριάζει! Παίξ’ την ή κράτα την.', keepBtn: '👍 Κράτα την', pickColor: '🌈 Διάλεξε χρώμα',
      unoBtn: '📣 UNO!', unoHint: 'Θα σου μείνει 1 κάρτα — πάτα πρώτα UNO!', unoSaid: '📣 Είπες UNO! Τώρα παίξε την κάρτα σου.', unoLate: 'Γρήγορα! Πάτα UNO! πριν σε πιάσουν!',
      catchBtn: '🚨 Πιάσε: {who}! (χωρίς UNO)', wd4Hit: '{who}: σου έπαιξε +4!',
      wd4Q: 'Τραβάς 4 — ή αμφισβητείς; Αν είχε κάρτα στο χρώμα, τραβάει 4. Αν δεν είχε, τραβάς εσύ 6!',
      accept: '🃏 Τραβάω 4', challenge: '⚖️ Αμφισβήτηση!', myCards: (p) => pl(p.n, 'κάρτα', 'κάρτες'),
      roundOverPh: 'Τέλος γύρου! Κοίτα τη μεγάλη οθόνη. 👀', youWon: '👑 Κέρδισες!', cameRank: 'Τερμάτισες στην {ord} θέση!',
      'err.started': 'Το παιχνίδι έχει ήδη ξεκινήσει — περίμενε το επόμενο!', 'err.full': 'Το παιχνίδι είναι γεμάτο (10 παίκτες).', 'err.name': 'Γράψε το όνομά σου.',
      'err.nameTaken': 'Κάποιος έχει ήδη αυτό το όνομα — πρόσθεσε ένα γράμμα!', 'err.running': 'Το παιχνίδι έχει ήδη ξεκινήσει.', 'err.need2': 'Χρειάζονται τουλάχιστον 2 παίκτες.',
      'err.rejoin': 'Μπες ξανά στο παιχνίδι.', 'err.notPlaying': 'Το παιχνίδι δεν είναι σε εξέλιξη.', 'err.notYourTurn': 'Περίμενε τη σειρά σου!',
      'err.respondFirst': 'Περίμενε — κάποιος αποφασίζει για ένα +4.', 'err.pickColor': 'Διάλεξε πρώτα χρώμα!', 'err.noCard': 'Αυτή η κάρτα δεν είναι στο χέρι σου.',
      'err.onlyDrawn': 'Μπορείς να παίξεις μόνο την κάρτα που τράβηξες (ή να την κρατήσεις).', 'err.cantPlay': 'Αυτή η κάρτα δεν ταιριάζει!', 'err.alreadyDrew': 'Έχεις ήδη τραβήξει κάρτα.',
      'err.notNow': 'Όχι τώρα.', 'err.nobodyToCatch': 'Πολύ αργά — δεν υπάρχει κανείς να πιάσεις!', 'err.nothost': 'Δεν είσαι ο οικοδεσπότης.', 'err.nogame': 'Δεν υπάρχει παιχνίδι με αυτόν τον κωδικό. Κοίτα στη μεγάλη οθόνη!',
    },
  };
  const ORD = {
    en: (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'),
    el: (n) => n + 'η',
  };
  function makeT(lang) {
    const dict = L[lang] || L.en;
    return (key, p = {}) => {
      const s = key in dict ? dict[key] : L.en[key];
      if (s === undefined) return key;
      if (typeof s === 'function') return s(p);
      return s.replace(/\{(\w+)\}/g, (_, k) => (p[k] !== undefined ? p[k] : ''));
    };
  }
  root.QI18N = { L, ORD, makeT };
})(window);
