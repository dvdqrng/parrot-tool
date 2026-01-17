#!/bin/bash

# Script to generate app icons from a source PNG (macOS version)
# Electron apps need icons with rounded corners BAKED IN
# macOS does NOT auto-apply squircle mask to Electron apps like native apps

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

echo "Generating macOS-style icons with baked-in rounded corners..."
mkdir -p "$TEMP_DIR"
mkdir -p "$DEST/icon.iconset"

# Function to create a macOS-style icon with rounded corners baked in
# The corner radius for macOS Big Sur+ is approximately 22.37% of the icon size
create_macos_icon() {
    local size=$1
    local output=$2
    # macOS squircle corner radius is ~22.37% of icon size
    local radius=$(printf "%.0f" $(echo "$size * 0.2237" | bc))

    # Create the rounded rectangle mask (squircle approximation)
    magick -size ${size}x${size} xc:none \
        -fill white \
        -draw "roundrectangle 0,0,$((size-1)),$((size-1)),$radius,$radius" \
        "$TEMP_DIR/mask_${size}.png"

    # Resize source to fill canvas, then apply rounded mask
    magick "$SOURCE" \
        -resize ${size}x${size}^ \
        -gravity center \
        -extent ${size}x${size} \
        -background white \
        -alpha remove -alpha off \
        \( "$TEMP_DIR/mask_${size}.png" -alpha extract \) \
        -compose CopyOpacity -composite \
        -define png:color-type=6 \
        "$output"
}

# Generate all required icon sizes with rounded corners
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

# Also create icon.png for other uses
create_macos_icon 1024 "$DEST/icon.png"

# Cleanup
rm -rf "$DEST/icon.iconset"
rm -rf "$TEMP_DIR"

echo "Conversion complete (macOS .icns generated with rounded corners)."
