// Every word Monster Battle shows, in English and Greek.
(function (root) {
  const L = {
    en: {
      title: 'Monster <span>Battle</span> 🐉', titlePlain: 'Monster Battle', bigScreen: 'Big Screen', player: 'Player',
      tagline: 'Team up and beat the maths monsters! Every right answer is a hit 💥',
      subtitle: 'Every right answer is a hit! 💥',
      rules: '🧮 Answer questions on your phone — every right answer hits the monster 💥<br>⚡ Fast answers and 🔥 streaks hit harder · every 5 in a row is a ×2 CRITICAL!<br>🐉 Beat a monster and a tougher one appears · how many can your team beat?<br>🏆 When time runs out, whoever did the most damage wins!',
      scan: '📱 Scan to join!', orLink: 'or open the link and type the code', waitingKids: 'Waiting for heroes to join… ⚔️', remove: 'Remove',
      hTables: '✖️ Which times tables?', qAll: 'All', qTricky: 'Tricky: 6 7 8 9 12', qEasy: 'Starter: 2 5 10',
      hTypes: '🧮 Question types', opMul: '✖️ Multiply', opDiv: '➗ Divide', opMissing: '□ Missing number', opBig: '💯 × ÷ 10, 100, 1000',
      hMode: '📱 How to answer', modeChoices: '🍓 Pick from 4', modeType: '⌨️ Type the answer', hTime: '⏱️ How long?', minutes: '{n} min',
      start: (p) => `⚔️ Start the battle! (${p.n} hero${p.n > 1 ? 'es' : ''})`, waitingPlayers: '⚔️ Waiting for heroes…',
      newCode: '🔄 New game code', allGames: '🏠 All games', newCodeQ: 'Make a new game code? Everyone will need to scan again.', newCodeYes: 'Yes, new code', cancel: 'Cancel',
      pickTable: 'Pick at least one times table!', pickType: 'Pick at least one question type!',
      lateJoin: 'Join late? Code', soundOn: '🔊 Sound on', soundOff: '🔇 Sound off', fullScreen: '⛶ Full screen', end: '🏁 End battle',
      endQ: 'End the battle now and show the heroes?', timeUp: "Time's up!",
      'm.dragon': 'Sparkle Dragon', 'm.gobbler': 'Number Gobbler', 'm.octo': 'Octo-Muncher', 'm.rex': 'Times-Rex',
      'm.troll': 'Table Troll', 'm.ghost': 'Divido the Ghost', 'm.kraken': 'Kraken of Sums', 'm.mega': 'Mega Dragon', superPrefix: 'Super ',
      monsterN: 'Monster {n}', beaten: '🏆 Beaten: {n}', teamDmg: '💥 Team damage: {n}', lb: '⚔️ Top heroes', dmgShort: '{n} 💥',
      koBy: '{monster} beaten by {who}! 🎉', crit: 'CRITICAL!',
      teamResult: (p) => `Your team beat ${p.n} monster${p.n === 1 ? '' : 's'}! 🎉`, teamNone: 'The monsters got away this time — try again! 💪',
      winnerT: '👑 Top hero: {name}! 👑', everyoneH: '🏅 Everyone', damage: '{n} damage', again: '🔁 Play again (same players)',
      gameCode: 'Game code (on the big screen)', name: "What's your name?", namePh: 'Your name', pickAvatar: 'Pick your hero', join: 'Join the battle! ⚔️',
      typeCode: 'Type the game code from the big screen.', typeName: 'Type your name first! ✏️', pickAv: 'Pick a hero! 🦄',
      youreIn: "You're in! 🎉", lookBig: 'Look at the big screen — the battle starts soon!',
      playersN: (p) => `👫 ${p.n} hero${p.n > 1 ? 'es' : ''}`, summary: 'Tables: {tables} · {min} minutes', all: 'all',
      hit: '💥 Hit! −{n}', critHit: '⚡ CRITICAL! −{n}', fast: '⚡ fast!', ko: '🎉 You beat {monster}!', miss: '💨 Missed! {fact}',
      typeAnswer: 'Type your answer', typeFirst: 'Type a number first!',
      statLine: '{dmg} damage · {ord} place', fighting: 'Fighting: {monster}',
      topYou: '👑 You are the top hero!', cameRank: 'You came {ord}!', rightOf: '✅ {c} of {t} right', bestStreak: ' · 🔥 best streak {n}',
      practise: '🧠 Practise these', perfect: '🎉 No mistakes!', youSaidShort: 'you said {v}', allCorrect: 'You got every single one right. Amazing! 🌟',
      'err.full': 'The game is full.', 'err.name': 'Please type your name.', 'err.nameTaken': 'Someone already has that name — add a letter!',
      'err.settingsLocked': 'Change settings before starting.', 'err.running': 'Already running.', 'err.noPlayers': 'Wait for at least one player to join.',
      'err.rejoin': 'Please join again.', 'err.notPlaying': 'The battle is not running.', 'err.nothost': 'Not the host.', 'err.nogame': 'No game with that code. Check the big screen!',
    },
    el: {
      title: 'Μάχη με <span>Τέρατα</span> 🐉', titlePlain: 'Μάχη με Τέρατα', bigScreen: 'Μεγάλη Οθόνη', player: 'Παίκτης',
      tagline: 'Ενώστε τις δυνάμεις σας και νικήστε τα τέρατα των μαθηματικών! Κάθε σωστή απάντηση είναι ένα χτύπημα 💥',
      subtitle: 'Κάθε σωστή απάντηση είναι ένα χτύπημα! 💥',
      rules: '🧮 Απάντα σε ερωτήσεις στο κινητό — κάθε σωστή απάντηση χτυπά το τέρας 💥<br>⚡ Οι γρήγορες απαντήσεις και τα 🔥 σερί χτυπούν πιο δυνατά · κάθε 5 στη σειρά είναι ×2 ΚΡΙΤΙΚΟ χτύπημα!<br>🐉 Νίκησε ένα τέρας και εμφανίζεται ένα πιο δυνατό · πόσα μπορεί να νικήσει η ομάδα σας;<br>🏆 Όταν τελειώσει ο χρόνος, νικά όποιος έκανε τη μεγαλύτερη ζημιά!',
      scan: '📱 Σκάναρε για να μπεις!', orLink: 'ή άνοιξε τον σύνδεσμο και γράψε τον κωδικό', waitingKids: 'Περιμένουμε τους ήρωες… ⚔️', remove: 'Αφαίρεση',
      hTables: '✖️ Ποια προπαίδεια;', qAll: 'Όλες', qTricky: 'Δύσκολες: 6 7 8 9 12', qEasy: 'Εύκολες: 2 5 10',
      hTypes: '🧮 Είδη ερωτήσεων', opMul: '✖️ Πολλαπλασιασμός', opDiv: '➗ Διαίρεση', opMissing: '□ Ο αριθμός που λείπει', opBig: '💯 × ÷ με 10, 100, 1.000',
      hMode: '📱 Πώς απαντάμε', modeChoices: '🍓 Επιλογή από 4', modeType: '⌨️ Γράφω την απάντηση', hTime: '⏱️ Πόση ώρα;', minutes: '{n} λεπτά',
      start: (p) => `⚔️ Ξεκινά η μάχη! (${p.n} ${p.n > 1 ? 'ήρωες' : 'ήρωας'})`, waitingPlayers: '⚔️ Περιμένουμε ήρωες…',
      newCode: '🔄 Νέος κωδικός', allGames: '🏠 Όλα τα παιχνίδια', newCodeQ: 'Νέος κωδικός παιχνιδιού; Όλοι θα πρέπει να σκανάρουν ξανά.', newCodeYes: 'Ναι, νέος κωδικός', cancel: 'Άκυρο',
      pickTable: 'Διάλεξε τουλάχιστον μία προπαίδεια!', pickType: 'Διάλεξε τουλάχιστον ένα είδος ερώτησης!',
      lateJoin: 'Ήρθες αργά; Κωδικός', soundOn: '🔊 Ήχος: ναι', soundOff: '🔇 Ήχος: όχι', fullScreen: '⛶ Πλήρης οθόνη', end: '🏁 Τέλος μάχης',
      endQ: 'Να τελειώσει τώρα η μάχη και να δούμε τους ήρωες;', timeUp: 'Τέλος χρόνου!',
      'm.dragon': 'Δράκος της Λάμψης', 'm.gobbler': 'Αριθμοφάγος', 'm.octo': 'Χταπόδι Μασουλητής', 'm.rex': 'Πολλαπλασιόσαυρος',
      'm.troll': 'Τρολ της Προπαίδειας', 'm.ghost': 'Φάντασμα Διαιρούλης', 'm.kraken': 'Κράκεν των Πράξεων', 'm.mega': 'Μέγα Δράκος', superPrefix: 'Σούπερ ',
      monsterN: 'Τέρας {n}', beaten: '🏆 Νικήθηκαν: {n}', teamDmg: '💥 Ζημιά ομάδας: {n}', lb: '⚔️ Κατάταξη', dmgShort: '{n} 💥',
      koBy: '{monster}: νικήθηκε από {who}! 🎉', crit: 'ΚΡΙΤΙΚΟ!',
      teamResult: (p) => `Η ομάδα σας νίκησε ${p.n} ${p.n === 1 ? 'τέρας' : 'τέρατα'}! 🎉`, teamNone: 'Τα τέρατα ξέφυγαν αυτή τη φορά — ξαναδοκιμάστε! 💪',
      winnerT: '👑 Πρώτη θέση: {name}! 👑', everyoneH: '🏅 Όλοι', damage: '{n} ζημιά', again: '🔁 Ξανά (με τους ίδιους παίκτες)',
      gameCode: 'Κωδικός παιχνιδιού (στη μεγάλη οθόνη)', name: 'Πώς σε λένε;', namePh: 'Το όνομά σου', pickAvatar: 'Διάλεξε ήρωα', join: 'Μπαίνω στη μάχη! ⚔️',
      typeCode: 'Γράψε τον κωδικό από τη μεγάλη οθόνη.', typeName: 'Γράψε πρώτα το όνομά σου! ✏️', pickAv: 'Διάλεξε ήρωα! 🦄',
      youreIn: 'Είσαι μέσα! 🎉', lookBig: 'Κοίτα τη μεγάλη οθόνη — η μάχη ξεκινά σε λίγο!',
      playersN: (p) => `👫 ${p.n} ${p.n > 1 ? 'ήρωες' : 'ήρωας'}`, summary: 'Προπαίδεια: {tables} · {min} λεπτά', all: 'όλες',
      hit: '💥 Χτύπημα! −{n}', critHit: '⚡ ΚΡΙΤΙΚΟ! −{n}', fast: '⚡ γρήγορα!', ko: '🎉 Νίκησες: {monster}!', miss: '💨 Αστόχησες! {fact}',
      typeAnswer: 'Γράψε την απάντηση', typeFirst: 'Γράψε πρώτα έναν αριθμό!',
      statLine: '{dmg} ζημιά · {ord} θέση', fighting: 'Μάχη με: {monster}',
      topYou: '👑 Πήρες την πρώτη θέση!', cameRank: 'Τερμάτισες στην {ord} θέση!', rightOf: '✅ Σωστές: {c} από {t}', bestStreak: ' · 🔥 καλύτερο σερί: {n}',
      practise: '🧠 Κάνε εξάσκηση σε αυτές', perfect: '🎉 Κανένα λάθος!', youSaidShort: 'απάντησες {v}', allCorrect: 'Τις βρήκες όλες σωστές. Καταπληκτικό! 🌟',
      'err.full': 'Το παιχνίδι είναι γεμάτο.', 'err.name': 'Γράψε το όνομά σου.', 'err.nameTaken': 'Κάποιος έχει ήδη αυτό το όνομα — πρόσθεσε ένα γράμμα!',
      'err.settingsLocked': 'Οι ρυθμίσεις αλλάζουν πριν ξεκινήσει η μάχη.', 'err.running': 'Η μάχη έχει ήδη ξεκινήσει.', 'err.noPlayers': 'Περίμενε να μπει τουλάχιστον ένας παίκτης.',
      'err.rejoin': 'Μπες ξανά στο παιχνίδι.', 'err.notPlaying': 'Η μάχη δεν είναι σε εξέλιξη.', 'err.nothost': 'Δεν είσαι ο οικοδεσπότης.', 'err.nogame': 'Δεν υπάρχει παιχνίδι με αυτόν τον κωδικό. Κοίτα στη μεγάλη οθόνη!',
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
