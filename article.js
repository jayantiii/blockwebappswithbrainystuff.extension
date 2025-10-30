// Article display script for FocusGuard extension
class ArticleDisplay {
  constructor() {
    // Will be filled dynamically from APIs or cache
    this.articles = [];
    
    this.currentArticleIndex = 0;
    this.isTeaserMode = false;
    this.timerState = {
      isActive: false,
      isBlocked: false,
      isPaused: false,
      timeRemaining: 20 * 60,
      sessionStartTime: null
    };
    
    // Simple persistent todos
    this.todos = [];
    
    this.init();
  }
  
  async init() {
    await this.loadTimerState();
    await this.prepareArticles();
    this.displayArticle();
    this.updateTimer();
    this.startTimer();
    this.setupTabVisibilityListener();
    await this.loadTodos();
    await this.cleanupCompletedTodosIfNeeded();
    this.renderTodos();
    this.wireTodoUi();
    this.alignTodoDock();
    window.addEventListener('resize', () => this.alignTodoDock());
    this.startSubtitleRotator();
    this.initCalmBoard();
  }

  async prepareArticles() {
    try {
      const cached = await this.getCachedArticles();
      if (cached && Array.isArray(cached) && cached.length > 0) {
        this.articles = cached;
        console.log('Loaded cached articles:', this.articles.length);
        return;
      }
      console.log('Fetching new articles...');
      const [wikiArticles, spaceArticles, hnArticles, quoteItems] = await Promise.all([
        this.fetchWikipediaSummaries(4),
        this.fetchSpaceflightNews(4),
        this.fetchHackerNewsStories(4),
        this.fetchQuotes(3)
      ]);
      const combined = this.shuffleArray([...wikiArticles, ...spaceArticles, ...hnArticles, ...quoteItems]);
      this.articles = combined.slice(0, 6);
      console.log('Fetched articles:', this.articles.length);
      await this.setCachedArticles(this.articles);
    } catch (e) {
      console.error('Error preparing articles:', e);
      if (this.articles.length === 0) {
        this.articles = [
          {
            category: 'Offline',
            title: 'You are offline',
            content: '<p>No internet connection. Please reconnect to fetch new articles.</p>'
          }
        ];
      }
    }
  }

  async getCachedArticles() {
    const { dynamicArticles, dynamicArticlesTimestamp } = await chrome.storage.local.get([
      'dynamicArticles', 'dynamicArticlesTimestamp'
    ]);
    const maxAgeMs = 1000 * 60 * 30; // 30 minutes cache
    if (dynamicArticles && dynamicArticlesTimestamp && (Date.now() - dynamicArticlesTimestamp) < maxAgeMs) {
      return dynamicArticles;
    }
    return null;
  }

  async setCachedArticles(articles) {
    await chrome.storage.local.set({
      dynamicArticles: articles,
      dynamicArticlesTimestamp: Date.now()
    });
  }

  async fetchWikipediaSummaries(limit) {
    const results = [];
    for (let i = 0; i < limit; i++) {
      try {
        const resp = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
        if (!resp.ok) continue;
        const data = await resp.json();
        const title = data.title || 'Wikipedia Article';
        const extract = data.extract || '';
        const url = data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : data.content_urls?.mobile?.page;
        const imageUrl = data.thumbnail?.source;
        results.push({
          category: 'Science',
          title,
          imageUrl,
          sourceName: 'Wikipedia',
          sourceUrl: url,
          content: `
            ${imageUrl ? `<img src="${imageUrl}" alt="${this.escapeHtml(title)}" style="max-width:100%;border-radius:10px;margin-bottom:12px;"/>` : ''}
            <p>${this.escapeHtml(extract)}</p>
            <p><a href="${url}" target="_blank" rel="noreferrer">Read on Wikipedia →</a></p>
          `
        });
      } catch (_) { /* ignore this iteration */ }
    }
    return results;
  }

