# NEX-52 — Faturamento e contas a receber por operação

## Objetivo

Registrar o título a receber do cliente por operação, controlar vencimento e saldo, associar referência/documento fiscal e suportar baixa manual inicial com histórico auditável.

## Fonte canônica

O título referencia `transport_requests` e deriva automaticamente:

- cliente de `transport_requests.customer_party_id`;
- moeda de `transport_request_commercial_terms.currency_code`.

O valor faturado é explícito porque representa o documento comercial efetivamente emitido, não uma cópia silenciosa da projeção de receita do NEX-50.

## Modelo

### `customer_receivables`

Um título por operação no MVP. Armazena snapshot imutável de cliente, moeda e valor faturado, além de vencimento, documento fiscal, referência fiscal, observações e estado persistido.

Estados persistidos:

- `open`;
- `partially_received`;
- `paid`;
- `cancelled`.

`overdue` é derivado em leitura quando existe saldo pendente após `due_at`.

### `customer_receivable_transactions`

Ledger append-only:

- `receipt` — baixa manual;
- `reversal` — reversão integral de uma baixa anterior.

Regras:

- baixa não pode exceder o saldo;
- reversão deve apontar para baixa do mesmo título;
- reversão deve ter o mesmo valor da baixa original;
- uma baixa pode ser revertida uma única vez;
- reversão não pode ocorrer antes da baixa original;
- transações não podem ser atualizadas nem excluídas.

### `customer_receivable_events`

Histórico append-only de criação, mudanças de vencimento/documento fiscal/observação, status, cancelamento e lançamentos.

## Document Core

`fiscal_document_id` e `proof_document_id` usam a tabela `documents` existente. Os triggers aceitam somente documentos ativos cujo `document_types.subject_scope` seja `financial`.

Nenhum storage documental paralelo é criado.

## Cancelamento

Um título só pode ser cancelado quando o recebimento líquido for zero. Caso existam baixas, elas devem ser revertidas antes do cancelamento.

## RBAC

- leitura: `finance.read`;
- escrita: `finance.write`.

A permissão `finance.write` já é restrita pelo NEX-51 a Tenant Admin e Finance Manager. Operations Manager e Auditor permanecem somente leitura financeira.

## API

Base: `/api/v1/finance/receivables`

- `GET /titles`;
- `POST /titles`;
- `GET /titles/:receivableId`;
- `PATCH /titles/:receivableId`;
- `POST /titles/:receivableId/cancel`;
- `GET /titles/:receivableId/transactions`;
- `POST /titles/:receivableId/transactions`;
- `GET /titles/:receivableId/events`.

## Web

- `/financeiro/faturamento` — criação e visão de contas a receber;
- `/financeiro/faturamento/[id]` — baixa, reversão, documento fiscal, vencimento, ledger, auditoria e cancelamento.

## Qualificação

O `Neon Finance Receivables Gate` cria branch Neon efêmera a partir de Production, aplica toda a cadeia de migrations e valida:

- schema/RLS/least privilege;
- título vinculado à operação/cliente;
- valor faturado e moeda comercial;
- documento fiscal financeiro;
- baixa parcial com comprovante;
- bloqueio de recebimento acima do saldo;
- quitação e saldo zero;
- reversão cronológica única;
- recálculo automático de status;
- overdue derivado;
- append-only;
- cancelamento após reversões;
- isolamento cross-tenant;
- cleanup da branch efêmera.

## Limite de escopo

NEX-52 não implementa conciliação bancária, matching de extrato, importação bancária ou baixa automática. Esses itens pertencem ao NEX-53.

Production permanece congelada durante a qualificação da PR.
