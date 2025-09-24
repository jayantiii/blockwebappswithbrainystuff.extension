// Popup script for FocusGuard extension
class FocusGuardPopup {
  constructor() {
    this.blockedSites = [];
    this.timerState = {
      isActive: false,
      isBlocked: false,
      isPaused: false,
      timeRemaining: 20 * 60, // 20 minutes in seconds
      sessionStartTime: null,
      sessionsCompleted: 0,
      totalFocusedTime: 0
    };
    
    this.init();
  }
  
  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.updateDisplay();
    this.startTimer();
  }
  
  async loadData() {
    try {
      const result = await chrome.storage.local.get([
        'blockedSites', 
        'timerState', 
        'dailyStats'
      ]);
      
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
    document.getElementById('addSiteBtn').addEventListener('click', () => {
      this.addSite();
    });
    
    document.getElementById('siteInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addSite();
      }
    });
  }
  
  addSite() {
    const input = document.getElementById('siteInput');
    const url = input.value.trim();
    
    if (!url) return;
    
    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url);
    
    if (!this.blockedSites.includes(normalizedUrl)) {
      this.blockedSites.push(normalizedUrl);
      this.saveData();
      this.updateSiteList();
      input.value = '';
    }
  }
  
  removeSite(url) {
    this.blockedSites = this.blockedSites.filter(site => site !== url);
    this.saveData();
    this.updateSiteList();
  }
  
  normalizeUrl(url) {
    // Remove protocol and www
    let normalized = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    return normalized;
  }
  
  updateSiteList() {
    const siteList = document.getElementById('siteList');
    siteList.innerHTML = '';
    
    if (this.blockedSites.length === 0) {
      siteList.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">No blocked sites yet</div>';
      return;
    }
    
    this.blockedSites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';

      const urlSpan = document.createElement('span');
      urlSpan.className = 'site-url';
      urlSpan.textContent = site;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-danger';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        this.confirmAndRemove(site);
      });

      siteItem.appendChild(urlSpan);
      siteItem.appendChild(removeBtn);
      siteList.appendChild(siteItem);
    });
  }

  confirmAndRemove(site) {
    const quotes = [
      '“You become what you give your attention to.” – Epictetus',
      '“What you do every day matters more than what you do once in a while.” – Gretchen Rubin',
      '“The secret of getting ahead is getting started.” – Mark Twain',
      '“Discipline equals freedom.” – Jocko Willink'
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    const message = `Are you sure you want to remove \n"${site}"\nfrom your blocked list?\n\nBe honest: are you removing this to pass time?\n\n${q}`;
    const ok = window.confirm(message);
    if (!ok) return;
    this.removeSite(site);
  }
  
  updateDisplay() {
    this.updateTimerDisplay();
    this.updateSiteList();
    this.updateStats();
  }
  
  updateTimerDisplay() {
    const timerDisplay = document.getElementById('timerDisplay');
    const timerStatus = document.getElementById('timerStatus');
    
    if (!this.timerState.isActive) {
      timerDisplay.textContent = '00:00';
      timerStatus.textContent = 'Timer starts when you visit a blocked site';
      timerStatus.style.color = '#ffd700';
      return;
    }
    
    const minutes = Math.floor(this.timerState.timeRemaining / 60);
    const seconds = this.timerState.timeRemaining % 60;
    
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (this.timerState.isBlocked) {
      timerStatus.textContent = 'Break Time - Sites are unblocked!';
      timerStatus.style.color = '#4CAF50';
    } else if (this.timerState.isPaused) {
      timerStatus.textContent = 'Timer paused - Switch back to continue';
      timerStatus.style.color = '#ff9800';
    } else {
      timerStatus.textContent = 'Focus Time - Stay on the article page!';
      timerStatus.style.color = '#ffd700';
    }
  }
  
  updateStats() {
    document.getElementById('sessionsCompleted').textContent = this.timerState.sessionsCompleted;
    document.getElementById('timeFocused').textContent = `${Math.floor(this.timerState.totalFocusedTime / 60)}m`;
  }
  
  handleTimerComplete() {
    if (!this.timerState.isBlocked) {
      // Focus session completed, start break
      this.timerState.isBlocked = true;
      this.timerState.timeRemaining = 5 * 60; // 5 minutes break
      this.timerState.sessionsCompleted++;
      this.timerState.totalFocusedTime += 20; // 20 minutes focused
      
      // Show notification
      this.showNotification('Great job! 🎉 You earned a 5-minute break!');
    } else {
      // Break completed, start new focus session
      this.timerState.isBlocked = false;
      this.timerState.timeRemaining = 20 * 60; // 20 minutes focus
      
      // Show notification
      this.showNotification('Break time is over! Time to focus again! 🎯');
    }
    
    this.updateDisplay();
    this.saveData();
  }
  
  showNotification(message) {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #4CAF50;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 1000;
      font-size: 14px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }
  
  // Start/stop timer methods
  startFocusSession() {
    this.timerState.isActive = true;
    this.timerState.isBlocked = false;
    this.timerState.timeRemaining = 20 * 60; // 20 minutes
    this.timerState.sessionStartTime = Date.now();
    this.saveData();
  }
  
  startTimer() {
    setInterval(() => {
      if (this.timerState.isActive) {
        this.timerState.timeRemaining--;
        
        if (this.timerState.timeRemaining <= 0) {
          this.handleTimerComplete();
        }
        
        this.updateTimerDisplay();
        this.saveData();
      }
    }, 1000);
  }
  
  stopTimer() {
    this.timerState.isActive = false;
    this.saveData();
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.popup = new FocusGuardPopup();
});