  async fetchSpaceflightNews(limit) {
    try {
      const resp = await fetch(`https://api.spaceflightnewsapi.net/v4/articles/?limit=${limit}`);
      if (!resp.ok) return [];
      const data = await resp.json();
      const items = Array.isArray(data.results) ? data.results : [];
      return items.map(item => ({
        category: 'Technology',
        title: item.title,
        imageUrl: item.image_url,
        sourceName: 'Spaceflight News',
        sourceUrl: item.url,
        content: `
          ${item.image_url ? `<img src="${item.image_url}" alt="${this.escapeHtml(item.title)}" style=\"max-width:100%;border-radius:10px;margin-bottom:12px;\"/>` : ''}
          <p>${this.escapeHtml(item.summary || '')}</p>
          <p><a href="${item.url}" target="_blank" rel="noreferrer">Read on Spaceflight News →</a></p>
        `
      }));
    } catch (e) {
      return [];
    }
  }

  async fetchHackerNewsStories(limit) {
    try {
      const resp = await fetch(`https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=${limit}&query=science%20technology`);
      if (!resp.ok) return [];
      const data = await resp.json();
      const hits = Array.isArray(data.hits) ? data.hits : [];
      return hits.map(hit => ({
        category: 'Tech News',
        title: hit.title || 'Hacker News Story',
        sourceName: 'Hacker News',
        sourceUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        content: `
          <p>${this.escapeHtml(hit.title || '')}</p>
          <p><a href="${hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`}" target="_blank" rel="noreferrer">Open story →</a></p>
        `
      }));
    } catch (e) {
      return [];
    }
  }

  async fetchQuotes(limit) {
    try {
      const resp = await fetch(`https://api.quotable.io/quotes?tags=science|technology&limit=${limit}`);
      if (!resp.ok) return [];
      const data = await resp.json();
      const results = Array.isArray(data.results) ? data.results : [];
      return results.map(q => ({
        category: 'Inspiration',
        title: q.author || 'Quote',
        sourceName: 'Quotable',
        sourceUrl: `https://api.quotable.io/quotes/${q._id}`,
        content: `
          <blockquote style="margin:0;padding:12px 16px;border-left:4px solid #764ba2;background:rgba(118,75,162,0.08);border-radius:6px;">
            <p style="margin:0 0 6px 0;font-size:18px;">“${this.escapeHtml(q.content)}”</p>
            <footer style="opacity:0.8;">— ${this.escapeHtml(q.author || 'Unknown')}</footer>
          </blockquote>
        `
      }));
    } catch (e) {
      return [];
    }
  }

  shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  async loadTimerState() {
    try {
      const result = await chrome.storage.local.get('timerState');
      if (result.timerState) {
        this.timerState = { ...this.timerState, ...result.timerState };
      }
    } catch (error) {
      console.error('Error loading timer state:', error);
    }
  }
  
  displayArticle() {
    console.log('displayArticle called, articles length:', this.articles.length, 'current index:', this.currentArticleIndex);
    
    if (!this.articles || this.articles.length === 0) {
      const articleCard = document.getElementById('articleCard');
      articleCard.innerHTML = `
        <div class="article-category">Loading</div>
        <h2 class="article-title">Loading articles...</h2>
        <div class="article-content">
          <p>Please wait while we fetch interesting articles for you.</p>
        </div>
      `;
      return;
    }
    
    const article = this.articles[this.currentArticleIndex];
    console.log('Displaying article:', article.title);
    const articleCard = document.getElementById('articleCard');
    const teaserCard = document.getElementById('teaserCard');
    if (teaserCard) teaserCard.style.display = 'none';
    if (articleCard) articleCard.style.display = 'block';
    
    articleCard.innerHTML = `
      <div class="article-category">${article.category}</div>
      <h2 class="article-title">${article.title}</h2>
      <div class="article-content">${article.content}</div>
      ${article.sourceUrl ? `<div style="margin-top:12px;display:flex;gap:8px;">
        <button class="btn" id="readInPageBtn">📰 Read in page</button>
        <a class="btn btn-secondary" href="${article.sourceUrl}" target="_blank" rel="noreferrer">Open in new tab</a>
      </div>` : ''}
    `;

    // Wire up in-page reader
    const readInPageBtn = document.getElementById('readInPageBtn');
    if (readInPageBtn && article.sourceUrl) {
      readInPageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openReader(article.title, article.sourceUrl);
      });
    }
  }

  openReader(title, url) {
    const overlay = document.getElementById('readerOverlay');
    const frame = document.getElementById('readerFrame');
    const fallback = document.getElementById('readerFallback');
    const readerTitle = document.getElementById('readerTitle');
    const openInNewTabBtn = document.getElementById('openInNewTabBtn');
    const fallbackOpenBtn = document.getElementById('fallbackOpenBtn');
    const closeBtn = document.getElementById('closeReaderBtn');

    if (!overlay || !frame) return;

    readerTitle.textContent = title || 'In-page Reader';
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Reset states
    fallback.style.display = 'none';
    frame.style.display = 'block';
    frame.src = url;

    const onLoad = () => {
      // Loaded successfully
    };
    const onError = () => {
      // If site blocks embedding
      frame.style.display = 'none';
      fallback.style.display = 'block';
    };
    frame.addEventListener('load', onLoad, { once: true });
    frame.addEventListener('error', onError, { once: true });

    const openFn = () => window.open(url, '_blank', 'noopener,noreferrer');
    if (openInNewTabBtn) openInNewTabBtn.onclick = openFn;
    if (fallbackOpenBtn) fallbackOpenBtn.onclick = openFn;
    if (closeBtn) closeBtn.onclick = () => this.closeReader();

    // Close on overlay click (outside panel)
    overlay.onclick = (evt) => {
      if (evt.target === overlay) this.closeReader();
    };
    document.addEventListener('keydown', this.readerEscHandler);
  }

  readerEscHandler = (e) => {
    if (e.key === 'Escape') {
      this.closeReader();
    }
  }

  closeReader() {
    const overlay = document.getElementById('readerOverlay');
    const frame = document.getElementById('readerFrame');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => { overlay.style.display = 'none'; }, 180);
    if (frame) frame.src = 'about:blank';
    document.removeEventListener('keydown', this.readerEscHandler);
  }
  
