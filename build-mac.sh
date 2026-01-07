#!/bin/bash

# This script provides a more robust build process for macOS
# with keychain unlocking and detailed debug logging.

echo "🚀 Starting robust macOS build process..."

# 1. Unlock Keychain
# This is often the cause of "Above command failed" during signing
echo "🔐 Checking keychain status..."
if security show-keychain-info login.keychain > /dev/null 2>&1; then
    echo "✅ Keychain is unlocked."
else
    echo "🔓 Attempting to unlock login keychain..."
    security unlock-keychain -p "" login.keychain
fi

# 2. Run the build
# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist

# Build Next.js
echo "🏗️  Building Next.js..."
npm run build

# Copy necessary files for standalone mode
echo "📂 Copying static assets for standalone mode..."
# Next.js standalone entry is nested based on actual project folder name
STANDALONE_DIR=".next/standalone/Projects/beeper-kanban"

# Ensure the directories exist
mkdir -p "$STANDALONE_DIR/public"
mkdir -p "$STANDALONE_DIR/.next/static"

# Copy public folder
cp -R public/* "$STANDALONE_DIR/public/"

# Copy static assets
cp -R .next/static/* "$STANDALONE_DIR/.next/static/"

echo "📦 Running electron-builder..."
# Run electron-builder for arm64 to reduce file clutter (matching user's machine)
if DEBUG=electron-builder npx electron-builder --mac --arm64; then
    echo "✨ Build completed successfully!"
    echo "📂 Cleaning up redundant artifacts in 'dist'..."
    
    # Keep only the DMG, ZIP and the App folder results
    # We don't delete directories here as mac/ and mac-arm64/ contain the actual .app
    find dist -maxdepth 1 -type f ! -name "*.dmg" ! -name "*.zip" -delete
    
    echo "✅ Final artifacts are in the 'dist' directory."
else
    echo "❌ Build failed. Please check the logs above for 'codesign' or 'notarization' errors."
    exit 1
fi
