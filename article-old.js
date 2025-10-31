// Article display script for FocusGuard extension
class ArticleDisplay {
  // Timing constants
  static FOCUS_SECONDS = 12 * 60;
  static BREAK_SECONDS = 5 * 60;
  static ARTICLES_CACHE_MS = 1000 * 60 * 30; // 30 minutes

  constructor() {
    // Will be filled dynamically from APIs or cache
    this.articles = [];
    
    this.currentArticleIndex = 0;
    this.isTeaserMode = false;
    this.timerState = {
      isActive: false,
      isBlocked: false,
      isPaused: false,
      timeRemaining: ArticleDisplay.FOCUS_SECONDS,
      sessionStartTime: null
    };
    
    // Simple persistent todos
    this.todos = [];
    
    this.init();
  }

  // ------- Small helpers -------
  $(id) { return document.getElementById(id); }
  on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }
  debounce(fn, wait = 250) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
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
    // Preload summarizer in background
    this.preloadSummarizer();
  }

  async prepareArticles() {
    try {
      const cached = await this.getCachedArticles();
      if (cached && Array.isArray(cached) && cached.length > 0) {
        this.articles = cached;
        return;
      }
      const [wikiArticles, spaceArticles, hnArticles, quoteItems] = await Promise.all([
        this.fetchWikipediaSummaries(4),
        this.fetchSpaceflightNews(4),
        this.fetchHackerNewsStories(4),
        this.fetchQuotes(3)
      ]);
      const combined = this.shuffleArray([...wikiArticles, ...spaceArticles, ...hnArticles, ...quoteItems]);
      this.articles = combined.slice(0, 6);
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
    const maxAgeMs = ArticleDisplay.ARTICLES_CACHE_MS;
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
    // Skip quotable.io due to certificate issues - return empty array silently
    // This prevents console errors
    return [];
    /* Disabled due to certificate errors
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`https://api.quotable.io/quotes?tags=science|technology&limit=${limit}`, {
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      }).catch(() => {
        clearTimeout(timeoutId);
        return null;
      });
      clearTimeout(timeoutId);
      if (!resp || !resp.ok) return [];
      const data = await resp.json();
      const results = Array.isArray(data.results) ? data.results : [];
      return results.map(q => ({
        category: 'Inspiration',
        title: q.author || 'Quote',
        sourceName: 'Quotable',
        sourceUrl: `https://api.quotable.io/quotes/${q._id}`,
        content: `
          <blockquote style="margin:0;padding:12px 16px;border-left:4px solid #764ba2;background:rgba(118,75,162,0.08);border-radius:6px;">
            <p style="margin:0 0 6px 0;font-size:18px;">"${this.escapeHtml(q.content)}"</p>
            <footer style="opacity:0.8;">— ${this.escapeHtml(q.author || 'Unknown')}</footer>
          </blockquote>
        `
      }));
    } catch (e) {
      return [];
    }
    */
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
  
  markdownToHtml(markdown) {
    if (!markdown) return '';
    let html = String(markdown);
    
    // Escape HTML first
    html = this.escapeHtml(html);
    
    // Convert bullet points (* item or - item) to list items
    // Do this BEFORE bold/italic conversion to protect bullet asterisks
    const lines = html.split('\n');
    let inList = false;
    const processed = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();
      // Check for bullet point patterns (must be at start of trimmed line)
      const bulletMatch = trimmed.match(/^[\*\-]\s+(.+)$/);
      
      if (bulletMatch) {
        if (!inList) {
          processed.push('<ul>');
          inList = true;
        }
        // Extract the content and convert any markdown within it
        const content = bulletMatch[1];
        // Protect this line - replace bullet asterisk with placeholder
        processed.push(`___BULLET_ITEM___${content}___BULLET_END___`);
      } else {
        if (inList) {
          processed.push('</ul>');
          inList = false;
        }
        processed.push(line);
      }
    }
    
    if (inList) {
      processed.push('</ul>');
    }
    
    html = processed.join('\n');
    
    // Now do bold/italic conversion (bullet asterisks are protected)
    html = html.replace(/\*\*([^*]+?)\*\*/g, '___BOLD_PLACEHOLDER___$1___BOLD_END___');
    html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
    html = html.replace(/___BOLD_PLACEHOLDER___([^_]+?)___BOLD_END___/g, '<strong>$1</strong>');
    
    // Restore bullet points
    html = html.replace(/___BULLET_ITEM___([^_]+?)___BULLET_END___/g, '<li>$1</li>');
    
    // Convert remaining paragraphs (text not in lists)
    html = html.replace(/\n\n+/g, '</p><p>');
    
    // Wrap standalone paragraphs (not already in tags)
    const finalLines = html.split('\n');
    const wrapped = [];
    for (let line of finalLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.match(/^<[uodl]|^<\/[uodl]|^<li|^<\/li|^<p|^<\/p|^<strong|^<\/strong|^<em|^<\/em/)) {
        if (!trimmed.startsWith('<')) {
          wrapped.push(`<p>${trimmed}</p>`);
        } else {
          wrapped.push(line);
        }
      } else if (!trimmed) {
        wrapped.push('<br>');
      } else {
        wrapped.push(line);
      }
    }
    html = wrapped.join('\n');
    
    return html;
  }
  
  async loadTimerState() {
    try {
      const result = await chrome.storage.local.get('timerState');
      if (result.timerState) {
        this.timerState = { ...this.timerState, ...result.timerState };
        // Clamp to 12-minute focus when not on break
        if (!this.timerState.isBlocked) {
          const maxFocus = 12 * 60;
          if (typeof this.timerState.timeRemaining === 'number' && this.timerState.timeRemaining > maxFocus) {
            this.timerState.timeRemaining = maxFocus;
            await chrome.storage.local.set({ timerState: this.timerState });
          }
        }
      }
    } catch (error) {
      console.error('Error loading timer state:', error);
    }
  }
  
  displayArticle() {
    
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
    const articleCard = this.$('articleCard');
    const teaserCard = this.$('teaserCard');
    if (teaserCard) teaserCard.style.display = 'none';
    if (articleCard) articleCard.style.display = 'block';
    
    articleCard.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <div class="article-category">${article.category}</div>
      </div>
      <h2 class="article-title">${article.title}</h2>
      <div class="article-content">${article.content}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb;">
        ${article.sourceUrl ? `<button class=\"btn\" id=\"readInPageBtn\">📰 Read in page</button>
        <a class=\"btn btn-secondary\" href=\"${article.sourceUrl}\" target=\"_blank\" rel=\"noreferrer\">Open in new tab</a>` : ''}
        <button class="btn btn-secondary" id="summarizeBtn">📝 Summarize</button>
      </div>
    `;

    // Wire up in-page reader
    const readInPageBtn = this.$('readInPageBtn');
    if (readInPageBtn && article.sourceUrl) {
      readInPageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openReader(article.title, article.sourceUrl);
      });
    }

    // Wire summarizer
    const summarizeBtn = document.getElementById('summarizeBtn');
    if (summarizeBtn) {
      summarizeBtn.onclick = async () => {
        await this.summarizeCurrentArticle();
      };
    }

    // Initialize summarizer control state
    this.updateSummarizeControls();
  }


  async summarizeCurrentArticle() {
    try {
      const result = await this.getSummarizer();
      
      if (result.status === 'ready' && result.summarizer) {
        const articleCard = this.$('articleCard');
        if (!articleCard) return;
        
        // Get title and content
        const titleEl = articleCard.querySelector('.article-title');
        const contentEl = articleCard.querySelector('.article-content');
        if (!contentEl) return;
        
        // Store original if not already stored (and not translated)
        if (!this._originalArticleHtml) {
          this._originalArticleHtml = contentEl.innerHTML;
        }
        
        // Get clean text: title + content
        const titleText = titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : '';
        const contentText = contentEl.innerText || contentEl.textContent || '';
        const fullText = titleText ? `${titleText}\n\n${contentText}` : contentText;
        
        if (!fullText || fullText.length < 50) {
          if (this?.showNotification) {
            this.showNotification('Article too short to summarize');
          }
          return;
        }

        // Show loading state
        const summarizeBtn = document.getElementById('summarizeBtn');
        if (summarizeBtn) {
          summarizeBtn.disabled = true;
          summarizeBtn.textContent = '⏳ Summarizing...';
        }

        try {
          
          // Request longer, detailed summary
          // The Summarizer API requires outputLanguage - try passing it in summarize() options
          let summary;
          // Always pass outputLanguage in options - this is required by Chrome API
          // Try with just outputLanguage first (most compatible)
          try {
            summary = await result.summarizer.summarize(fullText, { outputLanguage: 'en' });
          } catch (e1) {
            // If that fails, the API might not accept options at all
            // In that case, outputLanguage from create() should be used
            // But if it still warns, we may need to recreate the instance
            summary = await result.summarizer.summarize(fullText);
          }
          
          // If we got a summary and want longer, try requesting it with length option
          // but only if the basic call worked (meaning options might be supported)
          if (summary && summary.length < 200) {
            try {
              const longerSummary = await result.summarizer.summarize(fullText, { 
                outputLanguage: 'en',
                length: 'long'
              });
              if (longerSummary && longerSummary.length > summary.length) {
                summary = longerSummary;
              }
            } catch (e) {
              // Ignore - use the summary we already have
            }
          }
          
          // If summary is too short or contains placeholder text, enhance it using languageModel
          const hasPlaceholders = summary && /\[.*?\]|insert|placeholder|briefly describe|replace.*with/i.test(summary);
          
          if ((summary && summary.length < 200) || hasPlaceholders) {
            try {
              const LM = window.ai?.languageModel ?? globalThis.LanguageModel;
              if (LM) {
                const availability = typeof LM.availability === 'function' ? await LM.availability() : null;
                if (availability && availability !== 'unavailable') {
                  const params = typeof LM.params === 'function' ? await LM.params() : null;
                  const session = await LM.create({
                    temperature: 0.3, // Lower temperature for more factual content
                    topK: Math.min(8, params?.maxTopK ?? 8),
                    outputLanguage: 'en'
                  });
                  
                  // Create a better prompt that includes context and explicitly avoids placeholders
                  const articlePreview = fullText.slice(0, 1000); // First 1000 chars for context
                  const enhancePrompt = `Based ONLY on the following article content, create a detailed summary (200-400 words). 
                  
IMPORTANT: 
- Use ONLY information from the article below
- Do NOT use placeholders like [Insert...], [Briefly describe...], or any bracketed instructions
- Do NOT invent or add information not present in the article
- Focus on the main points, key facts, and important details from the actual article

Article:
${articlePreview}

${summary && summary.length > 50 ? `\nCurrent summary (may contain errors - correct based on article):\n${summary}` : ''}

Write a clear, detailed summary based on the article content above:`;

                  const enhanced = await session.prompt(enhancePrompt, { outputLanguage: 'en' });
                  session.destroy?.();
                  
                  // Validate enhanced summary doesn't contain placeholders
                  if (enhanced && !/\[.*?\]|insert.*here|briefly describe|replace.*with/i.test(enhanced)) {
                    if (enhanced.length > summary.length || hasPlaceholders) {
                      summary = enhanced;
                    }
                  }
                }
              }
            } catch (e3) {
            }
          }
          
          // Final validation: if summary still has placeholders, try one more time with just the article
          if (summary && /\[.*?\]|insert.*here|briefly describe/i.test(summary)) {
            try {
              const LM = window.ai?.languageModel ?? globalThis.LanguageModel;
              if (LM) {
                const availability = typeof LM.availability === 'function' ? await LM.availability() : null;
                if (availability && availability !== 'unavailable') {
                  const params = typeof LM.params === 'function' ? await LM.params() : null;
                  const session = await LM.create({
                    temperature: 0.3,
                    topK: Math.min(8, params?.maxTopK ?? 8),
                    outputLanguage: 'en'
                  });
                  
                  const articleText = fullText.slice(0, 2000); // Use first 2000 chars
                  const regenPrompt = `Summarize the following article in 200-400 words. Use ONLY facts from the article. No placeholders, no [Insert...] text, no instructions.

Article:
${articleText}

Summary:`;
                  
                  const regen = await session.prompt(regenPrompt, { outputLanguage: 'en' });
                  session.destroy?.();
                  
                  if (regen && !/\[.*?\]|insert|placeholder|briefly describe/i.test(regen)) {
                    summary = regen;
                  }
                }
              }
            } catch (e4) {
            }
          }
          
          const summarizeBtn = document.getElementById('summarizeBtn');
          if (summarizeBtn) {
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = '📝 Summarize';
          }
          
          // Store original summary HTML
          this._originalSummaryHtml = this.markdownToHtml(summary);
          
          // Make summary the primary view - scroll to top and show prominently
          contentEl.innerHTML = `
            <div id="summarySection" style="background:linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);border-left:4px solid #0ea5e9;padding:24px;margin-bottom:24px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                <h3 style="margin:0;color:#0369a1;font-size:1.3rem;font-weight:600;">📝 AI Summary</h3>
                <div style="display:flex;gap:8px;align-items:center;margin-left:auto;flex-wrap:wrap;">
                  <button class="btn btn-secondary" id="showFullArticleBtn" style="font-size:0.85rem;">Show Full Article</button>
                </div>
              </div>
              <div id="summaryContent" style="color:#1e3a8a;line-height:1.8;font-size:1.05rem;">${this._originalSummaryHtml}</div>
            </div>
            <div id="fullArticleSection" style="display:none;border-top:2px solid #e5e7eb;padding-top:20px;margin-top:20px;">
              <button class="btn btn-secondary" id="hideFullArticleBtn" style="margin-bottom:12px;font-size:0.85rem;">Hide Full Article</button>
              <h4 style="margin:0 0 12px 0;opacity:0.8;">Full Article</h4>
              ${this._originalArticleHtml}
            </div>
          `;
          
          // Wire up show/hide buttons
          const showBtn = document.getElementById('showFullArticleBtn');
          const hideBtn = document.getElementById('hideFullArticleBtn');
          const fullSection = document.getElementById('fullArticleSection');
          if (showBtn && fullSection) {
            showBtn.onclick = () => {
              fullSection.style.display = 'block';
              showBtn.style.display = 'none';
              fullSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
          }
          if (hideBtn && fullSection) {
            hideBtn.onclick = () => {
              fullSection.style.display = 'none';
              if (showBtn) showBtn.style.display = 'inline-block';
              document.getElementById('summarySection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
          }
          
          // Scroll to summary
          setTimeout(() => {
            const summarySection = document.getElementById('summarySection');
            if (summarySection) {
              summarySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        } catch (e) {
          console.error('Summarization error:', e);
          if (this?.showNotification) {
            this.showNotification('Summarization failed');
          }
          const summarizeBtn = document.getElementById('summarizeBtn');
          if (summarizeBtn) {
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = '📝 Summarize';
          }
        }
      } else if (result.status === 'needs-download') {
        // User gesture detected - attempt to trigger download
        try {
          const S = window.ai?.summarizer ?? globalThis.Summarizer;
          if (S) {
            // Trigger download by attempting create (user gesture required) - with outputLanguage
            this._summarizerInflight = Promise.race([
              S.create({ outputLanguage: 'en' }),
              new Promise((_, r) => setTimeout(() => r(new Error('create-timeout')), 30000))
            ]);
            this._summarizer = await this._summarizerInflight;
            this._summarizerInflight = null;
            // Retry summarization after download
            await this.summarizeCurrentArticle();
          }
        } catch (e) {
          if (this?.showNotification) {
            this.showNotification('Downloading summarizer model… please wait and try again.');
          }
        }
      } else if (result.status === 'unavailable') {
        if (this?.showNotification) {
          this.showNotification('Summarizer unavailable. Ensure Chrome AI features are enabled.');
        }
      } else if (result.status === 'error') {
        if (this?.showNotification) {
          this.showNotification('Summarization failed. Please try again.');
        }
      } else {
        if (this?.showNotification) {
          this.showNotification('Summarizer unavailable');
        }
      }
    } catch (e) {
      console.error('Summarization error:', e);
      if (this?.showNotification) {
        this.showNotification('Summarization failed');
      }
    }
  }

  async preloadSummarizer() {
    // Preload summarizer in background for faster summarization
    try {
      const result = await this.getSummarizer();
      if (result.status === 'ready') {
      }
    } catch (e) {
    }
  }

  async getSummarizer() {
    try {
      const S = window.ai?.summarizer ?? globalThis.Summarizer;
      if (!S) {
        return { summarizer: null, status: 'unavailable' };
      }

      // Check availability same way as languageModel
      let availability = typeof S.availability === 'function' ? await S.availability() : null;
      if (!availability && typeof S.capabilities === 'function') {
        const caps = await S.capabilities();
        availability = caps?.available === 'readily'
          ? 'available'
          : caps?.available === 'after-download'
          ? 'downloadable'
          : 'unavailable';
      }
      
      if (availability === 'unavailable' || availability === 'downloading') {
        return { summarizer: null, status: 'unavailable' };
      }
      
      if (availability === 'downloadable') {
        if (this?.showNotification) {
          this.showNotification('Summarizer model needs download. Click again to download.');
        }
        return { summarizer: null, status: 'needs-download' };
      }

      // Always create fresh instance with outputLanguage each time
      // This ensures outputLanguage is always properly set
      this._summarizer = null;
      this._summarizerInflight = null;
      
      const summarizer = await Promise.race([
        S.create({ outputLanguage: 'en' }),
        new Promise((_, r) => setTimeout(() => r(new Error('create-timeout')), 15000))
      ]);

      this._summarizer = summarizer;

      return { summarizer: this._summarizer, status: 'ready' };
    } catch (err) {
      this._summarizerInflight = null;
      
      // If error is about download, return needs-download status
      if (err?.message?.includes('download') || err?.message?.includes('Download')) {
        return { summarizer: null, status: 'needs-download' };
      }
      
      return { summarizer: null, status: 'error' };
    }
  }

  async updateSummarizeControls() {
    const summarizeBtn = document.getElementById('summarizeBtn');
    if (!summarizeBtn) return;
    
    // Always show the button - let error handling deal with unavailability
    summarizeBtn.style.display = 'inline-block';
    summarizeBtn.disabled = false;
    summarizeBtn.style.opacity = '';
    
    try {
      const S = window.ai?.summarizer ?? globalThis.Summarizer;
      
      if (!S) {
        // Summarizer API not found
        summarizeBtn.title = 'Summarizer API not detected - will attempt on click';
        return;
      }
      
      // Check availability same way as languageModel
      let availability = typeof S.availability === 'function' ? await S.availability() : null;
      if (!availability && typeof S.capabilities === 'function') {
        const caps = await S.capabilities();
        availability = caps?.available === 'readily'
          ? 'available'
          : caps?.available === 'after-download'
          ? 'downloadable'
          : 'unavailable';
      }
      
      
      if (availability === 'unavailable' || availability === 'downloading') {
        summarizeBtn.title = 'Summarizer not available';
        summarizeBtn.disabled = false; // Still allow click to show proper error
        return;
      }
      
      if (availability === 'downloadable') {
        summarizeBtn.title = 'Click to download summarizer model (requires user gesture)';
        return;
      }
      
      // Ready to use
      summarizeBtn.title = 'Generate AI summary of this article';
    } catch (err) {
      console.error('updateSummarizeControls error:', err);
      summarizeBtn.title = 'Click to try summarization';
    }
  }

openReader(title, url) {
    const overlay = this.$('readerOverlay');
    const frame = this.$('readerFrame');
    const fallback = this.$('readerFallback');
    const readerTitle = this.$('readerTitle');
    const openInNewTabBtn = this.$('openInNewTabBtn');
    const fallbackOpenBtn = this.$('fallbackOpenBtn');
    const closeBtn = this.$('closeReaderBtn');

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
    if (this.isTeaserMode) {
      // If in teaser mode, show a fresh teaser instead
      this.renderRandomTeaser();
      return;
    }
    
    // Show loading state
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
    
    // Ensure articles are loaded
    if (!this.articles || this.articles.length === 0) {
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
    this.displayArticle();

    // Top-up when getting close to the end of the list
    const remaining = this.articles.length - this.currentArticleIndex - 1;
    if (remaining < 2) {
      const more = await this.fetchMoreMixed(4);
      if (more.length > 0) {
        const deduped = this.mergeDedupArticles(this.articles, more);
        this.articles = deduped;
        await this.setCachedArticles(this.articles);
      }
    }
  }

  // --------- Teaser Mode ---------
  toggleTeaserMode() {
    this.isTeaserMode = !this.isTeaserMode;
    const articleCard = this.$('articleCard');
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

  async renderRandomTeaser() {
    try {
      const cached = await chrome.storage.local.get(['aiTeasersCache', 'aiTeasersLoading']);
      let queue = Array.isArray(cached.aiTeasersCache) ? cached.aiTeasersCache : [];
      const seen = await this.getSeenAiKeys();

      // Proactively refill cache if running low (< 5 items)
      if (queue.length < 5 && !cached.aiTeasersLoading && typeof window.generateAiTeasers === 'function') {
        this.topUpAiCache();
      }

      // Try AI first: show an unseen AI teaser if available
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

          // Proactively top-up cache if running low (< 5 items)
          if (queue.length < 5 && !cached.aiTeasersLoading && typeof window.generateAiTeasers === 'function') {
            this.topUpAiCache();
          }
          return;
        }
      }

      // Fallback: show built-in immediately
      this.renderBuiltinTeaser();

      // Top-up in background if not already loading
      if (!cached.aiTeasersLoading && typeof window.generateAiTeasers === 'function') {
        this.topUpAiCache();
      }
    } catch (_) {
      this.renderBuiltinTeaser();
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
    const title = 'Math Riddle';
    const question = 'A farmer has 17 sheep, and all but 9 die. How many are left?';
    const answer = '9';
    this.renderTeaser(title, `<p>${question}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim();
      resultEl.textContent = val === answer ? 'Correct! ✅' : 'Try again ❌';
    }, { answer });
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
    }, { answer: original });
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
    }, { hint: `Think: ${pick.rule}`, answer: pick.answer });
  }

  teaserPatternLogic() {
    const title = 'Pattern Logic';
    const desc = 'Find the next pair: (A,1), (C,3), (E,5), (?)';
    const answer = 'G,7';
    this.renderTeaser(title, `<p>${this.escapeHtml(desc)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toUpperCase().replace(/\s+/g,'');
      resultEl.textContent = val === 'G,7' || val === 'G,7'.replace(',','') ? 'Correct! ✅' : 'Try again ❌';
    }, { hint: 'Skip letters by 2; numbers +2', answer });
  }

  teaserQuickRiddle() {
    const title = 'Quick Riddle';
    const q = 'What has keys but can\'t open locks?';
    const answer = 'piano';
    this.renderTeaser(title, `<p>${this.escapeHtml(q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val === answer ? 'Correct! ✅' : 'Try again ❌';
    }, { hint: 'It makes music', answer });
  }

  teaserOddOneOut() {
    const title = 'Odd One Out';
    const items = ['Mercury', 'Venus', 'Pluto', 'Earth'];
    const answer = 'Pluto';
    const q = `Which is the odd one out: ${items.join(', ')}?`;
    this.renderTeaser(title, `<p>${this.escapeHtml(q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val === answer.toLowerCase() ? 'Correct! ✅' : 'Hint: Dwarf planet';
    }, { hint: 'Think classification', answer });
  }

  teaserAnalogy() {
    const title = 'Analogy';
    const q = 'Hand is to glove as foot is to ____?';
    const answer = 'sock';
    this.renderTeaser(title, `<p>${this.escapeHtml(q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val === answer ? 'Correct! ✅' : 'Try again ❌';
    }, { hint: 'Clothing', answer });
  }

  teaserAnagram() {
    const title = 'Anagram';
    const word = 'listen';
    const answer = 'silent';
    const q = `Find an anagram of "${word.toUpperCase()}"`;
    this.renderTeaser(title, `<p>${this.escapeHtml(q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val === answer ? 'Correct! ✅' : 'Not quite ❌';
    }, { hint: 'Starts with S', answer });
  }

  teaserQuickMath() {
    const title = 'Quick Math';
    const q = 'What is 15% of 200?';
    const answer = '30';
    this.renderTeaser(title, `<p>${this.escapeHtml(q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim();
      resultEl.textContent = val === answer ? 'Correct! ✅' : 'Try again ❌';
    }, { hint: '10% + 5%', answer });
  }

  teaserLateral() {
    const title = 'Lateral Thinking';
    const q = 'A man pushes his car to a hotel and loses his fortune. What happened?';
    const answer = 'monopoly';
    this.renderTeaser(title, `<p>${this.escapeHtml(q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(answer) ? 'Correct! ✅' : 'Think board games 🎲';
    }, { hint: 'Board game', answer });
  }

  teaserRiddle2() {
    const riddles = [
      { q: 'I speak without a mouth and hear without ears. I have no body but come alive with wind. What am I?', a: 'echo' },
      { q: 'The more you take, the more you leave behind. What am I?', a: 'footsteps' },
      { q: 'I have cities but no houses, forests but no trees, and water but no fish. What am I?', a: 'map' }
    ];
    const pick = riddles[Math.floor(Math.random() * riddles.length)];
    this.renderTeaser('Riddle', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(pick.a) ? 'Correct! ✅' : 'Think carefully 🧠';
    }, { hint: 'Think outside the box', answer: pick.a });
  }

  teaserWordplay() {
    const puzzles = [
      { q: 'What word becomes shorter when you add two letters?', a: 'short' },
      { q: 'What has 4 eyes but cannot see?', a: 'mississippi' },
      { q: 'What starts with E, ends with E, but only contains one letter?', a: 'envelope' }
    ];
    const pick = puzzles[Math.floor(Math.random() * puzzles.length)];
    this.renderTeaser('Wordplay', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(pick.a) ? 'Correct! ✅' : 'Play with words 🔤';
    }, { hint: 'Word trick', answer: pick.a });
  }

  teaserLogicPuzzle() {
    const puzzles = [
      { q: 'All roses are flowers. Some flowers fade quickly. Therefore, some roses fade quickly. True or False?', a: 'false' },
      { q: 'If all cats are mammals, and all mammals are animals, are all cats animals?', a: 'yes' },
      { q: 'A box contains 3 red balls and 2 blue balls. If you pick one at random, what color are you more likely to get?', a: 'red' }
    ];
    const pick = puzzles[Math.floor(Math.random() * puzzles.length)];
    this.renderTeaser('Logic Puzzle', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(pick.a) ? 'Correct! ✅' : 'Apply logic 🧩';
    }, { hint: 'Use reasoning', answer: pick.a });
  }

  teaserMathPuzzle() {
    const puzzles = [
      { q: 'If a train travels 60 mph for 2.5 hours, how far does it go?', a: '150' },
      { q: 'What is the square root of 144?', a: '12' },
      { q: 'If 5x + 3 = 18, what is x?', a: '3' },
      { q: 'How many degrees are in a triangle?', a: '180' }
    ];
    const pick = puzzles[Math.floor(Math.random() * puzzles.length)];
    this.renderTeaser('Math Puzzle', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim();
      resultEl.textContent = val === pick.a ? 'Correct! ✅' : 'Calculate 🔢';
    }, { hint: 'Do the math', answer: pick.a });
  }

  teaserCodeBreak() {
    const codes = [
      { q: 'If A=1, B=2, C=3... what does CODE spell in numbers?', a: '3,15,4,5' },
      { q: 'ROT13: What is "EBG13" in plain text?', a: 'rot13' },
      { q: 'In Morse code, what letter is represented by · — · ·?', a: 'c' }
    ];
    const pick = codes[Math.floor(Math.random() * codes.length)];
    this.renderTeaser('Code Break', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(pick.a) ? 'Correct! ✅' : 'Decode it 🔐';
    }, { hint: 'Pattern recognition', answer: pick.a });
  }

  teaserVisualPattern() {
    const patterns = [
      { q: 'What comes next: ⭐ ☆ ⭐ ☆ ?', a: '⭐' },
      { q: 'Pattern: 2, 4, 8, 16, ?', a: '32' },
      { q: 'ABCD, EFGH, IJKL, ?', a: 'mnop' }
    ];
    const pick = patterns[Math.floor(Math.random() * patterns.length)];
    this.renderTeaser('Visual Pattern', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(pick.a.toLowerCase()) ? 'Correct! ✅' : 'Find the pattern 🔍';
    }, { hint: 'Look for repetition', answer: pick.a });
  }

  teaserReversal() {
    const reversals = [
      { q: 'Spell "stressed" backwards.', a: 'desserts' },
      { q: 'What word reads the same forward and backward?', a: 'racecar' },
      { q: 'Reverse the word "drawer"', a: 'reward' }
    ];
    const pick = reversals[Math.floor(Math.random() * reversals.length)];
    this.renderTeaser('Reversal', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(pick.a) ? 'Correct! ✅' : 'Flip it ↪️';
    }, { hint: 'Reverse order', answer: pick.a });
  }

  teaserMissingLink() {
    const links = [
      { q: 'Complete: Apple, Banana, Cherry, ?', a: 'date' },
      { q: 'Continue: Monday, Tuesday, Wednesday, ?', a: 'thursday' },
      { q: 'Sequence: 5, 10, 15, 20, ?', a: '25' }
    ];
    const pick = links[Math.floor(Math.random() * links.length)];
    this.renderTeaser('Missing Link', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(pick.a) ? 'Correct! ✅' : 'Find the connection 🔗';
    }, { hint: 'Look for sequence', answer: pick.a });
  }

  teaserWordChain() {
    const chains = [
      { q: 'Word chain: CAT -> BAT -> BAG -> ?', a: 'bug' },
      { q: 'Change one letter: HATE -> GATE -> ?', a: 'date' },
      { q: 'Link: DOG -> LOG -> LOT -> ?', a: 'pot' }
    ];
    const pick = chains[Math.floor(Math.random() * chains.length)];
    this.renderTeaser('Word Chain', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(pick.a) ? 'Correct! ✅' : 'Follow the chain ⛓️';
    }, { hint: 'One letter changes', answer: pick.a });
  }

  teaserTrivia() {
    const trivia = [
      { q: 'How many continents are there?', a: '7' },
      { q: 'What planet is known as the Red Planet?', a: 'mars' },
      { q: 'How many sides does a hexagon have?', a: '6' },
      { q: 'What is the largest ocean?', a: 'pacific' }
    ];
    const pick = trivia[Math.floor(Math.random() * trivia.length)];
    this.renderTeaser('Trivia', `<p>${this.escapeHtml(pick.q)}</p>`, (inputEl, resultEl) => {
      const val = (inputEl.value || '').trim().toLowerCase();
      resultEl.textContent = val.includes(pick.a) ? 'Correct! ✅' : 'Test your knowledge 📚';
    }, { hint: 'General knowledge', answer: pick.a });
  }

  makeHintFromAnswer(answer) {
    if (!answer) return '';
    const clean = String(answer).replace(/[^a-z0-9]/gi,'');
    if (clean.length <= 2) return `Length: ${clean.length}`;
    return `Starts with: ${clean[0].toUpperCase()}`;
  }

  // ---- AI Teaser de-dup helpers ----
  makeAiKey(teaser) {
    const norm = (s) => String(s || '')
      .toLowerCase()
      .replace(/[`~!@#$%^&*()_+\-={}\[\]\\|;:'",.<>/?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const q = norm(teaser?.question);
    const a = norm(teaser?.answer);
    return `${q}::${a}`;
  }

  async getSeenAiKeys() {
    try {
      const { seenAiTeasers } = await chrome.storage.local.get('seenAiTeasers');
      return new Set(Array.isArray(seenAiTeasers) ? seenAiTeasers : []);
    } catch (_) { return new Set(); }
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

  // ---- Article de-dup helper (used by older code paths) ----
  getArticleKey(art) {
    const url = (art?.sourceUrl || '').toString();
    if (url) {
      try {
        const u = new URL(url);
        u.search = '';
        u.hash = '';
        return u.toString().toLowerCase();
      } catch (_) {}
    }
    return (art?.title || '').toString().toLowerCase();
  }

  // ---- RSS fetch stub (prevents runtime error if called) ----
  async fetchRssFeeds(maxTotal = 0) {
    try {
      // Intentionally returning empty to avoid network issues; can be filled later
      return [];
    } catch (_) { return []; }
  }

  renderTeaser(title, html, onCheck, options = {}) {
    const tTitle = document.getElementById('teaserTitle');
    const tContent = document.getElementById('teaserContent');
    const tActions = document.getElementById('teaserActions');
    const aiBadge = document.getElementById('teaserAIBadge');
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
      const inputEl = document.getElementById('teaserInput');
      const resultEl = document.getElementById('teaserResult');
      onCheck(inputEl, resultEl);
    };
    if (options.hint) {
      hintBtn.onclick = () => {
        const resultEl = document.getElementById('teaserResult');
        if (resultEl) resultEl.textContent = `Hint: ${options.hint}`;
      };
    }
    showAnswerBtn.onclick = () => {
      const resultEl = document.getElementById('teaserResult');
      if (resultEl && options.answer) {
        resultEl.textContent = `Answer: ${options.answer}`;
        resultEl.style.color = '#4CAF50';
        showAnswerBtn.disabled = true;
        showAnswerBtn.style.opacity = '0.6';
      }
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
    const timerDisplay = this.$('timerDisplay');
    const timerStatus = this.$('timerStatus');
    const progressBar = this.$('progressBar');
    
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
    const totalTime = this.timerState.isBlocked ? 5 * 60 : 12 * 60;
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
      this.timerState.timeRemaining = 12 * 60; // 12 minutes focus
      
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
    const input = this.$('todoInput');
    const addBtn = this.$('todoAddBtn');
    if (!input || !addBtn) return;
    const addHandler = async () => {
      const text = (input.value || '').trim();
      if (!text) return;
      this.addTodo(text);
      input.value = '';
      await this.saveTodos();
      this.renderTodos();
    };
    this.on(addBtn, 'click', (e) => { e.preventDefault(); addHandler(); });
    this.on(input, 'keydown', (e) => {
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
    const list = this.$('todoList');
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

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let drawing = false;
    let tool = 'pen';
    let color = '#4c6ef5';
    let size = 6;
    let opacity = 1;

    const colorEl = document.getElementById('calmColor');
    const sizeEl = document.getElementById('calmSize');
    const penBtn = document.getElementById('calmPenBtn');
    const eraserBtn = document.getElementById('calmEraserBtn');
    const clearBtn = document.getElementById('calmClearBtn');
    const statusEl = document.getElementById('calmStatus');
    const opacityEl = document.getElementById('calmOpacity');

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = Math.max(300, Math.floor(rect.width));
      canvas.height = Math.max(180, Math.floor(rect.height));
      try { ctx.putImageData(img, 0, 0); } catch (_) {}
    };

    const saveImmediate = async () => {
      try {
        const data = canvas.toDataURL('image/png');
        await chrome.storage.local.set({ calmPad: data });
        if (statusEl) statusEl.textContent = 'Saved ✨';
        setTimeout(() => { if (statusEl) statusEl.textContent = 'Relax and draw ✨'; }, 1000);
      } catch (_) {}
    };
    const save = this.debounce(saveImmediate, 300);

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
      if (tool === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
      } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#000000';
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const end = async () => { if (!drawing) return; drawing = false; await save(); };

    // Events
    this.on(canvas, 'pointerdown', start);
    this.on(canvas, 'pointermove', move);
    this.on(window, 'pointerup', end);
    this.on(window, 'pointercancel', end);

    this.on(colorEl, 'input', (e) => { color = e.target.value; });
    document.querySelectorAll('.calm-swatch').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const c = ev.currentTarget.getAttribute('data-color');
        if (c) { color = c; if (colorEl) colorEl.value = c; }
      });
    });
    this.on(sizeEl, 'input', (e) => { size = parseInt(e.target.value || '6', 10); });
    this.on(opacityEl, 'input', (e) => { opacity = parseFloat(e.target.value || '1') || 1; });
    this.on(penBtn, 'click', () => {
      tool = 'pen';
      penBtn.classList.remove('btn-secondary');
      eraserBtn.classList.add('btn-secondary');
    });
    this.on(eraserBtn, 'click', () => {
      tool = 'eraser';
      eraserBtn.classList.remove('btn-secondary');
      penBtn.classList.add('btn-secondary');
    });
    this.on(clearBtn, 'click', async () => { ctx.clearRect(0, 0, canvas.width, canvas.height); await saveImmediate(); });

    // Toggle card visibility
    this.on(calmBtn, 'click', (e) => {
      e.preventDefault();
      const showing = card.style.display === 'block';
      card.style.display = showing ? 'none' : 'block';
      const articleCard = this.$('articleCard');
      const teaserCard = this.$('teaserCard');
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
    this.on(this.$('newArticleBtn'), 'click', hideBoard);
    this.on(this.$('shuffleBtn'), 'click', hideBoard);

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
});
