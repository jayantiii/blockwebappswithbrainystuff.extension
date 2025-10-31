// Article rendering and display module
class ArticleRenderer {
  constructor() {
    this._originalArticleHtml = '';
    this._originalSummaryHtml = '';
    this.readerEscHandler = this.readerEscHandler.bind(this);
  }

  $(id) { return document.getElementById(id); }
  on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  displayArticle(article, onSummarize, onOpenReader) {
    if (!article) {
      const articleCard = this.$('articleCard');
      if (articleCard) {
        articleCard.innerHTML = `
          <div class="article-category">Loading</div>
          <h2 class="article-title">Loading articles...</h2>
          <div class="article-content">
            <p>Please wait while we fetch interesting articles for you.</p>
          </div>
        `;
      }
      return;
    }

    const articleCard = this.$('articleCard');
    const teaserCard = this.$('teaserCard');
    if (teaserCard) teaserCard.style.display = 'none';
    if (articleCard) articleCard.style.display = 'block';
    
    this._originalArticleHtml = article.content;
    
    articleCard.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div class="article-category">${article.category}</div>
      </div>
      <h2 class="article-title">${article.title}</h2>
      <div class="article-content">${article.content}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb;">
        ${article.sourceUrl ? `<button class="btn" id="readInPageBtn">📰 Read in page</button>
        <a class="btn btn-secondary" href="${article.sourceUrl}" target="_blank" rel="noreferrer">Open in new tab</a>` : ''}
        <button class="btn btn-secondary" id="summarizeBtn">📝 Summarize</button>
      </div>
    `;

    // Wire up in-page reader
    const readInPageBtn = this.$('readInPageBtn');
    if (readInPageBtn && article.sourceUrl && onOpenReader) {
      readInPageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        onOpenReader(article.title, article.sourceUrl);
      });
    }

    // Wire summarizer
    const summarizeBtn = this.$('summarizeBtn');
    if (summarizeBtn && onSummarize) {
      summarizeBtn.onclick = async () => {
        await onSummarize();
      };
    }
  }

  displaySummary(summaryHtml, originalHtml) {
    const contentEl = document.querySelector('#articleCard .article-content');
    if (!contentEl) return;

    this._originalSummaryHtml = summaryHtml;
    this._originalArticleHtml = originalHtml || this._originalArticleHtml;

    contentEl.innerHTML = `
      <div id="summarySection" style="background:linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);border-left:4px solid #0ea5e9;padding:24px;margin-bottom:24px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <h3 style="margin:0;color:#0369a1;font-size:1.3rem;font-weight:600;">📝 AI Summary</h3>
          <div style="display:flex;gap:8px;align-items:center;margin-left:auto;flex-wrap:wrap;">
            <button class="btn btn-secondary" id="showFullArticleBtn" style="font-size:0.85rem;">Show Full Article</button>
          </div>
        </div>
        <div id="summaryContent" style="color:#1e3a8a;line-height:1.8;font-size:1.05rem;">${summaryHtml}</div>
      </div>
      <div id="fullArticleSection" style="display:none;border-top:2px solid #e5e7eb;padding-top:20px;margin-top:20px;">
        <button class="btn btn-secondary" id="hideFullArticleBtn" style="margin-bottom:12px;font-size:0.85rem;">Hide Full Article</button>
        <h4 style="margin:0 0 12px 0;opacity:0.8;">Full Article</h4>
        ${this._originalArticleHtml}
      </div>
    `;
    
    // Wire up show/hide buttons
    const showBtn = this.$('showFullArticleBtn');
    const hideBtn = this.$('hideFullArticleBtn');
    const fullSection = this.$('fullArticleSection');
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
      const summarySection = this.$('summarySection');
      if (summarySection) {
        summarySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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

    fallback.style.display = 'none';
    frame.style.display = 'block';
    frame.src = url;

    const onLoad = () => { };
    const onError = () => {
      frame.style.display = 'none';
      fallback.style.display = 'block';
    };
    frame.addEventListener('load', onLoad, { once: true });
    frame.addEventListener('error', onError, { once: true });

    const openFn = () => window.open(url, '_blank', 'noopener,noreferrer');
    if (openInNewTabBtn) openInNewTabBtn.onclick = openFn;
    if (fallbackOpenBtn) fallbackOpenBtn.onclick = openFn;
    if (closeBtn) closeBtn.onclick = () => this.closeReader();

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
    const overlay = this.$('readerOverlay');
    const frame = this.$('readerFrame');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => { overlay.style.display = 'none'; }, 180);
    if (frame) frame.src = 'about:blank';
    document.removeEventListener('keydown', this.readerEscHandler);
  }

  getOriginalArticleHtml() {
    return this._originalArticleHtml;
  }

  setOriginalArticleHtml(html) {
    this._originalArticleHtml = html;
  }
}
