# Inventário de rotas e contratos FE/BE

Este inventário serve como baseline para a separação frontend/backend.

## Rotas públicas (v1)

- `GET /api/v1/me`
- `GET /api/v1/organizations/accessible`
- `GET /api/v1/companies/accessible`
- `GET /api/v1/organizations/:organizationId/monitored-companies`
- `GET|POST /api/v1/organizations/:organizationId/monitored-companies/:companyId/adn/sync`
- `GET|PATCH /api/v1/organizations/:organizationId/adn-sync-settings`
- `GET /api/health`
- `GET /api/health/ready`

## Rotas internas ADN (worker)

- `POST /api/internal/v1/adn/uploads/prepare`
- `POST /api/internal/v1/adn/artifacts/commit`
- `PATCH /api/internal/v1/adn/jobs/:jobId`

## Contratos compartilhados

- `packages/shared/src/api-v1.ts`
  - `activeCompanyBodySchema`
  - `activeOrganizationBodySchema`
  - `companiesAccessibleQuerySchema`
  - `companyCreateBodySchema`
  - `membersQuerySchema`
  - `memberPostBodySchema`
  - `memberPatchBodySchema`
  - `companyPatchBodySchema`

## Contratos internos ADN (payloads)

- `prepare`:
  - `organizationId` (uuid)
  - `companyId` (uuid)
  - `accessKey` (44 chars)
  - `sha256` (hex 64)
  - `contentType`
  - `kind` (`xml|pdf`)
- `commit`:
  - `artifactDraftId` (uuid)
  - `issuedAt` (date-time)
  - `byteSize` (optional)
  - `contentType` (optional)
  - `adnSyncJobId` (optional)
- `patch job`:
  - `organizationId` (uuid)
  - `status` (`queued|running|completed|partial|failed`, optional)
  - `summaryJson` (optional)
  - `workerCorrelationId` (optional)
  - `http429Count` (optional)
  - `http503Count` (optional)
  - `startedAt` (optional)
  - `completedAt` (optional)
