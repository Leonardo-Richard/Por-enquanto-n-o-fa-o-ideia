# Imagem de produção do portal (Next.js em `frontend`) para EasyPanel / Docker genérico.
# O layout de node_modules varia (Linux vs Windows); um único `npm ci` após o código garante árvore correcta.
# Build: docker build -t portal-nf .

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS builder
RUN apt-get update -y && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY packages/db/package.json ./packages/db/
COPY packages/scheduling/package.json ./packages/scheduling/
COPY packages/shared/package.json ./packages/shared/
COPY frontend ./frontend
COPY backend ./backend
COPY packages ./packages
RUN npm ci
ENV NODE_OPTIONS="--max-old-space-size=8192"
RUN cd frontend && npx next build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN apt-get update -y && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/frontend ./frontend
COPY --from=builder /app/packages ./packages
WORKDIR /app/frontend
EXPOSE 3000
CMD ["sh", "-c", "exec npx next start --hostname 0.0.0.0 --port ${PORT:-3000}"]
