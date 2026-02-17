# Troubleshooting Guide

Common issues and their solutions for Beeper Kanban.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Connection Issues](#connection-issues)
- [Message Loading Issues](#message-loading-issues)
- [Performance Issues](#performance-issues)
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
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher
```

Update if needed:
```bash
# Using nvm
nvm install 18
nvm use 18

# Or download from nodejs.org
```

2. **Clear npm cache**:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

3. **Use different registry** (if facing network issues):
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

### "Invalid token" error

**Cause**: Token expired or incorrect

**Solutions**:

1. **Log out and back in to Beeper Desktop**
2. **Get new token** from Developer Tools
3. **Update token** in app settings
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
   - Look for `/api/beeper/data` request
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

### "Load More" not working

**Symptoms**: Button does nothing or shows error

**Check**:
1. Are there actually more messages?
2. Network tab for failed request
3. Console for errors

**Solutions**:

1. **Check if at end of history**:
   - Might be at end of message history
   - Normal if no more messages exist

2. **Check pagination**:
   - Issue with cursor parameter
   - Check API call in Network tab

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

**Solutions**:

1. **Close other tabs**:
   - Especially heavy apps (Figma, video calls)

2. **Reduce polling frequency** (if self-hosting):
   - Increase polling interval in code

### Memory leaks

**Symptoms**: Browser memory usage grows over time

**Solutions**:

1. **Reload page periodically**:
   - Memory resets on reload
   - Reload every few hours if using heavily

2. **Clear data**:
   - Settings → Data → Clear old data
   - Remove old drafts

3. **Update browser**:
   - Latest browser versions have better memory management

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

// Clear all app data
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
5. **Keep documentation handy**: Bookmark this guide
6. **Report issues**: Help improve the app for everyone

---

## Still Stuck?

If this guide didn't help:

1. **Search GitHub Issues**: https://github.com/yourusername/beeper-kanban/issues
2. **Open New Issue**: Provide details as described above
3. **Check Updates**: Ensure you're on latest version

We're here to help!
