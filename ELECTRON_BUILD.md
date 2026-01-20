# Electron Build & Distribution Setup

This document explains the Electron build setup for Parrot, including solutions to issues encountered during development.

## Architecture

- **Framework**: Next.js 16 (App Router) + Electron 32
- **Build Mode**: Next.js Standalone Output
- **Package Manager**: npm
- **Target Platforms**: macOS (Intel + Apple Silicon)

## Key Configuration Files

### 1. `electron-builder.json`

Main configuration for building and packaging the Electron app.

**Critical settings:**

```json
{
  "asar": false,  // Required: Next.js standalone needs non-asar for node_modules access
  "npmRebuild": false,  // Skip native module rebuild
  "files": [
    // Exclude root node_modules (too large)
    "!node_modules",
    "!node_modules/**/*",

    // Include entire standalone directory
    {
      "from": ".next/standalone",
      "to": ".next/standalone",
      "filter": ["**/*", "!.git"]
    },

    // Include standalone node_modules (required by Next.js server)
    {
      "from": ".next/standalone/node_modules",
      "to": ".next/standalone/node_modules",
      "filter": ["**/*"]
    },

    // Copy static files to BOTH paths (CI and local use different structures)
    {
      "from": ".next/static",
      "to": ".next/standalone/Projects/beeper-kanban/.next/static"
    },
    {
      "from": ".next/static",
      "to": ".next/standalone/.next/static"
    },

    // Copy public files to BOTH paths
    {
      "from": "public",
      "to": ".next/standalone/Projects/beeper-kanban/public"
    },
    {
      "from": "public",
      "to": ".next/standalone/public"
    }
  ]
}
```

### 2. `next.config.ts`

Enable standalone output mode:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',  // Required for Electron
  // ...
}
```

### 3. `server.js`

Wrapper that handles different standalone paths between local and CI builds:

```javascript
const possiblePaths = [
  // CI build path
  path.join(__dirname, '.next', 'standalone', 'Projects', 'beeper-kanban', 'server.js'),
  // Local build path
  path.join(__dirname, '.next', 'standalone', 'server.js'),
];
```

## Environment Variables

### Required for Build (CI)

Add these as GitHub repository secrets:

```bash
# Apple Code Signing & Notarization
CSC_LINK=<base64-encoded-p12-certificate>
CSC_KEY_PASSWORD=<certificate-password>
APPLE_ID=<apple-id-email>
APPLE_APP_SPECIFIC_PASSWORD=<app-specific-password>
APPLE_TEAM_ID=<10-character-team-id>

# Supabase (baked into build at compile time)
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

**Important:** `NEXT_PUBLIC_*` variables are embedded at build time by Next.js. They must be set during `npm run build`, not at runtime.

## Common Issues & Solutions

### Issue 1: App Crashes Immediately on Startup

**Symptom:** App icon appears briefly in dock then disappears, no error messages.

**Cause:** `ELECTRON_RUN_AS_NODE=1` environment variable set by VSCode terminal.

**Solution:**
- Don't launch packaged app from VSCode integrated terminal
- Launch from Finder or regular terminal
- Or unset the variable: `unset ELECTRON_RUN_AS_NODE`

**Why it happens:** When `ELECTRON_RUN_AS_NODE=1`, `require('electron')` returns a string path instead of the Electron module, breaking everything.

### Issue 2: Infinite Loading Screen (404 for Static Files)

**Symptom:** App opens but shows infinite "Loading..." spinner. DevTools shows 404 errors for all `.js` files.

**Cause:** Static files not copied to the correct location for CI builds. Next.js standalone uses different paths on CI (GitHub Actions) vs local builds.

**Solution:** Copy static files to BOTH possible paths in `electron-builder.json`:
- `.next/standalone/.next/static/` (CI)
- `.next/standalone/Projects/beeper-kanban/.next/static/` (local)

### Issue 3: "Cannot find module 'next'"

**Symptom:** App crashes with "Cannot find module 'next'" error.

**Cause:** The `node_modules` folder inside `.next/standalone/` was excluded by electron-builder.

**Solution:** Explicitly include standalone's node_modules:
```json
{
  "from": ".next/standalone/node_modules",
  "to": ".next/standalone/node_modules",
  "filter": ["**/*"]
}
```

### Issue 4: App Size Too Large (>400MB)

**Symptom:** DMG file is huge.

**Cause:** Including root `node_modules` folder which contains dev dependencies.

**Solution:** Exclude root node_modules:
```json
"files": [
  "!node_modules",
  "!node_modules/**/*"
]
```

The standalone build's `node_modules` (much smaller, production only) is included separately.

