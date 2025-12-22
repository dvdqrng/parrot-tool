#!/bin/bash

# Script to generate app icons from a source PNG (macOS version)
SOURCE="build/icon-source.png"
DEST="build"

if [ ! -f "$SOURCE" ]; then
    echo "Source file $SOURCE not found!"
    exit 1
fi

echo "Generating macOS icons..."
mkdir -p "$DEST/icon.iconset"
sips -z 16 16     "$SOURCE" --out "$DEST/icon.iconset/icon_16x16.png"
sips -z 32 32     "$SOURCE" --out "$DEST/icon.iconset/icon_16x16@2x.png"
sips -z 32 32     "$SOURCE" --out "$DEST/icon.iconset/icon_32x32.png"
sips -z 64 64     "$SOURCE" --out "$DEST/icon.iconset/icon_32x32@2x.png"
sips -z 128 128   "$SOURCE" --out "$DEST/icon.iconset/icon_128x128.png"
sips -z 256 256   "$SOURCE" --out "$DEST/icon.iconset/icon_128x128@2x.png"
sips -z 256 256   "$SOURCE" --out "$DEST/icon.iconset/icon_256x256.png"
sips -z 512 512   "$SOURCE" --out "$DEST/icon.iconset/icon_256x256@2x.png"
sips -z 512 512   "$SOURCE" --out "$DEST/icon.iconset/icon_512x512.png"
sips -z 1024 1024 "$SOURCE" --out "$DEST/icon.iconset/icon_512x512@2x.png"

iconutil -c icns "$DEST/icon.iconset"
rm -rf "$DEST/icon.iconset"

echo "Note: Windows .ico and high-res Linux .png are also needed."
echo "Linux icon: Already copied to build/icon.png"
echo "Creating a resized 256x256 icon for Windows (as a basic .ico fallback if possible, or just .png)..."
# Simple sips doesn't make .ico, so we might need the user to use an online tool or ImageMagick for .ico
# But we have the source now!

echo "Conversion complete (macOS .icns generated)."
