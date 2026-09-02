import Link from 'next/link';

import {
  cancelCarrierPaymentObligation,
  recordCarrierPaymentTransaction,
  updateCarrierPaymentObligation,
} from '../../../_actions/finance-payment-actions';
import { OperationalPage } from '../../../_components/operational-page';
import { apiGet } from '../../../_lib/api-client';

interface Obligation {
  readonly id: string;
  readonly transportRequestId: string;
  readonly transportContractId: string;
  readonly tripId: string | null;
  readonly tripCode: string | null;
  readonly carrierName: string;
  readonly cargoDescription: string;
  readonly currencyCode: string;
  readonly contractedAmount: string;
  readonly advanceAmount: string;
  readonly paymentAmount: string;
  readonly reversalAmount: string;
  readonly settledAmount: string;
  readonly balanceAmount: string;
  readonly dueAt: string;
  readonly effectiveStatus: string;
  readonly notes: string | null;
  readonly cancelReason: string | null;
}

interface Transaction {
  readonly id: string;
  readonly kind: 'advance' | 'payment' | 'reversal';
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

export const metadata = { title: 'Detalhe do pagamento' };

export default async function Page({
  params,
  searchParams,
}: Readonly<{ params: Params; searchParams: SearchParams }>) {
  const { id } = await params;
  const query = await searchParams;
  const [obligationResult, transactionsResult, eventsResult] = await Promise.all([
    apiGet<Obligation>(`/api/v1/finance/payments/obligations/${id}`),
    apiGet<readonly Transaction[]>(`/api/v1/finance/payments/obligations/${id}/transactions`),
    apiGet<readonly EventRecord[]>(`/api/v1/finance/payments/obligations/${id}/events`),
  ]);

  if (obligationResult.kind !== 'ready') {
    return (
      <OperationalPage
        eyebrow="Financeiro • NEX-51"
        title="Obrigação financeira"
        description="Não foi possível carregar a obrigação solicitada."
        status="API indisponível"
        filters={[]}
        columns={[]}
        rows={[]}
        emptyTitle="Obrigação indisponível"
        emptyDescription={obligationResult.message}
      />
    );
  }

  const obligation = obligationResult.data;
  const transactions = transactionsResult.kind === 'ready' ? transactionsResult.data : [];
  const events = eventsResult.kind === 'ready' ? eventsResult.data : [];
  const error = typeof query.error === 'string' ? query.error : null;
  const reversible = transactions.filter((item) => item.kind === 'advance' || item.kind === 'payment');

  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">Financeiro • NEX-51</span>
          <h1>{obligation.carrierName}</h1>
          <p>{obligation.cargoDescription}</p>
        </div>
        <Link href="/financeiro/pagamentos" className="button button-secondary">
          Voltar para pagamentos
        </Link>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Valor contratado</span>
          <strong>{money(obligation.contractedAmount, obligation.currencyCode)}</strong>
          <small>Snapshot do contrato</small>
        </article>
        <article className="metric-card">
          <span>Liquidado</span>
          <strong>{money(obligation.settledAmount, obligation.currencyCode)}</strong>
          <small>Adiantamentos + pagamentos − reversões</small>
        </article>
        <article className="metric-card">
          <span>Saldo</span>
          <strong>{money(obligation.balanceAmount, obligation.currencyCode)}</strong>
          <small>{statusLabel(obligation.effectiveStatus)}</small>
        </article>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Lançamento append-only</span>
            <h2>Registrar adiantamento, pagamento ou reversão</h2>
            <p>Transações já registradas não podem ser editadas nem excluídas.</p>
          </div>
        </div>
        <form action={recordCarrierPaymentTransaction} className="entity-form">
          <input type="hidden" name="obligationId" value={obligation.id} />
          <div className="form-main">
            <div className="field-grid">
              <label className="form-field">
                <span>Tipo *</span>
                <select name="kind" defaultValue="advance" required>
                  <option value="advance">Adiantamento</option>
                  <option value="payment">Pagamento</option>
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
                      {kindLabel(item.kind)} — {money(item.amount, obligation.currencyCode)} — {dateTime(item.occurredAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field field-wide">
                <span>Comprovante (Document ID)</span>
                <input name="proofDocumentId" placeholder="UUID de documento já enviado ao Document Core" />
              </label>
              <label className="form-field field-wide">
                <span>Observações</span>
                <input name="notes" placeholder="Referência bancária, instrução ou justificativa" />
              </label>
            </div>
          </div>
          <aside className="form-aside">
            <div className="form-summary-card">
              <span className="eyebrow">Saldo atual</span>
              <h2>{money(obligation.balanceAmount, obligation.currencyCode)}</h2>
              <p>O banco rejeita automaticamente lançamentos acima do saldo disponível.</p>
            </div>
            <div className="sticky-actions">
              <button className="button button-primary" type="submit" disabled={obligation.effectiveStatus === 'cancelled'}>
                Registrar lançamento
              </button>
            </div>
          </aside>
        </form>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Obrigação</span>
            <h2>Vencimento e vínculo operacional</h2>
          </div>
        </div>
        <form action={updateCarrierPaymentObligation} className="entity-form">
          <input type="hidden" name="obligationId" value={obligation.id} />
          <div className="form-main">
            <div className="field-grid">
              <label className="form-field">
                <span>Vencimento *</span>
                <input name="dueDate" type="date" defaultValue={inputDate(obligation.dueAt)} required />
              </label>
              <label className="form-field">
                <span>Viagem (UUID)</span>
                <input name="tripId" defaultValue={obligation.tripId ?? ''} />
              </label>
              <label className="form-field field-wide">
                <span>Observações</span>
                <input name="notes" defaultValue={obligation.notes ?? ''} />
              </label>
            </div>
          </div>
          <aside className="form-aside">
            <div className="form-summary-card">
              <span className="eyebrow">Referência</span>
              <p>Contrato: {obligation.transportContractId}</p>
              <p>Viagem: {obligation.tripCode ?? 'não vinculada'}</p>
            </div>
            <div className="sticky-actions">
              <button className="button button-secondary" type="submit" disabled={obligation.effectiveStatus === 'cancelled'}>
                Atualizar obrigação
              </button>
            </div>
          </aside>
        </form>
      </section>

      <OperationalPage
        eyebrow="Financeiro • Ledger"
        title="Lançamentos"
        description="Histórico imutável de adiantamentos, pagamentos e reversões."
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
          kind: kindLabel(item.kind),
          amount: money(item.amount, obligation.currencyCode),
          proof: item.proofDocumentTitle ?? item.proofDocumentId ?? '—',
          notes: item.notes ?? (item.relatedTransactionId ? `Reverte ${item.relatedTransactionId}` : '—'),
        }))}
        totalRows={transactions.length}
        emptyTitle="Nenhum lançamento"
        emptyDescription="Registre um adiantamento ou pagamento para iniciar o ledger."
      />

      <OperationalPage
        eyebrow="Financeiro • Auditoria"
        title="Histórico da obrigação"
        description="Eventos de criação, alteração, status e lançamentos gerados pelo banco."
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

      {obligation.effectiveStatus !== 'cancelled' ? (
        <section className="form-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Ação administrativa</span>
              <h2>Cancelar obrigação</h2>
              <p>Se houver valor liquidado, reverta os lançamentos antes do cancelamento.</p>
            </div>
          </div>
          <form action={cancelCarrierPaymentObligation} className="field-grid">
            <input type="hidden" name="obligationId" value={obligation.id} />
            <label className="form-field field-wide">
              <span>Motivo *</span>
              <input name="reason" minLength={10} required />
            </label>
            <button className="button button-secondary" type="submit">
              Cancelar obrigação
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

function kindLabel(value: string): string {
  return { advance: 'Adiantamento', payment: 'Pagamento', reversal: 'Reversão' }[value] ?? value;
}

function statusLabel(value: string): string {
  return {
    open: 'Em aberto',
    partially_paid: 'Parcialmente pago',
    overdue: 'Vencido',
    paid: 'Pago',
    cancelled: 'Cancelado',
  }[value] ?? value;
}

function eventLabel(value: string): string {
  return {
    created: 'Criada',
    due_at_changed: 'Vencimento alterado',
    notes_changed: 'Observação alterada',
    cancelled: 'Cancelada',
    status_changed: 'Status alterado',
    transaction_recorded: 'Lançamento registrado',
  }[value] ?? value;
}
