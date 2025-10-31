// Brain teaser management module
class TeaserManager {
  constructor() {
    this.escapeHtml = AppUtils.escapeHtml;
  }

  $(id) { return document.getElementById(id); }

  normalizeQuestion(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(/[`~!@#$%^&*()_+\-={}\[\]\\|;:'",.<>/?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  makeAiKey(teaser) {
    const q = this.normalizeQuestion(teaser?.question);
    const a = this.normalizeQuestion(teaser?.answer);
    return `${q}::${a}`;
  }

  async getSeenAiKeys() {
    try {
      const { seenAiTeasers } = await chrome.storage.local.get('seenAiTeasers');
      return new Set(Array.isArray(seenAiTeasers) ? seenAiTeasers : []);
    } catch (_) {
      return new Set();
    }
  }

  async addSeenAiKey(key) {
    if (!key) return;
    try {
      const { seenAiTeasers } = await chrome.storage.local.get('seenAiTeasers');
      const arr = Array.isArray(seenAiTeasers) ? seenAiTeasers : [];
      arr.push(key);
      const capped = arr.slice(-1000);
      await chrome.storage.local.set({ seenAiTeasers: capped });
    } catch (_) {}
  }

  makeHintFromAnswer(answer) {
    if (!answer) return '';
    const clean = String(answer).replace(/[^a-z0-9]/gi, '');
    if (clean.length <= 2) return `Length: ${clean.length}`;
    return `Starts with: ${clean[0].toUpperCase()}`;
  }

  renderTeaser(title, html, onCheck, options = {}) {
    const tTitle = this.$('teaserTitle');
    const tContent = this.$('teaserContent');
    const tActions = this.$('teaserActions');
    const aiBadge = this.$('teaserAIBadge');
    if (!tTitle || !tContent || !tActions) return;

    tTitle.textContent = title;
    if (aiBadge) aiBadge.style.display = options.ai ? 'inline-block' : 'none';
    tContent.innerHTML = html + '<p><input id="teaserInput" type="text" placeholder="Your answer" style="padding:8px 10px;border-radius:6px;border:1px solid #ddd;width:100%;max-width:320px;"></p><p id="teaserResult" style="min-height:22px;color:#2c3e50;"></p>';
    tActions.innerHTML = '';
    
    const checkBtn = document.createElement('button');
    checkBtn.className = 'btn';
    checkBtn.textContent = 'Check';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-secondary';
    nextBtn.textContent = 'Another';
    const hintBtn = document.createElement('button');
    hintBtn.className = 'btn btn-secondary';
    hintBtn.textContent = 'Hint';
    const showAnswerBtn = document.createElement('button');
    showAnswerBtn.className = 'btn btn-secondary';
    showAnswerBtn.textContent = 'Show Answer';
    
    tActions.appendChild(checkBtn);
    if (options.hint) tActions.appendChild(hintBtn);
    tActions.appendChild(showAnswerBtn);
    tActions.appendChild(nextBtn);
    
    checkBtn.onclick = () => {
      const inputEl = this.$('teaserInput');
      const resultEl = this.$('teaserResult');
      onCheck(inputEl, resultEl);
    };
    
    if (options.hint) {
      hintBtn.onclick = () => {
        const resultEl = this.$('teaserResult');
        if (resultEl) resultEl.textContent = `Hint: ${options.hint}`;
      };
    }
    
    showAnswerBtn.onclick = () => {
      const resultEl = this.$('teaserResult');
      if (resultEl && options.answer) {
        resultEl.textContent = `Answer: ${options.answer}`;
        resultEl.style.color = '#4CAF50';
        showAnswerBtn.disabled = true;
        showAnswerBtn.style.opacity = '0.6';
      }
    };
    
    nextBtn.onclick = () => {
      if (window.articleDisplay && window.articleDisplay.renderRandomTeaser) {
        window.articleDisplay.renderRandomTeaser();
      }
    };
  }

  async renderRandomTeaser(renderBuiltinTeaser) {
    try {
      const cached = await chrome.storage.local.get(['aiTeasersCache', 'aiTeasersLoading']);
      let queue = Array.isArray(cached.aiTeasersCache) ? cached.aiTeasersCache : [];
      const seen = await this.getSeenAiKeys();

      if (queue.length < 5 && !cached.aiTeasersLoading && typeof window.generateAiTeasers === 'function') {
        this.topUpAiCache();
      }

      if (queue.length > 0) {
        let ai = null;
        while (queue.length > 0) {
          const cand = queue.shift();
          const key = this.makeAiKey(cand);
          if (!seen.has(key)) { ai = cand; break; }
        }
        await chrome.storage.local.set({ aiTeasersCache: queue });
        if (ai && ai.question && ai.answer) {
          const title = ai.title || 'Brain Teaser';
          const question = ai.question;
          const answer = (ai.answer || '').trim().toLowerCase();
          this.renderTeaser(title, `<p>${this.escapeHtml(question)}</p>`, (inputEl, resultEl) => {
            const val = (inputEl.value || '').trim().toLowerCase();
            resultEl.textContent = val === answer ? 'Correct! ✅' : 'Try again ❌';
          }, { ai: true, hint: this.makeHintFromAnswer(answer), answer });
          await this.addSeenAiKey(this.makeAiKey(ai));

          if (queue.length < 5 && !cached.aiTeasersLoading && typeof window.generateAiTeasers === 'function') {
            this.topUpAiCache();
          }
          return;
        }
      }

      if (renderBuiltinTeaser) {
        renderBuiltinTeaser();
      }

      if (!cached.aiTeasersLoading && typeof window.generateAiTeasers === 'function') {
        this.topUpAiCache();
      }
    } catch (_) {
      if (renderBuiltinTeaser) {
        renderBuiltinTeaser();
      }
    }
  }

  async topUpAiCache() {
    try {
      await chrome.storage.local.set({ aiTeasersLoading: true });
      const seenSet = await this.getSeenAiKeys();
      const avoidList = Array.from(seenSet).slice(-10).map(k => (k.split('::')[0] || ''));
      window.generateAiTeasers(12, avoidList)
        .then(async list => {
          if (Array.isArray(list) && list.length) {
            const seen2 = await this.getSeenAiKeys();
            const filtered = list.filter(t => !seen2.has(this.makeAiKey(t)));
            const { aiTeasersCache } = await chrome.storage.local.get('aiTeasersCache');
            const existing = Array.isArray(aiTeasersCache) ? aiTeasersCache : [];
            const combined = [...existing, ...filtered];
            await chrome.storage.local.set({ aiTeasersCache: combined });
          }
        })
        .finally(async () => {
          await chrome.storage.local.set({ aiTeasersLoading: false });
        });
    } catch (_) {}
  }
}
