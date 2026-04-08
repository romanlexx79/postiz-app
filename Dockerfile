FROM node:22.20-bookworm-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ make python3-pip bash nginx \
    && rm -rf /var/lib/apt/lists/*

# Nginx user
RUN addgroup --system www \
 && adduser --system --ingroup www --home /www --shell /usr/sbin/nologin www \
 && mkdir -p /www \
 && chown -R www:www /www /var/lib/nginx

# PM2 + pnpm
RUN npm --no-update-notifier --no-fund --global install pnpm@10.6.1 pm2

WORKDIR /app

# Copy source
COPY . /app

# AI Recepce nginx config (with /sso endpoint)
COPY var/docker/nginx.conf /etc/nginx/nginx.conf

# Install dependencies
RUN pnpm install

# Build
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

# AI Recepce theme — patch compiled CSS colors (purple → orange)
RUN find /app -name "*.css" -path "*/.next/*" -exec sed -i \
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
  {} + && echo "CSS theme patched"

EXPOSE 5000

CMD ["sh", "-c", "nginx && pnpm run pm2"]
