import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';
import {
  documentBytes,
  documentDate,
  documentDateTime,
  documentStatusLabel,
  documentText,
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
  const view = ['versions', 'validations', 'links'].includes(values.view)
    ? values.view
    : 'versions';
  const document = await apiGet<DocumentRecord>(`/api/v1/documents/${documentId}`);
  if (document.kind !== 'ready') {
    return (
      <OperationalPage
        eyebrow="Documents • Wave 0018"
        title="Documento"
        description="Detalhe documental tenant-aware."
        status="Documento indisponível"
        filters={[]}
        columns={[{ key: 'status', label: 'Estado' }]}
        emptyTitle="Não foi possível carregar o documento"
        emptyDescription={document.message}
        actions={[{ href: '/documentos', label: 'Voltar', variant: 'secondary' }]}
      />
    );
  }

  const child = await apiGet<readonly DocumentRecord[]>(`/api/v1/documents/${documentId}/${view}`);
  const items = child.kind === 'ready' ? child.data : [];
  let columns: Array<{ key: string; label: string; hrefKey?: string }> = [];
  let rows: Array<Record<string, string>> = [];
  let emptyTitle = 'Nenhum registro encontrado';
  const emptyDescription =
    child.kind === 'ready' ? 'A API respondeu sem itens neste histórico.' : child.message;

  if (view === 'versions') {
    columns = [
      { key: 'version', label: 'Versão' },
      { key: 'file', label: 'Arquivo' },
      { key: 'type', label: 'MIME' },
      { key: 'size', label: 'Tamanho' },
      { key: 'source', label: 'Origem' },
      { key: 'created', label: 'Registrada em' },
    ];
    rows = items.map((item) => ({
      id: documentText(item.id),
      version: `v${documentText(item.version_number)}`,
      file: documentText(item.file_name),
      type: documentText(item.mime_type),
      size: documentBytes(item.size_bytes),
      source: documentText(item.source),
      created: documentDateTime(item.created_at),
    }));
    emptyTitle = 'Nenhuma versão registrada';
  } else if (view === 'validations') {
    columns = [
      { key: 'type', label: 'Validação' },
      { key: 'status', label: 'Resultado' },
      { key: 'provider', label: 'Provider / regra' },
      { key: 'version', label: 'Versão' },
      { key: 'validated', label: 'Concluída em' },
    ];
    rows = items.map((item) => ({
      id: documentText(item.id),
      type: documentText(item.validation_type),
      status: documentStatusLabel(item.status),
      provider: [item.provider, item.rule_code].filter(Boolean).map(String).join(' • ') || '—',
      version: documentText(item.version_id),
      validated: documentDateTime(item.validated_at),
    }));
    emptyTitle = 'Nenhuma validação registrada';
  } else {
    columns = [
      { key: 'kind', label: 'Entidade' },
      { key: 'target', label: 'Target' },
      { key: 'relation', label: 'Relação' },
      { key: 'created', label: 'Criado em' },
      { key: 'status', label: 'Estado', hrefKey: 'statusHref' },
    ];
    rows = items.map((item) => {
      const active = !item.unlinked_at;
      return {
        id: documentText(item.id),
        kind: documentText(item.target_kind),
        target: documentText(item.target_id),
        relation: documentText(item.relation_type),
        created: documentDateTime(item.created_at),
        status: active ? 'Desvincular' : `Desvinculado • ${documentDateTime(item.unlinked_at)}`,
        statusHref: active
          ? `/documentos/${documentId}/vinculos/${documentText(item.id)}/desvincular`
          : '',
      };
    });
    emptyTitle = 'Nenhum vínculo registrado';
  }

  const d = document.data;
  const saved = values.saved === '1';
  const childStatus = child.kind === 'ready' ? 'API conectada' : 'Falha no histórico';
  return (
    <OperationalPage
      eyebrow="Documents • Wave 0018"
      title={documentText(d.title, 'Documento')}
      description={[
        documentText(d.document_type_name, 'Tipo não informado'),
        d.document_number ? `Nº ${documentText(d.document_number)}` : null,
        d.issuer ? `Emissor ${documentText(d.issuer)}` : null,
      ]
        .filter(Boolean)
        .join(' • ')}
      status={saved ? 'Operação concluída' : childStatus}
      metrics={[
        {
          label: 'Status',
          value: documentStatusLabel(d.effective_status ?? d.status),
          helper: 'Lifecycle efetivo.',
        },
        {
          label: 'Validação',
          value: documentStatusLabel(d.validation_status),
          helper: 'Estado agregado de validação.',
        },
        {
          label: 'Versão atual',
          value: documentText(d.current_version_number),
          helper: 'Incrementada atomicamente.',
        },
        {
          label: 'Validade',
          value: documentDate(d.expires_on),
          helper: documentText(d.document_type_name),
        },
        {
          label: 'Vínculos ativos',
          value: documentText(d.active_link_count),
          helper: 'Associações tipadas ainda vigentes.',
        },
      ]}
      filters={[]}
      columns={columns}
      rows={rows}
      totalRows={items.length}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      tabs={[
        { href: `/documentos/${documentId}?view=versions`, label: 'Versões' },
        { href: `/documentos/${documentId}?view=validations`, label: 'Validações' },
        { href: `/documentos/${documentId}?view=links`, label: 'Vínculos' },
      ]}
      actions={[
        { href: `/documentos/${documentId}/versoes/nova`, label: 'Nova versão' },
        {
          href: `/documentos/${documentId}/validacoes/nova`,
          label: 'Validar',
          variant: 'secondary',
        },
        {
          href: `/documentos/${documentId}/vinculos/novo`,
          label: 'Vincular',
          variant: 'secondary',
        },
        { href: '/documentos', label: 'Voltar', variant: 'secondary' },
      ]}
      integrationNotes={[
        'Versões e validações são históricos append-only no runtime.',
        'Vínculos apontam para FKs reais do mesmo tenant e são encerrados sem DELETE.',
        'O storage é referenciado por provider/key/hash; credenciais não são exibidas.',
      ]}
    />
  );
}
