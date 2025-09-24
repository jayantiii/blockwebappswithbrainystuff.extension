// Background script for FocusGuard extension
class FocusGuardBackground {
  constructor() {
    this.timerState = {
      isActive: false,
      isBlocked: false,
      isPaused: false,
      timeRemaining: 20 * 60, // 20 minutes in seconds
      sessionStartTime: null,
      sessionsCompleted: 0,
      totalFocusedTime: 0
    };
    
    this.blockedSites = [];
    this.timerInterval = null;
    
    this.init();
  }
  
  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.startTimer();
  }
  
  async loadData() {
    try {
      const result = await chrome.storage.local.get(['blockedSites', 'timerState', 'dailyStats']);
      this.blockedSites = result.blockedSites || [];
      this.timerState = { ...this.timerState, ...(result.timerState || {}) };
      
      // Load daily stats
      const today = new Date().toDateString();
      const dailyStats = result.dailyStats || {};
      if (dailyStats[today]) {
        this.timerState.sessionsCompleted = dailyStats[today].sessionsCompleted || 0;
        this.timerState.totalFocusedTime = dailyStats[today].totalFocusedTime || 0;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }
  
  async saveData() {
    try {
      await chrome.storage.local.set({
        blockedSites: this.blockedSites,
        timerState: this.timerState
      });
      
      // Save daily stats
      const today = new Date().toDateString();
      const dailyStats = await chrome.storage.local.get('dailyStats');
      const currentDailyStats = dailyStats.dailyStats || {};
      
      currentDailyStats[today] = {
        sessionsCompleted: this.timerState.sessionsCompleted,
        totalFocusedTime: this.timerState.totalFocusedTime
      };
      
      await chrome.storage.local.set({ dailyStats: currentDailyStats });
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }
  
  setupEventListeners() {
    // Listen for messages from popup and content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'startFocusSession':
          this.startFocusSession();
          sendResponse({ success: true });
          break;
        case 'pauseTimer':
          this.pauseTimer();
          sendResponse({ success: true });
          break;
        case 'resumeTimer':
          this.resumeTimer();
          sendResponse({ success: true });
          break;
        case 'stopTimer':
          this.stopFocusSession();
          sendResponse({ success: true });
          break;
        case 'getTimerState':
          sendResponse({ timerState: this.timerState });
          break;
        case 'openPopup':
          chrome.action.openPopup();
          break;
        case 'updateBlockedSites':
          this.blockedSites = request.blockedSites;
          this.saveData();
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.blockedSites) {
          this.blockedSites = changes.blockedSites.newValue || [];
        }
        if (changes.timerState) {
          this.timerState = { ...this.timerState, ...changes.timerState.newValue };
        }
      }
    });
  }
  
  startFocusSession() {
    this.timerState.isActive = true;
    this.timerState.isBlocked = false;
    this.timerState.isPaused = false;
    this.timerState.timeRemaining = 20 * 60; // 20 minutes
    this.timerState.sessionStartTime = Date.now();
    
    this.saveData();
    this.showNotification('Focus session started! 🎯 Stay on the article page!');
  }
  
  pauseTimer() {
    if (this.timerState.isActive) {
      this.timerState.isPaused = true;
      this.saveData();
    }
  }
  
  resumeTimer() {
    if (this.timerState.isActive && this.timerState.isPaused) {
      this.timerState.isPaused = false;
      this.saveData();
    }
  }
  
  stopFocusSession() {
    this.timerState.isActive = false;
    this.timerState.isPaused = false;
    this.saveData();
    this.showNotification('Focus session stopped');
  }
  
  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      if (this.timerState.isActive && !this.timerState.isPaused) {
        this.timerState.timeRemaining--;
        
        if (this.timerState.timeRemaining <= 0) {
          this.handleTimerComplete();
        }
        
        this.saveData();
      }
    }, 1000);
  }
  
  handleTimerComplete() {
    if (!this.timerState.isBlocked) {
      // Focus session completed, start break
      this.timerState.isBlocked = true;
      this.timerState.timeRemaining = 5 * 60; // 5 minutes break
      this.timerState.sessionsCompleted++;
      this.timerState.totalFocusedTime += 20; // 20 minutes focused
      
      this.showNotification('Great job! 🎉 You earned a 5-minute break!');
    } else {
      // Break completed, start new focus session
      this.timerState.isBlocked = false;
      this.timerState.timeRemaining = 20 * 60; // 20 minutes focus
      
      this.showNotification('Break time is over! Time to focus again! 🎯');
    }
    
    this.saveData();
  }
  
  showNotification(message) {
    // Use badge text as lightweight notification to avoid icon asset issues
    try {
      chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
      chrome.action.setBadgeText({ text: '•' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
    } catch (_) {}
  }
  
  // Check if a URL should be blocked
  shouldBlockUrl(url) {
    if (!this.timerState.isActive || this.timerState.isBlocked) {
      return false;
    }
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      return this.blockedSites.some(site => {
        return hostname.includes(site) || site.includes(hostname);
      });
    } catch (error) {
      return false;
    }
  }
}

// Initialize the background service
const focusGuard = new FocusGuardBackground();

// Optional: set a generated icon at runtime so the toolbar isn't a gray letter
async function setRuntimeIcon() {
  try {
    const sizes = [16, 32, 48, 128];
    const images = {};
    for (const s of sizes) {
      const canvas = new OffscreenCanvas(s, s);
      const ctx = canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, s, s);
      grad.addColorStop(0, '#667eea');
      grad.addColorStop(1, '#764ba2');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s);
      // White FG monogram
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.floor(s * 0.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', s / 2, s / 2 + (s * 0.06));
      images[s] = ctx.getImageData(0, 0, s, s);
    }
    await chrome.action.setIcon({ imageData: images });
  } catch (_) {}
}

setRuntimeIcon();
