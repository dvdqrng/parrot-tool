# Troubleshooting Guide

Common issues and their solutions for Parrot.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Connection Issues](#connection-issues)
- [Message Loading Issues](#message-loading-issues)
- [AI Integration Issues](#ai-integration-issues)
- [Autopilot Issues](#autopilot-issues)
- [Performance Issues](#performance-issues)
- [Electron App Issues](#electron-app-issues)
- [Data & Storage Issues](#data--storage-issues)
- [Browser-Specific Issues](#browser-specific-issues)

---

## Installation Issues

### `npm install` fails

**Symptoms**: Errors during dependency installation

**Common Causes**:
- Node.js version too old
- npm cache corrupted
- Network issues
- Permission problems

**Solutions**:

1. **Check Node.js version**:
```bash
node --version  # Should be 20.x or higher
npm --version   # Should be 9.x or higher
```

Update if needed:
```bash
# Using nvm
nvm install 20
nvm use 20

# Or download from nodejs.org
```

2. **Clear npm cache**:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

3. **Use different registry** (if in China or facing network issues):
```bash
npm install --registry=https://registry.npmmirror.com
```

4. **Fix permissions** (macOS/Linux):
```bash
sudo chown -R $(whoami) ~/.npm
```

### TypeScript errors on first run

**Symptoms**: Red squiggly lines everywhere in VS Code

**Solutions**:

1. **Restart TypeScript server**:
   - VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"

2. **Rebuild**:
```bash
rm -rf .next
npm run build
```

3. **Check tsconfig.json** is present

---

## Connection Issues

### Cannot connect to Beeper

**Symptoms**:
- "Connection Error" message
- Messages not loading
- Empty columns

**Check**:
1. Beeper Desktop is running
2. You're logged into Beeper
3. Internet connection is working
4. Access token is valid

**Solutions**:

1. **Verify Beeper Desktop is running**:
   - Open Beeper Desktop
   - Ensure you're logged in
   - Send a test message

2. **Get fresh access token**:
   - Beeper Desktop → Developer Tools
   - Application → Local Storage
   - Copy fresh token
   - Settings → Platforms → Update token

3. **Check token format**:
   - Should be long alphanumeric string
   - No extra spaces or quotes
   - Complete copy (don't truncate)

4. **Verify network**:
```bash
# Test connection to Beeper API
curl https://api.beeper.com/health
```

### "Invalid token" error

**Cause**: Token expired or incorrect

**Solutions**:

1. **Log out and back in to Beeper Desktop**
2. **Get new token** from Developer Tools
3. **Update token** in Parrot settings
4. **Verify token** is copied completely

### API calls failing

**Symptoms**: Network tab shows 401/403 errors

**Check**:
1. Browser console for error messages
2. Network tab for failed requests
3. Request headers include correct token

**Solutions**:

1. **Check request headers**:
   - Open DevTools → Network
   - Click failed request
   - Verify `x-beeper-token` header exists
   - Value matches your token

2. **Clear browser cache**:
   - Hard reload: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

3. **Try incognito mode**:
   - Rules out extension conflicts

---

## Message Loading Issues

### Messages not appearing

**Symptoms**: Columns are empty despite having messages in Beeper

**Checklist**:
- [ ] Beeper Desktop is running
- [ ] Access token is configured
- [ ] At least one platform is selected
- [ ] Internet connection is working
- [ ] No JavaScript errors in console

**Solutions**:

1. **Check platform selection**:
   - Settings → Platforms
   - Ensure checkboxes are checked
   - Click "Save Settings"

2. **Manual refresh**:
   - Click refresh button (↻)
   - Wait 5-10 seconds

3. **Check browser console**:
```javascript
// Open console (F12)
// Look for errors
// Common errors:
- "Failed to fetch"
- "CORS error"
- "401 Unauthorized"
```

4. **Verify API response**:
   - DevTools → Network tab
   - Look for `/api/beeper/messages` request
   - Check response body has data

5. **Check hidden chats**:
   - Settings → Hidden Chats
   - Unhide if needed

### Messages stuck loading forever

**Symptoms**: Spinner never stops

**Cause**: API call hanging or erroring silently

**Solutions**:

1. **Check Network tab**:
   - DevTools → Network
   - Look for stuck requests
   - Cancel and retry

2. **Reload page**:
   - Hard reload: `Cmd+Shift+R`

3. **Check Beeper Desktop**:
   - Restart Beeper Desktop
   - Verify it loads messages normally

4. **Reduce limit**:
   - Modify request to load fewer messages
   - Check if large message history causing timeout

### "Load More" not working

**Symptoms**: Button does nothing or shows error

**Check**:
1. Are there actually more messages?
2. Network tab for failed request
3. Console for errors

**Solutions**:

1. **Check `hasMore` flag**:
   - Might be at end of message history
   - Normal if no more messages exist

2. **Check timestamp pagination**:
   - Issue with `before` parameter
   - Check API call in Network tab

---

## AI Integration Issues

### AI draft generation fails

**Symptoms**:
- Draft shows "Generating..." forever
- Error toast appears
- Draft created but empty

**By Provider**:

#### Anthropic Issues

**"Invalid API key"**:
- Verify key format: `sk-ant-...`
- Check key is active in Anthropic Console
- Ensure key has credits

**"Rate limit exceeded"**:
- Wait a few minutes
- Check usage in Anthropic Console
- Upgrade plan if needed

**"Model not available"**:
- Check model exists (claude-3-sonnet-20240229)
- May need to request access

**Solutions**:
```bash
# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-sonnet-20240229","max_tokens":100,"messages":[{"role":"user","content":"test"}]}'
```

#### OpenAI Issues

**"Invalid API key"**:
- Verify key format: `sk-...`
- Check key in OpenAI Platform
- Ensure billing is set up

**"Insufficient quota"**:
- Add credits to OpenAI account
- Check billing in Platform

**"Model not found"**:
- Verify model name (e.g., `gpt-4`, `gpt-3.5-turbo`)
- Check you have access to that model

**Solutions**:
```bash
# Test API key
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}'
```

#### Ollama Issues

**"Cannot connect to Ollama"**:

**Check if running**:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve
```

**"Model not found"**:
```bash
# List installed models
ollama list

# Pull model if needed
ollama pull llama2
```

**Wrong URL**:
- Default: `http://localhost:11434`
- Check Settings → API Keys → Ollama Base URL
- Ensure port is correct

**Firewall blocking**:
```bash
# Test connection
curl http://localhost:11434/api/tags

# If fails, check firewall settings
```

### AI responses are poor quality

**Symptoms**: Responses don't make sense or are off-tone

**Solutions**:

1. **Adjust tone settings**:
   - Settings → Tone
   - Move sliders to desired position
   - Test with new draft

2. **Train writing style**:
   - Settings → Tone → Writing Style
   - Add 5-10 sample messages
   - Click "Analyze Style"

3. **Check system prompts** (for autopilot):
   - Review agent configuration
   - Make prompts more specific
   - Add constraints and examples

4. **Try different model**:
   - OpenAI: Try `gpt-4` instead of `gpt-3.5-turbo`
   - Ollama: Try `llama3` instead of `llama2`

### AI chat assistant not responding

**Check**:
1. Message panel is open
2. AI chat panel is visible (toggle with chat icon)
3. Provider is configured
4. API key is valid

**Solutions**:

1. **Toggle panel**:
   - Close and reopen AI chat panel
   - Close and reopen message panel

2. **Check console**:
   - Look for API errors
   - Network tab for failed requests

3. **Verify configuration**:
   - Settings → API Keys
   - Ensure provider and key are set

---

## Autopilot Issues

### Autopilot not responding

**Symptoms**: Agent enabled but no drafts appearing

**Checklist**:
- [ ] Autopilot enabled for chat
- [ ] Agent is selected
- [ ] Agent status is "Active"
- [ ] Not outside activity hours
- [ ] Response rate not at 0
- [ ] No errors in activity log

**Solutions**:

1. **Check activity hours**:
   - Settings → Autopilot → Agents → [Your Agent]
   - Review activity hours setting
   - If enabled, verify current time is within range

2. **Check response rate**:
   - Agent behavior settings
   - If set to < 100%, agent may randomly not respond
   - This is normal behavior

3. **Review activity log**:
   - Settings → Autopilot → Activity
   - Look for errors or "skipped-busy" entries
   - Check for recent activity

4. **Verify mode**:
   - Manual Approval: Check Drafts column
   - Self-Driving: Check Autopilot column and activity log

5. **Check AI provider**:
   - Ensure AI provider is working
   - Test with manual draft generation
   - Verify API key is valid

### Autopilot sending at wrong times

**Symptoms**: Messages sent immediately or at wrong intervals

**Check**:
1. Agent behavior settings
2. Activity hours configuration
3. Scheduled actions in storage

**Solutions**:

1. **Adjust delay settings**:
   - Settings → Autopilot → Agents → [Agent]
   - Increase Min/Max reply delays
   - Enable context-aware delays

2. **Check activity hours**:
   - Verify timezone is correct
   - Verify start/end hours match your schedule

3. **Review scheduled actions**:
   - Open browser DevTools
   - Application → Local Storage
   - Look for `parrot-autopilot-actions`
   - Check `scheduledFor` timestamps

### Self-driving mode not working

**Symptoms**: Enabled but agent not sending automatically

**Check**:
1. Mode is set to "Self-Driving" (not Manual Approval)
2. Duration hasn't expired
3. No errors in activity log

**Solutions**:

1. **Verify mode**:
   - Open message panel
   - Click autopilot icon
   - Confirm "Self-Driving" is selected

2. **Check duration**:
   - Look for "Expires at:" timestamp
   - If expired, re-enable with new duration

3. **Check errors**:
   - Settings → Autopilot → Activity
   - Look for error entries
   - Address any API issues

4. **Verify Beeper token**:
   - Token must be valid to send messages
   - Refresh token if needed

### Goal not being detected

**Symptoms**: Conversation continues past goal completion

**Solutions**:

1. **Review agent goal**:
   - Settings → Autopilot → Agents → [Agent]
   - Make goal more specific
   - Example: "Schedule meeting with confirmed date AND time"

2. **Check goal completion behavior**:
   - Ensure it's not set to "Maintenance"
   - Try "Handoff" to see if goal is being detected

3. **Review conversation**:
   - Was goal actually achieved?
   - AI may correctly detect goal not met

4. **Update system prompt**:
```
Add explicit goal completion instruction:

"When you have successfully [achieved goal], explicitly state:
'GOAL COMPLETED: [brief confirmation]'"
```

---

## Performance Issues

### App is slow/laggy

**Symptoms**: UI feels sluggish, delayed reactions

**Common Causes**:
- Large message history
- Too many messages loaded
- Browser extensions interfering
- System resources low

**Solutions**:

1. **Reduce loaded messages**:
   - Don't click "Load More" repeatedly
   - Archive old conversations
   - Clear old drafts

2. **Disable browser extensions**:
   - Try incognito mode
   - Disable extensions one by one
   - Ad blockers can sometimes interfere

3. **Check system resources**:
   - Close unused tabs
   - Check CPU/RAM usage
   - Restart browser

4. **Clear browser cache**:
   - Settings → Privacy → Clear browsing data
   - Or hard reload: `Cmd+Shift+R`

### High CPU usage

**Symptoms**: Fan running loud, system hot

**Check**:
1. Browser task manager (what's using CPU?)
2. Are multiple tabs open?
3. Is autopilot running intensively?

**Solutions**:

1. **Reduce polling frequency**:
   - Edit `app/page.tsx`
   - Increase interval from 10000ms to 30000ms

2. **Pause autopilot**:
   - Disable autopilot temporarily
   - Check if CPU usage drops

3. **Close other tabs**:
   - Especially heavy apps (Figma, video calls)

### Memory leaks

**Symptoms**: Browser memory usage grows over time

**Solutions**:

1. **Reload page periodically**:
   - Memory resets on reload
   - Reload every few hours if using heavily

2. **Clear data**:
   - Settings → Data → Clear AI Chat History
   - Remove old drafts

3. **Update browser**:
   - Latest browser versions have better memory management

---

## Electron App Issues

### App won't start

**Symptoms**: Electron window doesn't open

**Checklist**:
- [ ] Next.js dev server is running
- [ ] Port 3000 is available
- [ ] Electron is installed

**Solutions**:

1. **Start Next.js first**:
```bash
# Terminal 1
npm run dev

# Wait for "Ready on http://localhost:3000"

# Terminal 2
npm run electron
```

2. **Check port 3000**:
```bash
# See what's using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill if needed
kill -9 [PID]
```

3. **Reinstall Electron**:
```bash
npm uninstall electron
npm install electron --save-dev
```

### Dev Tools showing by default

**Symptom**: Developer Tools open on start

**Cause**: `mainWindow.webContents.openDevTools()` in electron.js

**Solution**:
```javascript
// electron.js
// Comment out or remove:
// mainWindow.webContents.openDevTools();
```

### App crashes on startup

**Check**:
1. Console output for errors
2. Electron logs

**Solutions**:

1. **Run with verbose logging**:
```bash
ELECTRON_ENABLE_LOGGING=1 npm run electron
```

2. **Clear Electron cache**:
```bash
# macOS
rm -rf ~/Library/Application\ Support/Electron

# Linux
rm -rf ~/.config/Electron

# Windows
rmdir /s %APPDATA%\Electron
```

---

## Data & Storage Issues

### Settings not persisting

**Symptoms**: Settings reset on page reload

**Cause**: LocalStorage not working or cleared

**Check**:
1. Not in incognito/private mode
2. LocalStorage enabled in browser
3. Storage quota not exceeded

**Solutions**:

1. **Check browser mode**:
   - Don't use incognito for persistent data
   - Use normal browser window

2. **Check storage**:
```javascript
// Open console (F12)
console.log(localStorage.getItem('parrot-settings'))
// Should return JSON string, not null
```

3. **Check quota**:
   - Browser storage limit: ~5-10MB
   - Clear old data if needed
   - Settings → Data → Clear old data

4. **Browser settings**:
   - Ensure cookies/storage is allowed
   - Check for privacy extensions blocking storage

### Data disappeared

**Symptoms**: Drafts, settings, or history gone

**Possible Causes**:
- Browser cache cleared
- Browser update reset storage
- Switched browser/profile
- Incognito mode closed

**Solutions**:

1. **Check if in correct browser/profile**:
   - Data is per-browser and per-profile
   - Switch to correct profile

2. **Import backup** (if you have one):
   - Settings → Data → Import Data
   - Select backup JSON file

3. **Can't recover** if no backup:
   - LocalStorage data is not recoverable once cleared
   - **Prevention**: Export data regularly

### Unable to export data

**Symptoms**: Export button doesn't work

**Solutions**:

1. **Check browser console** for errors

2. **Try different browser**

3. **Manual export**:
```javascript
// Open console (F12)
const data = {
  settings: localStorage.getItem('parrot-settings'),
  drafts: localStorage.getItem('parrot-drafts'),
  // Add other keys as needed
}
console.log(JSON.stringify(data, null, 2))
// Copy output
```

---

## Browser-Specific Issues

### Chrome/Edge Issues

**Extensions interfering**:
- Disable ad blockers temporarily
- Try incognito mode (disables extensions)

**Storage quota**:
- Chrome has generous storage limits
- Rarely an issue

### Firefox Issues

**CORS errors**:
- Firefox is stricter about CORS
- Usually not an issue with Next.js API routes

**Storage**:
- Check `about:preferences#privacy`
- Ensure "Enhanced Tracking Protection" allows storage

### Safari Issues

**LocalStorage in Private Mode**:
- Safari doesn't persist LocalStorage in Private Browsing
- Use normal mode

**Fetch API issues**:
- Safari can be strict about CORS
- Try Chrome if issues persist

**IndexedDB limitations**:
- Not currently used, but future consideration

---

## Getting More Help

### Before Opening an Issue

1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Check browser console for errors
4. Try in different browser
5. Try with fresh configuration

### When Opening an Issue

Include:
- **Browser & Version**: e.g., Chrome 120.0.6099.109
- **OS**: macOS 14.1, Windows 11, etc.
- **Node.js version**: `node --version`
- **Error messages**: Copy full error from console
- **Steps to reproduce**: Detailed steps to trigger issue
- **Screenshots**: If UI-related
- **Configuration**: Relevant settings (redact API keys!)

### Emergency Reset

If all else fails:

```javascript
// Open browser console (F12)
// WARNING: This deletes ALL data

// Clear all Parrot data
Object.keys(localStorage)
  .filter(key => key.startsWith('parrot-'))
  .forEach(key => localStorage.removeItem(key))

// Reload page
location.reload()
```

Then reconfigure from scratch.

---

## Prevention Tips

1. **Export data regularly**: Settings → Data → Export All Data
2. **Keep API keys current**: Check expiration dates
3. **Update dependencies**: `npm update` periodically
4. **Monitor console**: Check for warnings during use
5. **Test changes**: Test in manual mode before autopilot
6. **Keep documentation handy**: Bookmark this guide
7. **Report issues**: Help improve the app for everyone

---

## Still Stuck?

If this guide didn't help:

1. **Search GitHub Issues**: https://github.com/yourusername/parrot/issues
2. **Open New Issue**: Provide details as described above
3. **Community**: Discord/Forum if available
4. **Check Updates**: Ensure you're on latest version

We're here to help!
