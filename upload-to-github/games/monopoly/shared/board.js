// Board data shared by the server and the browser.
// Layout, prices and rents follow the official US Monopoly board; names are Greek places.
(function (root) {
  const GROUPS = {
    brown:  { name: 'Olive Groves',  color: '#c58b5c' },
    light:  { name: 'Mountain Towns', color: '#67c7f0' },
    pink:   { name: 'Castle Towns',  color: '#f472b6' },
    orange: { name: 'Ancient Wonders', color: '#fb923c' },
    red:    { name: 'Big Islands',   color: '#f43f5e' },
    yellow: { name: 'Cyclades',      color: '#facc15' },
    green:  { name: 'City Life',     color: '#34d399' },
    blue:   { name: 'Superstars',    color: '#7c6cf2' },
  };

  const S = (name, group, price, rent, house, emoji) => ({ type: 'street', name, group, price, rent, house, emoji });
  const R = (name) => ({ type: 'rail', name, price: 200, emoji: '⛴️' });
  const U = (name, emoji) => ({ type: 'util', name, price: 150, emoji });

  const SPACES = [
    { type: 'go', name: 'GO! Yassou!', emoji: '🌞' },
    S('Kalamata', 'brown', 60, [2, 10, 30, 90, 160, 250], 50, '🫒'),
    { type: 'chest', name: 'Treasure Amphora', emoji: '🏺' },
    S('Larissa', 'brown', 60, [4, 20, 60, 180, 320, 450], 50, '🌾'),
    { type: 'tax', name: 'Olive Oil Tax', amount: 200, emoji: '🫙' },
    R('Piraeus Ferry'),
    S('Ioannina', 'light', 100, [6, 30, 90, 270, 400, 550], 50, '🏞️'),
    { type: 'chance', name: 'Oracle of Delphi', emoji: '🔮' },
    S('Volos', 'light', 100, [6, 30, 90, 270, 400, 550], 50, '⛰️'),
    S('Patras', 'light', 120, [8, 40, 100, 300, 450, 600], 50, '🎭'),
    { type: 'jail', name: "Minotaur's Maze", emoji: '🐂' },
    S('Nafplio', 'pink', 140, [10, 50, 150, 450, 625, 750], 100, '🏰'),
    U("Zeus's Lightning", '⚡'),
    S('Corfu', 'pink', 140, [10, 50, 150, 450, 625, 750], 100, '🌺'),
    S('Rhodes', 'pink', 160, [12, 60, 180, 500, 700, 900], 100, '🦌'),
    R('Rafina Ferry'),
    S('Meteora', 'orange', 180, [14, 70, 200, 550, 750, 950], 100, '🪨'),
    { type: 'chest', name: 'Treasure Amphora', emoji: '🏺' },
    S('Delphi', 'orange', 180, [14, 70, 200, 550, 750, 950], 100, '🏛️'),
    S('Olympia', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100, '🏅'),
    { type: 'parking', name: 'Beach Day', emoji: '🏖️' },
    S('Chania', 'red', 220, [18, 90, 250, 700, 875, 1050], 150, '⛵'),
    { type: 'chance', name: 'Oracle of Delphi', emoji: '🔮' },
    S('Zakynthos', 'red', 220, [18, 90, 250, 700, 875, 1050], 150, '🐢'),
    S('Naxos', 'red', 240, [20, 100, 300, 750, 925, 1100], 150, '🚪'),
    R('Heraklion Ferry'),
    S('Paros', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150, '🐚'),
    S('Milos', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150, '🗿'),
    U("Poseidon's Fountain", '🔱'),
    S('Mykonos', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150, '🌬️'),
    { type: 'gotojail', name: 'Into the Maze!', emoji: '🌀' },
    S('Thessaloniki', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200, '🗼'),
    S('Plaka', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200, '🏘️'),
    { type: 'chest', name: 'Treasure Amphora', emoji: '🏺' },
    S('Monastiraki', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200, '🛍️'),
    R('Lavrio Ferry'),
    { type: 'chance', name: 'Oracle of Delphi', emoji: '🔮' },
    S('Santorini', 'blue', 350, [35, 175, 500, 1100, 1300, 1500], 200, '🌅'),
    { type: 'tax', name: 'Jewelry Tax', amount: 100, emoji: '💎' },
    S('The Acropolis', 'blue', 400, [50, 200, 600, 1400, 1700, 2000], 200, '🏛️'),
  ];

  // Official card effects, retold with Greek flavour.
  const CHANCE = [
    { text: 'Take a trip to The Acropolis!', act: 'move', to: 39 },
    { text: 'Advance to GO! Collect €200.', act: 'move', to: 0 },
    { text: 'Advance to Naxos. If you pass GO, collect €200.', act: 'move', to: 24 },
    { text: 'Advance to Nafplio. If you pass GO, collect €200.', act: 'move', to: 11 },
    { text: 'Sail to the nearest Ferry! If someone owns it, pay them double rent. If not, you may buy it.', act: 'nearest', kind: 'rail' },
    { text: 'Sail to the nearest Ferry! If someone owns it, pay them double rent. If not, you may buy it.', act: 'nearest', kind: 'rail' },
    { text: 'Go to the nearest Zeus or Poseidon spot! If owned, roll the dice and pay 10× the roll.', act: 'nearest', kind: 'util' },
    { text: 'The olive harvest was great! Collect €50.', act: 'money', amount: 50 },
    { text: 'Ariadne gives you her magic thread: Escape the Maze for free! Keep this card.', act: 'jailcard' },
    { text: 'Oops, you forgot your sun hat! Go back 3 spaces.', act: 'back3' },
    { text: 'The Minotaur caught you! Go straight to the Maze. Do not pass GO.', act: 'gotojail' },
    { text: 'Time to paint your houses white & blue! Pay €25 for each house and €100 for each hotel.', act: 'repairs', house: 25, hotel: 100 },
    { text: 'Your donkey ride was too fast! Pay a €15 fine.', act: 'money', amount: -15 },
    { text: 'Hop on the Piraeus Ferry. If you pass GO, collect €200.', act: 'move', to: 5 },
    { text: 'You were chosen as Festival Queen! Pay every player €50 for the party.', act: 'each', amount: -50 },
    { text: 'Your loukoumades shop is a hit! Collect €150.', act: 'money', amount: 150 },
  ];

  const CHEST = [
    { text: 'Advance to GO! Collect €200.', act: 'move', to: 0 },
    { text: 'The bank made a mistake in your favour! Collect €200.', act: 'money', amount: 200 },
    { text: 'Visit to the doctor. Pay €50.', act: 'money', amount: -50 },
    { text: 'You sold your seashell collection! Collect €50.', act: 'money', amount: 50 },
    { text: 'Hermes delivers a magic key: Escape the Maze for free! Keep this card.', act: 'jailcard' },
    { text: 'The Minotaur caught you! Go straight to the Maze. Do not pass GO.', act: 'gotojail' },
    { text: 'Your holiday piggy bank is full! Collect €100.', act: 'money', amount: 100 },
    { text: 'Tax refund! Collect €20.', act: 'money', amount: 20 },
    { text: "It's your Name Day! Collect €10 from every player.", act: 'each', amount: 10 },
    { text: 'Grandma Yiayia sends you a present! Collect €100.', act: 'money', amount: 100 },
    { text: 'Your cat ate too much feta. Pay the vet €100.', act: 'money', amount: -100 },
    { text: 'Dance school fees. Pay €50.', act: 'money', amount: -50 },
    { text: 'You helped bake spanakopita! Collect €25.', act: 'money', amount: 25 },
    { text: 'The streets need fixing. Pay €40 per house and €115 per hotel.', act: 'repairs', house: 40, hotel: 115 },
    { text: 'You won 2nd prize in the sandcastle contest! Collect €10.', act: 'money', amount: 10 },
    { text: 'You found a treasure in an old amphora! Collect €100.', act: 'money', amount: 100 },
  ];

  const TOKENS = [
    { id: 'owl', emoji: '🦉', name: 'Athena Owl', nameEl: 'Κουκουβάγια', color: '#8b5cf6' },
    { id: 'dolphin', emoji: '🐬', name: 'Dolphin', nameEl: 'Δελφίνι', color: '#0ea5e9' },
    { id: 'cat', emoji: '🐱', name: 'Island Cat', nameEl: 'Γατούλα', color: '#f97316' },
    { id: 'unicorn', emoji: '🦄', name: 'Pegasus', nameEl: 'Πήγασος', color: '#ec4899' },
    { id: 'butterfly', emoji: '🦋', name: 'Butterfly', nameEl: 'Πεταλούδα', color: '#3b82f6' },
    { id: 'turtle', emoji: '🐢', name: 'Sea Turtle', nameEl: 'Χελώνα', color: '#10b981' },
    { id: 'flower', emoji: '🌸', name: 'Flower', nameEl: 'Λουλούδι', color: '#e11d48' },
    { id: 'star', emoji: '⭐', name: 'Star', nameEl: 'Αστέρι', color: '#eab308' },
  ];

  // ---------- Themes: same board & rules, different names, words and cards ----------
  const THEMES = {
    greece: {
      id: 'greece', title: 'Greekopoly', icon: '🇬🇷', cur: '€',
      tagline: 'A sunny Monopoly adventure around Greece 🇬🇷 🌊 🏛️',
      boardTag: '🌸 Buy islands, build little white houses, become Queen of Greece! 🌸',
      crown: 'Queen of Greece',
      jail: "the Minotaur's Maze", jailShort: 'the Maze', escapeNames: 'escape cards', jailIco: '🐂', gotoIco: '🌀',
      escapeIco: '🧵', escapeName: 'escape card',
      parkingIco: '🏖️', parkingName: 'Beach Day', parkingMsg: 'relaxes on the beach',
      chanceIco: '🔮', chanceName: 'Oracle of Delphi', chanceShort: 'the Oracle',
      chestIco: '🏺', chestName: 'Treasure Amphora',
      payEach: 'the party', collectEach: 'a Name Day present', goIco: '🌞',
      rail: 'Ferry', rails: 'Ferries', util: 'Magic Power', utils: 'Magic Powers',
      deco: ['⛵', '🏝️', '🐬', '🐬', '🏛️', '☁️'],
      el: {
        title: 'Ελλαδόπολη', tagline: 'Μια ηλιόλουστη περιπέτεια Μονόπολης στην Ελλάδα 🇬🇷 🌊 🏛️',
        boardTag: '🌸 Αγόρασε νησιά, χτίσε ασπρόσπιτα, γίνε η Βασίλισσα της Ελλάδας! 🌸',
        crown: 'η Βασίλισσα της Ελλάδας', cur: '€',
        jail: 'Λαβύρινθος του Μινώταυρου', jailTo: 'στον Λαβύρινθο του Μινώταυρου', jailIn: 'στον Λαβύρινθο', jailFrom: 'από τον Λαβύρινθο',
        escapeName: 'κάρτα απόδρασης', escapeNames: 'κάρτες απόδρασης',
        parkingName: 'Μέρα στην Παραλία', parkingMsg: 'χαλαρώνει στην παραλία',
        chanceName: 'Μαντείο των Δελφών', chestName: 'Αμφορέας του Θησαυρού',
        payEach: 'το πάρτι', collectEach: 'δώρο γιορτής',
        rail: 'Πλοίο', rails: 'Πλοία', util: 'Μαγική Δύναμη', utils: 'Μαγικές Δυνάμεις',
        groups: { brown: 'Ελαιώνες', light: 'Ορεινές Πόλεις', pink: 'Πόλεις με Κάστρα', orange: 'Αρχαία Θαύματα', red: 'Μεγάλα Νησιά', yellow: 'Κυκλάδες', green: 'Ζωή στην Πόλη', blue: 'Σούπερ Σταρ' },
        names: ['ΑΦΕΤΗΡΙΑ! Γεια σου!', 'Καλαμάτα', 'Αμφορέας του Θησαυρού', 'Λάρισα', 'Φόρος Ελαιολάδου', 'Πλοίο Πειραιά', 'Ιωάννινα', 'Μαντείο των Δελφών', 'Βόλος', 'Πάτρα',
          'Λαβύρινθος του Μινώταυρου', 'Ναύπλιο', 'Κεραυνός του Δία', 'Κέρκυρα', 'Ρόδος', 'Πλοίο Ραφήνας', 'Μετέωρα', 'Αμφορέας του Θησαυρού', 'Δελφοί', 'Ολυμπία',
          'Μέρα στην Παραλία', 'Χανιά', 'Μαντείο των Δελφών', 'Ζάκυνθος', 'Νάξος', 'Πλοίο Ηρακλείου', 'Πάρος', 'Μήλος', 'Σιντριβάνι του Ποσειδώνα', 'Μύκονος',
          'Στον Λαβύρινθο!', 'Θεσσαλονίκη', 'Πλάκα', 'Αμφορέας του Θησαυρού', 'Μοναστηράκι', 'Πλοίο Λαυρίου', 'Μαντείο των Δελφών', 'Σαντορίνη', 'Φόρος Κοσμημάτων', 'Ακρόπολη'],
        chance: [
          'Ταξίδι στην Ακρόπολη!',
          'Πήγαινε στην ΑΦΕΤΗΡΙΑ! Πάρε 200 €.',
          'Πήγαινε στη Νάξο. Αν περάσεις από την ΑΦΕΤΗΡΙΑ, πάρε 200 €.',
          'Πήγαινε στο Ναύπλιο. Αν περάσεις από την ΑΦΕΤΗΡΙΑ, πάρε 200 €.',
          'Ταξίδεψε με το πιο κοντινό Πλοίο! Αν έχει ιδιοκτήτη, πλήρωσε διπλό ενοίκιο. Αν όχι, μπορείς να το αγοράσεις.',
          'Ταξίδεψε με το πιο κοντινό Πλοίο! Αν έχει ιδιοκτήτη, πλήρωσε διπλό ενοίκιο. Αν όχι, μπορείς να το αγοράσεις.',
          'Πήγαινε στον πιο κοντινό Δία ή Ποσειδώνα! Αν έχει ιδιοκτήτη, ρίξε τα ζάρια και πλήρωσε 10 φορές τη ζαριά.',
          'Η σοδειά της ελιάς ήταν τέλεια! Πάρε 50 €.',
          'Η Αριάδνη σού δίνει τον μαγικό της μίτο: βγες από τον Λαβύρινθο δωρεάν! Κράτα αυτή την κάρτα.',
          'Ουπς, ξέχασες το καπέλο σου! Πήγαινε 3 θέσεις πίσω.',
          'Σε έπιασε ο Μινώταυρος! Πήγαινε κατευθείαν στον Λαβύρινθο. Μην περάσεις από την ΑΦΕΤΗΡΙΑ.',
          'Βάψε τα σπίτια σου άσπρα και μπλε! Πλήρωσε 25 € για κάθε σπίτι και 100 € για κάθε ξενοδοχείο.',
          'Το γαϊδουράκι σου έτρεξε πολύ γρήγορα! Πλήρωσε πρόστιμο 15 €.',
          'Πάρε το Πλοίο του Πειραιά. Αν περάσεις από την ΑΦΕΤΗΡΙΑ, πάρε 200 €.',
          'Σε διάλεξαν Βασίλισσα της Γιορτής! Πλήρωσε 50 € σε κάθε παίκτη για το πάρτι.',
          'Το μαγαζί σου με λουκουμάδες έγινε ανάρπαστο! Πάρε 150 €.',
        ],
        chest: [
          'Πήγαινε στην ΑΦΕΤΗΡΙΑ! Πάρε 200 €.',
          'Η τράπεζα έκανε λάθος υπέρ σου! Πάρε 200 €.',
          'Επίσκεψη στον γιατρό. Πλήρωσε 50 €.',
          'Πούλησες τη συλλογή σου με κοχύλια! Πάρε 50 €.',
          'Ο Ερμής σού φέρνει ένα μαγικό κλειδί: βγες από τον Λαβύρινθο δωρεάν! Κράτα αυτή την κάρτα.',
          'Σε έπιασε ο Μινώταυρος! Πήγαινε κατευθείαν στον Λαβύρινθο. Μην περάσεις από την ΑΦΕΤΗΡΙΑ.',
          'Ο κουμπαράς των διακοπών γέμισε! Πάρε 100 €.',
          'Επιστροφή φόρου! Πάρε 20 €.',
          'Γιορτάζεις σήμερα! Πάρε 10 € από κάθε παίκτη.',
          'Η γιαγιά σού στέλνει δώρο! Πάρε 100 €.',
          'Η γάτα σου έφαγε πολλή φέτα. Πλήρωσε 100 € στον κτηνίατρο.',
          'Δίδακτρα για τη σχολή χορού. Πλήρωσε 50 €.',
          'Βοήθησες να φτιαχτεί σπανακόπιτα! Πάρε 25 €.',
          'Οι δρόμοι θέλουν φτιάξιμο. Πλήρωσε 40 € για κάθε σπίτι και 115 € για κάθε ξενοδοχείο.',
          'Κέρδισες το 2ο βραβείο στον διαγωνισμό για κάστρα στην άμμο! Πάρε 10 €.',
          'Βρήκες θησαυρό σε έναν παλιό αμφορέα! Πάρε 100 €.',
        ],
      },
    },
    world: {
      id: 'world', title: 'Worldopoly', icon: '🌍', cur: '$',
      tagline: 'Travel the world and collect countries! 🌍 ✈️ 🗺️',
      boardTag: '🌸 Visit countries, build houses everywhere, become Queen of the World! 🌸',
      crown: 'Queen of the World',
      jail: 'the Lost Passport Office', jailShort: 'the Passport Office', escapeNames: 'Golden Passports', jailIco: '🛂', gotoIco: '😱',
      escapeIco: '🎫', escapeName: 'Golden Passport',
      parkingIco: '🧺', parkingName: 'Picnic Park', parkingMsg: 'has a picnic in the park',
      chanceIco: '💌', chanceName: 'Mystery Postcard', chanceShort: 'the Postcard',
      chestIco: '🧳', chestName: 'Travel Suitcase',
      payEach: 'the world party', collectEach: 'a birthday present', goIco: '🌍',
      rail: 'Airline', rails: 'Airlines', util: 'Power Plant', utils: 'Power Plants',
      deco: ['✈️', '🌍', '🐋', '🎈', '🗽', '☁️'],
      el: {
        title: 'Κοσμόπολη', tagline: 'Ταξίδεψε στον κόσμο και μάζεψε χώρες! 🌍 ✈️ 🗺️',
        boardTag: '🌸 Επισκέψου χώρες, χτίσε σπίτια παντού, γίνε η Βασίλισσα του Κόσμου! 🌸',
        crown: 'η Βασίλισσα του Κόσμου', cur: '$',
        jail: 'Γραφείο Χαμένων Διαβατηρίων', jailTo: 'στο Γραφείο Χαμένων Διαβατηρίων', jailIn: 'στο Γραφείο Διαβατηρίων', jailFrom: 'από το Γραφείο Διαβατηρίων',
        escapeName: 'Χρυσό Διαβατήριο', escapeNames: 'Χρυσά Διαβατήρια',
        parkingName: 'Πικνίκ στο Πάρκο', parkingMsg: 'κάνει πικνίκ στο πάρκο',
        chanceName: 'Μυστηριώδης Κάρτα', chestName: 'Ταξιδιωτική Βαλίτσα',
        payEach: 'το παγκόσμιο πάρτι', collectEach: 'δώρο γενεθλίων',
        rail: 'Αεροπορική', rails: 'Αεροπορικές', util: 'Σταθμός Ενέργειας', utils: 'Σταθμοί Ενέργειας',
        groups: { brown: 'Αφρική', light: 'Αμερική', pink: 'Ασία', orange: 'Ευρώπη', red: 'Μεσόγειος', yellow: 'Μέση Ανατολή', green: 'Ωκεανία', blue: 'Κορώνα & Σφεντάμι' },
        names: ['ΑΦΕΤΗΡΙΑ! Γεια σου, Κόσμε!', 'Κένυα', 'Ταξιδιωτική Βαλίτσα', 'Αίγυπτος', 'Τέλος Διαβατηρίου', 'Αεροπορική Ουράνιο Τόξο', 'Μεξικό', 'Μυστηριώδης Κάρτα', 'Βραζιλία', 'ΗΠΑ',
          'Γραφείο Χαμένων Διαβατηρίων', 'Ινδία', 'Ηλιακή Ενέργεια', 'Κίνα', 'Ιαπωνία', 'Αεροπορική Μονόκερος', 'Ολλανδία', 'Ταξιδιωτική Βαλίτσα', 'Γερμανία', 'Γαλλία',
          'Πικνίκ στο Πάρκο', 'Ισπανία', 'Μυστηριώδης Κάρτα', 'Ιταλία', 'Ελλάδα', 'Αεροπορική Πεταλούδα', 'Ιορδανία', 'Παλαιστίνη', 'Αιολική Ενέργεια', 'Σαουδική Αραβία',
          'Έχασες το Διαβατήριο!', 'Φίτζι', 'Νέα Ζηλανδία', 'Ταξιδιωτική Βαλίτσα', 'Αυστραλία', 'Αεροπορική Πύραυλος', 'Μυστηριώδης Κάρτα', 'Καναδάς', 'Φόρος Σουβενίρ', 'Αγγλία'],
        chance: [
          'Πέτα στην Αγγλία για τσάι με τον Βασιλιά!',
          'Πήγαινε στην ΑΦΕΤΗΡΙΑ! Πάρε 200 $.',
          'Πήγαινε στην Ελλάδα. Αν περάσεις από την ΑΦΕΤΗΡΙΑ, πάρε 200 $.',
          'Πήγαινε στην Ινδία. Αν περάσεις από την ΑΦΕΤΗΡΙΑ, πάρε 200 $.',
          'Πέτα με την πιο κοντινή Αεροπορική! Αν έχει ιδιοκτήτη, πλήρωσε διπλό ενοίκιο. Αν όχι, μπορείς να την αγοράσεις.',
          'Πέτα με την πιο κοντινή Αεροπορική! Αν έχει ιδιοκτήτη, πλήρωσε διπλό ενοίκιο. Αν όχι, μπορείς να την αγοράσεις.',
          'Πήγαινε στην πιο κοντινή Ηλιακή ή Αιολική Ενέργεια! Αν έχει ιδιοκτήτη, ρίξε τα ζάρια και πλήρωσε 10 φορές τη ζαριά.',
          'Πούλησες τις φωτογραφίες από τα ταξίδια σου! Πάρε 50 $.',
          'Χρυσό Διαβατήριο: βγες από το Γραφείο Χαμένων Διαβατηρίων δωρεάν! Κράτα αυτή την κάρτα.',
          'Ουπς, ξέχασες τη βαλίτσα σου! Πήγαινε 3 θέσεις πίσω.',
          'Έχασες το διαβατήριό σου! Πήγαινε κατευθείαν στο Γραφείο Χαμένων Διαβατηρίων. Μην περάσεις από την ΑΦΕΤΗΡΙΑ.',
          'Τα σπίτια σου θέλουν φρέσκια μπογιά! Πλήρωσε 25 $ για κάθε σπίτι και 100 $ για κάθε ξενοδοχείο.',
          'Έχασες το λεωφορείο! Πλήρωσε 15 $ για ταξί.',
          'Ταξίδεψε με την Αεροπορική Ουράνιο Τόξο. Αν περάσεις από την ΑΦΕΤΗΡΙΑ, πάρε 200 $.',
          'Έκανες ένα παγκόσμιο πάρτι! Πλήρωσε 50 $ σε κάθε παίκτη.',
          'Η λεμονάδα σου έγινε διάσημη σε όλο τον κόσμο! Πάρε 150 $.',
        ],
        chest: [
          'Πήγαινε στην ΑΦΕΤΗΡΙΑ! Πάρε 200 $.',
          'Η τράπεζα έκανε λάθος υπέρ σου! Πάρε 200 $.',
          'Επίσκεψη σε ταξιδιωτικό γιατρό. Πλήρωσε 50 $.',
          'Πούλησες τη συλλογή σου με γραμματόσημα! Πάρε 50 $.',
          'Χρυσό Διαβατήριο: βγες από το Γραφείο Χαμένων Διαβατηρίων δωρεάν! Κράτα αυτή την κάρτα.',
          'Έχασες το διαβατήριό σου! Πήγαινε κατευθείαν στο Γραφείο Χαμένων Διαβατηρίων. Μην περάσεις από την ΑΦΕΤΗΡΙΑ.',
          'Ο κουμπαράς των διακοπών γέμισε! Πάρε 100 $.',
          'Επιστροφή φόρου! Πάρε 20 $.',
          'Έχεις γενέθλια! Πάρε 10 $ από κάθε παίκτη.',
          'Η γιαγιά σού στέλνει δώρο από το εξωτερικό! Πάρε 100 $.',
          'Το κουτάβι σου χρειάζεται διαβατήριο. Πλήρωσε 100 $.',
          'Δίδακτρα για μαθήματα ξένων γλωσσών. Πλήρωσε 50 $.',
          'Βοήθησες έναν χαμένο τουρίστα να βρει τον δρόμο! Πάρε 25 $.',
          'Οι δρόμοι θέλουν φτιάξιμο. Πλήρωσε 40 $ για κάθε σπίτι και 115 $ για κάθε ξενοδοχείο.',
          'Κέρδισες το 2ο βραβείο στον παγκόσμιο διαγωνισμό χορού! Πάρε 10 $.',
          'Βρήκες θησαυρό σε μια παλιά βαλίτσα! Πάρε 100 $.',
        ],
      },
      groups: {
        brown: 'Africa', light: 'The Americas', pink: 'Asia', orange: 'Europe',
        red: 'Mediterranean', yellow: 'Middle East', green: 'Down Under', blue: 'Royal & Maple',
      },
      names: [
        ['GO! Hello World!', '🌍'], ['Kenya', '🇰🇪'], ['Travel Suitcase', '🧳'], ['Egypt', '🇪🇬'], ['Passport Fee', '🛂'],
        ['Rainbow Airline', '🛫'], ['Mexico', '🇲🇽'], ['Mystery Postcard', '💌'], ['Brazil', '🇧🇷'], ['USA', '🇺🇸'],
        ['Lost Passport Office', '🛂'], ['India', '🇮🇳'], ['Solar Power', '☀️'], ['China', '🇨🇳'], ['Japan', '🇯🇵'],
        ['Unicorn Airline', '🛫'], ['Netherlands', '🇳🇱'], ['Travel Suitcase', '🧳'], ['Germany', '🇩🇪'], ['France', '🇫🇷'],
        ['Picnic Park', '🧺'], ['Spain', '🇪🇸'], ['Mystery Postcard', '💌'], ['Italy', '🇮🇹'], ['Greece', '🇬🇷'],
        ['Butterfly Airline', '🛫'], ['Jordan', '🇯🇴'], ['Palestine', '🇵🇸'], ['Wind Power', '🌬️'], ['Saudi Arabia', '🇸🇦'],
        ['Lost Your Passport!', '😱'], ['Fiji', '🇫🇯'], ['New Zealand', '🇳🇿'], ['Travel Suitcase', '🧳'], ['Australia', '🇦🇺'],
        ['Rocket Airline', '🛫'], ['Mystery Postcard', '💌'], ['Canada', '🇨🇦'], ['Souvenir Tax', '🛍️'], ['England', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'],
      ],
      chance: [
        'Fly to England for tea with the King!',
        'Advance to GO! Collect $200.',
        'Advance to Greece. If you pass GO, collect $200.',
        'Advance to India. If you pass GO, collect $200.',
        'Fly to the nearest Airline! If someone owns it, pay them double rent. If not, you may buy it.',
        'Fly to the nearest Airline! If someone owns it, pay them double rent. If not, you may buy it.',
        'Go to the nearest Solar or Wind Power! If owned, roll the dice and pay 10× the roll.',
        'You sold your travel photos! Collect $50.',
        'Golden Passport: get out of the Lost Passport Office for free! Keep this card.',
        'Oops, you forgot your suitcase! Go back 3 spaces.',
        'You lost your passport! Go straight to the Lost Passport Office. Do not pass GO.',
        'Your houses need fresh paint! Pay $25 for each house and $100 for each hotel.',
        'You missed the bus! Pay a $15 taxi fare.',
        'Take a trip on Rainbow Airline. If you pass GO, collect $200.',
        'You threw a world party! Pay every player $50.',
        'Your lemonade stand went global! Collect $150.',
      ],
      chest: [
        'Advance to GO! Collect $200.',
        'The bank made a mistake in your favour! Collect $200.',
        'Travel doctor visit. Pay $50.',
        'You sold your stamp collection! Collect $50.',
        'Golden Passport: get out of the Lost Passport Office for free! Keep this card.',
        'You lost your passport! Go straight to the Lost Passport Office. Do not pass GO.',
        'Your holiday piggy bank is full! Collect $100.',
        'Tax refund! Collect $20.',
        "It's your birthday! Collect $10 from every player.",
        'Grandma sends a present from abroad! Collect $100.',
        'Your puppy needs a passport. Pay $100.',
        'Language school fees. Pay $50.',
        'You helped a lost tourist find the way! Collect $25.',
        'The roads need fixing. Pay $40 per house and $115 per hotel.',
        'You won 2nd prize in the world dance contest! Collect $10.',
        'You found treasure in an old suitcase! Collect $100.',
      ],
    },
  };

  // Returns the board, groups and cards dressed in a theme. Prices and rules never change.
  function themed(id, lang) {
    const base = THEMES[id] || THEMES.greece;
    const tr = lang === 'el' ? base.el : null;
    const t = { ...base, ...(tr || {}), lang: tr ? 'el' : 'en' };
    const names = tr ? tr.names : base.names && base.names.map((n) => n[0]);
    const emojis = base.names ? base.names.map((n) => n[1]) : null;
    const spaces = SPACES.map((s, i) => ({ ...s, name: names ? names[i] : s.name, emoji: emojis ? emojis[i] : s.emoji }));
    const groups = {};
    for (const [k, g] of Object.entries(GROUPS)) groups[k] = { ...g, name: (t.groups && t.groups[k]) || g.name };
    const texts = (deck, base2) => (tr ? tr[deck] : base[deck]) || base2.map((c) => c.text);
    const chanceText = texts('chance', CHANCE), chestText = texts('chest', CHEST);
    const chance = CHANCE.map((c, i) => ({ ...c, text: chanceText[i] }));
    const chest = CHEST.map((c, i) => ({ ...c, text: chestText[i] }));
    return { T: t, SPACES: spaces, GROUPS: groups, CHANCE: chance, CHEST: chest };
  }

  // Money in the local style: €1,500 in English, 1.500 € in Greek.
  function money(T, n) {
    n = Math.round(Number(n) || 0);
    return T.lang === 'el' ? `${n.toLocaleString('el-GR')} ${T.cur}` : `${T.cur}${n.toLocaleString('en-GB')}`;
  }

  const api = { GROUPS, SPACES, CHANCE, CHEST, TOKENS, THEMES, themed, money, START_CASH: 1500, GO_SALARY: 200, JAIL_FINE: 50, JAIL_POS: 10 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BOARD = api;
})(typeof window !== 'undefined' ? window : globalThis);
