import Link from 'next/link';

import {
  ignoreReconciliationEntry,
  reconcileEntry,
  reverseReconciliationMatch,
  suggestReconciliationEntry,
} from '../../../_actions/finance-reconciliation-actions';
import { OperationalPage } from '../../../_components/operational-page';
import { apiGet } from '../../../_lib/api-client';

interface Candidate {
  readonly targetType: 'customer_receivable' | 'carrier_payment';
  readonly targetId: string;
  readonly reference: string;
  readonly counterpartyName: string;
  readonly amount: string;
  readonly balanceAmount: string;
  readonly dueAt: string;
  readonly score: number;
  readonly reasons: readonly string[];
}

interface MatchRecord {
  readonly id: string;
  readonly targetType: 'customer_receivable' | 'carrier_payment';
  readonly targetId: string;
  readonly ledgerTransactionId: string;
  readonly matchMethod: 'suggested' | 'manual';
  readonly score: number | null;
  readonly status: 'active' | 'reversed';
  readonly reversalTransactionId: string | null;
  readonly matchedAt: string;
  readonly reversedAt: string | null;
  readonly reverseReason: string | null;
}

interface EventRecord {
  readonly id: string;
  readonly matchId: string | null;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actorUserId: string;
  readonly createdAt: string;
}

interface EntryDetail {
  readonly id: string;
  readonly externalId: string | null;
  readonly direction: 'credit' | 'debit';
  readonly amount: string;
  readonly currencyCode: string;
  readonly occurredAt: string;
  readonly reference: string | null;
  readonly counterpartyName: string | null;
  readonly status: 'pending' | 'suggested' | 'divergent' | 'reconciled' | 'ignored';
  readonly suggestedTargetType: 'customer_receivable' | 'carrier_payment' | null;
  readonly suggestedTargetId: string | null;
  readonly suggestedScore: number | null;
  readonly suggestionReason: string | null;
  readonly candidates: readonly Candidate[];
  readonly matches: readonly MatchRecord[];
  readonly events: readonly EventRecord[];
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: 'Revisar conciliação' };

