#!/bin/bash

# Script to generate macOS app icons with proper squircle shape
# Creates icons with rounded corners baked in for Electron apps

DEST="build"
TEMP_DIR="$DEST/temp_icon"

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo "ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

echo "Generating macOS-style icons with rounded corners..."
mkdir -p "$TEMP_DIR"
mkdir -p "$DEST/icon.iconset"

# Create the base icon at 1024x1024 with "Parrot" text on white background with rounded corners
create_base_icon() {
    local size=1024
    # macOS squircle corner radius is ~22.37% of icon size
    local radius=$(printf "%.0f" $(echo "$size * 0.2237" | bc))

    # Create white rounded rectangle background
    magick -size ${size}x${size} xc:none \
        -fill white \
        -draw "roundrectangle 0,0,$((size-1)),$((size-1)),$radius,$radius" \
        "$TEMP_DIR/background.png"

    # Add "Parrot" text centered on the rounded background
    magick "$TEMP_DIR/background.png" \
        -gravity center \
        -font "Times-Bold" \
        -pointsize 180 \
        -fill black \
        -annotate +0+0 "Parrot" \
        "$TEMP_DIR/base_icon.png"
}

# Function to create icon at specific size from base
create_sized_icon() {
    local size=$1
    local output=$2

    magick "$TEMP_DIR/base_icon.png" \
        -resize ${size}x${size} \
        -define png:color-type=6 \
        "$output"
}

# Create the base icon first
create_base_icon

# Generate all required icon sizes
create_sized_icon 16 "$DEST/icon.iconset/icon_16x16.png"
create_sized_icon 32 "$DEST/icon.iconset/icon_16x16@2x.png"
create_sized_icon 32 "$DEST/icon.iconset/icon_32x32.png"
create_sized_icon 64 "$DEST/icon.iconset/icon_32x32@2x.png"
create_sized_icon 128 "$DEST/icon.iconset/icon_128x128.png"
create_sized_icon 256 "$DEST/icon.iconset/icon_128x128@2x.png"
create_sized_icon 256 "$DEST/icon.iconset/icon_256x256.png"
create_sized_icon 512 "$DEST/icon.iconset/icon_256x256@2x.png"
create_sized_icon 512 "$DEST/icon.iconset/icon_512x512.png"
create_sized_icon 1024 "$DEST/icon.iconset/icon_512x512@2x.png"

# Create the .icns file
iconutil -c icns "$DEST/icon.iconset"

# Copy the 1024 icon as icon.png
cp "$TEMP_DIR/base_icon.png" "$DEST/icon.png"

# Cleanup
rm -rf "$DEST/icon.iconset"
rm -rf "$TEMP_DIR"

echo "Conversion complete (macOS .icns generated with rounded corners)."
