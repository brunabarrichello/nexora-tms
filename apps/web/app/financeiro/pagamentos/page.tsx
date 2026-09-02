import { createCarrierPaymentObligation } from '../../_actions/finance-payment-actions';
import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';

interface PaymentObligation {
  readonly id: string;
  readonly transportContractId: string;
  readonly carrierName: string;
  readonly cargoDescription: string;
  readonly currencyCode: string;
  readonly contractedAmount: string;
  readonly advanceAmount: string;
  readonly settledAmount: string;
  readonly balanceAmount: string;
  readonly dueAt: string;
  readonly effectiveStatus: string;
}

interface MarginCandidate {
  readonly transportRequestId: string;
  readonly contractId: string | null;
  readonly customerName: string;
  readonly cargoDescription: string;
  readonly stage: 'planned' | 'contracted';
  readonly currencyCode: string;
  readonly totalCostAmount: string;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: 'Pagamentos' };

export default async function Page({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const [obligationsResult, marginsResult] = await Promise.all([
    apiGet<readonly PaymentObligation[]>('/api/v1/finance/payments/obligations'),
    apiGet<readonly MarginCandidate[]>('/api/v1/finance/margins'),
  ]);
  const obligations = obligationsResult.kind === 'ready' ? obligationsResult.data : [];
  const existingContracts = new Set(obligations.map((item) => item.transportContractId));
  const candidates =
    marginsResult.kind === 'ready'
      ? marginsResult.data.filter(
          (item) =>
            item.stage === 'contracted' &&
            item.contractId &&
            !existingContracts.has(item.contractId),
        )
      : [];
  const error = typeof params.error === 'string' ? params.error : null;

  return (
    <div className="page-stack">
      <section className="form-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Financeiro • NEX-51</span>
            <h2>Nova obrigação do transportador</h2>
            <p>
              O valor é copiado do contrato confirmado; o usuário informa somente vencimento,
              vínculo opcional de viagem e observações.
            </p>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <form action={createCarrierPaymentObligation} className="entity-form">
          <div className="form-main">
            <div className="field-grid">
              <label className="form-field field-wide">
                <span>Contrato confirmado *</span>
                <select name="transportContractId" defaultValue="" required>
                  <option value="" disabled>
                    Selecione uma operação contratada
                  </option>
                  {candidates.map((item) => (
                    <option
                      key={item.contractId ?? item.transportRequestId}
                      value={item.contractId ?? ''}
                    >
                      {item.customerName} — {item.cargoDescription} —{' '}
                      {money(item.totalCostAmount, item.currencyCode)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Vencimento *</span>
                <input name="dueDate" type="date" required />
              </label>
              <label className="form-field">
                <span>Viagem (UUID, opcional)</span>
                <input name="tripId" placeholder="Vincule somente se a viagem já existir" />
              </label>
              <label className="form-field field-wide">
                <span>Observações</span>
                <input name="notes" placeholder="Condição de pagamento ou referência interna" />
              </label>
            </div>
          </div>
          <aside className="form-aside">
            <div className="form-summary-card">
              <span className="eyebrow">Fonte canônica</span>
              <h2>Sem digitação do valor contratado</h2>
              <p>
                Frete, pedágio e adicionais são capturados do contrato para evitar divergência
                manual.
              </p>
            </div>
            <div className="sticky-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={candidates.length === 0}
              >
                Criar obrigação
              </button>
            </div>
          </aside>
        </form>
      </section>

      <OperationalPage
        eyebrow="Financeiro • NEX-51"
        title="Pagamentos e adiantamentos"
        description="Obrigações do transportador com saldo derivado do ledger append-only."
        status={obligationsResult.kind === 'ready' ? 'API conectada' : 'API indisponível'}
        metrics={[
          {
            label: 'Em aberto',
            value: String(
              obligations.filter((item) =>
                ['open', 'partially_paid'].includes(item.effectiveStatus),
              ).length,
            ),
            helper: 'Inclui obrigações parcialmente pagas',
          },
          {
            label: 'Vencidos',
            value: String(obligations.filter((item) => item.effectiveStatus === 'overdue').length),
            helper: 'Saldo pendente após vencimento',
          },
          {
            label: 'Pagos',
            value: String(obligations.filter((item) => item.effectiveStatus === 'paid').length),
            helper: 'Saldo zerado pelo ledger',
          },
        ]}
        filters={[]}
        columns={[
          { key: 'dueDate', label: 'Vencimento' },
          { key: 'payee', label: 'Transportador', hrefKey: 'href' },
          { key: 'reference', label: 'Carga' },
          { key: 'contracted', label: 'Contratado', align: 'right' },
          { key: 'advance', label: 'Adiantado', align: 'right' },
          { key: 'balance', label: 'Saldo', align: 'right' },
          { key: 'status', label: 'Status' },
        ]}
        rows={obligations.map((item) => ({
          id: item.id,
          dueDate: date(item.dueAt),
          payee: item.carrierName,
          href: `/financeiro/pagamentos/${item.id}`,
          reference: item.cargoDescription,
          contracted: money(item.contractedAmount, item.currencyCode),
          advance: money(item.advanceAmount, item.currencyCode),
          balance: money(item.balanceAmount, item.currencyCode),
          status: statusLabel(item.effectiveStatus),
        }))}
        totalRows={obligations.length}
        emptyTitle={
          obligationsResult.kind === 'ready'
            ? 'Nenhuma obrigação registrada'
            : 'Pagamentos indisponíveis'
        }
        emptyDescription={
          obligationsResult.kind === 'ready'
            ? 'Crie a obrigação a partir de uma operação já contratada.'
            : obligationsResult.message
        }
        integrationNotes={[
          'A obrigação é única por contrato e carrega o valor contratado como snapshot protegido pelo banco.',
          'Adiantamentos, pagamentos e reversões são append-only; o saldo nunca é digitado manualmente.',
          'Comprovantes são documentos existentes do Document Core, referenciados pela transação.',
        ]}
      />
    </div>
  );
}

function money(value: string, currency: string): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount)
    : value;
}

function date(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    open: 'Em aberto',
    partially_paid: 'Parcialmente pago',
    overdue: 'Vencido',
    paid: 'Pago',
    cancelled: 'Cancelado',
  };
  return labels[value] ?? value;
}
