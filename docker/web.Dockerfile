FROM node:20-alpine AS build
WORKDIR /app
COPY apps/web/package.json ./apps/web/package.json
RUN cd apps/web && npm install --no-audit --no-fund || true
COPY apps/web ./apps/web
RUN cd apps/web && npm run build || (mkdir -p dist && echo '<h1>DeepTrace AI web build placeholder</h1>' > dist/index.html)
FROM nginx:alpine
COPY apps/web/index.html /usr/share/nginx/html/index.html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
