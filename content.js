// Content script for FocusGuard extension
class WebsiteBlocker {
  constructor() {
    this.blockedSites = [];
    this.timerState = {
      isActive: false,
      isBlocked: false,
      isPaused: false,
      timeRemaining: 20 * 60
    };
    this.isOnArticlePage = false;
    
    this.init();
  }
  
  async init() {
    await this.loadData();
    this.checkAndBlock();
    this.setupTabVisibilityListener();
  }
  
  async loadData() {
    try {
      const result = await chrome.storage.local.get(['blockedSites', 'timerState']);
      this.blockedSites = result.blockedSites || [];
      this.timerState = { ...this.timerState, ...(result.timerState || {}) };
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }
  
  checkAndBlock() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname || '';
    // Only consider http/https pages with a non-empty hostname
    const eligible = (protocol === 'http:' || protocol === 'https:') && hostname.length > 0;
    if (!eligible) return;

    const isBlocked = this.blockedSites.some(site => {
      return hostname.includes(site) || site.includes(hostname);
    });
    
    // Check if we're on the article page
    this.isOnArticlePage = window.location.href.includes('article.html');
    
    if (isBlocked && !this.timerState.isBlocked) {
      this.startFocusSession();
      this.redirectToArticle();
    }
  }
  
  startFocusSession() {
    this.timerState.isActive = true;
    this.timerState.isBlocked = false;
    this.timerState.isPaused = false;
    this.timerState.timeRemaining = 12 * 60; // 12 minutes
    this.timerState.sessionStartTime = Date.now();
    
    // Save timer state
    chrome.storage.local.set({ timerState: this.timerState });
    
    // Send message to background script to start timer
    chrome.runtime.sendMessage({ action: 'startFocusSession' });
  }
  
  redirectToArticle() {
    const articleUrl = chrome.runtime.getURL('article.html');
    window.location.href = articleUrl;
  }
  
  setupTabVisibilityListener() {
    // Pause timer when tab becomes hidden (user switches tabs)
    document.addEventListener('visibilitychange', () => {
      if (this.timerState.isActive && this.isOnArticlePage) {
        if (document.hidden) {
          // Tab is hidden - pause timer
          this.timerState.isPaused = true;
          chrome.storage.local.set({ timerState: this.timerState });
          chrome.runtime.sendMessage({ action: 'pauseTimer' });
        } else {
          // Tab is visible - resume timer
          this.timerState.isPaused = false;
          chrome.storage.local.set({ timerState: this.timerState });
          chrome.runtime.sendMessage({ action: 'resumeTimer' });
        }
      }
    });
  }
  
  // Listen for storage changes to update blocking status
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.blockedSites) {
          this.blockedSites = changes.blockedSites.newValue || [];
        }
        if (changes.timerState) {
          this.timerState = { ...this.timerState, ...changes.timerState.newValue };
        }
        
        // Re-check blocking status when data changes
        this.checkAndBlock();
      }
    });
  }
}

// Initialize the blocker
const blocker = new WebsiteBlocker();
blocker.setupStorageListener();
