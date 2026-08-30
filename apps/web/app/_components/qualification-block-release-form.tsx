'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import {
  releaseQualificationBlock,
  type QualificationSaveState,
} from '../_actions/qualification-actions';
import type { QualificationConfig } from '../_lib/qualification-config';

const initialState: QualificationSaveState = { status: 'idle' };

export function QualificationBlockReleaseForm({
  config,
  subjectId,
  blockId,
}: Readonly<{
  config: QualificationConfig;
  subjectId: string;
  blockId: string;
}>) {
  const [state, formAction, pending] = useActionState(releaseQualificationBlock, initialState);
  const returnHref = `${config.returnPath}?${config.scope === 'driver' ? 'driverId' : 'assetId'}=${encodeURIComponent(subjectId)}`;

  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">Capacity • Wave 0017</span>
          <h1>Liberar bloqueio</h1>
          <p>
            A liberação é explícita, exige motivo e preserva o histórico do bloqueio para auditoria.
          </p>
        </div>
        <Link href={returnHref} className="button button-secondary">
          Voltar
        </Link>
      </section>

      <form className="entity-form" action={formAction}>
        <input type="hidden" name="resource" value={config.resource} />
        <input type="hidden" name="subjectId" value={subjectId} />
        <input type="hidden" name="blockId" value={blockId} />

        <div className="form-main">
          <section className="form-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Ação auditável</span>
                <h2>Motivo da liberação</h2>
                <p>O registro original não é apagado nem reescrito fora dos campos de liberação.</p>
              </div>
            </div>
            <div className="field-grid">
              <label className="form-field field-wide">
                <span>Motivo *</span>
                <input
                  name="releaseReason"
                  required
                  placeholder="Descreva por que o bloqueio pode ser liberado"
                />
              </label>
            </div>
          </section>
          {state.status === 'error' ? (
            <section className="form-summary-card" aria-live="polite">
              <span className="eyebrow">Não foi possível liberar</span>
              <h2>Revise a ação</h2>
              <p>{state.message}</p>
            </section>
          ) : null}
        </div>

        <aside className="form-aside">
          <section className="form-summary-card">
            <span className="eyebrow">Governança</span>
            <h2>Liberação controlada</h2>
            <ul className="check-list">
              <li>Motivo obrigatório</li>
              <li>Ator resolvido no backend</li>
              <li>Timestamp persistido pela API</li>
              <li>TenantContext + RLS</li>
              <li>Histórico preservado</li>
            </ul>
          </section>
          <div className="sticky-actions">
            <Link href={returnHref} className="button button-secondary">
              Cancelar
            </Link>
            <button type="submit" className="button button-primary" disabled={pending}>
              {pending ? 'Liberando…' : 'Confirmar liberação'}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
