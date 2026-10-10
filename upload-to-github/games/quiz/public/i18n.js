// Every word Maths Superstars shows, in English and Greek. Strings use {placeholders}; functions get the params.
(function (root) {
  const L = {
    en: {
      title: 'Maths <span>Superstars</span> 🌟', titlePlain: 'Maths Superstars', bigScreen: 'Big Screen', player: 'Player',
      tagline: 'The times tables quiz show! Answer fast, collect points, become the Superstar! ✖️➗',
      subtitle: 'The times tables quiz show!',
      scan: '📱 Scan to join!', orLink: 'or open the link and type the code', waitingKids: 'Waiting for superstars to join… ✨', remove: 'Remove',
      hTables: '✖️ Which times tables?', qAll: 'All', qTricky: 'Tricky: 6 7 8 9 12', qEasy: 'Starter: 2 5 10',
      hTypes: '🧮 Question types', opMul: '✖️ Multiply', opDiv: '➗ Divide', opMissing: '□ Missing number', opBig: '💯 × ÷ 10, 100, 1000',
      hMode: '📱 How to answer', modeChoices: '🍓 Pick from 4', modeType: '⌨️ Type the answer',
      hCount: '❓ How many questions?', hTime: '⏱️ Seconds per question', language: 'Language',
      start: (p) => `🚀 Start the quiz! (${p.n} player${p.n > 1 ? 's' : ''})`, waitingPlayers: '🚀 Waiting for players…',
      newCode: '🔄 New game code', allGames: '🏠 All games', newCodeQ: 'Make a new game code? Everyone will need to scan again.', newCodeYes: 'Yes, new code', cancel: 'Cancel',
      pickTable: 'Pick at least one times table!', pickType: 'Pick at least one question type!',
      lateJoin: 'Join late? Code', soundOn: '🔊 Sound on', soundOff: '🔇 Sound off', fullScreen: '⛶ Full screen', next: '⏭️ Next', end: '🏁 End quiz',
      endQ: 'End the quiz now and show the winners?',
      qnum: 'Question {n} of {total}', final: '🏁 Final results', getReady: 'Get ready! Question 1 of {total} 🚀',
      typeOnPhone: '⌨️ Type your answer on your phone!', answeredCount: '✋ {n} of {total} answered', timeUp: "Time's up!", secs: '{n}s',
      everyone: '🎉 Everyone got it! Amazing!', someGot: '🎉 {n} of {total} got it right!', nobody: '😮 Tricky one! Nobody got it this time.',
      leaderboard: '⭐ Leaderboard ⭐', nextQ: 'Next: question {n} of {total}',
      superstar: '🌟 Our Maths Superstar is… {name}! 🌟', pts: '{n} pts', everyoneH: '🏅 Everyone', trickyH: '🧠 Tricky ones to practise',
      gotIt: '{r} of {t} got it', allRight: 'Everyone got everything right! 🎉', again: '🔁 Play again (same players)',
      gameCode: 'Game code (on the big screen)', name: "What's your name?", namePh: 'Your name', pickAvatar: 'Pick your avatar', join: 'Join the show! 🎤',
      typeCode: 'Type the game code from the big screen.', typeName: 'Type your name first! ✏️', pickAv: 'Pick an avatar! 🦄',
      place: '{ord} place', youreIn: "You're in! 🎉", lookBig: 'Look at the big screen — the quiz starts soon!',
      playersN: (p) => `👫 ${p.n} player${p.n > 1 ? 's' : ''}`, summary: 'Tables: {tables} · {count} questions · {time}s each', all: 'all',
      willType: '⌨️ You will type your answers', willPick: '🍓 You will pick from 4 answers', getReadyPh: 'Get ready! 🚀',
      locked: 'Locked in!', youSaid: 'You said <b>{v}</b>. ', waitingOthers: 'Waiting for the others…', typeAnswer: 'Type your answer', typeFirst: 'Type a number first!',
      correct: 'Correct!', streakBonus: '🔥 {n} in a row! +{b} bonus', notQuite: 'Not quite!', quicker: 'Be quicker next time!',
      youSaidNext: "You said {v}. You'll get the next one!", youreRank: "You're {ord}!", points: '{n} points',
      lead: 'You are in the lead! Keep going!', catchUp: 'Next question coming… you can catch up!',
      superstarYou: "You're the Maths Superstar!", cameRank: 'You came {ord}!', rightOf: '✅ {c} of {t} right', bestStreak: ' · 🔥 best streak {n}',
      practise: '🧠 Practise these', perfect: '🎉 Perfect score!', noAnswer: 'no answer', youSaidShort: 'you said {v}', allCorrect: 'You got every single one right. Amazing! 🌟',
      'err.full': 'The game is full.', 'err.name': 'Please type your name.', 'err.nameTaken': 'Someone already has that name — add a letter!',
      'err.settingsLocked': 'Change settings before starting.', 'err.running': 'Already running.', 'err.noPlayers': 'Wait for at least one player to join.',
      'err.rejoin': 'Please join again.', 'err.late': 'Too late!', 'err.answered': 'You already answered.', 'err.noSkip': 'Nothing to skip.',
      'err.nothost': 'Not the host.', 'err.nogame': 'No game with that code. Check the big screen!',
    },
    el: {
      title: 'Αστέρια των <span>Μαθηματικών</span> 🌟', titlePlain: 'Αστέρια των Μαθηματικών', bigScreen: 'Μεγάλη Οθόνη', player: 'Παίκτης',
      tagline: 'Το κουίζ της προπαίδειας! Απάντα γρήγορα, μάζεψε πόντους, γίνε το Αστέρι! ✖️➗',
      subtitle: 'Το κουίζ της προπαίδειας!',
      scan: '📱 Σκάναρε για να μπεις!', orLink: 'ή άνοιξε τον σύνδεσμο και γράψε τον κωδικό', waitingKids: 'Περιμένουμε τα αστέρια να μπουν… ✨', remove: 'Αφαίρεση',
      hTables: '✖️ Ποια προπαίδεια;', qAll: 'Όλες', qTricky: 'Δύσκολες: 6 7 8 9 12', qEasy: 'Εύκολες: 2 5 10',
      hTypes: '🧮 Είδη ερωτήσεων', opMul: '✖️ Πολλαπλασιασμός', opDiv: '➗ Διαίρεση', opMissing: '□ Ο αριθμός που λείπει', opBig: '💯 × ÷ με 10, 100, 1.000',
      hMode: '📱 Πώς απαντάμε', modeChoices: '🍓 Επιλογή από 4', modeType: '⌨️ Γράφω την απάντηση',
      hCount: '❓ Πόσες ερωτήσεις;', hTime: '⏱️ Δευτερόλεπτα για κάθε ερώτηση', language: 'Γλώσσα',
      start: (p) => `🚀 Ξεκινάμε το κουίζ! (${p.n} ${p.n > 1 ? 'παίκτες' : 'παίκτης'})`, waitingPlayers: '🚀 Περιμένουμε παίκτες…',
      newCode: '🔄 Νέος κωδικός', allGames: '🏠 Όλα τα παιχνίδια', newCodeQ: 'Νέος κωδικός παιχνιδιού; Όλοι θα πρέπει να σκανάρουν ξανά.', newCodeYes: 'Ναι, νέος κωδικός', cancel: 'Άκυρο',
      pickTable: 'Διάλεξε τουλάχιστον μία προπαίδεια!', pickType: 'Διάλεξε τουλάχιστον ένα είδος ερώτησης!',
      lateJoin: 'Ήρθες αργά; Κωδικός', soundOn: '🔊 Ήχος: ναι', soundOff: '🔇 Ήχος: όχι', fullScreen: '⛶ Πλήρης οθόνη', next: '⏭️ Επόμενο', end: '🏁 Τέλος κουίζ',
      endQ: 'Να τελειώσει τώρα το κουίζ και να δούμε τους νικητές;',
      qnum: 'Ερώτηση {n} από {total}', final: '🏁 Τελικά αποτελέσματα', getReady: 'Ετοιμαστείτε! Ερώτηση 1 από {total} 🚀',
      typeOnPhone: '⌨️ Γράψε την απάντηση στο κινητό σου!', answeredCount: '✋ Απάντησαν {n} από {total}', timeUp: 'Τέλος χρόνου!', secs: '{n}″',
      everyone: '🎉 Το βρήκαν όλοι! Τέλεια!', someGot: '🎉 Το βρήκαν {n} από {total}!', nobody: '😮 Δύσκολη! Δεν το βρήκε κανείς αυτή τη φορά.',
      leaderboard: '⭐ Κατάταξη ⭐', nextQ: 'Επόμενη: ερώτηση {n} από {total}',
      superstar: '🌟 Το Αστέρι των Μαθηματικών είναι… {name}! 🌟', pts: '{n} πόντοι', everyoneH: '🏅 Όλοι', trickyH: '🧠 Δύσκολες για εξάσκηση',
      gotIt: 'σωστά: {r} από {t}', allRight: 'Όλοι τα βρήκαν όλα σωστά! 🎉', again: '🔁 Ξανά (με τους ίδιους παίκτες)',
      gameCode: 'Κωδικός παιχνιδιού (στη μεγάλη οθόνη)', name: 'Πώς σε λένε;', namePh: 'Το όνομά σου', pickAvatar: 'Διάλεξε φατσούλα', join: 'Μπαίνω στο κουίζ! 🎤',
      typeCode: 'Γράψε τον κωδικό από τη μεγάλη οθόνη.', typeName: 'Γράψε πρώτα το όνομά σου! ✏️', pickAv: 'Διάλεξε φατσούλα! 🦄',
      place: '{ord} θέση', youreIn: 'Είσαι μέσα! 🎉', lookBig: 'Κοίτα τη μεγάλη οθόνη — το κουίζ ξεκινά σε λίγο!',
      playersN: (p) => `👫 ${p.n} ${p.n > 1 ? 'παίκτες' : 'παίκτης'}`, summary: 'Προπαίδεια: {tables} · {count} ερωτήσεις · {time} δευτ. η καθεμία', all: 'όλες',
      willType: '⌨️ Θα γράφεις τις απαντήσεις', willPick: '🍓 Θα διαλέγεις από 4 απαντήσεις', getReadyPh: 'Ετοιμάσου! 🚀',
      locked: 'Η απάντηση κλείδωσε!', youSaid: 'Απάντησες <b>{v}</b>. ', waitingOthers: 'Περιμένουμε τους άλλους…', typeAnswer: 'Γράψε την απάντηση', typeFirst: 'Γράψε πρώτα έναν αριθμό!',
      correct: 'Σωστό!', streakBonus: '🔥 {n} στη σειρά! +{b} μπόνους', notQuite: 'Όχι ακριβώς!', quicker: 'Πιο γρήγορα την επόμενη φορά!',
      youSaidNext: 'Απάντησες {v}. Την επόμενη θα τη βρεις!', youreRank: '{ord} θέση!', points: '{n} πόντοι',
      lead: 'Είσαι στην πρώτη θέση! Συνέχισε έτσι!', catchUp: 'Έρχεται η επόμενη ερώτηση… μπορείς να ανέβεις!',
      superstarYou: 'Είσαι το Αστέρι των Μαθηματικών!', cameRank: 'Τερμάτισες στην {ord} θέση!', rightOf: '✅ Σωστές: {c} από {t}', bestStreak: ' · 🔥 καλύτερο σερί: {n}',
      practise: '🧠 Κάνε εξάσκηση σε αυτές', perfect: '🎉 Τέλειο σκορ!', noAnswer: 'χωρίς απάντηση', youSaidShort: 'απάντησες {v}', allCorrect: 'Τις βρήκες όλες σωστές. Καταπληκτικό! 🌟',
      'err.full': 'Το παιχνίδι είναι γεμάτο.', 'err.name': 'Γράψε το όνομά σου.', 'err.nameTaken': 'Κάποιος έχει ήδη αυτό το όνομα — πρόσθεσε ένα γράμμα!',
      'err.settingsLocked': 'Οι ρυθμίσεις αλλάζουν πριν ξεκινήσει το κουίζ.', 'err.running': 'Το κουίζ έχει ήδη ξεκινήσει.', 'err.noPlayers': 'Περίμενε να μπει τουλάχιστον ένας παίκτης.',
      'err.rejoin': 'Μπες ξανά στο παιχνίδι.', 'err.late': 'Πολύ αργά!', 'err.answered': 'Έχεις ήδη απαντήσει.', 'err.noSkip': 'Δεν υπάρχει κάτι να προσπεράσουμε.',
      'err.nothost': 'Δεν είσαι ο οικοδεσπότης.', 'err.nogame': 'Δεν υπάρχει παιχνίδι με αυτόν τον κωδικό. Κοίτα στη μεγάλη οθόνη!',
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
