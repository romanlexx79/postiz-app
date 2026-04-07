#!/bin/sh
echo "[AI Recepce] Applying custom theme..."

# Find all compiled CSS files
CSS_DIR="/app/apps/frontend/.next/static/css"
if [ -d "$CSS_DIR" ]; then
  for f in "$CSS_DIR"/*.css; do
    # Primary buttons: purple → orange
    sed -i 's/#612bd3/#E8751A/g' "$f"
    sed -i 's/#612ad5/#E8751A/g' "$f"
    # Accent colors
    sed -i 's/#7236f1/#D4650F/g' "$f"
    sed -i 's/#7950f2/#E8751A/g' "$f"
    sed -i 's/#8155dd/#F09030/g' "$f"
    sed -i 's/#832ad5/#E8751A/g' "$f"
    sed -i 's/#5826c2/#C45A10/g' "$f"
    # AI button pink → orange
    sed -i 's/#d82d7e/#E8751A/g' "$f"
    # Focus/highlight purple → orange
    sed -i 's/#fc69ff/#E8751A/g' "$f"
    sed -i 's/#b69dec/#F5A623/g' "$f"
    # Light theme focused text
    sed -i 's/#3900b2/#C45A10/g' "$f"
    sed -i 's/#ebe8ff/#FFF3E0/g' "$f"
    # Backdrop purple → dark orange
    sed -i 's/#2d1b57/#3D2008/g' "$f"
    echo "  Patched: $f"
  done
fi

# Also patch backend static if exists
POLONTO="/app/apps/frontend/src/app/polonto.css"
if [ -f "$POLONTO" ]; then
  sed -i 's/#612bd3/#E8751A/g' "$POLONTO"
  sed -i 's/#612ad5/#E8751A/g' "$POLONTO"
fi

echo "[AI Recepce] Theme applied."
