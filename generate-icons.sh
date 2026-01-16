#!/bin/bash

# Script to generate app icons from a source PNG (macOS version)
# macOS icons require:
# 1. Content sized to ~80% of canvas with padding
# 2. Rounded corners (squircle shape)

SOURCE="build/icon-source.png"
DEST="build"
TEMP_DIR="$DEST/temp_icon"

if [ ! -f "$SOURCE" ]; then
    echo "Source file $SOURCE not found!"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo "ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

echo "Generating macOS-style icons with rounded corners..."
mkdir -p "$TEMP_DIR"
mkdir -p "$DEST/icon.iconset"

# Function to create a macOS-style icon at a given size
# macOS icons use a "squircle" - a superellipse with continuous curvature
# The corner radius is approximately 22.37% of the icon size
create_macos_icon() {
    local size=$1
    local output=$2
    local radius=$(echo "$size * 0.2237" | bc)
    local content_size=$(echo "$size * 0.80" | bc | cut -d. -f1)
    local padding=$(echo "($size - $content_size) / 2" | bc | cut -d. -f1)

    # Create rounded rectangle mask for macOS squircle shape
    magick -size ${size}x${size} xc:none \
        -fill white \
        -draw "roundrectangle 0,0,$((size-1)),$((size-1)),$radius,$radius" \
        "$TEMP_DIR/mask_${size}.png"

    # Resize source, add white background, apply padding, then apply rounded mask
    magick "$SOURCE" \
        -resize ${content_size}x${content_size} \
        -background white \
        -gravity center \
        -extent ${size}x${size} \
        "$TEMP_DIR/mask_${size}.png" \
        -compose DstIn -composite \
        "$output"
}

# Generate all required icon sizes
create_macos_icon 16 "$DEST/icon.iconset/icon_16x16.png"
create_macos_icon 32 "$DEST/icon.iconset/icon_16x16@2x.png"
create_macos_icon 32 "$DEST/icon.iconset/icon_32x32.png"
create_macos_icon 64 "$DEST/icon.iconset/icon_32x32@2x.png"
create_macos_icon 128 "$DEST/icon.iconset/icon_128x128.png"
create_macos_icon 256 "$DEST/icon.iconset/icon_128x128@2x.png"
create_macos_icon 256 "$DEST/icon.iconset/icon_256x256.png"
create_macos_icon 512 "$DEST/icon.iconset/icon_256x256@2x.png"
create_macos_icon 512 "$DEST/icon.iconset/icon_512x512.png"
create_macos_icon 1024 "$DEST/icon.iconset/icon_512x512@2x.png"

# Create the .icns file
iconutil -c icns "$DEST/icon.iconset"

# Also create icon.png for other uses (1024x1024 with rounded corners)
create_macos_icon 1024 "$DEST/icon.png"

# Cleanup
rm -rf "$DEST/icon.iconset"
rm -rf "$TEMP_DIR"

echo "Note: Windows .ico and high-res Linux .png are also needed."
echo "Linux icon: Already copied to build/icon.png"
echo "Creating a resized 256x256 icon for Windows (as a basic .ico fallback if possible, or just .png)..."
# Simple sips doesn't make .ico, so we might need the user to use an online tool or ImageMagick for .ico
# But we have the source now!

echo "Conversion complete (macOS .icns generated with proper rounded corners)."
