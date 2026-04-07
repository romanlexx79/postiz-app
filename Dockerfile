FROM ghcr.io/gitroomhq/postiz-app:latest

# AI Recepce theme override script
COPY override-theme.sh /app/override-theme.sh
RUN chmod +x /app/override-theme.sh

# AI Recepce logo
COPY logo.svg /app/apps/frontend/public/logo.svg
COPY logo-text.svg /app/apps/frontend/public/logo-text.svg

# Override CMD: apply theme THEN start normally
CMD ["sh", "-c", "/app/override-theme.sh && nginx && pnpm run pm2"]
