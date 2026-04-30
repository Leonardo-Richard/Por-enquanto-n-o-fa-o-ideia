# Imagem de produção do portal (Next.js em `frontend`) para EasyPanel / Docker genérico.
# Build (na raiz do repo): docker build -t portal-nf .
# Run: docker run -p 3000:3000 --env-file .env.production portal-nf

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY packages/db/package.json ./packages/db/
COPY packages/scheduling/package.json ./packages/scheduling/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY frontend ./frontend
COPY backend ./backend
COPY packages ./packages
# O COPY do código apaga os `node_modules` dos workspaces criados no estágio `deps` (o lockfile
# coloca `next` em `frontend/node_modules`, não só na raiz).
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/scheduling/node_modules ./packages/scheduling/node_modules
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
# EasyPanel costuma injectar PORT; o Next precisa de escutar em todas as interfaces.
CMD ["sh", "-c", "exec npx next start --hostname 0.0.0.0 --port ${PORT:-3000}"]
