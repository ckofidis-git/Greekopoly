// Every word Times Table Bingo shows, in English and Greek.
(function (root) {
  const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const L = {
    en: {
      title: 'Times Table <span>Bingo</span> 🎱', titlePlain: 'Times Table Bingo', bigScreen: 'Big Screen', player: 'Player',
      tagline: 'Watch for the question, find the answer on your card, get a BINGO! 🎉',
      subtitle: 'Find the answers on your card!',
      rules: '🎱 Every player gets a bingo card full of answers<br>📺 The big screen calls a question — if the answer is on your card, tap it!<br>✅ Right tap +10 (+5 if quick) · 📏 line +50 · 🥇 first BINGO +50 more · 🌟 full card +100<br>❌ A wrong tap costs 5 points and locks you out of that question — no guessing!',
      scan: '📱 Scan to join!', orLink: 'or open the link and type the code', waitingKids: 'Waiting for players to join… 🎱', remove: 'Remove',
      hTables: '✖️ Which times tables?', qAll: 'All', qTricky: 'Tricky: 6 7 8 9 12', qEasy: 'Starter: 2 5 10',
      hTypes: '🧮 Question types', opMul: '✖️ Multiply', opDiv: '➗ Divide', opMissing: '□ Missing number',
      hCalls: '🎱 How many calls?', hSecs: '⏱️ Seconds per call', secs: '{n}s',
      start: (p) => `🎱 Start Bingo! (${pl(p.n, 'player', 'players')})`, waitingPlayers: '🎱 Waiting for players…',
      newCode: '🔄 New game code', allGames: '🏠 All games', newCodeQ: 'Make a new game code? Everyone will need to scan again.', newCodeYes: 'Yes, new code', cancel: 'Cancel',
      pickTable: 'Pick at least one times table!', pickType: 'Pick at least one question type!',
      lateJoin: 'Join late? Code', soundOn: '🔊 Sound on', soundOff: '🔇 Sound off', fullScreen: '⛶ Full screen', next: '⏭️ Next', end: '🏁 End game',
      endQ: 'End the game now and show the winners?',
      callN: 'Call {n} of {total}', findIt: 'Find the answer on your card! 👀', called: '📜 Called so far', final: '🏁 Final results',
      lb: '🏆 Leaderboard', ptsShort: '{n} pts', linesShort: '📏 {n}',
      'ev.firstBingo': '🥇 BINGO! {who} got the first line!', 'ev.line': '📏 {who} completed a line!', 'ev.full': '🌟 FULL CARD! {who} marked every square!', 'ev.winner': '👑 {who} wins Bingo!',
      winnerT: '👑 {name} wins Bingo! 👑', everyoneH: '🏅 Everyone', points: (p) => pl(p.n, 'point', 'points'), linesN: (p) => pl(p.n, 'line', 'lines'),
      again: '🔁 Play again (same players)',
      gameCode: 'Game code (on the big screen)', name: "What's your name?", namePh: 'Your name', pickAvatar: 'Pick your avatar', join: 'Join Bingo! 🎱',
      typeCode: 'Type the game code from the big screen.', typeName: 'Type your name first! ✏️', pickAv: 'Pick an avatar! 🦄',
      youreIn: "You're in! 🎉", lookBig: 'Look at the big screen — Bingo starts soon!',
      playersN: (p) => `👫 ${pl(p.n, 'player', 'players')}`, summary: 'Tables: {tables} · {calls} calls', all: 'all',
      tapAnswer: 'Tap the answer if it is on your card!', good: '✅ +{n}!', fast: '⚡ quick!', gotLine: '📏 LINE!', gotFirst: '🥇 BINGO!', gotFull: '🌟 FULL CARD!',
      wrongTap: "❌ {v} isn't it! −{n} · wait for the next question", wrongTap0: "❌ {v} isn't it! · wait for the next question", locked: '🔒 Wait for the next question', answerWas: 'The answer was {fact}',
      statLine: (p) => `${pl(p.pts, 'point', 'points')} · ${p.ord} place`,
      kingYou: '👑 You won Bingo!', cameRank: 'You came {ord}!', markedOf: (p) => `✅ ${pl(p.m, 'square', 'squares')} marked · 📏 ${pl(p.l, 'line', 'lines')}`,
      practise: '🧠 You missed these', perfect: "🎉 You didn't miss any!",
      'err.full': 'The game is full.', 'err.name': 'Please type your name.', 'err.nameTaken': 'Someone already has that name — add a letter!',
      'err.settingsLocked': 'Change settings before starting.', 'err.running': 'Already running.', 'err.noPlayers': 'Wait for at least one player to join.',
      'err.rejoin': 'Please join again.', 'err.notPlaying': 'The game is not running.', 'err.notCalling': 'Wait for the next question!', 'err.cell': 'Tap a square on your card.',
      'err.already': 'Already marked! ✅', 'err.locked': 'Locked until the next question 🔒', 'err.nothost': 'Not the host.', 'err.nogame': 'No game with that code. Check the big screen!',
    },
    el: {
      title: 'Μπίνγκο της <span>Προπαίδειας</span> 🎱', titlePlain: 'Μπίνγκο της Προπαίδειας', bigScreen: 'Μεγάλη Οθόνη', player: 'Παίκτης',
      tagline: 'Δες την ερώτηση, βρες την απάντηση στην κάρτα σου και κάνε ΜΠΙΝΓΚΟ! 🎉',
      subtitle: 'Βρες τις απαντήσεις στην κάρτα σου!',
      rules: '🎱 Κάθε παίκτης παίρνει μια κάρτα μπίνγκο γεμάτη απαντήσεις<br>📺 Η μεγάλη οθόνη λέει μια ερώτηση — αν η απάντηση είναι στην κάρτα σου, πάτα την!<br>✅ Σωστό πάτημα +10 (+5 αν πατήσεις γρήγορα) · 📏 γραμμή +50 · 🥇 πρώτο ΜΠΙΝΓΚΟ +50 ακόμα · 🌟 γεμάτη κάρτα +100<br>❌ Λάθος πάτημα: −5 πόντοι και κλειδώνεις για αυτή την ερώτηση — όχι στα τυχαία!',
      scan: '📱 Σκάναρε για να μπεις!', orLink: 'ή άνοιξε τον σύνδεσμο και γράψε τον κωδικό', waitingKids: 'Περιμένουμε παίκτες… 🎱', remove: 'Αφαίρεση',
      hTables: '✖️ Ποια προπαίδεια;', qAll: 'Όλες', qTricky: 'Δύσκολες: 6 7 8 9 12', qEasy: 'Εύκολες: 2 5 10',
      hTypes: '🧮 Είδη ερωτήσεων', opMul: '✖️ Πολλαπλασιασμός', opDiv: '➗ Διαίρεση', opMissing: '□ Ο αριθμός που λείπει',
      hCalls: '🎱 Πόσες ερωτήσεις;', hSecs: '⏱️ Δευτερόλεπτα για κάθε ερώτηση', secs: '{n}″',
      start: (p) => `🎱 Ξεκινά το μπίνγκο! (${pl(p.n, 'παίκτης', 'παίκτες')})`, waitingPlayers: '🎱 Περιμένουμε παίκτες…',
      newCode: '🔄 Νέος κωδικός', allGames: '🏠 Όλα τα παιχνίδια', newCodeQ: 'Νέος κωδικός παιχνιδιού; Όλοι θα πρέπει να σκανάρουν ξανά.', newCodeYes: 'Ναι, νέος κωδικός', cancel: 'Άκυρο',
      pickTable: 'Διάλεξε τουλάχιστον μία προπαίδεια!', pickType: 'Διάλεξε τουλάχιστον ένα είδος ερώτησης!',
      lateJoin: 'Ήρθες αργά; Κωδικός', soundOn: '🔊 Ήχος: ναι', soundOff: '🔇 Ήχος: όχι', fullScreen: '⛶ Πλήρης οθόνη', next: '⏭️ Επόμενη', end: '🏁 Τέλος παιχνιδιού',
      endQ: 'Να τελειώσει τώρα το παιχνίδι και να δούμε τους νικητές;',
      callN: 'Ερώτηση {n} από {total}', findIt: 'Βρες την απάντηση στην κάρτα σου! 👀', called: '📜 Οι ερωτήσεις μέχρι τώρα', final: '🏁 Τελικά αποτελέσματα',
      lb: '🏆 Κατάταξη', ptsShort: '{n} π.', linesShort: '📏 {n}',
      'ev.firstBingo': '🥇 ΜΠΙΝΓΚΟ! {who}: η πρώτη γραμμή!', 'ev.line': '📏 {who}: έκλεισε γραμμή!', 'ev.full': '🌟 ΓΕΜΑΤΗ ΚΑΡΤΑ! {who}: σημείωσε όλα τα τετράγωνα!', 'ev.winner': '👑 {who}: κερδίζει το μπίνγκο!',
      winnerT: '👑 Νίκη για: {name}! 👑', everyoneH: '🏅 Όλοι', points: (p) => pl(p.n, 'πόντος', 'πόντοι'), linesN: (p) => pl(p.n, 'γραμμή', 'γραμμές'),
      again: '🔁 Ξανά (με τους ίδιους παίκτες)',
      gameCode: 'Κωδικός παιχνιδιού (στη μεγάλη οθόνη)', name: 'Πώς σε λένε;', namePh: 'Το όνομά σου', pickAvatar: 'Διάλεξε φατσούλα', join: 'Μπαίνω στο μπίνγκο! 🎱',
      typeCode: 'Γράψε τον κωδικό από τη μεγάλη οθόνη.', typeName: 'Γράψε πρώτα το όνομά σου! ✏️', pickAv: 'Διάλεξε φατσούλα! 🦄',
      youreIn: 'Είσαι μέσα! 🎉', lookBig: 'Κοίτα τη μεγάλη οθόνη — το μπίνγκο ξεκινά σε λίγο!',
      playersN: (p) => `👫 ${pl(p.n, 'παίκτης', 'παίκτες')}`, summary: 'Προπαίδεια: {tables} · {calls} ερωτήσεις', all: 'όλες',
      tapAnswer: 'Πάτα την απάντηση αν είναι στην κάρτα σου!', good: '✅ +{n}!', fast: '⚡ γρήγορα!', gotLine: '📏 ΓΡΑΜΜΗ!', gotFirst: '🥇 ΜΠΙΝΓΚΟ!', gotFull: '🌟 ΓΕΜΑΤΗ ΚΑΡΤΑ!',
      wrongTap: '❌ Το {v} δεν είναι σωστό! −{n} · περίμενε την επόμενη ερώτηση', wrongTap0: '❌ Το {v} δεν είναι σωστό! · περίμενε την επόμενη ερώτηση', locked: '🔒 Περίμενε την επόμενη ερώτηση', answerWas: 'Η απάντηση ήταν: {fact}',
      statLine: (p) => `${pl(p.pts, 'πόντος', 'πόντοι')} · ${p.ord} θέση`,
      kingYou: '👑 Κέρδισες στο μπίνγκο!', cameRank: 'Τερμάτισες στην {ord} θέση!', markedOf: (p) => `✅ ${pl(p.m, 'τετράγωνο', 'τετράγωνα')} · 📏 ${pl(p.l, 'γραμμή', 'γραμμές')}`,
      practise: '🧠 Αυτές σου ξέφυγαν', perfect: '🎉 Δεν σου ξέφυγε καμία!',
      'err.full': 'Το παιχνίδι είναι γεμάτο.', 'err.name': 'Γράψε το όνομά σου.', 'err.nameTaken': 'Κάποιος έχει ήδη αυτό το όνομα — πρόσθεσε ένα γράμμα!',
      'err.settingsLocked': 'Οι ρυθμίσεις αλλάζουν πριν ξεκινήσει το παιχνίδι.', 'err.running': 'Το παιχνίδι έχει ήδη ξεκινήσει.', 'err.noPlayers': 'Περίμενε να μπει τουλάχιστον ένας παίκτης.',
      'err.rejoin': 'Μπες ξανά στο παιχνίδι.', 'err.notPlaying': 'Το παιχνίδι δεν είναι σε εξέλιξη.', 'err.notCalling': 'Περίμενε την επόμενη ερώτηση!', 'err.cell': 'Πάτα ένα τετράγωνο της κάρτας σου.',
      'err.already': 'Το έχεις ήδη σημειώσει! ✅', 'err.locked': 'Κλειδωμένο μέχρι την επόμενη ερώτηση 🔒', 'err.nothost': 'Δεν είσαι ο οικοδεσπότης.', 'err.nogame': 'Δεν υπάρχει παιχνίδι με αυτόν τον κωδικό. Κοίτα στη μεγάλη οθόνη!',
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
