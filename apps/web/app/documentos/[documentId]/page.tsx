import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';
import {
  documentBytes,
  documentDate,
  documentDateTime,
  documentStatusLabel,
  documentText,
  effectiveStatus,
  singleValues,
  type DocumentRecord,
  type DocumentSearchParams,
} from '../../_lib/document-ui';

export default async function Page({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ documentId: string }>;
  searchParams: DocumentSearchParams;
}>) {
  const { documentId } = await params;
  const values = singleValues(await searchParams);
  const view = values.view === 'validations' ? 'validations' : 'versions';
  const [document, versions, validations] = await Promise.all([
    apiGet<DocumentRecord>(`/api/v1/documents/${documentId}`),
    apiGet<readonly DocumentRecord[]>(`/api/v1/documents/${documentId}/versions`),
    apiGet<readonly DocumentRecord[]>(`/api/v1/documents/${documentId}/validations`),
  ]);

  if (document.kind !== 'ready') {
    return (
      <OperationalPage
        eyebrow="Documents • Wave 0018"
        title="Documento"
        description="Detalhe documental tenant-aware."
        status="Indisponível"
        filters={[]}
        columns={[{ key: 'status', label: 'Estado' }]}
        emptyTitle="Não foi possível carregar o documento"
        emptyDescription={document.message}
        actions={[{ href: '/documentos', label: 'Voltar', variant: 'secondary' }]}
      />
    );
  }

  const d = document.data;
  const versionItems = versions.kind === 'ready' ? versions.data : [];
  const validationItems = validations.kind === 'ready' ? validations.data : [];
  const rows =
    view === 'versions'
      ? versionItems.map((item) => ({
          id: documentText(item.id),
          version: `v${documentText(item.version_number)}`,
          file: documentText(item.original_file_name),
          mime: documentText(item.mime_type),
          size: documentBytes(item.byte_size),
          source: documentText(item.source),
          created: documentDateTime(item.created_at),
        }))
      : validationItems.map((item) => ({
          id: documentText(item.id),
          type: documentStatusLabel(item.validation_type),
          result: documentStatusLabel(item.result),
          version: documentText(item.document_version_id),
          provider: documentText(item.provider_reference),
          validated: documentDateTime(item.validated_at),
        }));

  return (
    <OperationalPage
      eyebrow="Documents • Wave 0018"
      title={documentText(d.title, 'Documento')}
      description={[
        documentText(d.document_type_name),
        d.external_reference ? `Ref. ${documentText(d.external_reference)}` : null,
        `Escopo ${documentText(d.subject_scope)}`,
      ]
        .filter(Boolean)
        .join(' • ')}
      status={values.saved === '1' ? 'Operação concluída' : 'API conectada'}
      metrics={[
        {
          label: 'Status',
          value: documentStatusLabel(effectiveStatus(d)),
          helper: 'Lifecycle efetivo.',
        },
        {
          label: 'Validade',
          value: documentDate(d.expires_on),
          helper:
            d.has_expiry === true ? 'Obrigatória para este tipo.' : 'Opcional para este tipo.',
        },
        { label: 'Versões', value: String(versionItems.length), helper: 'Arquivos confirmados.' },
        {
          label: 'Validações',
          value: String(validationItems.length),
          helper:
            d.requires_validation === true ? 'Tipo exige validação.' : 'Validação não obrigatória.',
        },
      ]}
      filters={[]}
      columns={
        view === 'versions'
          ? [
              { key: 'version', label: 'Versão' },
              { key: 'file', label: 'Arquivo' },
              { key: 'mime', label: 'MIME' },
              { key: 'size', label: 'Tamanho' },
              { key: 'source', label: 'Origem' },
              { key: 'created', label: 'Criada em' },
            ]
          : [
              { key: 'type', label: 'Tipo' },
              { key: 'result', label: 'Resultado' },
              { key: 'version', label: 'Versão' },
              { key: 'provider', label: 'Referência' },
              { key: 'validated', label: 'Validada em' },
            ]
      }
      rows={rows}
      totalRows={rows.length}
      tabs={[
        { href: `/documentos/${documentId}?view=versions`, label: 'Versões' },
        { href: `/documentos/${documentId}?view=validations`, label: 'Validações' },
      ]}
      actions={[
        { href: `/documentos/${documentId}/editar`, label: 'Editar', variant: 'secondary' },
        { href: `/documentos/${documentId}/validacoes/nova`, label: 'Validar' },
        {
          href: `/documentos/${documentId}/vinculos/novo`,
          label: 'Vincular',
          variant: 'secondary',
        },
        { href: `/documentos/${documentId}/upload`, label: 'Upload', variant: 'secondary' },
        { href: `/documentos/${documentId}/arquivar`, label: 'Arquivar', variant: 'secondary' },
      ]}
      emptyTitle={
        view === 'versions' ? 'Nenhuma versão registrada' : 'Nenhuma validação registrada'
      }
      emptyDescription={
        view === 'versions'
          ? 'Nenhum arquivo foi confirmado pelo storage.'
          : 'Nenhuma decisão foi adicionada ao histórico.'
      }
      integrationNotes={[
        'Versões só nascem após confirmação pelo storage.',
        'O object storage é desacoplado do domínio.',
        'Links são especializados por aggregate root.',
      ]}
    />
  );
}
