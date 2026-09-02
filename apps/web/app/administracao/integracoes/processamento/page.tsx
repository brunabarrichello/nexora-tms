import Link from 'next/link';

import { reprocessDurableJob, reprocessOutboxEvent } from '../../../_actions/async-admin-actions';
import { apiGet } from '../../../_lib/api-client';

interface OutboxItem {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly idempotencyKey: string;
  readonly correlationId: string | null;
  readonly requestId: string | null;
  readonly state: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: string;
  readonly occurredAt: string;
  readonly processedAt: string | null;
  readonly leaseOwner: string | null;
  readonly leaseExpiresAt: string | null;
  readonly lastError: string | null;
  readonly deadLetteredAt: string | null;
  readonly deadLetterReason: string | null;
}

interface JobItem {
  readonly id: string;
  readonly sourceOutboxEventId: string | null;
  readonly jobType: string;
  readonly idempotencyKey: string;
  readonly correlationId: string | null;
  readonly requestId: string | null;
  readonly state: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly runAt: string;
  readonly lockedAt: string | null;
  readonly lockedBy: string | null;
  readonly leaseExpiresAt: string | null;
  readonly lastError: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: 'Processamento assíncrono' };

export default async function Page({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const outboxState = normalizeOutboxState(params.outboxState);
  const jobState = normalizeJobState(params.jobState);
  const [outboxResult, jobsResult] = await Promise.all([
    apiGet<readonly OutboxItem[]>('/api/v1/admin/async/outbox', { state: outboxState }),
    apiGet<readonly JobItem[]>('/api/v1/admin/async/jobs', { state: jobState }),
  ]);
  const outbox = outboxResult.kind === 'ready' ? outboxResult.data : [];
  const jobs = jobsResult.kind === 'ready' ? jobsResult.data : [];
  const error = typeof params.error === 'string' ? params.error : null;
  const reprocessed = typeof params.reprocessed === 'string' ? params.reprocessed : null;

  return (
    <div className="page-stack">
      <section className="operational-hero">
        <div>
          <span className="eyebrow">Administração • Integrações • NEX-55</span>
          <h1>Processamento assíncrono</h1>
          <p>
            Visão tenant-scoped do Transactional Outbox e Durable Jobs, com tentativas, correlação,
            falhas e reprocessamento controlado de dead letters.
          </p>
        </div>
      </section>

      <nav className="subnav" aria-label="Integrações">
        <Link href="/administracao/integracoes">Adapters</Link>
        <Link href="/administracao/integracoes/webhooks">Webhooks</Link>
        <Link href="/administracao/integracoes/entregas">Entregas</Link>
        <Link href="/administracao/integracoes/processamento">Processamento</Link>
      </nav>

      <section className="metric-grid" aria-label="Resumo assíncrono">
        <article className="metric-card">
          <span>Outbox exibido</span>
          <strong>{outbox.length}</strong>
          <small>Eventos do tenant atual</small>
        </article>
        <article className="metric-card">
          <span>Outbox dead-letter</span>
          <strong>{outbox.filter((item) => item.state === 'dead_lettered').length}</strong>
          <small>Elegíveis a reprocessamento</small>
        </article>
        <article className="metric-card">
          <span>Jobs exibidos</span>
          <strong>{jobs.length}</strong>
          <small>Tarefas duráveis do tenant</small>
        </article>
        <article className="metric-card">
          <span>Jobs dead-letter</span>
          <strong>{jobs.filter((item) => item.state === 'dead_lettered').length}</strong>
          <small>Exigem decisão administrativa</small>
        </article>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {reprocessed ? (
        <p className="form-success">
          Reprocessamento solicitado. O item retornou à fila preservando identidade e auditoria.
        </p>
      ) : null}

      <section className="data-panel">
        <div className="data-toolbar">
          <div>
            <span className="eyebrow">Transactional Outbox</span>
            <h2>Eventos assíncronos</h2>
          </div>
          <span className="result-count">{outbox.length} resultado(s)</span>
        </div>

        <form className="filter-grid" method="get">
          <label className="filter-field">
            <span>Estado do Outbox</span>
            <select name="outboxState" defaultValue={outboxState}>
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="retry_wait">Aguardando retry</option>
              <option value="leased">Em processamento</option>
              <option value="processed">Processado</option>
              <option value="dead_lettered">Dead letter</option>
            </select>
          </label>
          <input name="jobState" type="hidden" value={jobState} />
          <div className="filter-actions">
            <button className="button button-primary" type="submit">
              Filtrar
            </button>
            <Link
              className="button button-secondary"
              href="/administracao/integracoes/processamento"
            >
              Limpar
            </Link>
          </div>
        </form>

        {outbox.length > 0 ? (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Evento / entidade</th>
                  <th>Estado</th>
                  <th>Tentativas</th>
                  <th>Correlação</th>
                  <th>Idempotência</th>
                  <th>Falha</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {outbox.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.eventType}</strong>
                      <br />
                      <span>
                        {item.aggregateType} · {item.aggregateId}
                      </span>
                    </td>
                    <td>
                      <span className="table-status">{stateLabel(item.state)}</span>
                      <br />
                      <small>{dateTime(item.occurredAt)}</small>
                    </td>
                    <td>
                      {item.attempts}/{item.maxAttempts}
                    </td>
                    <td>{item.correlationId ?? item.requestId ?? '—'}</td>
                    <td>
                      <code>{item.idempotencyKey}</code>
                    </td>
                    <td>{item.deadLetterReason ?? item.lastError ?? '—'}</td>
                    <td>
                      {item.state === 'dead_lettered' ? (
                        <form action={reprocessOutboxEvent} className="inline-form">
                          <input name="eventId" type="hidden" value={item.id} />
                          <input
                            aria-label="Motivo do reprocessamento"
                            name="reason"
                            placeholder="Motivo obrigatório"
                            required
                            minLength={3}
                            maxLength={500}
                          />
                          <button className="button button-secondary" type="submit">
                            Reprocessar
                          </button>
                        </form>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-empty">
            <div className="empty-icon">AQ</div>
            <div>
              <strong>
                {outboxResult.kind === 'ready' ? 'Nenhum evento encontrado' : 'Outbox indisponível'}
              </strong>
              <p>
                {outboxResult.kind === 'ready'
                  ? 'Ajuste o filtro para consultar outros estados.'
                  : outboxResult.message}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="data-toolbar">
          <div>
            <span className="eyebrow">Durable Jobs</span>
            <h2>Tarefas duráveis</h2>
          </div>
          <span className="result-count">{jobs.length} resultado(s)</span>
        </div>

        <form className="filter-grid" method="get">
          <input name="outboxState" type="hidden" value={outboxState} />
          <label className="filter-field">
            <span>Estado do job</span>
            <select name="jobState" defaultValue={jobState}>
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="running">Executando</option>
              <option value="retry_wait">Aguardando retry</option>
              <option value="succeeded">Concluído</option>
              <option value="dead_lettered">Dead letter</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
          <div className="filter-actions">
            <button className="button button-primary" type="submit">
              Filtrar
            </button>
          </div>
        </form>

        {jobs.length > 0 ? (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Estado</th>
                  <th>Tentativas</th>
                  <th>Correlação</th>
                  <th>Idempotência</th>
                  <th>Falha</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.jobType}</strong>
                      <br />
                      <small>{item.sourceOutboxEventId ?? 'Sem evento de origem'}</small>
                    </td>
                    <td>
                      <span className="table-status">{stateLabel(item.state)}</span>
                      <br />
                      <small>{dateTime(item.updatedAt)}</small>
                    </td>
                    <td>
                      {item.attempt}/{item.maxAttempts}
                    </td>
                    <td>{item.correlationId ?? item.requestId ?? '—'}</td>
                    <td>
                      <code>{item.idempotencyKey}</code>
                    </td>
                    <td>{item.lastError ?? '—'}</td>
                    <td>
                      {item.state === 'dead_lettered' ? (
                        <form action={reprocessDurableJob} className="inline-form">
                          <input name="jobId" type="hidden" value={item.id} />
                          <input
                            aria-label="Motivo do reprocessamento"
                            name="reason"
                            placeholder="Motivo obrigatório"
                            required
                            minLength={3}
                            maxLength={500}
                          />
                          <button className="button button-secondary" type="submit">
                            Reprocessar
                          </button>
                        </form>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-empty">
            <div className="empty-icon">DJ</div>
            <div>
              <strong>
                {jobsResult.kind === 'ready'
                  ? 'Nenhum job encontrado'
                  : 'Durable Jobs indisponível'}
              </strong>
              <p>
                {jobsResult.kind === 'ready'
                  ? 'Ajuste o filtro para consultar outros estados.'
                  : jobsResult.message}
              </p>
            </div>
          </div>
        )}

        <div className="table-footer">
          <span>
            Consulta exige audit.read. Reprocessamento exige tenant.manage e é revalidado no
            PostgreSQL para membership ativa de Tenant Admin.
          </span>
        </div>
      </section>
    </div>
  );
}

function normalizeOutboxState(value: string | string[] | undefined): string {
  return ['pending', 'retry_wait', 'leased', 'processed', 'dead_lettered'].includes(String(value))
    ? String(value)
    : 'dead_lettered';
}

function normalizeJobState(value: string | string[] | undefined): string {
  return ['pending', 'running', 'retry_wait', 'succeeded', 'dead_lettered', 'cancelled'].includes(
    String(value),
  )
    ? String(value)
    : 'dead_lettered';
}

function stateLabel(value: string): string {
  return (
    {
      pending: 'Pendente',
      retry_wait: 'Aguardando retry',
      leased: 'Em processamento',
      processed: 'Processado',
      running: 'Executando',
      succeeded: 'Concluído',
      dead_lettered: 'Dead letter',
      cancelled: 'Cancelado',
    }[value] ?? value
  );
}

function dateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
}
