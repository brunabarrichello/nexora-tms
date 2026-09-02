import { createReconciliationImport } from '../../_actions/finance-reconciliation-actions';
import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';

interface ReconciliationImportRecord {
  readonly id: string;
  readonly source: string;
  readonly provider: string | null;
  readonly externalBatchId: string | null;
  readonly accountReference: string | null;
  readonly entryCount: number;
  readonly createdAt: string;
}

interface ReconciliationEntryRecord {
  readonly id: string;
  readonly externalId: string | null;
  readonly direction: 'credit' | 'debit';
  readonly amount: string;
  readonly currencyCode: string;
  readonly occurredAt: string;
  readonly reference: string | null;
  readonly counterpartyName: string | null;
  readonly status: 'pending' | 'suggested' | 'divergent' | 'reconciled' | 'ignored';
  readonly suggestedScore: number | null;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: 'Conciliação financeira' };

const exampleEntries = JSON.stringify(
  [
    {
      externalId: 'linha-001',
      direction: 'credit',
      amount: '19000.00',
      currencyCode: 'BRL',
      occurredAt: '2026-09-02T12:00:00-03:00',
      reference: 'NF-12345',
      counterpartyName: 'Cliente Exemplo',
      rawPayload: { origem: 'csv' },
    },
  ],
  null,
  2,
);

export default async function Page({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const [importsResult, entriesResult] = await Promise.all([
    apiGet<readonly ReconciliationImportRecord[]>('/api/v1/finance/reconciliation/imports'),
    apiGet<readonly ReconciliationEntryRecord[]>('/api/v1/finance/reconciliation/entries'),
  ]);
  const imports = importsResult.kind === 'ready' ? importsResult.data : [];
  const entries = entriesResult.kind === 'ready' ? entriesResult.data : [];
  const error = typeof params.error === 'string' ? params.error : null;

  return (
    <div className="page-stack">
      <section className="form-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Financeiro • NEX-53</span>
            <h2>Importar movimentos para conciliação</h2>
            <p>
              A importação é provider-agnostic e imutável. O Nexora sugere vínculos, mas nenhuma
              baixa é criada sem confirmação explícita do financeiro.
            </p>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <form action={createReconciliationImport} className="entity-form">
          <div className="form-main">
            <div className="field-grid">
              <label className="form-field">
                <span>Fonte *</span>
                <input name="source" defaultValue="bank_statement" maxLength={40} required />
              </label>
              <label className="form-field">
                <span>Provider</span>
                <input name="provider" placeholder="generic-csv, banco, PSP..." maxLength={80} />
              </label>
              <label className="form-field">
                <span>ID externo do lote</span>
                <input name="externalBatchId" maxLength={160} />
              </label>
              <label className="form-field">
                <span>Conta/referência</span>
                <input name="accountReference" maxLength={160} />
              </label>
              <label className="form-field">
                <span>Início do período</span>
                <input name="periodStart" type="date" />
              </label>
              <label className="form-field">
                <span>Fim do período</span>
                <input name="periodEnd" type="date" />
              </label>
              <label className="form-field field-wide">
                <span>Linhas JSON *</span>
                <textarea name="entriesJson" rows={14} defaultValue={exampleEntries} required />
              </label>
            </div>
          </div>
          <aside className="form-aside">
            <div className="form-summary-card">
              <span className="eyebrow">Importação segura</span>
              <h2>Até 500 linhas por lote</h2>
              <p>
                Use <strong>credit</strong> para recebimentos e <strong>debit</strong> para
                pagamentos. Referência, valor e data alimentam o score de matching.
              </p>
            </div>
            <div className="sticky-actions">
              <button className="button button-primary" type="submit">
                Importar lote
              </button>
            </div>
          </aside>
        </form>
      </section>

      <OperationalPage
        eyebrow="Financeiro • Conciliação"
        title="Fila de conciliação"
        description="Revise sugestões, divergências e conciliações sem alterar silenciosamente os ledgers financeiros."
        status={entriesResult.kind === 'ready' ? 'API conectada' : 'API indisponível'}
        metrics={[
          {
            label: 'Pendentes',
            value: String(entries.filter((item) => item.status === 'pending').length),
            helper: 'Ainda sem tentativa de matching',
          },
          {
            label: 'Divergentes',
            value: String(entries.filter((item) => item.status === 'divergent').length),
            helper: 'Exigem revisão humana',
          },
          {
            label: 'Sugestões',
            value: String(entries.filter((item) => item.status === 'suggested').length),
            helper: 'Candidatos fortes não confirmados',
          },
          {
            label: 'Conciliados',
            value: String(entries.filter((item) => item.status === 'reconciled').length),
            helper: `${imports.length} lote(s) importado(s)`,
          },
        ]}
        filters={[]}
        columns={[
          { key: 'date', label: 'Data' },
          { key: 'nature', label: 'Natureza' },
          { key: 'reference', label: 'Referência' },
          { key: 'counterparty', label: 'Contraparte' },
          { key: 'amount', label: 'Valor', align: 'right' },
          { key: 'score', label: 'Score', align: 'right' },
          { key: 'status', label: 'Estado', hrefKey: 'href' },
        ]}
        rows={entries.map((item) => ({
          id: item.id,
          date: date(item.occurredAt),
          nature: item.direction === 'credit' ? 'Recebimento' : 'Pagamento',
          reference: item.reference ?? item.externalId ?? 'Sem referência',
          counterparty: item.counterpartyName ?? 'Não informado',
          amount: money(item.amount, item.currencyCode),
          score: item.suggestedScore === null ? '—' : String(item.suggestedScore),
          status: statusLabel(item.status),
          href: `/financeiro/conciliacao/${item.id}`,
        }))}
        totalRows={entries.length}
        emptyTitle={
          entriesResult.kind === 'ready' ? 'Nenhum movimento importado' : 'Conciliação indisponível'
        }
        emptyDescription={
          entriesResult.kind === 'ready'
            ? 'Importe um lote para iniciar matching e revisão.'
            : entriesResult.message
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
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
}

function statusLabel(value: ReconciliationEntryRecord['status']): string {
  return (
    {
      pending: 'Pendente',
      suggested: 'Sugestão disponível',
      divergent: 'Divergente',
      reconciled: 'Conciliado',
      ignored: 'Ignorado',
    }[value] ?? value
  );
}
