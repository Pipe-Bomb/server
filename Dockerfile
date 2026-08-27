FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
COPY sdk/ ./sdk/

RUN npm run build && npm prune --omit=dev

# -----------------------------------------------------------------------------

FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
		ffmpeg git \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN addgroup --system pipebomb \
	&& adduser --system --ingroup pipebomb --no-create-home pipebomb

COPY --from=builder --chown=pipebomb:pipebomb /app/dist ./dist
COPY --from=builder --chown=pipebomb:pipebomb /app/node_modules ./node_modules
# package.json is imported at runtime by main.js (one level up from dist/src/)
COPY --from=builder --chown=pipebomb:pipebomb /app/package.json ./dist/package.json
COPY --chown=pipebomb:pipebomb assets/ ./assets/

RUN mkdir -p /app/data /app/resources /app/audio-cache /app/plugin-cache /app/temp /app/plugins /app/bin /app/.secrets \
	&& chown -R pipebomb:pipebomb /app/data /app/resources /app/audio-cache /app/plugin-cache /app/temp /app/plugins /app/bin /app/.secrets

USER pipebomb

ENV NODE_ENV=production
ENV DB_FILE=/app/data/pipe-bomb.sqlite
ENV PLUGIN_DIRECTORY=/app/plugins
# /app/bin is on PATH so plugin maintainers can bind-mount binaries (yt-dlp, fpcalc, etc.)
ENV PATH="/app/bin:$PATH"

EXPOSE 3000

VOLUME ["/app/data", "/app/resources", "/app/audio-cache", "/app/plugin-cache", "/app/plugins", "/app/temp", "/app/.secrets"]

CMD ["node", "dist/src/main.js"]
