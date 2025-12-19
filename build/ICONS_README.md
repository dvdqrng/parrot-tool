# App Icons

To complete the Electron app setup, you need to add application icons to this directory.

## Required Icon Files

### macOS
- `icon.icns` - macOS icon file (1024x1024 recommended)
  - Use an icon generator or create with Xcode

### Windows
- `icon.ico` - Windows icon file (256x256 recommended)
  - Should contain multiple sizes: 16x16, 32x32, 48x48, 256x256

### Linux
- `icon.png` - PNG icon file (512x512 or 1024x1024 recommended)

## Creating Icons

### From PNG:
1. Create a 1024x1024 PNG image of your app icon
2. Use online tools or command-line utilities to convert:
   - **For .icns (macOS)**: Use `png2icns` or online converters
   - **For .ico (Windows)**: Use ImageMagick or online converters
   - **For Linux**: Just use the PNG directly

### Using electron-icon-builder:
```bash
npm install -g electron-icon-builder
electron-icon-builder --input=./icon-source.png --output=./build
```

### Quick Start (Placeholder):
You can use a simple colored square as a placeholder for development:
```bash
# Create a basic placeholder (macOS with ImageMagick)
convert -size 1024x1024 xc:#4F46E5 build/icon.png
```

## Current Status
Icons are referenced in `electron-builder.json` but not yet created. The app will build without them but won't have a custom icon.
