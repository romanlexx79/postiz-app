FROM ghcr.io/gitroomhq/postiz-app:latest

# AI Recepce logo
COPY logo.svg /app/apps/frontend/public/logo.svg
COPY logo-text.svg /app/apps/frontend/public/logo-text.svg

# AI Recepce theme — replace purple with orange in compiled CSS at BUILD TIME
RUN find /app/apps/frontend/.next -name "*.css" -exec sed -i \
  -e 's/#612bd3/#E8751A/g' \
  -e 's/#612ad5/#E8751A/g' \
  -e 's/#7236f1/#D4650F/g' \
  -e 's/#7950f2/#E8751A/g' \
  -e 's/#8155dd/#F09030/g' \
  -e 's/#832ad5/#E8751A/g' \
  -e 's/#5826c2/#C45A10/g' \
  -e 's/#d82d7e/#E8751A/g' \
  -e 's/#fc69ff/#E8751A/g' \
  -e 's/#b69dec/#F5A623/g' \
  -e 's/#3900b2/#C45A10/g' \
  -e 's/#ebe8ff/#FFF3E0/g' \
  -e 's/#2d1b57/#3D2008/g' \
  {} + && echo "CSS patched successfully"
