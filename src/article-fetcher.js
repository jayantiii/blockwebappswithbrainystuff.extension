// Article fetching module - handles all article sources
class ArticleFetcher {
  constructor() {
    this.ARTICLES_CACHE_MS = 30 * 60 * 1000; // 30 minutes
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async getCachedArticles() {
    const { cachedArticles, cacheTimestamp } = await chrome.storage.local.get(['cachedArticles', 'cacheTimestamp']);
    if (cachedArticles && cacheTimestamp && (Date.now() - cacheTimestamp < this.ARTICLES_CACHE_MS)) {
      return cachedArticles;
    }
    return null;
  }

  async setCachedArticles(articles) {
    await chrome.storage.local.set({
      cachedArticles: articles,
      cacheTimestamp: Date.now()
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
        const url = data.content_urls?.desktop?.page || data.content_urls?.mobile?.page;
        const imageUrl = data.thumbnail?.source;
        results.push({
          category: 'Wikipedia',
          title,
          content: `<p>${this.escapeHtml(extract)}</p>`,
          sourceName: 'Wikipedia',
          sourceUrl: url || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
        });
      } catch (_) { /* ignore */ }
    }
    return results;
  }

  async fetchSpaceflightNews(limit) {
    try {
      const resp = await fetch(`https://api.spaceflightnewsapi.net/v4/articles/?limit=${limit}`);
      if (!resp.ok) return [];
      const data = await resp.json();
      const results = Array.isArray(data.results) ? data.results : [];
      return results.map(a => ({
        category: 'Spaceflight',
        title: a.title,
        content: `<p>${this.escapeHtml(a.summary)}</p>`,
        sourceName: a.news_site,
        sourceUrl: a.url
      }));
    } catch (e) {
      return [];
    }
  }

  async fetchHackerNewsStories(limit) {
    try {
      const resp = await fetch(`https://hn.algolia.com/api/v1/search?query=story&tags=front_page&hitsPerPage=${limit}`);
      if (!resp.ok) return [];
      const data = await resp.json();
      const hits = Array.isArray(data.hits) ? data.hits : [];
      return hits.map(h => ({
        category: 'Hacker News',
        title: h.title,
        content: `<p>${this.escapeHtml(h.url || h.story_text || 'No content available.')}</p>`,
        sourceName: 'Hacker News',
        sourceUrl: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`
      }));
    } catch (e) {
      return [];
    }
  }

  async fetchQuotes(limit) {
    // Skip quotable.io due to certificate issues
    return [];
  }

  async fetchRssFeeds(limit) {
    try {
      const response = await fetch(chrome.runtime.getURL('src/feeds.json'));
      if (!response.ok) return [];
      const feeds = await response.json();
      
      const allArticles = [];
      const seenUrls = new Set();
      
      for (const feed of this.shuffleArray(feeds)) {
        try {
          const feedResponse = await fetch(feed.url);
          const feedText = await feedResponse.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(feedText, 'text/xml');
          
          const items = Array.from(xmlDoc.querySelectorAll('item, entry'));
          for (const item of items) {
            const titleEl = item.querySelector('title');
            const linkEl = item.querySelector('link');
            const descriptionEl = item.querySelector('description, summary');
            
            const title = titleEl ? titleEl.textContent : 'No Title';
            let url = linkEl ? (linkEl.getAttribute('href') || linkEl.textContent) : null;
            const description = descriptionEl ? descriptionEl.textContent : 'No description available.';
            
            // Sanitize URL if it's a markdown link
            if (url) url = AppUtils.sanitizeMarkdownLink(url);

            if (url && !seenUrls.has(url)) {
              allArticles.push({
                category: feed.category || 'RSS',
                title: title,
                content: `<p>${this.escapeHtml(description)}</p>`,
                sourceName: new URL(feed.url).hostname,
                sourceUrl: url
              });
              seenUrls.add(url);
              if (allArticles.length >= limit) break;
            }
          }
        } catch (e) {
          // Ignore feed errors
        }
        if (allArticles.length >= limit) break;
      }
      return allArticles.slice(0, limit);
    } catch (e) {
      return [];
    }
  }

  normalizeArticleKey(article) {
    if (article.sourceUrl) {
      try {
        const url = new URL(article.sourceUrl);
        return `${url.hostname}${url.pathname}${url.search}`;
      } catch (_) {
        return article.title ? article.title.toLowerCase().trim() : '';
      }
    }
    return article.title ? article.title.toLowerCase().trim() : '';
  }

  async getSeenKeys() {
    const { seenArticleKeys } = await chrome.storage.local.get('seenArticleKeys');
    return new Set(seenArticleKeys || []);
  }

  async addSeenKey(key) {
    const seen = await this.getSeenKeys();
    seen.add(key);
    const arr = Array.from(seen).slice(-1000);
    await chrome.storage.local.set({ seenArticleKeys: arr });
  }

  filterUnseen(articles, seenKeys) {
    return articles.filter(article => {
      const key = this.normalizeArticleKey(article);
      if (seenKeys.has(key)) {
        return false;
      }
      seenKeys.add(key);
      return true;
    });
  }

  mergeDedupArticles(existing, incoming) {
    const seen = new Set(existing.map(a => this.normalizeArticleKey(a)));
    const newArticles = incoming.filter(a => !seen.has(this.normalizeArticleKey(a)));
    return [...existing, ...newArticles];
  }

  async fetchMoreMixed(limit) {
    const [wiki, space, hn, rss, quotes] = await Promise.all([
      this.fetchWikipediaSummaries(Math.ceil(limit / 5)),
      this.fetchSpaceflightNews(Math.ceil(limit / 5)),
      this.fetchHackerNewsStories(Math.ceil(limit / 5)),
      this.fetchRssFeeds(Math.ceil(limit / 5)),
      this.fetchQuotes(2)
    ]);
    return this.shuffleArray([...wiki, ...space, ...hn, ...rss, ...quotes]).slice(0, limit);
  }

  async prepareArticles() {
    try {
      const cached = await this.getCachedArticles();
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
      const [wikiArticles, spaceArticles, hnArticles, quoteItems, rssArticles] = await Promise.all([
        this.fetchWikipediaSummaries(4),
        this.fetchSpaceflightNews(4),
        this.fetchHackerNewsStories(4),
        this.fetchQuotes(3),
        this.fetchRssFeeds(10)
      ]);
      const combined = this.shuffleArray([...wikiArticles, ...spaceArticles, ...hnArticles, ...quoteItems, ...rssArticles]);
      const articles = combined.slice(0, 50);
      await this.setCachedArticles(articles);
      return articles;
    } catch (e) {
      console.error('Error preparing articles:', e);
      return [{
        category: 'Welcome',
        title: 'Welcome to Focus the Unfocus!',
        content: '<p>Start by adding tasks to your to-do list on the left. When you\'re ready, click "New Article" to dive into something interesting. Stay focused for 12 minutes to earn a break!</p><p>Explore brain teasers or relax with the calm board. Your journey to focused learning begins now!</p>',
        sourceName: 'Focus the Unfocus',
        sourceUrl: null
      }];
    }
  }
}
