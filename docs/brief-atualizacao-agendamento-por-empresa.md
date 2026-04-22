# Brief de atualização: dia da automação mensal configurável por empresa

## Contexto

No produto atual (ver `docs/brief.md` e fluxos em `docs/architecture.md`), a automação de coleta de notas dispara:

1. **Imediatamente após o cadastro** da empresa (job imediato).
2. **Mensalmente no dia 1º** (agendamento global, com referência a fuso `America/Sao_Paulo` na arquitetura).

Operadores com vários CNPJs frequentemente precisam **alinhar a coleta ao calendário de cada cliente** (fechamento contábil, convenção interna, carga de rede). Hoje o dia 1º é fixo para todas as empresas da conta.

## Problema a resolver

- **Rigidez:** não há como escolher outro dia do mês para a execução recorrente **por empresa**, sem perder o comportamento automático já acordado no MVP.

## Objetivo da atualização

Permitir que o usuário **defina o dia do mês** em que a automação agendada roda **para cada empresa**, **sem remover** a automação **automática no cadastro** (primeira execução continua disparando ao concluir o cadastro, como hoje).

## Comportamento desejado (regras de produto)

| Gatilho | Comportamento |
|--------|----------------|
| **Conclusão do cadastro da empresa** | Mantém-se: enfileirar job imediato (sem ação manual obrigatória do usuário). |
| **Automação mensal recorrente** | Passa a respeitar o **dia configurado na empresa** (ex.: dia 5, 10, 28). |
| **Valor padrão ao criar empresa** | Sugestão de produto: **dia 1** (paridade com o comportamento atual do brief, migração transparente). |
| **Edição posterior** | Usuário pode alterar o dia nas configurações da empresa; próxima janela de agendamento segue a nova regra (definir se há job “já agendado” para o mês corrente — ver riscos). |

## Escopo IN

- Campo de configuração por empresa: **dia do mês** (inteiro 1–28 ou 1–31 — ver decisão abaixo).
- UI: seleção clara (dropdown ou numérico com validação) no cadastro/edição da empresa.
- Backend/agendador: ao calcular o próximo tick mensal, usar o dia da empresa em vez de constante global “1”.
- Persistência do valor por `company` (ou equivalente no modelo atual).
- Documentação de API/contrato se existir endpoint público de empresas.

## Escopo OUT (para este brief)

- Múltiplos agendamentos por empresa (ex.: duas vezes ao mês).
- Horário configurável por empresa (o brief atual pode manter horário fixo global até nova story).
- Fuso horário diferente por empresa (manter alinhado ao que já está definido na arquitetura, salvo decisão explícita).

## Decisões em aberto (para PRD / @architect)

1. **Limite superior do dia:** dias 29–31 geram meses “sem esse dia”. Opções comuns: permitir só **1–28** (previsível) ou permitir **1–31** com regra “último dia útil do mês” / “último dia do mês” quando o dia não existir — deve ser uma escolha explícita.
2. **Mudança de dia no meio do mês:** se o usuário mudar de dia 1 para dia 20 no dia 10, o job do mês corrente já rodou ou não? Evitar dupla execução ou “buraco” de mês exige regra de idempotência documentada (alinhar com `INSERT job scheduled_monthly idempotente` na arquitetura).
3. **Nome do campo e retrocompatibilidade:** empresas existentes sem valor → default dia 1.

## Critérios de aceite (alto nível)

- Nova empresa: após cadastro, **job imediato** continua ocorrendo como hoje.
- Empresa com dia N: o agendador enfileira a coleta mensal **no dia N** (segundo regra de calendário acordada), não mais fixo em 1 para essa empresa.
- Empresa sem configuração legada: comportamento equivalente ao atual (**dia 1**).
- Validação de UI e API: rejeitar valores inválidos com mensagem clara.

## Métricas / sucesso

- Redução de suporte/feedback do tipo “preciso rodar no dia X, não no dia 1”.
- Manter ou melhorar a taxa de execuções bem-sucedidas agendadas (sem regressão por colisão de datas).

## Riscos

- **Idempotência mensal:** mudar o dia exige revisar a chave de idempotência do job mensal (por empresa + período + tipo).
- **Fuso e DST:** garantir que “dia N” no calendário do usuário corresponde ao comportamento esperado no scheduler (já citado `America/Sao_Paulo`).

## Referências internas

- `docs/brief.md` — gatilhos MVP (cadastro + mensal dia 1).
- `docs/architecture.md` — sequências “Cadastro de empresa → job imediato” e “Job mensal (dia 1, 06:00)”.

## Próximo passo sugerido (AIOS)

- Handoff para **@pm**: incorporar este brief no PRD e critérios de aceite detalhados.
- **@architect**: ajustar modelo de dados, cron/tick e regras de borda (dia 29–31).

---

*Documento gerado para alinhar produto e implementação; revisar após decisões sobre dias 29–31 e mudança de dia intra-mês.*
