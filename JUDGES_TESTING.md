# Testing Guide for Judges

This document provides step-by-step instructions for judges to test the Focus the Unfocus Chrome extension.

## Pre-Testing Setup (5 minutes)

### Step 1: Enable Chrome AI Features (Important!)
1. Open Chrome browser
2. Navigate to `chrome://flags/`
3. Search for "AI" or "Chrome AI"
4. Enable any Chrome AI-related flags (e.g., "Chrome AI", "Built-in AI")
5. **Restart Chrome** (required)

### Step 2: Install the Extension
1. Download/clone this repository
2. Open Chrome
3. Go to `chrome://extensions/`
4. Enable **"Developer mode"** (toggle in top right)
5. Click **"Load unpacked"**
6. Select the repository folder (`blockwebapps.ext`)
7. Verify the extension appears without errors

### Step 3: Quick Verification
- Extension icon should appear in Chrome toolbar
- No red error messages in `chrome://extensions/`

## Quick Test Scenario (10 minutes)

### Test Flow 1: Core Functionality

1. **Setup Blocking**
   - Click extension icon → Add `instagram.com` → Click "Add"

2. **Trigger Blocking**
   - Open new tab → Navigate to `instagram.com`
   - ✅ Should redirect to article page
   - ✅ Timer should show 12:00 and start counting

3. **Test Articles**
   - Click "New Article" button
   - ✅ Article should load with content
   - ✅ Category, title, and content visible
   - Click "📝 Summarize" (if Chrome AI enabled)
   - ✅ Summary should appear

4. **Test Brain Teasers**
   - Click "Brain Teasers" button
   - ✅ Teaser appears with question
   - Enter an answer → Click "Check"
   - ✅ Feedback appears
   - Click "Show Answer"
   - ✅ Answer displayed

5. **Test Drawing Board**
   - Click "Calm Board" button
   - ✅ Canvas appears
   - Draw something → Change colors → Test eraser
   - ✅ Drawing works and saves

6. **Test To-Do List**
   - Add a task → Check it off → Delete a task
   - ✅ All operations work

### Test Flow 2: Timer & Break System

1. **Monitor Timer**
   - Block a site and visit it
   - ✅ Timer shows 12:00 and counts down
   - ✅ Status shows "Focus Time - Keep reading!"

2. **Test Pause/Resume**
   - Switch to another tab
   - ✅ Timer pauses (check status)
   - Return to article tab
   - ✅ Timer resumes

3. **Test Break (Optional - can skip 12 min wait)**
   - Wait for timer to reach 00:00 OR manually check code
   - ✅ Break should start (5:00 timer)
   - ✅ Status shows "Break Time - Sites are unblocked!"
   - ✅ Blocked sites accessible

## Feature Checklist

### ✅ Core Features
- [ ] Website blocking works
- [ ] Redirect to article page works
- [ ] Timer starts automatically
- [ ] Timer counts down correctly
- [ ] Articles load and display
- [ ] "New Article" button works
- [ ] Article navigation works (read in page, open in new tab)

### ✅ Advanced Features
- [ ] Brain teasers display and work
- [ ] Drawing board functions (pen, eraser, colors, clear)
- [ ] To-do list (add, complete, delete)
- [ ] To-do list persists after reload
- [ ] Drawing board persists after reload

### ✅ AI Features (if Chrome AI enabled)
- [ ] Summarizer button appears and works
- [ ] Summaries are generated and formatted correctly
- [ ] AI-generated brain teasers appear
- [ ] AI teasers have "AI generated" badge

### ✅ Timer Features
- [ ] Timer displays correctly
- [ ] Timer pauses when tab hidden
- [ ] Timer resumes when tab visible
- [ ] Timer state persists after reload
- [ ] Break system works (after 12 min)

## Expected Behaviors

### ✅ What Should Work
- Extension loads without errors
- All buttons are clickable and functional
- Articles load from various sources
- Timer accurately tracks time
- All features save state locally
- UI is responsive and intuitive

### ⚠️ Graceful Degradation
- If Chrome AI is disabled:
  - Extension still works
  - Summarizer may show as unavailable (this is expected)
  - Built-in brain teasers still work
  - AI-generated teasers won't appear (expected)

## Troubleshooting for Judges

### Issue: Extension won't load
**Solution**: Check Developer mode is enabled, verify manifest.json exists

### Issue: Timer not starting
**Solution**: Make sure you visit a blocked site, timer starts automatically

### Issue: Articles not loading
**Solution**: Check internet connection, verify host permissions granted

### Issue: AI features not working
**Solution**: Ensure Chrome AI is enabled in chrome://flags/ and Chrome is restarted

### Issue: Extension errors
**Solution**: Check browser console (F12) for specific error messages

## Browser Console Verification

Open console (F12) and check for:
- ✅ No critical errors (red messages)
- ✅ Extension loaded messages
- ✅ Timer state messages
- ⚠️ Warnings are okay (e.g., outputLanguage warnings are known)

## Time Estimate

- **Full test**: 15-20 minutes
- **Quick test**: 5-10 minutes (skip break timer wait)

## Notes for Judges

- The extension uses Chrome's Built-in AI APIs which require Chrome AI to be enabled
- Some features gracefully degrade if AI is not available
- All data is stored locally (no external servers)
- The extension works best with Chrome 131+
- Timer persistence means you can close and reopen tabs without losing progress

## Contact

Jayanti Lahoti - jayantirl2001@gmail.com
