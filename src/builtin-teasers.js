// Built-in brain teasers
class BuiltinTeasers {
  constructor(teaserManager) {
    this.teaserManager = teaserManager;
    this.escapeHtml = AppUtils.escapeHtml;
  }

  renderBuiltinTeaser() {
    const teasers = [
      () => this.teaserMathRiddle(),
      () => this.teaserWordScramble(),
      () => this.teaserNumberSequence(),
      () => this.teaserPatternLogic(),
      () => this.teaserQuickRiddle(),
      () => this.teaserOddOneOut(),
      () => this.teaserAnalogy(),
      () => this.teaserAnagram(),
      () => this.teaserQuickMath(),
      () => this.teaserLateral(),
      () => this.teaserRiddle2(),
      () => this.teaserWordplay(),
      () => this.teaserLogicPuzzle(),
      () => this.teaserMathPuzzle(),
      () => this.teaserCodeBreak(),
      () => this.teaserVisualPattern(),
      () => this.teaserReversal(),
      () => this.teaserMissingLink(),
      () => this.teaserWordChain(),
      () => this.teaserTrivia()
    ];
    const pick = teasers[Math.floor(Math.random() * teasers.length)];
    pick();
  }

  teaserMathRiddle() {
    this.teaserManager.renderTeaser('Math Riddle', `<p>A farmer has 17 sheep, and all but 9 die. How many are left?</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim() === '9' ? 'Correct! ✅' : 'Try again ❌'; }, 
      { answer: '9' });
  }

  teaserWordScramble() {
    const words = ['galaxy', 'quantum', 'neuron', 'energy', 'rocket'];
    const original = words[Math.floor(Math.random() * words.length)];
    const scrambled = original.split('').sort(() => Math.random() - 0.5).join('');
    this.teaserManager.renderTeaser('Word Scramble', `<p>Unscramble: <strong>${scrambled}</strong></p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase() === original ? 'Correct! ✅' : 'Not quite ❌'; }, 
      { answer: original });
  }

  teaserNumberSequence() {
    const sequences = [
      { seq: [2, 3, 5, 8, 12, '?'], rule: 'add 1,2,3,4,...', answer: '17' },
      { seq: [1, 1, 2, 3, 5, 8, '?'], rule: 'Fibonacci', answer: '13' },
      { seq: [3, 6, 12, 24, '?'], rule: 'x2', answer: '48' }
    ];
    const pick = sequences[Math.floor(Math.random() * sequences.length)];
    this.teaserManager.renderTeaser('Number Sequence', `<p>Fill the next: ${pick.seq.join(', ')}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim() === pick.answer ? 'Correct! ✅' : `Hint: ${pick.rule}`; }, 
      { hint: `Think: ${pick.rule}`, answer: pick.answer });
  }

  teaserPatternLogic() {
    this.teaserManager.renderTeaser('Pattern Logic', `<p>Find the next: (A,1), (C,3), (E,5), (?)</p>`, 
      (i, r) => { const v = (i.value || '').trim().toUpperCase().replace(/\s+/g, ''); r.textContent = (v === 'G,7' || v === 'G7') ? 'Correct! ✅' : 'Try again ❌'; }, 
      { hint: 'Skip letters by 2; numbers +2', answer: 'G,7' });
  }

  teaserQuickRiddle() {
    this.teaserManager.renderTeaser('Quick Riddle', `<p>What has keys but can't open locks?</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase() === 'piano' ? 'Correct! ✅' : 'Try again ❌'; }, 
      { hint: 'It makes music', answer: 'piano' });
  }

  teaserOddOneOut() {
    this.teaserManager.renderTeaser('Odd One Out', `<p>Which is odd: Mercury, Venus, Pluto, Earth?</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase() === 'pluto' ? 'Correct! ✅' : 'Hint: Dwarf planet'; }, 
      { hint: 'Think classification', answer: 'Pluto' });
  }

  teaserAnalogy() {
    this.teaserManager.renderTeaser('Analogy', `<p>Hand is to glove as foot is to ____?</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase() === 'sock' ? 'Correct! ✅' : 'Try again ❌'; }, 
      { hint: 'Clothing', answer: 'sock' });
  }

  teaserAnagram() {
    this.teaserManager.renderTeaser('Anagram', `<p>Find an anagram of "LISTEN"</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase() === 'silent' ? 'Correct! ✅' : 'Not quite ❌'; }, 
      { hint: 'Starts with S', answer: 'silent' });
  }

  teaserQuickMath() {
    this.teaserManager.renderTeaser('Quick Math', `<p>What is 15% of 200?</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim() === '30' ? 'Correct! ✅' : 'Try again ❌'; }, 
      { hint: '10% + 5%', answer: '30' });
  }

  teaserLateral() {
    this.teaserManager.renderTeaser('Lateral Thinking', `<p>A man pushes his car to a hotel and loses his fortune. What happened?</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes('monopoly') ? 'Correct! ✅' : 'Think board games 🎲'; }, 
      { hint: 'Board game', answer: 'monopoly' });
  }

  teaserRiddle2() {
    const riddles = [
      { q: 'I speak without a mouth and hear without ears. I have no body but come alive with wind. What am I?', a: 'echo' },
      { q: 'The more you take, the more you leave behind. What am I?', a: 'footsteps' },
      { q: 'I have cities but no houses, forests but no trees, and water but no fish. What am I?', a: 'map' }
    ];
    const pick = riddles[Math.floor(Math.random() * riddles.length)];
    this.teaserManager.renderTeaser('Riddle', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes(pick.a) ? 'Correct! ✅' : 'Think carefully 🧠'; }, 
      { hint: 'Think outside the box', answer: pick.a });
  }

  teaserWordplay() {
    const puzzles = [
      { q: 'What word becomes shorter when you add two letters?', a: 'short' },
      { q: 'What has 4 eyes but cannot see?', a: 'mississippi' },
      { q: 'What starts with E, ends with E, but only contains one letter?', a: 'envelope' }
    ];
    const pick = puzzles[Math.floor(Math.random() * puzzles.length)];
    this.teaserManager.renderTeaser('Wordplay', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes(pick.a) ? 'Correct! ✅' : 'Play with words 🔤'; }, 
      { hint: 'Word trick', answer: pick.a });
  }

  teaserLogicPuzzle() {
    const puzzles = [
      { q: 'All roses are flowers. Some flowers fade quickly. Therefore, some roses fade quickly. True or False?', a: 'false' },
      { q: 'If all cats are mammals, and all mammals are animals, are all cats animals?', a: 'yes' },
      { q: 'A box contains 3 red balls and 2 blue balls. If you pick one at random, what color are you more likely to get?', a: 'red' }
    ];
    const pick = puzzles[Math.floor(Math.random() * puzzles.length)];
    this.teaserManager.renderTeaser('Logic Puzzle', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes(pick.a) ? 'Correct! ✅' : 'Apply logic 🧩'; }, 
      { hint: 'Use reasoning', answer: pick.a });
  }

  teaserMathPuzzle() {
    const puzzles = [
      { q: 'If a train travels 60 mph for 2.5 hours, how far does it go?', a: '150' },
      { q: 'What is the square root of 144?', a: '12' },
      { q: 'If 5x + 3 = 18, what is x?', a: '3' },
      { q: 'How many degrees are in a triangle?', a: '180' }
    ];
    const pick = puzzles[Math.floor(Math.random() * puzzles.length)];
    this.teaserManager.renderTeaser('Math Puzzle', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim() === pick.a ? 'Correct! ✅' : 'Calculate 🔢'; }, 
      { hint: 'Do the math', answer: pick.a });
  }

  teaserCodeBreak() {
    const codes = [
      { q: 'If A=1, B=2, C=3... what does CODE spell in numbers?', a: '3,15,4,5' },
      { q: 'ROT13: What is "EBG13" in plain text?', a: 'rot13' },
      { q: 'In Morse code, what letter is represented by · — · ·?', a: 'c' }
    ];
    const pick = codes[Math.floor(Math.random() * codes.length)];
    this.teaserManager.renderTeaser('Code Break', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes(pick.a) ? 'Correct! ✅' : 'Decode it 🔐'; }, 
      { hint: 'Pattern recognition', answer: pick.a });
  }

  teaserVisualPattern() {
    const patterns = [
      { q: 'What comes next: ⭐ ☆ ⭐ ☆ ?', a: '⭐' },
      { q: 'Pattern: 2, 4, 8, 16, ?', a: '32' },
      { q: 'ABCD, EFGH, IJKL, ?', a: 'mnop' }
    ];
    const pick = patterns[Math.floor(Math.random() * patterns.length)];
    this.teaserManager.renderTeaser('Visual Pattern', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes(pick.a.toLowerCase()) ? 'Correct! ✅' : 'Find the pattern 🔍'; }, 
      { hint: 'Look for repetition', answer: pick.a });
  }

  teaserReversal() {
    const reversals = [
      { q: 'Spell "stressed" backwards.', a: 'desserts' },
      { q: 'What word reads the same forward and backward?', a: 'racecar' },
      { q: 'Reverse the word "drawer"', a: 'reward' }
    ];
    const pick = reversals[Math.floor(Math.random() * reversals.length)];
    this.teaserManager.renderTeaser('Reversal', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes(pick.a) ? 'Correct! ✅' : 'Flip it ↪️'; }, 
      { hint: 'Reverse order', answer: pick.a });
  }

  teaserMissingLink() {
    const links = [
      { q: 'Complete: Apple, Banana, Cherry, ?', a: 'date' },
      { q: 'Continue: Monday, Tuesday, Wednesday, ?', a: 'thursday' },
      { q: 'Sequence: 5, 10, 15, 20, ?', a: '25' }
    ];
    const pick = links[Math.floor(Math.random() * links.length)];
    this.teaserManager.renderTeaser('Missing Link', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes(pick.a) ? 'Correct! ✅' : 'Find the connection 🔗'; }, 
      { hint: 'Look for sequence', answer: pick.a });
  }

  teaserWordChain() {
    const chains = [
      { q: 'Word chain: CAT -> BAT -> BAG -> ?', a: 'bug' },
      { q: 'Change one letter: HATE -> GATE -> ?', a: 'date' },
      { q: 'Link: DOG -> LOG -> LOT -> ?', a: 'pot' }
    ];
    const pick = chains[Math.floor(Math.random() * chains.length)];
    this.teaserManager.renderTeaser('Word Chain', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes(pick.a) ? 'Correct! ✅' : 'Follow the chain ⛓️'; }, 
      { hint: 'One letter changes', answer: pick.a });
  }

  teaserTrivia() {
    const trivia = [
      { q: 'How many continents are there?', a: '7' },
      { q: 'What planet is known as the Red Planet?', a: 'mars' },
      { q: 'How many sides does a hexagon have?', a: '6' },
      { q: 'What is the largest ocean?', a: 'pacific' }
    ];
    const pick = trivia[Math.floor(Math.random() * trivia.length)];
    this.teaserManager.renderTeaser('Trivia', `<p>${this.escapeHtml(pick.q)}</p>`, 
      (i, r) => { r.textContent = (i.value || '').trim().toLowerCase().includes(pick.a) ? 'Correct! ✅' : 'Test your knowledge 📚'; }, 
      { hint: 'General knowledge', answer: pick.a });
  }
}
