# Focus the Unfocus

A productivity Chrome extension that transforms distractions into learning opportunities. Block distracting websites and engage with curated articles, brain teasers, and a calming drawing board while you focus.

## 🎯 Overview

Focus the Unfocus gamifies productivity by blocking distracting websites for 12-minute focus sessions. When you complete a session, you earn a 5-minute break. The extension replaces blocked sites with engaging educational content, keeping your mind active while helping you refocus.

## ✨ Features

- **🛡️ Website Blocking**: Block distracting websites during focus sessions
- **📚 Curated Articles**: Auto-fetched articles from science, technology, space, and more
- **🧠 Brain Teasers**: AI-generated and built-in puzzles to keep your mind sharp
- **🎨 Calming Drawing Board**: Creative outlet for stress relief
- **✅ To-Do List**: Persistent task management during focus sessions
- **📝 AI Summarization**: Summarize articles using Chrome's built-in AI
- **⏰ Smart Timer**: 12-minute focus sessions with 5-minute break rewards
- **🎮 Gamification**: Earn breaks by staying focused

## 🚀 Quick Start for Judges

### Prerequisites

- **Google Chrome** (version 131 or later recommended for Chrome AI features)
- Chrome AI features enabled (for Summarizer and Language Model APIs)

### Installation Steps

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/jayantiii/blockwebappswithbrainystuff.extension.git
   cd blockwebappswithbrainystuff.extension
   ```

2. **Enable Chrome AI Features** (Required for full functionality)
   - Open Chrome and navigate to `chrome://flags/`
   - Search for "AI" or "Chrome AI"
   - Enable "Chrome AI" or "Built-in AI" features
   - Restart Chrome

3. **Load the Extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **"Developer mode"** toggle in the top right corner
   - Click **"Load unpacked"** button
   - Select the `blockwebapps.ext` folder (the folder containing `manifest.json`)
   - The extension icon should appear in your Chrome toolbar

4. **Verify Installation**
   - Look for the "Focus the Unfocus" extension icon in your Chrome toolbar
   - You should see it without any error indicators

## 🧪 Testing Instructions

### Test 1: Basic Functionality

1. **Open the extension popup**
   - Click the extension icon in the toolbar
   - You should see the settings interface

2. **Add a blocked website**
   - Enter a distracting site URL (e.g., `instagram.com` or `twitter.com`)
   - Click "Add" to block it

3. **Visit the blocked site**
   - Navigate to the blocked website in a new tab
   - You should be redirected to the Focus the Unfocus article page
   - The timer should start automatically (12 minutes)

### Test 2: Article Features

1. **Browse articles**
   - Click "New Article" button
   - Articles should load from various sources (Wikipedia, Spaceflight News, Hacker News, RSS feeds)
   - Content should be diverse and engaging

2. **Test AI Summarization** (requires Chrome AI enabled)
   - Click "📝 Summarize" button on any article
   - A detailed summary should appear
   - Summary should be formatted nicely with HTML

3. **Test article navigation**
   - Click "📰 Read in page" to open in-page reader
   - Click "Open in new tab" to open full article
   - Both should work correctly

### Test 3: Brain Teasers

1. **Access brain teasers**
   - Click "Brain Teasers" button
   - A brain teaser should appear

2. **Test teaser interaction**
   - Try entering an answer
   - Click "Check" to verify
   - Try "Hint" button (if available)
   - Try "Show Answer" button
   - Click "Another" for a new teaser

3. **Test AI-generated teasers** (requires Chrome AI enabled)
   - Look for "AI generated" badge on some teasers
   - Verify variety in teaser types

### Test 4: Drawing Board

1. **Open drawing board**
   - Click "Calm Board" button
   - Drawing canvas should appear

2. **Test drawing features**
   - Draw with the pen tool
   - Switch to eraser
   - Change colors using the color picker or swatches
   - Adjust brush size
   - Clear the canvas
   - Verify drawing persists after page reload

### Test 5: To-Do List

1. **Add tasks**
   - Enter a task in the to-do input
   - Press Enter or click "Add"
   - Task should appear in the list

2. **Manage tasks**
   - Check off completed tasks
   - Delete tasks using the ✕ button
   - Verify tasks persist after page reload

3. **Test daily cleanup**
   - Complete some tasks
   - The completed tasks should be automatically deleted at the start of the next day

