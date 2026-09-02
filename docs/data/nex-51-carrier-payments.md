# NEX-51 — Pagamentos do transportador e adiantamentos

## Objetivo

Registrar a obrigação financeira do transportador por operação contratada, controlar adiantamentos, pagamentos, reversões, vencimento e saldo, associar comprovantes do Document Core e manter histórico auditável sem introduzir faturamento ou conciliação nesta história.

## Fronteira funcional

NEX-51 cobre somente contas a pagar do transportador:

- obrigação única por `transport_contract`;
- vínculo obrigatório à carga (`transport_request`) por meio do contrato;
- vínculo opcional com `trip`, validado contra `trip_transport_requests` ativo;
- snapshot do custo contratado (`freight + toll + additional`) e moeda do contrato;
- vencimento e estado operacional da obrigação;
- ledger append-only de `advance`, `payment` e `reversal`;
- comprovante opcional referenciando `documents` existente;
- histórico append-only de criação, alterações, status e lançamentos.

Fora do escopo:

- NEX-52: faturamento e contas a receber;
- NEX-53: conciliação/liquidação entre contas a pagar e receber;
- nova implementação de storage/documentos.

## Modelo

### `carrier_payment_obligations`

Uma linha por contrato dentro do tenant. O PostgreSQL lê o contrato confirmado/cumprido e protege como imutáveis:

- `transport_request_id`;
- `transport_contract_id`;
- `carrier_party_id`;
- `currency_code`;
- `contracted_amount`.

O usuário pode alterar apenas vencimento, viagem opcional e observações. Cancelamento exige motivo, ator e timestamp e só é permitido quando o valor líquido pago voltou a zero.

### `carrier_payment_transactions`

Ledger append-only:

- `advance`: adiantamento ao transportador;
- `payment`: pagamento de saldo;
- `reversal`: reversão integral de um único adiantamento/pagamento anterior.

Regras de banco:

- valor sempre positivo;
- nenhuma transação pode ultrapassar o saldo contratado;
- reversão deve apontar para transação da mesma obrigação;
- valor da reversão deve ser exatamente igual ao original;
- uma transação original pode ser revertida uma única vez;
- UPDATE/DELETE não são concedidos ao runtime e triggers reforçam imutabilidade.

### `carrier_payment_events`

Histórico gerado no banco e somente legível pelo runtime. Eventos incluem criação, mudança de vencimento/notas, mudança de status, cancelamento e lançamento financeiro.

## Saldo e status

O saldo nunca é digitado:

`settled = advances + payments - reversals`

`balance = contracted_amount - settled`

Status persistido:

- `open`;
- `partially_paid`;
- `paid`;
- `cancelled`.

`overdue` é estado derivado em leitura quando existe saldo e `due_at < now()`. Isso evita jobs diários apenas para alterar status temporal.

## Document Core

O comprovante é `proof_document_id -> documents(tenant_id,id)`. A API só aceita documento existente e não soft-deleted no tenant atual. Upload, versionamento, storage e validação continuam sob o Document Core existente.

## RBAC

- `finance.read`: Tenant Admin, Operations Manager, Finance Manager e Auditor.
- `finance.write`: Tenant Admin e Finance Manager.
- Dispatcher e Viewer não recebem permissão financeira de escrita.

## API

Base: `/api/v1/finance/payments`

Leitura (`finance.read`):

- `GET /obligations`
- `GET /obligations/:id`
- `GET /obligations/:id/transactions`
- `GET /obligations/:id/events`

Mutação (`finance.write`):

- `POST /obligations`
- `PATCH /obligations/:id`
- `POST /obligations/:id/cancel`
- `POST /obligations/:id/transactions`

## Web

- `/financeiro/pagamentos`: cria obrigação a partir de contrato confirmado e exibe contratado, adiantado, saldo, vencimento e status.
- `/financeiro/pagamentos/[id]`: registra adiantamento/pagamento/reversão, associa comprovante, altera vencimento/vínculo, exibe ledger e histórico e executa cancelamento controlado.

## Gate Neon

`Neon Finance Payments Gate` usa branch efêmera derivada de Production, replay integral das migrations e prova:

1. schema, RLS e least privilege;
2. contrato confirmado real;
3. vínculo da obrigação à carga e viagem real;
4. snapshot de R$ 15.300,00 do contrato;
5. adiantamento com comprovante;
6. bloqueio de overpayment;
7. pagamento até saldo zero;
8. bloqueio de cancelamento enquanto há valor liquidado;
9. reversões e recálculo automático;
10. overdue derivado;
11. imutabilidade de ledger/eventos;
12. cancelamento após reversão integral;
13. isolamento cross-tenant;
14. cleanup da branch efêmera.

Production permanece congelada durante a qualificação de NEX-51.
