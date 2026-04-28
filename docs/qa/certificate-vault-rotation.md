# Cofre de certificados — rotação e validação (MSYS-05)

## Modelo

- O conteúdo sensível do PKCS#12 é armazenado fora do modelo relacional, com **referência opaca** `vault_ref` em `company_certificates` (ver `writeCertificateToVault` / `deleteCertificateVaultObject`).
- Metadados (estado, `notAfter`, etc.) permanecem em Postgres.

## Rotação de segredos (ambiente / cofre)

1. **Preparar** um novo segredo/credencial do backend de armazenamento (conforme o fornecedor: storage + KMS) em janela de manutenção acordada.
2. **Aplicar** a configuração no deploy (env / secret manager) **sem** alterar `vault_ref` existente — os objetos antigos devem continuar acessíveis com a política de chave antiga até migração controlada, salvo se o fornecedor exigir reencriptação em lote.
3. **Reiniciar** as instâncias da aplicação para carregar credenciais novas.
4. **Validar pós-rotação:** `GET` do certificado (metadados) e upload de teste em ambiente de staging; **não** logar palavra-passe nem bytes do ficheiro.
5. **Rollback:** repor o segredo anterior, reiniciar, repetir validação; se um upload recente falhar, ver auditoria `company_certificate_audits` e runbook de incidente.

## Verificação de logs

- Não deve aparecer conteúdo de certificado, password em claro, nem caminhos internos do cofre com material sensível. A suíte de testes reforça padrões proibidos onde aplicável (ex. `adn-worker-errors` / handlers de certificado).
