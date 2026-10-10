// Every word Treasure Island shows, in English and Greek. Strings use {placeholders}; functions get the params.
(function (root) {
  const L = {
    en: {
      title: 'Treasure <span>Island</span> 🏝️', titlePlain: 'Treasure Island', bigScreen: 'Big Screen', player: 'Player',
      tagline: 'Answer maths questions to earn gold 🪙, then claim the island! The biggest landowner wins! 🏴‍☠️',
      subtitle: 'Earn gold, claim the island!',
      rules: '🧮 Answer questions on your phone → earn 🪙 gold (fast answers and 🔥 streaks earn more)<br>🗺️ Spend gold on squares: plain 30 🪙 · ⭐ treasure spot 60 🪙 · steal 60 🪙<br>🛡️ New land is safe for 20 seconds · 🎁 some squares hide surprises!<br>🏆 When time runs out, the most land points wins (⭐ and 💎 = 3 points)',
      scan: '📱 Scan to join!', orLink: 'or open the link and type the code', waitingKids: 'Waiting for pirates to join… 🏴‍☠️', remove: 'Remove',
      hTables: '✖️ Which times tables?', qAll: 'All', qTricky: 'Tricky: 6 7 8 9 12', qEasy: 'Starter: 2 5 10',
      hTypes: '🧮 Question types', opMul: '✖️ Multiply', opDiv: '➗ Divide', opMissing: '□ Missing number', opBig: '💯 × ÷ 10, 100, 1000',
      hMode: '📱 How to answer', modeChoices: '🍓 Pick from 4', modeType: '⌨️ Type the answer',
      hTime: '⏱️ How long?', minutes: '{n} min', hSteal: '🏴‍☠️ Stealing land', stealOn: 'Allowed', stealOff: 'Off (gentle game)',
      start: (p) => `🚀 Start the adventure! (${p.n} player${p.n > 1 ? 's' : ''})`, waitingPlayers: '🚀 Waiting for players…',
      newCode: '🔄 New game code', allGames: '🏠 All games', newCodeQ: 'Make a new game code? Everyone will need to scan again.', newCodeYes: 'Yes, new code', cancel: 'Cancel',
      pickTable: 'Pick at least one times table!', pickType: 'Pick at least one question type!',
      lateJoin: 'Join late? Code', soundOn: '🔊 Sound on', soundOff: '🔇 Sound off', fullScreen: '⛶ Full screen', end: '🏁 End game',
      endQ: 'End the game now and show the winners?', timeUp: "Time's up!",
      lb: '🏆 Who owns the most?', ptsShort: '{n} pts', landShort: '{n} 🟫', legend: '⭐ / 💎 = 3 points · 🛡️ = protected · 🎁 = hidden surprises somewhere!',
      'ev.start': '🏝️ The race for the island begins!', 'ev.steal': '🏴‍☠️ {who} took a square from {from}!', 'ev.star': '⭐ {who} claimed a treasure spot!',
      'ev.coins': '🎁 {who} found {n} gold coins!', 'ev.gem': '💎 {who} found a gem!', 'ev.winner': '👑 {who} rules Treasure Island!',
      winnerT: '👑 {name} rules the island! 👑', everyoneH: '🏅 Everyone', points: (p) => `${p.n} point${p.n === 1 ? '' : 's'}`, squares: (p) => `${p.n} square${p.n === 1 ? '' : 's'}`, again: '🔁 Play again (same players)',
      gameCode: 'Game code (on the big screen)', name: "What's your name?", namePh: 'Your name', pickAvatar: 'Pick your pirate', join: 'Join the adventure! 🏴‍☠️',
      typeCode: 'Type the game code from the big screen.', typeName: 'Type your name first! ✏️', pickAv: 'Pick a pirate! 🦄',
      youreIn: "You're in! 🎉", lookBig: 'Look at the big screen — the adventure starts soon!',
      playersN: (p) => `👫 ${p.n} player${p.n > 1 ? 's' : ''}`, summary: 'Tables: {tables} · {min} minutes', all: 'all',
      tabEarn: '🧮 Earn gold', tabMap: '🗺️ Claim land',
      correctPlus: '✅ Correct! +{n} 🪙', fast: '⚡ fast!', wrongFact: '❌ Not quite: {fact}', typeAnswer: 'Type your answer', typeFirst: 'Type a number first!',
      tapTile: '👆 Tap a square on the map to claim it',
      claimFree: 'Claim it for {c} 🪙', claimStar: 'Claim the ⭐ treasure spot for {c} 🪙', claimSteal: 'Steal it from {who} for {c} 🪙',
      needMore: 'You need {n} more 🪙 — answer more questions!', shielded: 'Protected 🛡️ for {s} more seconds',
      yoursTile: 'This square is yours! 🎉', noStealTile: 'Stealing is off in this game.', claimed: '🚩 Claimed!',
      foundCoins: '🎁 Surprise! You found {n} gold coins!', foundGem: '💎 Surprise! You found a gem! This square is now worth 3 points!',
      statLine: (p) => `${p.land} square${p.land === 1 ? '' : 's'} · ${p.pts} point${p.pts === 1 ? '' : 's'} · ${p.ord} place`,
      kingYou: '👑 You rule Treasure Island!', cameRank: 'You came {ord}!', rightOf: '✅ {c} of {t} right', bestStreak: ' · 🔥 best streak {n}',
      practise: '🧠 Practise these', perfect: '🎉 No mistakes!', youSaidShort: 'you said {v}', allCorrect: 'You got every single one right. Amazing! 🌟',
      'err.full': 'The game is full.', 'err.name': 'Please type your name.', 'err.nameTaken': 'Someone already has that name — add a letter!',
      'err.settingsLocked': 'Change settings before starting.', 'err.running': 'Already running.', 'err.noPlayers': 'Wait for at least one player to join.',
      'err.rejoin': 'Please join again.', 'err.notPlaying': 'The game is not running.', 'err.water': 'That is the sea! 🌊',
      'err.yours': 'This square is already yours.', 'err.noSteal': 'Stealing is off in this game.', 'err.shield': 'This square is protected 🛡️ for a little longer.',
      'err.coins': 'Not enough gold yet — answer more questions!', 'err.nothost': 'Not the host.', 'err.nogame': 'No game with that code. Check the big screen!',
    },
    el: {
      title: 'Το Νησί του <span>Θησαυρού</span> 🏝️', titlePlain: 'Το Νησί του Θησαυρού', bigScreen: 'Μεγάλη Οθόνη', player: 'Παίκτης',
      tagline: 'Απάντα σε ερωτήσεις μαθηματικών, κέρδισε χρυσό 🪙 και κατέκτησε το νησί! Νικά όποιος έχει την περισσότερη γη! 🏴‍☠️',
      subtitle: 'Κέρδισε χρυσό, κατέκτησε το νησί!',
      rules: '🧮 Απάντα σε ερωτήσεις στο κινητό → κερδίζεις 🪙 χρυσό (οι γρήγορες απαντήσεις και τα 🔥 σερί δίνουν περισσότερο)<br>🗺️ Ξόδεψε χρυσό για τετράγωνα: απλό 30 🪙 · ⭐ θησαυρός 60 🪙 · κλέψιμο 60 🪙<br>🛡️ Η νέα γη είναι ασφαλής για 20 δευτερόλεπτα · 🎁 κάποια τετράγωνα κρύβουν εκπλήξεις!<br>🏆 Όταν τελειώσει ο χρόνος, νικά όποιος έχει τους περισσότερους πόντους γης (⭐ και 💎 = 3 πόντοι)',
      scan: '📱 Σκάναρε για να μπεις!', orLink: 'ή άνοιξε τον σύνδεσμο και γράψε τον κωδικό', waitingKids: 'Περιμένουμε τους πειρατές… 🏴‍☠️', remove: 'Αφαίρεση',
      hTables: '✖️ Ποια προπαίδεια;', qAll: 'Όλες', qTricky: 'Δύσκολες: 6 7 8 9 12', qEasy: 'Εύκολες: 2 5 10',
      hTypes: '🧮 Είδη ερωτήσεων', opMul: '✖️ Πολλαπλασιασμός', opDiv: '➗ Διαίρεση', opMissing: '□ Ο αριθμός που λείπει', opBig: '💯 × ÷ με 10, 100, 1.000',
      hMode: '📱 Πώς απαντάμε', modeChoices: '🍓 Επιλογή από 4', modeType: '⌨️ Γράφω την απάντηση',
      hTime: '⏱️ Πόση ώρα;', minutes: '{n} λεπτά', hSteal: '🏴‍☠️ Κλέψιμο γης', stealOn: 'Επιτρέπεται', stealOff: 'Όχι (ήπιο παιχνίδι)',
      start: (p) => `🚀 Ξεκινά η περιπέτεια! (${p.n} ${p.n > 1 ? 'παίκτες' : 'παίκτης'})`, waitingPlayers: '🚀 Περιμένουμε παίκτες…',
      newCode: '🔄 Νέος κωδικός', allGames: '🏠 Όλα τα παιχνίδια', newCodeQ: 'Νέος κωδικός παιχνιδιού; Όλοι θα πρέπει να σκανάρουν ξανά.', newCodeYes: 'Ναι, νέος κωδικός', cancel: 'Άκυρο',
      pickTable: 'Διάλεξε τουλάχιστον μία προπαίδεια!', pickType: 'Διάλεξε τουλάχιστον ένα είδος ερώτησης!',
      lateJoin: 'Ήρθες αργά; Κωδικός', soundOn: '🔊 Ήχος: ναι', soundOff: '🔇 Ήχος: όχι', fullScreen: '⛶ Πλήρης οθόνη', end: '🏁 Τέλος παιχνιδιού',
      endQ: 'Να τελειώσει τώρα το παιχνίδι και να δούμε τους νικητές;', timeUp: 'Τέλος χρόνου!',
      lb: '🏆 Ποιος έχει τα περισσότερα;', ptsShort: '{n} π.', landShort: '{n} 🟫', legend: '⭐ / 💎 = 3 πόντοι · 🛡️ = προστατεύεται · 🎁 = κρυμμένες εκπλήξεις κάπου!',
      'ev.start': '🏝️ Ξεκινά ο αγώνας για το νησί!', 'ev.steal': '🏴‍☠️ {who}: πήρε ένα τετράγωνο από {from}!', 'ev.star': '⭐ {who}: πήρε σημείο θησαυρού!',
      'ev.coins': '🎁 {who}: βρήκε {n} χρυσά νομίσματα!', 'ev.gem': '💎 {who}: βρήκε ένα διαμάντι!', 'ev.winner': '👑 {who}: βασιλεύει στο Νησί του Θησαυρού!',
      winnerT: '👑 {name}: βασιλεύει στο νησί! 👑', everyoneH: '🏅 Όλοι', points: (p) => `${p.n} ${p.n === 1 ? 'πόντος' : 'πόντοι'}`, squares: (p) => `${p.n} ${p.n === 1 ? 'τετράγωνο' : 'τετράγωνα'}`, again: '🔁 Ξανά (με τους ίδιους παίκτες)',
      gameCode: 'Κωδικός παιχνιδιού (στη μεγάλη οθόνη)', name: 'Πώς σε λένε;', namePh: 'Το όνομά σου', pickAvatar: 'Διάλεξε πειρατή', join: 'Μπαίνω στην περιπέτεια! 🏴‍☠️',
      typeCode: 'Γράψε τον κωδικό από τη μεγάλη οθόνη.', typeName: 'Γράψε πρώτα το όνομά σου! ✏️', pickAv: 'Διάλεξε πειρατή! 🦄',
      youreIn: 'Είσαι μέσα! 🎉', lookBig: 'Κοίτα τη μεγάλη οθόνη — η περιπέτεια ξεκινά σε λίγο!',
      playersN: (p) => `👫 ${p.n} ${p.n > 1 ? 'παίκτες' : 'παίκτης'}`, summary: 'Προπαίδεια: {tables} · {min} λεπτά', all: 'όλες',
      tabEarn: '🧮 Κέρδισε χρυσό', tabMap: '🗺️ Πάρε γη',
      correctPlus: '✅ Σωστό! +{n} 🪙', fast: '⚡ γρήγορα!', wrongFact: '❌ Όχι ακριβώς: {fact}', typeAnswer: 'Γράψε την απάντηση', typeFirst: 'Γράψε πρώτα έναν αριθμό!',
      tapTile: '👆 Πάτα ένα τετράγωνο στον χάρτη για να το πάρεις',
      claimFree: 'Πάρ’ το με {c} 🪙', claimStar: 'Πάρε το ⭐ σημείο θησαυρού με {c} 🪙', claimSteal: 'Κλέψ’ το από {who} με {c} 🪙',
      needMore: 'Χρειάζεσαι ακόμα {n} 🪙 — απάντα σε περισσότερες ερωτήσεις!', shielded: 'Προστατεύεται 🛡️ για ακόμα {s} δευτερόλεπτα',
      yoursTile: 'Αυτό το τετράγωνο είναι δικό σου! 🎉', noStealTile: 'Σε αυτό το παιχνίδι δεν επιτρέπεται το κλέψιμο.', claimed: '🚩 Δικό σου!',
      foundCoins: '🎁 Έκπληξη! Βρήκες {n} χρυσά νομίσματα!', foundGem: '💎 Έκπληξη! Βρήκες διαμάντι! Το τετράγωνο αξίζει τώρα 3 πόντους!',
      statLine: (p) => `${p.land} ${p.land === 1 ? 'τετράγωνο' : 'τετράγωνα'} · ${p.pts} ${p.pts === 1 ? 'πόντος' : 'πόντοι'} · ${p.ord} θέση`,
      kingYou: '👑 Βασιλεύεις στο Νησί του Θησαυρού!', cameRank: 'Τερμάτισες στην {ord} θέση!', rightOf: '✅ Σωστές: {c} από {t}', bestStreak: ' · 🔥 καλύτερο σερί: {n}',
      practise: '🧠 Κάνε εξάσκηση σε αυτές', perfect: '🎉 Κανένα λάθος!', youSaidShort: 'απάντησες {v}', allCorrect: 'Τις βρήκες όλες σωστές. Καταπληκτικό! 🌟',
      'err.full': 'Το παιχνίδι είναι γεμάτο.', 'err.name': 'Γράψε το όνομά σου.', 'err.nameTaken': 'Κάποιος έχει ήδη αυτό το όνομα — πρόσθεσε ένα γράμμα!',
      'err.settingsLocked': 'Οι ρυθμίσεις αλλάζουν πριν ξεκινήσει το παιχνίδι.', 'err.running': 'Το παιχνίδι έχει ήδη ξεκινήσει.', 'err.noPlayers': 'Περίμενε να μπει τουλάχιστον ένας παίκτης.',
      'err.rejoin': 'Μπες ξανά στο παιχνίδι.', 'err.notPlaying': 'Το παιχνίδι δεν είναι σε εξέλιξη.', 'err.water': 'Αυτό είναι θάλασσα! 🌊',
      'err.yours': 'Αυτό το τετράγωνο είναι ήδη δικό σου.', 'err.noSteal': 'Σε αυτό το παιχνίδι δεν επιτρέπεται το κλέψιμο.', 'err.shield': 'Αυτό το τετράγωνο προστατεύεται 🛡️ λίγο ακόμα.',
      'err.coins': 'Δεν έχεις αρκετό χρυσό ακόμα — απάντα σε περισσότερες ερωτήσεις!', 'err.nothost': 'Δεν είσαι ο οικοδεσπότης.', 'err.nogame': 'Δεν υπάρχει παιχνίδι με αυτόν τον κωδικό. Κοίτα στη μεγάλη οθόνη!',
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