### Issue 5: Auth Not Working in Production Build

**Symptom:** Supabase auth doesn't work or app shows "Loading..." forever.

**Cause:** `NEXT_PUBLIC_SUPABASE_*` env vars not set during CI build.

**Solution:** Add env vars to GitHub Actions workflow build step:
```yaml
- name: Build Electron app (macOS)
  run: npm run electron:build
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

## Build Process

### Local Build

```bash
npm run electron:build
```

This will:
1. Run `next build` (creates `.next/standalone/`)
2. Copy static files
3. Run electron-builder (creates DMG in `dist/`)

### CI Build (GitHub Actions)

Triggered on push to `main` branch or tags matching `v*`.

Workflow: `.github/workflows/release.yml`

Steps:
1. Checkout code
2. Setup Node.js 20
3. Install dependencies
4. Build Next.js app with env vars
5. Build and sign Electron app
6. Notarize with Apple
7. Create GitHub release with DMG

## Testing the Build

### Testing Local Build

```bash
# Build
npm run electron:build

# Run from dist (works)
open dist/mac-arm64/Parrot.app

# From terminal with ELECTRON_RUN_AS_NODE unset
env -u ELECTRON_RUN_AS_NODE open dist/mac-arm64/Parrot.app
```

### Testing CI Build

1. Download DMG from GitHub Releases
2. Open DMG, drag app to Applications
3. Open from Finder (not terminal)
4. Expected: App opens and loads correctly
5. Press `Cmd+Option+I` to open DevTools and check for errors

## Apple Code Signing & Notarization

### Prerequisites

1. Apple Developer Account
2. Developer ID Application certificate
3. App-specific password for notarization

### Export Certificate

```bash
# Export to .p12 (you'll be prompted for password)
security find-identity -v -p codesigning

# Export certificate
# Keychain Access > My Certificates > Right-click certificate > Export

# Convert to base64 for GitHub secret
base64 -i certificate.p12 | pbcopy
```

### Verify Notarization

```bash
# Check code signature
codesign -dvv /path/to/Parrot.app

# Check notarization
spctl -a -vvv -t install /path/to/Parrot.app
```

## Path Differences: Local vs CI

### Local Build (macOS)
```
.next/standalone/
├── Projects/
│   └── beeper-kanban/
│       ├── .next/
│       │   └── static/     ← Static files here
│       ├── public/          ← Public files here
│       └── node_modules/    ← Dependencies here
├── package.json
└── server.js
```

### CI Build (GitHub Actions macOS runner)
```
.next/standalone/
├── .next/
│   ├── server/
│   └── static/             ← Static files here
├── public/                 ← Public files here
├── Projects/
│   └── beeper-kanban/      ← May exist but not always used
├── node_modules/           ← Dependencies here
├── package.json
└── server.js
```

**Solution:** Copy static files to both locations to support both structures.

## Troubleshooting Checklist

When the packaged app doesn't work:

1. **Check if it's the ELECTRON_RUN_AS_NODE issue:**
   - Try launching from Finder instead of terminal
   - Check: `echo $ELECTRON_RUN_AS_NODE` (should be empty)

2. **Check static files:**
   - Mount DMG and inspect app bundle
   - Verify files exist at both paths
   - Check DevTools Network tab for 404 errors

3. **Check Supabase env vars:**
   - Verify GitHub secrets are set
   - Check workflow file includes env vars in build step
   - Inspect built JS files for hardcoded URLs (should have real Supabase URL, not placeholder)

4. **Check server startup:**
   - Look for "Server started" logs in console
   - Verify node_modules exists in standalone
   - Check server.js can find the right path

5. **Check code signing:**
   ```bash
   codesign -dvv /path/to/Parrot.app
   spctl -a -vvv -t install /path/to/Parrot.app
   ```

## Maintenance Notes

### When Updating Dependencies

1. Test build locally first
2. Check app size (should be ~100MB, not >200MB)
3. Verify app launches and loads correctly
4. Check DevTools console for errors

### When Changing Next.js Config

1. Test standalone build works: `npm run build && node .next/standalone/server.js`
2. Verify static files are accessible at `http://localhost:3000/_next/static/`
3. Rebuild Electron app and test

### When Modifying electron-builder.json

1. Don't remove the duplicate static file copies (they're needed for CI)
2. Don't enable asar (Next.js standalone needs direct file access)
3. Keep npmRebuild false (we don't use native modules)

## Resources

- [Next.js Standalone Output](https://nextjs.org/docs/app/api-reference/next-config-js/output)
- [electron-builder Documentation](https://www.electron.build/)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
