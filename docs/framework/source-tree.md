# Árvore de origem (resumo)

```
portal-automacao-nf/
├── frontend/          # Next.js UI + api/v1 + api/internal/v1/adn
├── backend/           # API interna ADN opcional (:3001)
├── packages/
│   ├── db/            # Drizzle schema
│   ├── shared/
│   ├── scheduling/
│   └── adn-internal/  # Handlers HMAC ADN + leitura cofre certificados
├── db/migrations/     # SQL versionado
├── workers/
│   ├── nfse-portal-bridge/   # Worker fila ADN (Python)
│   └── adn-playwright-motor/
├── scripts/           # apply-migrations, bridge, enqueue
├── docs/              # PRD, arquitectura, stories, qa, framework
└── .github/workflows/ci.yml
```

Rotas públicas: `frontend/src/app/api/v1/*`.  
Rotas internas worker: `frontend/src/app/api/internal/v1/adn/*` (HMAC).  
Documentação de produto: `docs/architecture.md`, `docs/prd.md`.
