import Link from 'next/link';

import { markInAppNotificationRead } from '../_actions/in-app-notification-actions';
import { apiGet } from '../_lib/api-client';

interface NotificationItem {
  readonly id: string;
  readonly notificationEventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly module: 'freight' | 'negotiation' | 'trips' | 'documents';
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly title: string;
  readonly body: string;
  readonly contextUrl: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly deliveredAt: string;
  readonly readAt: string | null;
  readonly createdAt: string;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type NotificationState = 'all' | 'unread' | 'read';
type NotificationModule = '' | NotificationItem['module'];

export const metadata = { title: 'Notificações' };

export default async function Page({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const state = normalizeState(params.state);
  const module = normalizeModule(params.module);
  const [itemsResult, unreadResult] = await Promise.all([
    apiGet<readonly NotificationItem[]>('/api/v1/notifications', {
      state,
      module: module || undefined,
    }),
    apiGet<{ readonly count: number }>('/api/v1/notifications/unread-count'),
  ]);
  const items = itemsResult.kind === 'ready' ? itemsResult.data : [];
  const unread = unreadResult.kind === 'ready' ? unreadResult.data.count : 0;
  const error = typeof params.error === 'string' ? params.error : null;

  return (
    <div className="page-stack">
      <section className="operational-hero">
        <div>
          <span className="eyebrow">Integrações • NEX-54</span>
          <h1>Notificações</h1>
          <p>
            Caixa in-app pessoal para eventos operacionais relevantes de cargas, contratações,
            viagens e documentos. A entrega respeita tenant, membership e perfil.
          </p>
        </div>
      </section>

      <section className="metric-grid" aria-label="Resumo das notificações">
        <article className="metric-card">
          <span>Não lidas</span>
          <strong>{unread}</strong>
          <small>Somente da caixa do usuário atual</small>
        </article>
        <article className="metric-card">
          <span>Exibidas</span>
          <strong>{items.length}</strong>
          <small>Após os filtros atuais</small>
        </article>
        <article className="metric-card">
          <span>Críticas</span>
          <strong>{items.filter((item) => item.severity === 'critical').length}</strong>
          <small>Exigem atenção operacional</small>
        </article>
        <article className="metric-card">
          <span>Módulos ativos</span>
          <strong>{new Set(items.map((item) => item.module)).size}</strong>
          <small>Carga, contratação, viagem e documentos</small>
        </article>
      </section>

      <section className="data-panel">
        <div className="data-toolbar">
          <div>
            <span className="eyebrow">Caixa pessoal</span>
            <h2>Eventos entregues</h2>
          </div>
          <span className="result-count">{items.length} resultado(s)</span>
        </div>

        <form className="filter-grid" method="get">
          <label className="filter-field">
            <span>Estado</span>
            <select name="state" defaultValue={state}>
              <option value="all">Todas</option>
              <option value="unread">Não lidas</option>
              <option value="read">Lidas</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Módulo</span>
            <select name="module" defaultValue={module}>
              <option value="">Todos</option>
              <option value="freight">Cargas</option>
              <option value="negotiation">Contratação</option>
              <option value="trips">Viagens</option>
              <option value="documents">Documentos</option>
            </select>
          </label>
          <div className="filter-actions">
            <button className="button button-primary" type="submit">
              Filtrar
            </button>
            <Link className="button button-secondary" href="/notificacoes">
              Limpar
            </Link>
          </div>
        </form>

        {error ? <p className="form-error">{error}</p> : null}

        {items.length > 0 ? (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Assunto</th>
                  <th>Origem</th>
                  <th>Severidade</th>
                  <th>Estado</th>
                  <th>Contexto</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{dateTime(item.deliveredAt)}</td>
                    <td>
                      <strong>{item.title}</strong>
                      <br />
                      <span>{item.body}</span>
                    </td>
                    <td>{moduleLabel(item.module)}</td>
                    <td>
                      <span className="table-status">{severityLabel(item.severity)}</span>
                    </td>
                    <td>{item.readAt ? `Lida em ${dateTime(item.readAt)}` : 'Não lida'}</td>
                    <td>
                      <Link href={item.contextUrl}>Abrir contexto</Link>
                    </td>
                    <td>
                      {item.readAt ? (
                        <span>Concluído</span>
                      ) : (
                        <form action={markInAppNotificationRead}>
                          <input name="notificationId" type="hidden" value={item.id} />
                          <button className="button button-secondary" type="submit">
                            Marcar como lida
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-empty">
            <div className="empty-icon">IN</div>
            <div>
              <strong>
                {itemsResult.kind === 'ready'
                  ? 'Nenhuma notificação para os filtros atuais'
                  : 'Caixa de notificações indisponível'}
              </strong>
              <p>
                {itemsResult.kind === 'ready'
                  ? 'Novos eventos relevantes aparecerão aqui quando forem destinados ao seu perfil.'
                  : itemsResult.message}
              </p>
            </div>
          </div>
        )}

        <div className="table-footer">
          <span>
            A inbox não cria eventos manualmente: ela é uma projeção auditável dos eventos internos
            do Nexora.
          </span>
        </div>
      </section>
    </div>
  );
}

function normalizeState(value: string | string[] | undefined): NotificationState {
  return value === 'read' || value === 'unread' ? value : 'all';
}

function normalizeModule(value: string | string[] | undefined): NotificationModule {
  return value === 'freight' ||
    value === 'negotiation' ||
    value === 'trips' ||
    value === 'documents'
    ? value
    : '';
}

function moduleLabel(value: NotificationItem['module']): string {
  return (
    {
      freight: 'Cargas',
      negotiation: 'Contratação',
      trips: 'Viagens',
      documents: 'Documentos',
    }[value] ?? value
  );
}

function severityLabel(value: NotificationItem['severity']): string {
  return { info: 'Informativa', warning: 'Atenção', critical: 'Crítica' }[value] ?? value;
}

function dateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
}
