FROM node:20-alpine AS base
WORKDIR /app
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN cd apps/api && npm install --no-audit --no-fund || npm install --no-audit --no-fund
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN cd apps/api && npx prisma generate && npm run build
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
