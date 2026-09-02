import { createCustomerReceivable } from '../../_actions/finance-receivable-actions';
import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';

interface MarginRecord {
  readonly transportRequestId: string;
  readonly customerName: string;
  readonly cargoDescription: string;
  readonly currencyCode: string;
  readonly revenueAmount: string | null;
}

interface ReceivableRecord {
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
  readonly fiscalReference: string | null;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: 'Faturamento' };

export default async function Page({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const [marginsResult, receivablesResult] = await Promise.all([
    apiGet<readonly MarginRecord[]>('/api/v1/finance/margins'),
    apiGet<readonly ReceivableRecord[]>('/api/v1/finance/receivables/titles'),
  ]);
  const receivables = receivablesResult.kind === 'ready' ? receivablesResult.data : [];
  const existingRequests = new Set(receivables.map((item) => item.transportRequestId));
  const candidates =
    marginsResult.kind === 'ready'
      ? marginsResult.data.filter(
          (item) => item.revenueAmount !== null && !existingRequests.has(item.transportRequestId),
        )
      : [];
  const error = typeof params.error === 'string' ? params.error : null;

  return (
    <div className="page-stack">
      <section className="form-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Financeiro • NEX-52</span>
            <h2>Novo título a receber</h2>
            <p>
              Cliente e moeda vêm da operação. Informe o valor efetivamente faturado, vencimento e a
              referência fiscal quando disponível.
            </p>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <form action={createCustomerReceivable} className="entity-form">
          <div className="form-main">
            <div className="field-grid">
              <label className="form-field field-wide">
                <span>Operação *</span>
                <select name="transportRequestId" defaultValue="" required>
                  <option value="" disabled>
                    Selecione uma operação faturável
                  </option>
                  {candidates.map((item) => (
                    <option key={item.transportRequestId} value={item.transportRequestId}>
                      {item.customerName} — {item.cargoDescription} — receita planejada{' '}
                      {money(item.revenueAmount ?? '0', item.currencyCode)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Valor faturado *</span>
                <input name="invoicedAmount" type="number" min="0.01" step="0.01" required />
              </label>
              <label className="form-field">
                <span>Vencimento *</span>
                <input name="dueDate" type="date" required />
              </label>
              <label className="form-field field-wide">
                <span>Documento fiscal (Document ID)</span>
                <input
                  name="fiscalDocumentId"
                  placeholder="UUID de documento financeiro no Document Core"
                />
              </label>
              <label className="form-field">
                <span>Referência fiscal</span>
                <input name="fiscalReference" placeholder="NF-e, CT-e ou referência interna" />
              </label>
              <label className="form-field">
                <span>Observações</span>
                <input name="notes" placeholder="Condição, parcela ou instrução" />
              </label>
            </div>
          </div>
          <aside className="form-aside">
            <div className="form-summary-card">
              <span className="eyebrow">Conta a receber</span>
              <h2>Saldo controlado pelo ledger</h2>
              <p>
                Baixas posteriores serão append-only e o status será recalculado automaticamente.
              </p>
            </div>
            <div className="sticky-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={candidates.length === 0}
              >
                Criar título
              </button>
            </div>
          </aside>
        </form>
      </section>

      <OperationalPage
        eyebrow="Financeiro • Faturamento"
        title="Contas a receber"
        description="Acompanhe faturamento, saldo, vencimento e baixa manual por operação e cliente."
        status={receivablesResult.kind === 'ready' ? 'API conectada' : 'API indisponível'}
        metrics={[
          {
            label: 'Em aberto',
            value: String(
              receivables.filter((item) =>
                ['open', 'partially_received'].includes(item.effectiveStatus),
              ).length,
            ),
            helper: 'Inclui recebimentos parciais',
          },
          {
            label: 'Vencidos',
            value: String(receivables.filter((item) => item.effectiveStatus === 'overdue').length),
            helper: 'Saldo pendente após vencimento',
          },
          {
            label: 'Quitados',
            value: String(receivables.filter((item) => item.effectiveStatus === 'paid').length),
            helper: 'Saldo zerado',
          },
        ]}
        filters={[]}
        columns={[
          { key: 'customer', label: 'Cliente' },
          { key: 'cargo', label: 'Carga' },
          { key: 'invoice', label: 'Faturado', align: 'right' },
          { key: 'received', label: 'Recebido', align: 'right' },
          { key: 'balance', label: 'Saldo', align: 'right' },
          { key: 'due', label: 'Vencimento' },
          { key: 'status', label: 'Status', hrefKey: 'href' },
        ]}
        rows={receivables.map((item) => ({
          id: item.id,
          customer: item.customerName,
          cargo: item.cargoDescription,
          invoice: money(item.invoicedAmount, item.currencyCode),
          received: money(item.receivedAmount, item.currencyCode),
          balance: money(item.balanceAmount, item.currencyCode),
          due: date(item.dueAt),
          status: statusLabel(item.effectiveStatus),
          href: `/financeiro/faturamento/${item.id}`,
        }))}
        totalRows={receivables.length}
        emptyTitle={
          receivablesResult.kind === 'ready'
            ? 'Nenhum título registrado'
            : 'Faturamento indisponível'
        }
        emptyDescription={
          receivablesResult.kind === 'ready'
            ? 'Crie um título a partir de uma operação com receita comercial definida.'
            : receivablesResult.message
        }
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
  return (
    {
      open: 'Em aberto',
      partially_received: 'Recebido parcialmente',
      overdue: 'Vencido',
      paid: 'Quitado',
      cancelled: 'Cancelado',
    }[value] ?? value
  );
}
