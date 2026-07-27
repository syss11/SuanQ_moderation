FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=0 /app/dist ./dist

CMD ["sh", "-c", "echo 'Frontend built successfully. dist directory is ready.' && sleep 3600"]
