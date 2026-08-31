import Link from 'next/link';

type LoginSearchParams = Promise<Readonly<Record<string, string | string[] | undefined>>>;

export default async function LoginPage({
  searchParams,
}: Readonly<{ searchParams: LoginSearchParams }>) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : undefined;
  const recovery = typeof params.recovery === 'string' ? params.recovery : undefined;
  const loggedOut = params.logged_out === '1';
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : '/';
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Identidade Nexora</span>
          <h1>Entrar no Nexora TMS</h1>
          <p>
            A autenticação é executada pelo Auth0 usando Authorization Code com PKCE. O Nexora Web
            mantém somente a sessão segura da aplicação; credenciais e recuperação permanecem no
            provedor de identidade.
          </p>
        </div>
        <Link className="button button-primary" href={loginHref}>
          Entrar com Auth0
        </Link>
      </section>

      {loggedOut ? (
        <section className="panel" role="status">
          <strong>Sessão encerrada.</strong>
          <p>O estado local foi removido e o logout do provedor foi solicitado.</p>
        </section>
      ) : null}

      {error ? (
        <section className="panel" role="alert">
          <strong>Não foi possível concluir a autenticação.</strong>
          <p>Inicie uma nova tentativa de login. Nenhuma credencial foi armazenada pelo Nexora.</p>
        </section>
      ) : null}

      {recovery === 'sent' ? (
        <section className="panel" role="status">
          <strong>Solicitação recebida.</strong>
          <p>
            Se a conta puder utilizar recuperação por senha, o Auth0 enviará as instruções pelos
            canais configurados no provedor.
          </p>
        </section>
      ) : null}

      {recovery === 'unavailable' ? (
        <section className="panel" role="alert">
          <strong>Recuperação temporariamente indisponível.</strong>
          <p>Tente novamente mais tarde ou utilize o fluxo de suporte configurado no Auth0.</p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Recuperação</span>
            <h2>Recuperar acesso</h2>
          </div>
        </div>
        <form action="/auth/recovery" method="post" className="page-stack">
          <label>
            <span>E-mail</span>
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <div>
            <button className="button" type="submit">
              Solicitar recuperação no Auth0
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
