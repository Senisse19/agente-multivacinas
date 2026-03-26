FROM node:22-alpine

WORKDIR /app

# Copia apenas o necessário para instalar dependências primeiro (cache de camadas)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copia o código da bridge
COPY bridge/server.js ./bridge/server.js

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "bridge/server.js"]
