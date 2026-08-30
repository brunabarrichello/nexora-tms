import Link from 'next/link';

type Field = {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date';
  options?: string[];
  required?: boolean;
  wide?: boolean;
};

type Group = {
  title: string;
  description: string;
  fields: Field[];
};

type FormPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  backHref: string;
  groups: Group[];
  checklist?: string[];
};

export function FormPage({
  eyebrow,
  title,
  description,
  backHref,
  groups,
  checklist = [],
}: Readonly<FormPageProps>) {
  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <Link href={backHref} className="button button-secondary">
          Voltar para lista
        </Link>
      </section>

      <form className="entity-form">
        <div className="form-main">
          {groups.map((group) => (
            <section className="form-section" key={group.title}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Cadastro estruturado</span>
                  <h2>{group.title}</h2>
                  <p>{group.description}</p>
                </div>
              </div>
              <div className="field-grid">
                {group.fields.map((field) => (
                  <label
                    className={`form-field ${field.wide ? 'field-wide' : ''}`}
                    key={field.name}
                  >
                    <span>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                    {field.options ? (
                      <select name={field.name} defaultValue="" required={field.required}>
                        <option value="" disabled>
                          Selecione
                        </option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={field.name}
                        type={field.type ?? 'text'}
                        placeholder={field.placeholder}
                        required={field.required}
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="form-aside">
          <section className="form-summary-card">
            <span className="eyebrow">Validação</span>
            <h2>Pronto para persistência</h2>
            <p>
              O formulário já separa dados por domínio e está preparado para validação server-side,
              RBAC e auditoria.
            </p>
            <ul className="check-list">
              {(checklist.length > 0
                ? checklist
                : [
                    'Validação de campos e domínio',
                    'Escopo obrigatório de tenant',
                    'Controle de duplicidade',
                    'Auditoria de criação e alteração',
                    'Soft delete e lifecycle',
                  ]
              ).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <div className="sticky-actions">
            <button type="button" className="button button-secondary">
              Salvar rascunho
            </button>
            <button type="button" className="button button-primary">
              Salvar cadastro
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
