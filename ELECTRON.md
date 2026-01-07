# Electron App Guide

Your Parrot app is now a proper Electron desktop application! This guide covers everything you need to know about running, building, and distributing your app.

## Overview

The app has been configured with:
- ✅ Production build support
- ✅ Native application menus
- ✅ Security features (context isolation, sandboxing)
- ✅ Platform-specific packaging (.dmg, .exe, .AppImage)
- ✅ Development vs production mode handling
- ✅ Proper error handling
- ✅ Code signing support (requires configuration)

## Development

### Running in Development Mode

**Recommended: Single Command**
```bash
npm run dev:electron
```
This will start both the Next.js dev server and Electron app automatically!

**Alternative: Manual (Two terminals)**
```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start Electron (after Next.js is ready)
npm run electron:dev
```

### Development Features
- Auto-opens DevTools for debugging
- Hot reload via Next.js dev server
- Fast iteration cycle

## Building for Production

### Prerequisites
1. Run Next.js production build: `npm run build`
2. Add app icons (see `build/ICONS_README.md`)

### Build Commands

**Build for all platforms:**
```bash
npm run electron:build
```

**Platform-specific builds:**
```bash
npm run electron:build:mac     # Build for macOS (.dmg + .zip)
npm run electron:build:win     # Build for Windows (.exe + portable)
npm run electron:build:linux   # Build for Linux (.AppImage, .deb, .rpm)
```

**Test packaging without creating installers:**
```bash
npm run pack
```

### Build Output
Built applications are saved to the `dist/` directory:
- **macOS**: `dist/Parrot-0.1.0-arm64.dmg`
- **Windows**: `dist/Parrot Setup 0.1.0.exe`
- **Linux**: `dist/Parrot-0.1.0.AppImage`

## Architecture

### How It Works

**Development Mode:**
```
Electron → http://localhost:3000 → Next.js Dev Server
```

**Production Mode:**
```
Electron → Spawns Next.js Server → http://localhost:3000 → Built .next App
```

The app automatically:
1. Detects if it's running in dev or production
2. In production, starts the Next.js server internally
3. Loads the app in an Electron window
4. Cleans up the server when the app quits

### File Structure
```
parrot/
├── electron.js              # Main Electron process
├── preload.js              # Preload script for security
├── electron-builder.json   # Packaging configuration
├── build/                  # Build resources
│   ├── entitlements.mac.plist
│   ├── icon.icns          # (add this)
│   ├── icon.ico           # (add this)
│   └── icon.png           # (add this)
└── dist/                   # Built apps (gitignored)
```

## Configuration

### App Metadata
Edit `package.json`:
```json
{
  "name": "parrot",
  "version": "0.1.0",
  "description": "Your app description",
  "author": "Your Name"
}
```

### Window Configuration
Edit `electron.js` - `createWindow()` function:
```javascript
const mainWindow = new BrowserWindow({
  width: 1200,        // Adjust window size
  height: 800,
  minWidth: 800,      // Minimum window size
  minHeight: 600,
  // ... more options
});
```

### Menu Customization
Edit `electron.js` - `createMenu()` function to add custom menu items.

### Packaging Options
Edit `electron-builder.json` to customize:
- App ID and metadata
- Platform-specific settings
- File associations
- Auto-updater configuration

## Icons

Your app needs icons for each platform. See `build/ICONS_README.md` for details.

**Quick summary:**
- macOS: `build/icon.icns` (1024x1024)
- Windows: `build/icon.ico` (256x256)
- Linux: `build/icon.png` (512x512+)

## Code Signing

### macOS
1. Get an Apple Developer account
2. Create a Developer ID Application certificate
3. Configure in `electron-builder.json`:
```json
{
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)"
  }
}
```

### Windows
1. Get a code signing certificate
2. Configure in `electron-builder.json`:
```json
{
  "win": {
    "certificateFile": "path/to/cert.pfx",
    "certificatePassword": "password"
  }
}
```

## Distribution

### macOS
- `.dmg` file for distribution
- `.zip` for direct download
- Notarization required for public distribution

### Windows
- `.exe` installer (NSIS)
- Portable `.exe` (no installation required)

### Linux
- `.AppImage` (universal, runs anywhere)
- `.deb` (Debian/Ubuntu)
- `.rpm` (Fedora/RedHat)

## Security Features

The app includes modern Electron security practices:
- ✅ Context isolation enabled
- ✅ Node integration disabled
- ✅ Sandbox enabled
- ✅ Preload script for controlled API access
- ✅ External links open in browser

## Troubleshooting

### "Failed to load URL" error
- Make sure Next.js is running on port 3000
- In production, ensure `npm run build` was successful

### App doesn't start in production
- Run `npm run build` before building the Electron app
- Check that `.next/` directory exists

### Icons not showing
- Add icon files to `build/` directory
- Rebuild the app after adding icons

### Port 3000 already in use
- Change the port in `electron.js`:
  ```javascript
  const port = process.env.PORT || 3001;
  ```
- Update your Next.js dev server port too

## Next Steps

### Recommended Additions:
1. **Auto-updater**: Add electron-updater for automatic updates
2. **Native notifications**: Use Electron's Notification API
3. **System tray**: Add tray icon for background operation
4. **Deep linking**: Register custom protocol (e.g., `parrot://`)
5. **Crash reporting**: Integrate Sentry or similar service

### Resources:
- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Docs](https://www.electron.build/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)

## License

Configure licensing in `electron-builder.json` and `package.json` as needed.
