# Rate limit distribuído — evidência multi-instância (MSYS-06)

## Comportamento implementado

- Com `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, `POST .../adn/sync` e upload de certificado usam **sliding window** partilhada (prefixo `portal:sensitive:*`).
- Com `RATE_LIMIT_LOCAL_ONLY=1` ou ausência de credenciais Upstash, mantém-se o limite **em memória** por instância (adequado a dev/test).

## Como demonstrar 2 instâncias

1. Configurar as mesmas variáveis Upstash em **dois** deploys (ou dois processos locais com as mesmas env, portas diferentes).
2. Disparar pedidos até `429` numa instância; verificar que a segunda observa o mesmo teto (menos pedidos aceites após o limite global).
3. Capturar cabeçalho `Retry-After` nas respostas 429 e linhas de log `scope: "rate_limit_429"` com `route`, ids de contexto e `retryAfterSec`.

Teste automatizado de duas VMs não está no repositório; esta página serve de **runbook de evidência** para PR/conformidade.
