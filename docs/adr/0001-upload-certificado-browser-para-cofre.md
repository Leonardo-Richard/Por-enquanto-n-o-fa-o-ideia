# ADR 0001 — Upload de certificado e-CNPJ: browser → portal → cofre → worker

**Estado:** Aceite (MVP)  
**Data:** 2026-04-24  

## Contexto

O portal precisa de permitir que administradores enviem PKCS#12 para suportar a sincronização ADN sem gravar segredos no browser além do envio pontual (**CE-BR1**, **NFR19**).

## Decisão

- **Opção A (multipart):** o browser envia `multipart/form-data` (`file`, `password`) para uma Route Handler autenticada (`POST …/certificate`), que valida no servidor, grava bytes apenas no **cofre** (ou *mock* em desenvolvimento) e persiste **metadados** na base de dados (**sem** coluna PFX/senha).
- **MVP síncrono:** o `POST` conclui com **204** após escrita no cofre e metadados; estado `pending_validation` / **202** fica para backlog (**UBR-BL-02**) se necessário.
- **Chave de armazenamento:** referência opaca `vault_ref` por empresa; prefixo lógico `adn-cert/{organizationId}/{companyId}/…` alinhado à arquitectura.
- **Feature flags:** `CERT_UPLOAD_API_ENABLED` (servidor) e `NEXT_PUBLIC_CERT_UPLOAD_UI_ENABLED` (UI); com API desligada as rotas respondem **404**.

## Consequências

- O worker continua responsável por consumir o cofre e materializar o material para NFSE_dist (**CE-BR3**).
- Produção exige driver de cofre real (Secrets Manager, Key Vault, *blob* privado + KMS, etc.); o repositório passa a incluir driver real via **Supabase Storage** (`supabase-storage`) e mantém **`mock`** apenas para testes.
- **RLS (BR-NFR5):** migração `20260426140000_company_certificate_rls.sql` activa RLS e nega `anon` / `authenticated` quando esses roles existem (Supabase), reduzindo exposição via PostgREST. O pool do portal (dono da relação / *service_role*) mantém o comportamento actual de bypass de RLS em Postgres; o isolamento por `organization_id` continua obrigatório na camada de aplicação.

## Referências

- `docs/architecture-upload-certificado-browser-edicao-empresa-monitorada.md`
- `docs/stories/incremento-upload-certificado-browser-edicao-empresa.md` (**UBR-01** … **UBR-11**)
