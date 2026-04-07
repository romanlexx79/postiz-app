FROM ghcr.io/gitroomhq/postiz-app:latest

# SSO landing page — prijme token z URL, nastavi cookie, redirectne na hlavni stranku
COPY sso-init.html /app/apps/frontend/public/sso-init.html
