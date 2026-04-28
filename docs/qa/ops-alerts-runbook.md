# Alertas e dashboard operacional — runbook mínimo (MSYS-07)

## Endpoints

- `GET /api/v1/ops/metrics` — superadmin; query opcional `windowMinutes` ou `window` (minutos, 5–1440; default 60). Resposta inclui `partial: true` até existirem séries reais.
- `GET /api/v1/ops/alerts?active=1` — idem; mesma janela.
- UI MVP superadmin: `/admin/operacao` (JSON legível para diagnóstico).

Documentação de flags: `docs/qa/feature-flags-incremento-msys.md`.

## Severidades sugeridas

| Condição | Severidade | Acção inicial |
| -------- | ---------- | ------------- |
| Taxa de falha ADN acima do limiar por org | critical | Verificar worker, fila, credenciais ADN |
| Pico de HTTP 429 em sync/certificado | warning | Rever rate limit e uso legítimo; escalonar se abuso |
| Falhas repetidas de certificado para o mesmo `companyId` | critical | Validar cofre, permissões e `certificate-readiness` |

Calibrar números em PR com `@po` + `@architect`.

## Canal operacional

Definir no projeto (Slack/PagerDuty/e-mail) e referenciar aqui quando existir integração automática.
