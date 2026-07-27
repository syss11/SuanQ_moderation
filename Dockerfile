FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY ./suanqm-frontend/package.json ./suanqm-frontend/package-lock.json ./

RUN npm ci

COPY ./suanqm-frontend ./

RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY ./suanqm-backend/package.json ./suanqm-backend/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY ./suanqm-backend ./

RUN pnpm run build

COPY --from=frontend-builder /frontend/dist ./public/dist

EXPOSE 6065

CMD ["node", "dist/index.js"]
