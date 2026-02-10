FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app
RUN npm init -y && npm install playwright@1.50.0

COPY play-game.mjs .
RUN mkdir -p /output

CMD ["node", "play-game.mjs"]
