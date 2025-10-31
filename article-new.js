// Main Article Display class - refactored to use modular components
class ArticleDisplay {
  constructor() {
    this.articles = [];
    this.currentArticleIndex = 0;
    this.isTeaserMode = false;
    
    // Initialize modules
    this.fetcher = new ArticleFetcher();
    this.renderer = new ArticleRenderer();
    this.timer = new TimerManager();
    this.todo = new TodoManager();
    this.drawingBoard = new DrawingBoard();
    this.summarizer = new SummarizerManager();
    this.subtitleRotator = new SubtitleRotator();
    this.teaserManager = new TeaserManager();
    this.builtinTeasers = new BuiltinTeasers(this.teaserManager);
    
    // Wire up callbacks
    this.timer.setCallbacks(
      () => this.handleTimerComplete(),
      (msg) => this.showNotification(msg)
    );
    
    this.init();
  }

  $(id) { return document.getElementById(id); }
  on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }

  async init() {
    await this.timer.loadTimerState();
    this.timer.updateTimer();
    this.timer.startTimer();
    this.timer.setupTabVisibilityListener();
    this.timer.activate();

    await this.todo.loadTodos();
    await this.todo.cleanupCompletedTodosIfNeeded();
    this.todo.renderTodos();
    this.todo.wireTodoUi((msg) => this.showNotification(msg));
    this.todo.alignTodoDock();
    window.addEventListener('resize', () => this.todo.alignTodoDock());

    this.subtitleRotator.start();

    this.drawingBoard.init((msg) => this.showNotification(msg));

    await this.prepareArticles();
    this.displayArticle();
    
    this.summarizer.preloadSummarizer();
  }

  async prepareArticles() {
    this.articles = await this.fetcher.prepareArticles();
    const seenKeys = await this.fetcher.getSeenKeys();
    const unseen = this.fetcher.filterUnseen(this.articles, seenKeys);
    this.articles = unseen;
    await this.fetcher.setCachedArticles(this.articles);
  }

  displayArticle() {
    if (!this.articles || this.articles.length === 0) {
      this.renderer.displayArticle(null, null, null);
      return;
    }

    const article = this.articles[this.currentArticleIndex];
    this.renderer.displayArticle(
      article,
      () => this.summarizeCurrentArticle(),
      (title, url) => this.renderer.openReader(title, url)
    );
    this.summarizer.updateSummarizeControls((msg) => this.showNotification(msg));
  }

  async summarizeCurrentArticle() {
    try {
      const result = await this.summarizer.getSummarizer();
      
      if (result.status === 'ready' && result.summarizer) {
        const articleCard = this.$('articleCard');
        if (!articleCard) return;
        
        const titleEl = articleCard.querySelector('.article-title');
        const contentEl = articleCard.querySelector('.article-content');
        if (!contentEl) return;
        
        if (!this.renderer.getOriginalArticleHtml()) {
          this.renderer.setOriginalArticleHtml(contentEl.innerHTML);
        }
        
        const titleText = titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : '';
        const contentText = contentEl.innerText || contentEl.textContent || '';
        const fullText = titleText ? `${titleText}\n\n${contentText}` : contentText;
        
        if (!fullText || fullText.length < 50) {
          this.showNotification('Article too short to summarize');
          return;
        }

        const summarizeBtn = this.$('summarizeBtn');
        if (summarizeBtn) {
          summarizeBtn.disabled = true;
          summarizeBtn.textContent = '⏳ Summarizing...';
        }

        try {
          const summaryHtml = await this.summarizer.summarize(
            fullText,
            result,
            AppUtils.markdownToHtml,
            (msg) => this.showNotification(msg)
          );
          
          this.renderer.displaySummary(summaryHtml, this.renderer.getOriginalArticleHtml());
        } catch (e) {
          console.error('Summarization error:', e);
          this.showNotification('Summarization failed');
        } finally {
          if (summarizeBtn) {
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = '📝 Summarize';
          }
        }
      } else if (result.status === 'needs-download') {
        try {
          const S = window.ai?.summarizer ?? globalThis.Summarizer;
          if (S) {
            const summarizer = await Promise.race([
              S.create({ outputLanguage: 'en' }),
              new Promise((_, r) => setTimeout(() => r(new Error('create-timeout')), 30000))
            ]);
            await this.summarizeCurrentArticle();
          }
        } catch (e) {
          this.showNotification('Downloading summarizer model… please wait and try again.');
        }
      } else {
        this.showNotification('Summarizer unavailable. Ensure Chrome AI features are enabled.');
      }
    } catch (e) {
      console.error('Summarization error:', e);
      this.showNotification('Summarization failed');
    }
  }

  async loadNewArticle() {
    if (this.isTeaserMode) {
      this.renderRandomTeaser();
      return;
    }
    
    const articleCard = this.$('articleCard');
    if (articleCard) {
      articleCard.innerHTML = `
        <div class="article-category">Loading</div>
        <h2 class="article-title">Loading new article...</h2>
        <div class="article-content">
          <p>Please wait while we fetch a new article for you.</p>
        </div>
      `;
    }
    
    if (!this.articles || this.articles.length === 0) {
      await this.prepareArticles();
    }
    
    if (this.articles.length === 0) {
      if (articleCard) {
        articleCard.innerHTML = `
          <div class="article-category">Error</div>
          <h2 class="article-title">No articles available</h2>
          <div class="article-content">
            <p>Unable to load articles. Please check your internet connection.</p>
          </div>
        `;
      }
      return;
    }
    
    // Remove current article from queue
    if (this.articles.length > 0) {
      this.articles.shift();
    }
    
    // Top-up if needed
    if (this.articles.length < 3) {
      const seenKeys = await this.fetcher.getSeenKeys();
      const more = await this.fetcher.fetchMoreMixed(10);
      const unseen = this.fetcher.filterUnseen(more, seenKeys);
      await Promise.all(unseen.map(a => this.fetcher.addSeenKey(this.fetcher.normalizeArticleKey(a))));
      this.articles = this.fetcher.mergeDedupArticles(this.articles, unseen);
      await this.fetcher.setCachedArticles(this.articles);
    }
    
    if (this.articles.length > 0) {
      this.currentArticleIndex = 0;
      this.displayArticle();
    }
  }

  toggleTeaserMode() {
    this.isTeaserMode = !this.isTeaserMode;
    const articleCard = this.$('articleCard');
    const teaserCard = this.$('teaserCard');
    const shuffleBtn = this.$('shuffleBtn');
    const newBtn = this.$('newArticleBtn');
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

  async renderRandomTeaser() {
    await this.teaserManager.renderRandomTeaser(() => this.builtinTeasers.renderBuiltinTeaser());
  }

  handleTimerComplete() {
    // Timer complete callback - already handled by TimerManager
  }

  showNotification(message, duration = 3000) {
    const notification = this.$('notification');
    if (!notification) {
      // Create notification element if it doesn't exist
      const notif = document.createElement('div');
      notif.id = 'notification';
      notif.style.cssText = `
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
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      `;
      document.body.appendChild(notif);
      notif.textContent = message;
      notif.style.opacity = '1';
      setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 300);
      }, duration);
      return;
    }

    notification.textContent = message;
    notification.style.opacity = '1';
    
    setTimeout(() => {
      notification.style.opacity = '0';
    }, duration);
  }
}

// Global functions for button clicks
async function loadNewArticle() {
  if (window.articleDisplay) {
    await window.articleDisplay.loadNewArticle();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.articleDisplay = new ArticleDisplay();
  
  const newArticleBtn = document.getElementById('newArticleBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  
  if (newArticleBtn) {
    newArticleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await loadNewArticle();
    });
  }
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.articleDisplay.toggleTeaserMode();
    });
  }
});