### Test 6: Timer Functionality

1. **Monitor timer**
   - Check the timer display (should show 12:00 when focus session starts)
   - Timer should count down
   - Status should indicate "Focus Time - Keep reading!"

2. **Test pause/resume**
   - Switch to another tab
   - Timer should pause
   - Return to the tab
   - Timer should resume

3. **Test break reward** (optional - wait 12 minutes)
   - After 12 minutes, break should start
   - Timer should reset to 5:00
   - Status should show "Break Time - Sites are unblocked!"
   - Blocked sites should be accessible

### Test 7: Chrome AI Integration

1. **Verify AI features**
   - Open browser console (F12)
   - Check for any errors related to AI APIs
   - Summarizer should work if Chrome AI is enabled
   - Brain teaser generation should work if Chrome AI is enabled

2. **Test without AI features** (graceful degradation)
   - If Chrome AI is disabled, extension should still work
   - Summarizer button may show as unavailable
   - Built-in brain teasers should still work

## 📁 Project Structure

```
blockwebapps.ext/
├── manifest.json              # Extension configuration
├── popup.html                 # Settings interface
├── popup.js                   # Popup functionality
├── article.html               # Main focus page
├── article.js                 # Main application logic
├── content.js                 # Website blocking logic
├── background.js              # Background service worker
├── src/                       # Modular source files
│   ├── article-fetcher.js     # Article fetching logic
│   ├── article-renderer.js    # Article display
│   ├── timer-manager.js       # Timer functionality
│   ├── todo-manager.js        # To-do list management
│   ├── drawing-board.js       # Drawing board
│   ├── summarizer-manager.js  # AI summarization
│   ├── teaser-manager.js      # Brain teasers
│   ├── builtin-teasers.js     # Built-in teaser definitions
│   ├── subtitle-rotator.js    # Quote rotation
│   ├── ai.js                  # AI teaser generation
│   ├── utils.js               # Utility functions
│   └── constants.js           # App constants
├── README.md                  # This file
├── LICENSE                    # MIT License
└── HACKATHON_SUBMISSION.md    # Hackathon submission details
```

## 🛠️ Technologies Used

- **HTML/CSS/JavaScript** - Core web technologies
- **Chrome Extension APIs**:
  - Storage API - Local data persistence
  - Declarative Net Request - Website blocking
  - Built-in AI APIs - Summarizer and Language Model
- **External APIs**:
  - Wikipedia API
  - Spaceflight News API
  - Hacker News API
  - RSS feeds from various sources

## 🔧 Development

### Running Locally

1. Follow the installation steps above
2. Make changes to source files
3. Go to `chrome://extensions/`
4. Click the refresh icon on the extension card to reload

### Debugging

- Open browser console (F12) to see logs
- Check `chrome://extensions/` for extension errors
- Use Chrome DevTools for debugging

## 📝 Browser Console Testing

To verify everything is working, open the browser console (F12) and check:
- No critical errors
- Extension loaded successfully
- Timer state saved/loaded correctly
- Articles fetched successfully

## ⚠️ Known Limitations

- **Chrome AI Features**: Some features (AI summarization, AI brain teasers) require Chrome AI to be enabled. The extension gracefully degrades if these aren't available.
- **Network Dependency**: Article fetching requires internet connection
- **RSS Feeds**: Some RSS feeds may be unavailable or slow to load

## 🐛 Troubleshooting

### Extension not loading
- Ensure Developer mode is enabled
- Check that `manifest.json` is valid
- Look for errors in `chrome://extensions/`

### Timer not working
- Check browser console for errors
- Verify extension permissions are granted
- Try reloading the extension

### Articles not loading
- Check internet connection
- Verify host permissions in `manifest.json`
- Check browser console for API errors

### AI features not working
- Ensure Chrome AI is enabled in `chrome://flags/`
- Check Chrome version (131+ recommended)
- Verify permissions in extension settings

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

Jayanti Lahoti - jayantirl2001@gmail.com
Built for hackathon submission - transforming distractions into learning opportunities.

## 🙏 Acknowledgments

- Chrome Extension API documentation
- Various content sources (Wikipedia, Spaceflight News, Hacker News, RSS feeds)
- Chrome Built-in AI team for amazing on-device AI capabilities