  async loadNewArticle() {
    console.log('loadNewArticle called, current articles:', this.articles.length);
    if (this.isTeaserMode) {
      // If in teaser mode, show a fresh teaser instead
      this.renderRandomTeaser();
      return;
    }
    
    // Show loading state
    const articleCard = document.getElementById('articleCard');
    if (articleCard) {
      articleCard.innerHTML = `
        <div class="article-category">Loading</div>
        <h2 class="article-title">Loading new article...</h2>
        <div class="article-content">
          <p>Please wait while we fetch a new article for you.</p>
        </div>
      `;
    }
    
    // Ensure articles are loaded
    if (!this.articles || this.articles.length === 0) {
      console.log('No articles, fetching...');
      await this.prepareArticles();
    }
    
    if (this.articles.length === 0) {
      console.error('No articles available after fetching');
      articleCard.innerHTML = `
        <div class="article-category">Error</div>
        <h2 class="article-title">No articles available</h2>
        <div class="article-content">
          <p>Unable to load articles. Please check your internet connection.</p>
        </div>
      `;
      return;
    }
    
    this.currentArticleIndex = (this.currentArticleIndex + 1) % this.articles.length;
    console.log('New article index:', this.currentArticleIndex);
    this.displayArticle();

    // Top-up when getting close to the end of the list
    const remaining = this.articles.length - this.currentArticleIndex - 1;
    if (remaining < 2) {
      console.log('Topping up articles...');
      const more = await this.fetchMoreMixed(4);
      if (more.length > 0) {
        const deduped = this.mergeDedupArticles(this.articles, more);
        this.articles = deduped;
        await this.setCachedArticles(this.articles);
        console.log('Articles after top-up:', this.articles.length);
      }
    }
  }

  // --------- Teaser Mode ---------
  toggleTeaserMode() {
    this.isTeaserMode = !this.isTeaserMode;
    const articleCard = document.getElementById('articleCard');
    const teaserCard = document.getElementById('teaserCard');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const newBtn = document.getElementById('newArticleBtn');
    if (!articleCard || !teaserCard) return;
    if (this.isTeaserMode) {
      articleCard.style.display = 'none';
      teaserCard.style.display = 'block';
      if (shuffleBtn) shuffleBtn.textContent = 'Go to Articles';
      if (newBtn) newBtn.textContent = 'New Teaser';
      this.renderRandomTeaser();
    } else {
      teaserCard.style.display = 'none';
      articleCard.style.display = 'block';
      if (shuffleBtn) shuffleBtn.textContent = 'Brain Teasers';
      if (newBtn) newBtn.textContent = 'New Article';
      this.displayArticle();
    }
  }

