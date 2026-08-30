import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="system-state">
      <span className="eyebrow">404</span>
      <h1>Página não encontrada</h1>
      <p>A rota informada não faz parte do catálogo atual do Nexora TMS.</p>
      <Link href="/" className="button button-primary">
        Voltar ao dashboard
      </Link>
    </section>
  );
}
