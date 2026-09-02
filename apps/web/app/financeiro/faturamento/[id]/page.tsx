import Link from 'next/link';

import {
  cancelCustomerReceivable,
  recordCustomerReceipt,
  updateCustomerReceivable,
} from '../../../_actions/finance-receivable-actions';
import { OperationalPage } from '../../../_components/operational-page';
import { apiGet } from '../../../_lib/api-client';

interface Receivable {
  readonly id: string;
  readonly transportRequestId: string;
  readonly customerName: string;
  readonly cargoDescription: string;
  readonly currencyCode: string;
  readonly invoicedAmount: string;
  readonly receivedAmount: string;
  readonly balanceAmount: string;
  readonly dueAt: string;
  readonly effectiveStatus: string;
  readonly fiscalDocumentId: string | null;
  readonly fiscalDocumentTitle: string | null;
  readonly fiscalReference: string | null;
  readonly notes: string | null;
}

interface Transaction {
  readonly id: string;
  readonly kind: 'receipt' | 'reversal';
  readonly amount: string;
  readonly relatedTransactionId: string | null;
  readonly proofDocumentId: string | null;
  readonly proofDocumentTitle: string | null;
  readonly occurredAt: string;
  readonly notes: string | null;
}

interface EventRecord {
  readonly id: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actorUserId: string;
  readonly createdAt: string;
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: 'Conta a receber' };

