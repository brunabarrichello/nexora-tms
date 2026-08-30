'use client';

export default function ErrorPage({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <section className="system-state">
      <span className="eyebrow">Erro de interface</span>
      <h1>Não foi possível carregar esta área</h1>
      <p>
        O estado de erro está tratado e poderá receber telemetria e correlação quando a
        observabilidade for integrada.
      </p>
      <button className="button button-primary" type="button" onClick={() => reset()}>
        Tentar novamente
      </button>
    </section>
  );
}