export default async function Page({
  params,
  searchParams,
}: Readonly<{ params: Params; searchParams: SearchParams }>) {
  const { id } = await params;
  const query = await searchParams;
  const result = await apiGet<EntryDetail>(`/api/v1/finance/reconciliation/entries/${id}`);
  if (result.kind !== 'ready') {
    return (
      <OperationalPage
        eyebrow="Financeiro • NEX-53"
        title="Revisar conciliação"
        description="Não foi possível carregar o movimento solicitado."
        status="API indisponível"
        filters={[]}
        columns={[]}
        rows={[]}
        emptyTitle="Movimento indisponível"
        emptyDescription={result.message}
      />
    );
  }

  const entry = result.data;
  const activeMatches = entry.matches.filter((match) => match.status === 'active');
  const terminal = entry.status === 'reconciled' || entry.status === 'ignored';
  const error = typeof query.error === 'string' ? query.error : null;

  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">Financeiro • NEX-53</span>
          <h1>{entry.reference ?? entry.externalId ?? 'Movimento sem referência'}</h1>
          <p>
            {entry.counterpartyName ?? 'Contraparte não informada'} • {dateTime(entry.occurredAt)}
          </p>
        </div>
        <Link href="/financeiro/conciliacao" className="button button-secondary">
          Voltar para conciliação
        </Link>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Movimento</span>
          <strong>{money(entry.amount, entry.currencyCode)}</strong>
          <small>{entry.direction === 'credit' ? 'Recebimento' : 'Pagamento'}</small>
        </article>
        <article className="metric-card">
          <span>Estado</span>
          <strong>{statusLabel(entry.status)}</strong>
          <small>{entry.suggestionReason ?? 'Sem justificativa de matching ainda'}</small>
        </article>
        <article className="metric-card">
          <span>Score sugerido</span>
          <strong>{entry.suggestedScore === null ? '—' : entry.suggestedScore}</strong>
          <small>Confirmação continua obrigatória</small>
        </article>
      </section>

      {!terminal ? (
        <section className="form-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Matching determinístico</span>
              <h2>Calcular sugestão</h2>
              <p>O score combina referência, valor, proximidade da data e contraparte.</p>
            </div>
          </div>
          <form action={suggestReconciliationEntry} className="sticky-actions">
            <input type="hidden" name="entryId" value={entry.id} />
            <button className="button button-secondary" type="submit">
              Recalcular candidatos
            </button>
          </form>
        </section>
      ) : null}

      {entry.status === 'suggested' && entry.suggestedTargetId && entry.suggestedTargetType ? (
        <section className="form-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Sugestão qualificada</span>
              <h2>Confirmar vínculo sugerido</h2>
              <p>{entry.suggestionReason}</p>
            </div>
          </div>
          <form action={reconcileEntry} className="entity-form">
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="targetId" value={entry.suggestedTargetId} />
            <input type="hidden" name="targetType" value={entry.suggestedTargetType} />
            <input type="hidden" name="matchMethod" value="suggested" />
            <div className="form-main">
              <div className="field-grid">
                <label className="form-field field-wide">
                  <span>Alvo</span>
                  <input value={`${targetLabel(entry.suggestedTargetType)} • ${entry.suggestedTargetId}`} readOnly />
                </label>
                <label className="form-field field-wide">
                  <span>Comprovante financeiro (Document ID)</span>
                  <input name="proofDocumentId" placeholder="Opcional" />
                </label>
                <label className="form-field field-wide">
                  <span>Observações</span>
                  <input name="notes" placeholder="Referência de aprovação ou conferência" />
                </label>
              </div>
            </div>
            <aside className="form-aside">
              <div className="form-summary-card">
                <span className="eyebrow">Score</span>
                <h2>{entry.suggestedScore}</h2>
                <p>A baixa só será criada ao confirmar este formulário.</p>
              </div>
              <div className="sticky-actions">
                <button className="button button-primary" type="submit">
                  Confirmar e baixar
                </button>
              </div>
            </aside>
          </form>
        </section>
      ) : null}

      {!terminal ? (
        <section className="form-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Conciliação assistida</span>
              <h2>Vincular manualmente</h2>
              <p>Use quando o financeiro possuir evidência suficiente apesar de uma sugestão fraca.</p>
            </div>
          </div>
          <form action={reconcileEntry} className="entity-form">
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="matchMethod" value="manual" />
            <div className="form-main">
              <div className="field-grid">
                <label className="form-field">
                  <span>Natureza do alvo *</span>
                  <select
                    name="targetType"
                    defaultValue={entry.direction === 'credit' ? 'customer_receivable' : 'carrier_payment'}
                    required
                  >
                    <option value="customer_receivable">Conta a receber</option>
                    <option value="carrier_payment">Obrigação do transportador</option>
                  </select>
                </label>
                <label className="form-field field-wide">
                  <span>ID do alvo *</span>
                  <input name="targetId" placeholder="UUID do título/obrigação" required />
                </label>
                <label className="form-field field-wide">
                  <span>Comprovante financeiro (Document ID)</span>
                  <input name="proofDocumentId" placeholder="Opcional" />
                </label>
                <label className="form-field field-wide">
                  <span>Justificativa/observação</span>
                  <input name="notes" placeholder="Motivo da seleção manual" />
                </label>
              </div>
            </div>
            <aside className="form-aside">
              <div className="form-summary-card">
                <span className="eyebrow">Revisão humana</span>
                <h2>{money(entry.amount, entry.currencyCode)}</h2>
                <p>O banco ainda valida direção, saldo, tenant e integridade do ledger.</p>
              </div>
              <div className="sticky-actions">
                <button className="button button-primary" type="submit">
                  Conciliar manualmente
                </button>
              </div>
            </aside>
          </form>
        </section>
      ) : null}

      {!terminal ? (
        <section className="form-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Exceção administrativa</span>
              <h2>Ignorar movimento</h2>
              <p>Use apenas para itens que não pertencem aos ledgers operacionais do TMS.</p>
            </div>
          </div>
          <form action={ignoreReconciliationEntry} className="entity-form">
            <input type="hidden" name="entryId" value={entry.id} />
            <div className="form-main">
              <label className="form-field field-wide">
                <span>Justificativa *</span>
                <input name="reason" minLength={10} maxLength={1000} required />
              </label>
            </div>
            <aside className="form-aside">
              <div className="sticky-actions">
                <button className="button button-secondary" type="submit">
                  Marcar como ignorado
                </button>
              </div>
            </aside>
          </form>
        </section>
      ) : null}

      {activeMatches.map((match) => (
        <section className="form-section" key={match.id}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Correção append-only</span>
              <h2>Reverter conciliação ativa</h2>
              <p>
                {targetLabel(match.targetType)} • {match.targetId} • lançamento {match.ledgerTransactionId}
              </p>
            </div>
          </div>
          <form action={reverseReconciliationMatch} className="entity-form">
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="matchId" value={match.id} />
            <div className="form-main">
              <label className="form-field field-wide">
                <span>Motivo da reversão *</span>
                <input name="reason" minLength={10} maxLength={1000} required />
              </label>
            </div>
            <aside className="form-aside">
              <div className="sticky-actions">
                <button className="button button-secondary" type="submit">
                  Reverter e reabrir divergência
                </button>
              </div>
            </aside>
          </form>
        </section>
      ))}

      <OperationalPage
        eyebrow="Matching"
        title="Candidatos avaliados"
        description="Os motivos deixam explícitos os componentes usados no score."
        filters={[]}
        columns={[
          { key: 'target', label: 'Alvo' },
          { key: 'reference', label: 'Referência' },
          { key: 'counterparty', label: 'Contraparte' },
          { key: 'balance', label: 'Saldo', align: 'right' },
          { key: 'due', label: 'Vencimento' },
          { key: 'score', label: 'Score', align: 'right' },
          { key: 'reasons', label: 'Motivos' },
        ]}
        rows={entry.candidates.map((candidate) => ({
          id: `${candidate.targetType}-${candidate.targetId}`,
          target: targetLabel(candidate.targetType),
          reference: candidate.reference,
          counterparty: candidate.counterpartyName,
          balance: money(candidate.balanceAmount, entry.currencyCode),
          due: dateTime(candidate.dueAt),
          score: String(candidate.score),
          reasons: candidate.reasons.join(' • '),
        }))}
        totalRows={entry.candidates.length}
        emptyTitle="Nenhum candidato elegível"
        emptyDescription="Não existe título/obrigação compatível com direção, moeda e saldo deste movimento."
      />

      <OperationalPage
        eyebrow="Auditoria"
        title="Histórico da conciliação"
        description="Importação, tentativas, confirmação, exceções e reversões permanecem auditáveis."
        filters={[]}
        columns={[
          { key: 'time', label: 'Data/hora' },
          { key: 'event', label: 'Evento' },
          { key: 'actor', label: 'Responsável' },
          { key: 'details', label: 'Detalhes' },
        ]}
        rows={entry.events.map((event) => ({
          id: event.id,
          time: dateTime(event.createdAt),
          event: eventLabel(event.eventType),
          actor: event.actorUserId,
          details: JSON.stringify(event.payload),
        }))}
        totalRows={entry.events.length}
        emptyTitle="Sem eventos"
        emptyDescription="O histórico aparecerá após importação e processamento."
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

function dateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
}

function statusLabel(value: EntryDetail['status']): string {
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

function targetLabel(value: Candidate['targetType']): string {
  return value === 'customer_receivable' ? 'Conta a receber' : 'Obrigação do transportador';
}

function eventLabel(value: string): string {
  return (
    {
      entry_imported: 'Linha importada',
      matching_attempted: 'Matching executado',
      entry_ignored: 'Movimento ignorado',
      reconciled: 'Conciliado',
      reconciliation_reversed: 'Conciliação revertida',
    }[value] ?? value
  );
}
