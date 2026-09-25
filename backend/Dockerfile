FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies first so this layer is cached until package files change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV STORAGE_ROOT=/data

# The official image ships a non-root "node" user (uid 1000).
USER node
EXPOSE 4000
CMD ["node", "server.js"]
