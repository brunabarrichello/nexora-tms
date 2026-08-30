import Link from 'next/link';

import { apiGet } from '../_lib/api-client';
import { getRecordConfig, type RecordMode } from '../_lib/record-config';
import { RecordForm } from './record-form';

export async function RecordEditorPage({
  resource,
  mode,
  id,
  subjectId,
}: Readonly<{
  resource: string;
  mode: RecordMode;
  id?: string;
  subjectId?: string;
}>) {
  const config = getRecordConfig(resource);
  if (!config) return <EditorState title="Recurso inválido" message="O cadastro solicitado não está disponível." />;
  if (mode === 'edit' && !config.supportsEdit) {
    return <EditorState title="Edição indisponível" message="O contrato atual deste recurso oferece apenas criação e consulta." backHref={config.returnPath} />;
  }
  if (mode === 'create') return <RecordForm config={config} mode="create" subjectId={subjectId} />;
  if (!id) return <EditorState title="Registro inválido" message="O identificador do registro é obrigatório." backHref={config.returnPath} />;

  const result = await apiGet<Record<string, unknown>>(`${config.endpoint}/${id}`);
  if (result.kind !== 'ready') {
    return <EditorState title="Não foi possível carregar o cadastro" message={result.message} backHref={config.returnPath} />;
  }
  return (
    <RecordForm
      config={config}
      mode="edit"
      id={id}
      initialValues={initialValues(config.fields.map((field) => field.name), result.data)}
    />
  );
}

function initialValues(fields: readonly string[], item: Readonly<Record<string, unknown>>): Record<string, string | readonly string[]> {
  const values: Record<string, string | readonly string[]> = {};
  for (const field of fields) {
    const value = item[field];
    if (Array.isArray(value)) values[field] = value.filter((entry): entry is string => typeof entry === 'string');
    else if (value === undefined || value === null) values[field] = '';
    else if (typeof value === 'boolean') values[field] = value ? 'true' : 'false';
    else values[field] = String(value);
  }
  return values;
}

function EditorState({ title, message, backHref = '/cadastros' }: Readonly<{ title: string; message: string; backHref?: string }>) {
  return (
    <section className="system-state">
      <span className="eyebrow">Cadastros • API</span>
      <h1>{title}</h1>
      <p>{message}</p>
      <Link href={backHref} className="button button-secondary">Voltar</Link>
    </section>
  );
}
