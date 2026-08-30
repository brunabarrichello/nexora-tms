export default function Loading() {
  return (
    <div className="page-stack" aria-busy="true" aria-live="polite">
      <section className="skeleton skeleton-hero"><span>Carregando Nexora TMS…</span></section>
      <section className="metric-grid">
        {Array.from({ length: 4 }, (_, index) => <div className="skeleton skeleton-card" key={index} />)}
      </section>
      <section className="skeleton skeleton-table" />
    </div>
  );
}
