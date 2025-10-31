// Timer management module
class TimerManager {
  constructor() {
    this.FOCUS_SECONDS = 12 * 60;
    this.BREAK_SECONDS = 5 * 60;
    this.timerState = {
      isActive: false,
      isBlocked: false,
      isPaused: false,
      timeRemaining: this.FOCUS_SECONDS,
      sessionStartTime: 0,
      totalFocusedTime: 0,
    };
    this.timerInterval = null;
    this.onCompleteCallback = null;
    this.onNotificationCallback = null;
  }

  $(id) { return document.getElementById(id); }

  setCallbacks(onComplete, onNotification) {
    this.onCompleteCallback = onComplete;
    this.onNotificationCallback = onNotification;
  }

  async loadTimerState() {
    try {
      const result = await chrome.storage.local.get('timerState');
      if (result.timerState) {
        this.timerState = { ...this.timerState, ...result.timerState };
        // Clamp to 12-minute focus when not on break
        if (!this.timerState.isBlocked) {
          const maxFocus = this.FOCUS_SECONDS;
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

  async saveTimerState() {
    try {
      await chrome.storage.local.set({ timerState: this.timerState });
    } catch (error) {
      console.error('Error saving timer state:', error);
    }
  }

  updateTimer() {
    const timerDisplay = this.$('timerDisplay');
    const timerStatus = this.$('timerStatus');
    const progressBar = this.$('progressBar');
    
    if (!timerDisplay || !timerStatus || !progressBar) return;

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
    
    const totalTime = this.timerState.isBlocked ? this.BREAK_SECONDS : this.FOCUS_SECONDS;
    const progress = ((totalTime - this.timerState.timeRemaining) / totalTime) * 100;
    progressBar.style.width = `${progress}%`;
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
        
        this.updateTimer();
        this.saveTimerState();
      }
    }, 1000);
  }

  handleTimerComplete() {
    if (!this.timerState.isBlocked) {
      this.timerState.isBlocked = true;
      this.timerState.timeRemaining = this.BREAK_SECONDS;
      if (this.onNotificationCallback) {
        this.onNotificationCallback('Great job! 🎉 You earned a 5-minute break!');
      }
    } else {
      this.timerState.isBlocked = false;
      this.timerState.timeRemaining = this.FOCUS_SECONDS;
      if (this.onNotificationCallback) {
        this.onNotificationCallback('Break time is over! Time to focus again! 🎯');
      }
    }
    
    this.updateTimer();
    this.saveTimerState();
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }
  }

  setupTabVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (this.timerState.isActive) {
        if (document.hidden) {
          this.timerState.isPaused = true;
          this.saveTimerState();
          chrome.runtime.sendMessage({ action: 'pauseTimer' });
        } else {
          this.timerState.isPaused = false;
          this.saveTimerState();
          chrome.runtime.sendMessage({ action: 'resumeTimer' });
        }
        this.updateTimer();
      }
    });
  }

  activate() {
    this.timerState.isActive = true;
    this.timerState.isPaused = false;
    this.saveTimerState();
    this.startTimer();
    this.updateTimer();
  }

  getState() {
    return { ...this.timerState };
  }

  setState(state) {
    this.timerState = { ...this.timerState, ...state };
    this.saveTimerState();
    this.updateTimer();
  }
}
