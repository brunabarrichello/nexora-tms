# NEX-53 — Conciliação financeira assistida

## Objetivo

Reduzir baixas manuais repetitivas sem permitir que integrações externas alterem silenciosamente os ledgers financeiros do Nexora.

O fluxo é deliberadamente dividido em quatro etapas:

1. importar movimentos externos de forma imutável;
2. calcular candidatos determinísticos por referência, valor e data;
3. enviar casos fracos ou ambíguos para divergência;
4. exigir confirmação explícita antes de criar a baixa no ledger canônico.

## Modelo de dados

### `financial_reconciliation_imports`

Representa um lote importado. É append-only e provider-agnostic.

Campos de integração:

- `source`;
- `provider` opcional;
- `external_batch_id` idempotente por fonte/tenant;
- `account_reference`;
- período do lote.

### `financial_reconciliation_entries`

Linha imutável do extrato/provedor:

- `credit` — entrada financeira, candidata a `customer_receivables`;
- `debit` — saída financeira, candidata a `carrier_payment_obligations`.

Dados importados não podem ser reescritos. Somente estado/sugestão podem evoluir.

Estados:

- `pending`;
- `suggested`;
- `divergent`;
- `reconciled`;
- `ignored`.

`ignored` é terminal. Um item `reconciled` só pode voltar a `divergent` após uma reversão financeira append-only válida.

### `financial_reconciliation_matches`

Registra o vínculo entre linha externa e lançamento financeiro real.

O match aponta simultaneamente para:

- entry importada;
- alvo (`customer_receivable` ou `carrier_payment`);
- transação real do ledger;
- método `suggested` ou `manual`;
- score quando aplicável;
- reversão posterior, se houver.

O trigger valida que o transaction ID pertence ao target/tenant e possui a natureza financeira correta.

### `financial_reconciliation_events`

Auditoria append-only de:

- importação;
- tentativa de matching;
- item ignorado;
- conciliação;
- reversão.

`nexora_app` não possui INSERT direto nessa tabela. Eventos são criados somente pela função protegida `nexora_record_finance_reconciliation_event`, que valida `app.tenant_id` e `app.user_id`.

## Matching determinístico v1

Candidatos são filtrados primeiro por:

- direção financeira;
- moeda;
- saldo suficiente;
- alvo não cancelado.

Score máximo 100:

- saldo restante exatamente igual ao movimento: +45;
- movimento cabe no saldo, mas não o quita: +30;
- referência exata: +35;
- referência contém identificador do alvo: +25;
- data em até 3 dias do vencimento: +20;
- até 7 dias: +15;
- até 30 dias: +5;
- contraparte compatível: +10.

Uma sugestão automática só é publicada quando:

- score do primeiro candidato >= 70; e
- não existe segundo candidato a menos de 10 pontos de distância.

Caso contrário, a linha fica `divergent`.

Esse algoritmo é explicável e versionável. Ele não executa baixa automaticamente.

## Conciliação sugerida

Ao confirmar uma sugestão:

- `credit` cria `customer_receivable_transactions.kind='receipt'`;
- `debit` cria `carrier_payment_transactions.kind='payment'`;
- em seguida é criado o `financial_reconciliation_match`;
- a entry passa para `reconciled`;
- um evento de auditoria é registrado.

Tudo ocorre na mesma transação de banco. Qualquer rejeição dos triggers de NEX-51/NEX-52 faz rollback integral.

## Conciliação manual assistida

O Finance Manager pode selecionar manualmente um target quando possui evidência suficiente.

Mesmo em modo manual, permanecem obrigatórias as validações do banco:

- mesmo tenant;
- direção correta;
- saldo suficiente;
- documento financeiro válido quando informado;
- target ativo/não cancelado;
- integridade do ledger.

## Reversão

Uma conciliação não é apagada.

A reversão:

1. cria uma transação `reversal` no ledger original;
2. marca o match como `reversed` com ator, data e motivo;
3. reabre a entry como `divergent`;
4. registra evento `reconciliation_reversed`.

## RBAC

- leitura: `finance.read`;
- importação, matching, conciliação, ignore e reversão: `finance.write`.

A política existente mantém escrita financeira em Tenant Admin e Finance Manager.

## API

Base: `/api/v1/finance/reconciliation`

- `GET /imports`;
- `POST /imports`;
- `GET /entries`;
- `GET /entries/:entryId`;
- `POST /entries/:entryId/suggest`;
- `POST /entries/:entryId/reconcile`;
- `POST /entries/:entryId/ignore`;
- `POST /matches/:matchId/reverse`.

## Web

- `/financeiro/conciliacao` — importação e fila;
- `/financeiro/conciliacao/[id]` — candidatos, score, motivos, confirmação sugerida/manual, ignore, reversão e auditoria.

## Integrações futuras

O core não conhece banco, PSP ou formato específico. Adapters futuros devem normalizar dados no contrato de importação usando `source`, `provider`, `external_batch_id`, `external_id` e `raw_payload`.

A idempotência externa é preservada por índices únicos por tenant/lote.

## Gate

`Neon Finance Reconciliation Gate` deve validar em branch efêmera:

- replay completo das migrations 0039/0040;
- RLS e least privilege;
- eventos protegidos;
- importação provider-agnostic;
- sugestão forte por referência/valor/data;
- divergência para match fraco;
- conciliação manual;
- conciliação sugerida;
- gravação nos ledgers canônicos;
- reversão append-only;
- item ignorado;
- isolamento cross-tenant;
- cleanup da branch.

Na qualificação inicial, o gate confirmou migrations, segurança e build e revelou duas melhorias de execução que foram corrigidas antes do head final: testes SQL negativos passaram a usar transações independentes e consultas no mesmo `PoolClient` passaram a ser sequenciais, evitando estado `25P02` e a depreciação de queries concorrentes do `pg`.

Production permanece congelada durante a qualificação.
