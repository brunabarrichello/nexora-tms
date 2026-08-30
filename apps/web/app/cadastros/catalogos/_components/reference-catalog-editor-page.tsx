import Link from 'next/link';

import { apiGet } from '../../../_lib/api-client';
import { ReferenceCatalogForm } from './reference-catalog-form';
import {
  getEditableReferenceCatalog,
  type ReferenceCatalogFormMode,
} from '../_lib/reference-catalog-config';

export async function ReferenceCatalogEditorPage({
  catalog,
  mode,
  id,
}: Readonly<{
  catalog: string;
  mode: ReferenceCatalogFormMode;
  id?: string;
}>) {
  const config = getEditableReferenceCatalog(catalog);
  if (!config) {
    return <EditorState title="Catálogo inválido" message="O catálogo solicitado não é editável." />;
  }

  if (mode === 'create') {
    return <ReferenceCatalogForm config={config} mode="create" />;
  }

  if (!id) {
    return <EditorState title="Registro inválido" message="O identificador do registro é obrigatório." />;
  }

  const result = await apiGet<Record<string, unknown>>(`/api/v1/reference-data/${catalog}/${id}`);
  if (result.kind !== 'ready') {
    return (
      <EditorState title="Não foi possível carregar o cadastro" message={result.message} backHref={config.basePath} />
    );
  }

  return (
    <ReferenceCatalogForm
      config={config}
      mode="edit"
      id={id}
      initialValues={initialValues(config.fields.map((field) => field.name), result.data)}
    />
  );
}

function initialValues(
  fields: readonly string[],
  item: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = item[field];
    if (value === undefined || value === null) values[field] = '';
    else if (typeof value === 'boolean') values[field] = value ? 'true' : 'false';
    else values[field] = String(value);
  }
  return values;
}

function EditorState({
  title,
  message,
  backHref = '/cadastros/catalogos',
}: Readonly<{ title: string; message: string; backHref?: string }>) {
  return (
    <section className="system-state">
      <span className="eyebrow">Catálogos • Wave 0015</span>
      <h1>{title}</h1>
      <p>{message}</p>
      <Link href={backHref} className="button button-secondary">
        Voltar
      </Link>
    </section>
  );
}