export default async function Page({
  params,
  searchParams,
}: Readonly<{ params: Params; searchParams: SearchParams }>) {
  const { id } = await params;
  const query = await searchParams;
  const [receivableResult, transactionsResult, eventsResult] = await Promise.all([
    apiGet<Receivable>(`/api/v1/finance/receivables/titles/${id}`),
    apiGet<readonly Transaction[]>(`/api/v1/finance/receivables/titles/${id}/transactions`),
    apiGet<readonly EventRecord[]>(`/api/v1/finance/receivables/titles/${id}/events`),
  ]);

  if (receivableResult.kind !== 'ready') {
    return (
      <OperationalPage
        eyebrow="Financeiro • NEX-52"
        title="Conta a receber"
        description="Não foi possível carregar o título solicitado."
        status="API indisponível"
        filters={[]}
        columns={[]}
        rows={[]}
        emptyTitle="Título indisponível"
        emptyDescription={receivableResult.message}
      />
    );
  }

  const receivable = receivableResult.data;
  const transactions = transactionsResult.kind === 'ready' ? transactionsResult.data : [];
  const events = eventsResult.kind === 'ready' ? eventsResult.data : [];
  const reversible = transactions.filter((item) => item.kind === 'receipt');
  const error = typeof query.error === 'string' ? query.error : null;

  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">Financeiro • NEX-52</span>
          <h1>{receivable.customerName}</h1>
          <p>{receivable.cargoDescription}</p>
        </div>
        <Link href="/financeiro/faturamento" className="button button-secondary">
          Voltar para faturamento
        </Link>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Faturado</span>
          <strong>{money(receivable.invoicedAmount, receivable.currencyCode)}</strong>
          <small>{receivable.fiscalReference ?? 'Sem referência fiscal'}</small>
        </article>
        <article className="metric-card">
          <span>Recebido</span>
          <strong>{money(receivable.receivedAmount, receivable.currencyCode)}</strong>
          <small>Baixas líquidas</small>
        </article>
        <article className="metric-card">
          <span>Saldo</span>
          <strong>{money(receivable.balanceAmount, receivable.currencyCode)}</strong>
          <small>{statusLabel(receivable.effectiveStatus)}</small>
        </article>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Baixa manual append-only</span>
            <h2>Registrar recebimento ou reversão</h2>
            <p>O ledger não permite editar ou excluir lançamentos já registrados.</p>
          </div>
        </div>
        <form action={recordCustomerReceipt} className="entity-form">
          <input type="hidden" name="receivableId" value={receivable.id} />
          <div className="form-main">
            <div className="field-grid">
              <label className="form-field">
                <span>Tipo *</span>
                <select name="kind" defaultValue="receipt" required>
                  <option value="receipt">Recebimento</option>
                  <option value="reversal">Reversão</option>
                </select>
              </label>
              <label className="form-field">
                <span>Valor *</span>
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </label>
              <label className="form-field field-wide">
                <span>Lançamento original (somente reversão)</span>
                <select name="relatedTransactionId" defaultValue="">
                  <option value="">Nenhum</option>
                  {reversible.map((item) => (
                    <option key={item.id} value={item.id}>
                      Recebimento — {money(item.amount, receivable.currencyCode)} —{' '}
                      {dateTime(item.occurredAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field field-wide">
                <span>Comprovante (Document ID)</span>
                <input name="proofDocumentId" placeholder="UUID de documento financeiro no Document Core" />
              </label>
              <label className="form-field field-wide">
                <span>Observações</span>
                <input name="notes" placeholder="Referência bancária ou justificativa" />
              </label>
            </div>
          </div>
          <aside className="form-aside">
            <div className="form-summary-card">
              <span className="eyebrow">Saldo atual</span>
              <h2>{money(receivable.balanceAmount, receivable.currencyCode)}</h2>
              <p>O banco rejeita baixa acima do saldo e reversão incoerente.</p>
            </div>
            <div className="sticky-actions">
              <button className="button button-primary" type="submit" disabled={receivable.effectiveStatus === 'cancelled'}>
                Registrar lançamento
              </button>
            </div>
          </aside>
        </form>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Documento fiscal e vencimento</span>
            <h2>Atualizar metadados do título</h2>
          </div>
        </div>
        <form action={updateCustomerReceivable} className="entity-form">
          <input type="hidden" name="receivableId" value={receivable.id} />
          <div className="form-main">
            <div className="field-grid">
              <label className="form-field">
                <span>Vencimento *</span>
                <input name="dueDate" type="date" defaultValue={inputDate(receivable.dueAt)} required />
              </label>
              <label className="form-field">
                <span>Referência fiscal</span>
                <input name="fiscalReference" defaultValue={receivable.fiscalReference ?? ''} />
              </label>
              <label className="form-field field-wide">
                <span>Documento fiscal (Document ID)</span>
                <input name="fiscalDocumentId" defaultValue={receivable.fiscalDocumentId ?? ''} />
              </label>
              <label className="form-field field-wide">
                <span>Observações</span>
                <input name="notes" defaultValue={receivable.notes ?? ''} />
              </label>
            </div>
          </div>
          <aside className="form-aside">
            <div className="form-summary-card">
              <span className="eyebrow">Documento atual</span>
              <p>{receivable.fiscalDocumentTitle ?? 'Nenhum documento fiscal associado'}</p>
              <p>Operação: {receivable.transportRequestId}</p>
            </div>
            <div className="sticky-actions">
              <button className="button button-secondary" type="submit" disabled={receivable.effectiveStatus === 'cancelled'}>
                Atualizar título
              </button>
            </div>
          </aside>
        </form>
      </section>

      <OperationalPage
        eyebrow="Financeiro • Ledger"
        title="Baixas e reversões"
        description="Histórico imutável dos recebimentos manuais."
        status={transactionsResult.kind === 'ready' ? 'API conectada' : 'API indisponível'}
        filters={[]}
        columns={[
          { key: 'date', label: 'Data' },
          { key: 'kind', label: 'Tipo' },
          { key: 'amount', label: 'Valor', align: 'right' },
          { key: 'proof', label: 'Comprovante' },
          { key: 'notes', label: 'Observações' },
        ]}
        rows={transactions.map((item) => ({
          id: item.id,
          date: dateTime(item.occurredAt),
          kind: item.kind === 'receipt' ? 'Recebimento' : 'Reversão',
          amount: money(item.amount, receivable.currencyCode),
          proof: item.proofDocumentTitle ?? item.proofDocumentId ?? '—',
          notes: item.notes ?? (item.relatedTransactionId ? `Reverte ${item.relatedTransactionId}` : '—'),
        }))}
        totalRows={transactions.length}
        emptyTitle="Nenhuma baixa registrada"
        emptyDescription="Registre o primeiro recebimento manual para iniciar o ledger."
      />

      <OperationalPage
        eyebrow="Financeiro • Auditoria"
        title="Histórico do título"
        description="Criação, alterações, status e lançamentos produzidos pelo banco."
        status={eventsResult.kind === 'ready' ? 'API conectada' : 'API indisponível'}
        filters={[]}
        columns={[
          { key: 'date', label: 'Data' },
          { key: 'event', label: 'Evento' },
          { key: 'actor', label: 'Usuário' },
          { key: 'detail', label: 'Detalhe' },
        ]}
        rows={events.map((item) => ({
          id: item.id,
          date: dateTime(item.createdAt),
          event: eventLabel(item.eventType),
          actor: item.actorUserId,
          detail: JSON.stringify(item.payload).slice(0, 180),
        }))}
        totalRows={events.length}
        emptyTitle="Sem eventos"
        emptyDescription="O histórico será preenchido automaticamente pelo banco."
      />

      {receivable.effectiveStatus !== 'cancelled' ? (
        <section className="form-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Ação administrativa</span>
              <h2>Cancelar título</h2>
              <p>Se houver recebimento líquido, reverta as baixas antes do cancelamento.</p>
            </div>
          </div>
          <form action={cancelCustomerReceivable} className="field-grid">
            <input type="hidden" name="receivableId" value={receivable.id} />
            <label className="form-field field-wide">
              <span>Motivo *</span>
              <input name="reason" minLength={10} required />
            </label>
            <button className="button button-secondary" type="submit">
              Cancelar título
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function money(value: string, currency: string): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount)
    : value;
}

function dateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
}

function inputDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function statusLabel(value: string): string {
  return {
    open: 'Em aberto',
    partially_received: 'Recebido parcialmente',
    overdue: 'Vencido',
    paid: 'Quitado',
    cancelled: 'Cancelado',
  }[value] ?? value;
}

function eventLabel(value: string): string {
  return {
    created: 'Criado',
    due_at_changed: 'Vencimento alterado',
    fiscal_changed: 'Documento fiscal alterado',
    notes_changed: 'Observação alterada',
    cancelled: 'Cancelado',
    status_changed: 'Status alterado',
    transaction_recorded: 'Lançamento registrado',
  }[value] ?? value;
}
