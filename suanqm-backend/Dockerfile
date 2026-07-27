FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

RUN chmod +x docker-entrypoint.sh

EXPOSE 6065

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