  renderRandomTeaser() {
    const teasers = [
      () => this.teaserMathRiddle(),
      () => this.teaserWordScramble(),
      () => this.teaserNumberSequence()
    ];
    const pick = teasers[Math.floor(Math.random() * teasers.length)];
    pick();
  }

  teaserMathRiddle() {
    const title = 'Math Riddle';
    const question = 'A farmer has 17 sheep, and all but 9 die. How many are left?';
    const answer = '9';
    this.renderTeaser(title, `<p>${question}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim();
      resultEl.textContent = val === answer ? 'Correct! ✅' : 'Try again ❌';
    });
  }

  teaserWordScramble() {
    const words = ['galaxy', 'quantum', 'neuron', 'energy', 'rocket'];
    const original = words[Math.floor(Math.random() * words.length)];
    const scrambled = original.split('').sort(() => Math.random() - 0.5).join('');
    const title = 'Word Scramble';
    const prompt = `Unscramble this word: <strong>${scrambled}</strong>`;
    this.renderTeaser(title, `<p>${prompt}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val === original ? 'Correct! ✅' : 'Not quite ❌';
    });
  }

  teaserNumberSequence() {
    const sequences = [
      { seq: [2, 3, 5, 8, 12, '?'], rule: 'add 1,2,3,4,...', answer: '17' },
      { seq: [1, 1, 2, 3, 5, 8, '?'], rule: 'Fibonacci', answer: '13' },
      { seq: [3, 6, 12, 24, '?'], rule: 'x2', answer: '48' }
    ];
    const pick = sequences[Math.floor(Math.random() * sequences.length)];
    const title = 'Number Sequence';
    const prompt = `Fill the next number: ${pick.seq.join(', ')}`;
    this.renderTeaser(title, `<p>${prompt}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim();
      resultEl.textContent = val === pick.answer ? 'Correct! ✅' : `Hint: ${pick.rule}`;
    });
  }

  renderTeaser(title, html, onCheck) {
    const tTitle = document.getElementById('teaserTitle');
    const tContent = document.getElementById('teaserContent');
    const tActions = document.getElementById('teaserActions');
    if (!tTitle || !tContent || !tActions) return;
    tTitle.textContent = title;
    tContent.innerHTML = html + '<p><input id="teaserInput" type="text" placeholder="Your answer" style="padding:8px 10px;border-radius:6px;border:1px solid #ddd;width:100%;max-width:320px;"></p><p id="teaserResult" style="min-height:22px;color:#2c3e50;"></p>';
    tActions.innerHTML = '';
    const checkBtn = document.createElement('button');
    checkBtn.className = 'btn';
    checkBtn.textContent = 'Check';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-secondary';
    nextBtn.textContent = 'Another';
    tActions.appendChild(checkBtn);
    tActions.appendChild(nextBtn);
    checkBtn.onclick = () => {
      const inputEl = document.getElementById('teaserInput');
      const resultEl = document.getElementById('teaserResult');
      onCheck(inputEl, resultEl);
    };
    nextBtn.onclick = () => this.renderRandomTeaser();
  }

  async fetchMoreMixed(limit) {
    const [wiki, space, hn, quotes] = await Promise.all([
      this.fetchWikipediaSummaries(2),
      this.fetchSpaceflightNews(2),
      this.fetchHackerNewsStories(2),
      this.fetchQuotes(2)
    ]);
    return this.shuffleArray([...wiki, ...space, ...hn, ...quotes]).slice(0, limit);
  }

  mergeDedupArticles(existing, incoming) {
    const seen = new Set(existing.map(a => (a.sourceUrl || a.title || '').toLowerCase()));
    const out = existing.slice();
    for (const art of incoming) {
      const key = (art.sourceUrl || art.title || '').toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(art);
      }
    }
    return out;
  }
  
  updateTimer() {
    const timerDisplay = document.getElementById('timerDisplay');
    const timerStatus = document.getElementById('timerStatus');
    const progressBar = document.getElementById('progressBar');
    
    if (!this.timerState.isActive) {
      timerDisplay.textContent = '00:00';
      timerStatus.textContent = 'Timer not active';
      timerStatus.style.color = '#ffd700';
      progressBar.style.width = '0%';
      return;
    }
    
    const minutes = Math.floor(this.timerState.timeRemaining / 60);
    const seconds = this.timerState.timeRemaining % 60;
    
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (this.timerState.isBlocked) {
      timerStatus.textContent = 'Break Time - Sites are unblocked!';
      timerStatus.style.color = '#4CAF50';
    } else if (this.timerState.isPaused) {
      timerStatus.textContent = 'Timer paused - Stay on this page to continue!';
      timerStatus.style.color = '#ff9800';
    } else {
      timerStatus.textContent = 'Focus Time - Keep reading!';
      timerStatus.style.color = '#ffd700';
    }
    
    // Update progress bar
    const totalTime = this.timerState.isBlocked ? 5 * 60 : 20 * 60;
    const progress = ((totalTime - this.timerState.timeRemaining) / totalTime) * 100;
    progressBar.style.width = `${progress}%`;
  }
  
  startTimer() {
    setInterval(() => {
      if (this.timerState.isActive && !this.timerState.isPaused) {
        this.timerState.timeRemaining--;
        
        if (this.timerState.timeRemaining <= 0) {
          this.handleTimerComplete();
        }
        
        this.updateTimer();
      }
    }, 1000);
  }
  
  handleTimerComplete() {
    if (!this.timerState.isBlocked) {
      // Focus session completed, start break
      this.timerState.isBlocked = true;
      this.timerState.timeRemaining = 5 * 60; // 5 minutes break
      
      // Show notification
      this.showNotification('Great job! 🎉 You earned a 5-minute break!');
    } else {
      // Break completed, start new focus session
      this.timerState.isBlocked = false;
      this.timerState.timeRemaining = 20 * 60; // 20 minutes focus
      
      // Show notification
      this.showNotification('Break time is over! Time to focus again! 🎯');
    }
    
    this.updateTimer();
    this.saveTimerState();
  }
  
  async saveTimerState() {
    try {
      await chrome.storage.local.set({ timerState: this.timerState });
    } catch (error) {
      console.error('Error saving timer state:', error);
    }
  }
  
  showNotification(message) {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4CAF50;
      color: white;
      padding: 15px 25px;
      border-radius: 25px;
      z-index: 1000;
      font-size: 16px;
      font-weight: 500;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 4000);
  }
  
  setupTabVisibilityListener() {
    // Pause timer when tab becomes hidden (user switches tabs)
    document.addEventListener('visibilitychange', () => {
      if (this.timerState.isActive) {
        if (document.hidden) {
          // Tab is hidden - pause timer
          this.timerState.isPaused = true;
          this.saveTimerState();
          chrome.runtime.sendMessage({ action: 'pauseTimer' });
        } else {
          // Tab is visible - resume timer
          this.timerState.isPaused = false;
          this.saveTimerState();
          chrome.runtime.sendMessage({ action: 'resumeTimer' });
        }
        this.updateTimer();
      }
    });
  }
  
  openSettings() {
    // Open the extension popup in a tab to ensure it opens from this page
    try {
      const url = chrome.runtime.getURL('popup.html');
      window.open(url, '_blank', 'noopener');
    } catch (_) {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    }
  }

  // --------- Todos (persisted) ---------
  async loadTodos() {
    try {
      const { todos } = await chrome.storage.local.get('todos');
      if (Array.isArray(todos)) {
        this.todos = todos;
      }
    } catch (_) {}
  }

  async saveTodos() {
    try {
      await chrome.storage.local.set({ todos: this.todos });
    } catch (_) {}
  }

  wireTodoUi() {
    const input = document.getElementById('todoInput');
    const addBtn = document.getElementById('todoAddBtn');
    if (!input || !addBtn) return;
    const addHandler = async () => {
      const text = (input.value || '').trim();
      if (!text) return;
      this.addTodo(text);
      input.value = '';
      await this.saveTodos();
      this.renderTodos();
    };
    addBtn.addEventListener('click', (e) => { e.preventDefault(); addHandler(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addHandler();
      }
    });
  }

  addTodo(text) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.todos.push({ id, text, done: false, completedAt: null });
  }

  deleteTodo(id) {
    this.todos = this.todos.filter(x => x.id !== id);
  }

  renderTodos() {
    const list = document.getElementById('todoList');
    if (!list) return;
    list.innerHTML = '';
    if (!Array.isArray(this.todos)) this.todos = [];
    for (const item of this.todos) {
      const li = document.createElement('li');
      li.className = 'todo-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!item.done;
      checkbox.addEventListener('change', async () => {
        item.done = checkbox.checked;
        item.completedAt = item.done ? new Date().toDateString() : null;
        await this.saveTodos();
        this.renderTodos();
      });

      const span = document.createElement('span');
      span.className = 'todo-text' + (item.done ? ' done' : '');
      span.textContent = item.text;

      const actions = document.createElement('div');
      actions.className = 'todo-actions';
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        this.deleteTodo(item.id);
        await this.saveTodos();
        this.renderTodos();
      });
      actions.appendChild(del);

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(actions);
      list.appendChild(li);
    }
  }

  async cleanupCompletedTodosIfNeeded() {
    try {
      const today = new Date().toDateString();
      const { todosLastCleanupDate } = await chrome.storage.local.get('todosLastCleanupDate');
      if (todosLastCleanupDate === today) return;
      this.todos = this.todos.filter(t => !(t.done && t.completedAt && t.completedAt !== today));
      await chrome.storage.local.set({ todos: this.todos, todosLastCleanupDate: today });
    } catch (_) {}
  }

  alignTodoDock() {
    try {
      const todo = document.getElementById('todoCard');
      const timer = document.querySelector('.timer-info');
      const container = document.querySelector('.container');
      if (!todo || !timer || !container) return;

      // On narrow screens, stack
      if (window.matchMedia('(max-width: 860px)').matches) {
        todo.classList.add('stacked');
        todo.style.left = '';
        todo.style.top = '';
        return;
      }

      todo.classList.remove('stacked');

      const containerRect = container.getBoundingClientRect();
      const timerRect = timer.getBoundingClientRect();
      const todoWidth = todo.offsetWidth || 280;

      // Compute left so todo sits in gutter left of the container
      const gutter = containerRect.left;
      const desiredLeft = Math.max(8, Math.round(gutter - todoWidth - 16));
      todo.style.left = `${desiredLeft}px`;

      // Align top with timer top
      const top = Math.max(12, Math.round(timerRect.top));
      todo.style.top = `${top}px`;
    } catch (_) {}
  }

  // --------- Calm Drawing Board ---------
  initCalmBoard() {
    const calmBtn = document.getElementById('calmBtn');
    const card = document.getElementById('calmCard');
    const canvas = document.getElementById('calmCanvas');
    if (!calmBtn || !card || !canvas) return;

    const ctx = canvas.getContext('2d');
    let drawing = false;
    let tool = 'pen';
    let color = '#4c6ef5';
    let size = 6;

    const colorEl = document.getElementById('calmColor');
    const sizeEl = document.getElementById('calmSize');
    const penBtn = document.getElementById('calmPenBtn');
    const eraserBtn = document.getElementById('calmEraserBtn');
    const clearBtn = document.getElementById('calmClearBtn');
    const statusEl = document.getElementById('calmStatus');

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = Math.max(300, Math.floor(rect.width));
      canvas.height = Math.max(180, Math.floor(rect.height));
      try { ctx.putImageData(img, 0, 0); } catch (_) {}
    };

    const save = async () => {
      try {
        const data = canvas.toDataURL('image/png');
        await chrome.storage.local.set({ calmPad: data });
        if (statusEl) statusEl.textContent = 'Saved ✨';
        setTimeout(() => { if (statusEl) statusEl.textContent = 'Relax and draw ✨'; }, 1000);
      } catch (_) {}
    };

    const restore = async () => {
      try {
        const { calmPad } = await chrome.storage.local.get('calmPad');
        if (calmPad) {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
          img.src = calmPad;
        }
      } catch (_) {}
    };

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX ?? e.touches?.[0]?.clientX) - r.left;
      const y = (e.clientY ?? e.touches?.[0]?.clientY) - r.top;
      return { x, y };
    };

    const start = (e) => {
      drawing = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e) => {
      if (!drawing) return;
      const { x, y } = getPos(e);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size;
      ctx.strokeStyle = tool === 'pen' ? color : '#ffffff';
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const end = async () => { if (!drawing) return; drawing = false; await save(); };

    // Events
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    colorEl?.addEventListener('input', (e) => { color = e.target.value; });
    sizeEl?.addEventListener('input', (e) => { size = parseInt(e.target.value || '6', 10); });
    penBtn?.addEventListener('click', () => { tool = 'pen'; penBtn.classList.remove('btn-secondary'); eraserBtn.classList.add('btn-secondary'); });
    eraserBtn?.addEventListener('click', () => { tool = 'eraser'; eraserBtn.classList.remove('btn-secondary'); penBtn.classList.add('btn-secondary'); });
    clearBtn?.addEventListener('click', async () => { ctx.clearRect(0, 0, canvas.width, canvas.height); await save(); });

    // Toggle card visibility
    calmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const showing = card.style.display === 'block';
      card.style.display = showing ? 'none' : 'block';
      const articleCard = document.getElementById('articleCard');
      const teaserCard = document.getElementById('teaserCard');
      if (!showing) {
        // Opening calm board: hide article/teaser
        if (articleCard) articleCard.style.display = 'none';
        if (teaserCard) teaserCard.style.display = 'none';
        setTimeout(() => { resize(); restore(); }, 30);
      } else {
        // Closing calm board: restore the appropriate view
        if (this.isTeaserMode) {
          if (teaserCard) {
            teaserCard.style.display = 'block';
          }
          if (articleCard) articleCard.style.display = 'none';
        } else {
          if (articleCard) {
            articleCard.style.display = 'block';
          }
          if (teaserCard) teaserCard.style.display = 'none';
          // Ensure article content is present
          this.displayArticle();
        }
      }
    });

    // Hide board when other main actions are used
    const hideBoard = () => { if (card.style.display === 'block') card.style.display = 'none'; };
    document.getElementById('newArticleBtn')?.addEventListener('click', hideBoard);
    document.getElementById('shuffleBtn')?.addEventListener('click', hideBoard);
    document.getElementById('settingsBtn')?.addEventListener('click', hideBoard);

    // initial sizing on load and on resize
    new ResizeObserver(() => resize()).observe(canvas.parentElement);
    window.addEventListener('resize', resize);
  }

  async startSubtitleRotator() {
    try {
      const subtitle = document.getElementById('subtitleText');
      if (!subtitle) return;
      // Try fetching inspirational quotes; fallback to local list
      let quotes = [];
      try {
        const fetched = await this.fetchQuotes(8);
        quotes = (fetched || []).map(q => {
          const tmp = document.createElement('div');
          tmp.innerHTML = q.content || '';
          return tmp.textContent || 'Keep learning every day.';
        });
      } catch (_) {}
      if (!quotes || quotes.length === 0) {
        quotes = [
          'Small steps, big outcomes.',
          'Deep work beats shallow distractions.',
          'Focus is a muscle—train it daily.',
          'Make progress, not excuses.',
          'Consistency compounds.',
          'One article at a time.',
          'Tiny gains, massive change.'
        ];
      }

      let i = 0;
      const setQuote = (text) => {
        subtitle.style.transition = 'opacity 300ms ease';
        subtitle.style.opacity = '0';
        setTimeout(() => {
          subtitle.textContent = text;
          subtitle.style.opacity = '1';
        }, 220);
      };
      setQuote(quotes[i % quotes.length]);
      setInterval(() => {
        i = (i + 1) % quotes.length;
        setQuote(quotes[i]);
      }, 10000); // rotate every 10s
    } catch (_) {}
  }
}

// Global functions for button clicks
async function loadNewArticle() {
  console.log('loadNewArticle button clicked!');
  if (window.articleDisplay) {
    console.log('articleDisplay found, calling loadNewArticle...');
    await window.articleDisplay.loadNewArticle();
  } else {
    console.error('articleDisplay not found!');
  }
}

function openSettings() {
  window.articleDisplay.openSettings();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.articleDisplay = new ArticleDisplay();
  
  // Add event listeners for buttons
  const newArticleBtn = document.getElementById('newArticleBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  
  if (newArticleBtn) {
    newArticleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('New Article button clicked via event listener');
      await loadNewArticle();
    });
  }
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Shuffle toggled');
      window.articleDisplay.toggleTeaserMode();
    });
  }
  
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Settings button clicked');
      openSettings();
    });
  }
});
