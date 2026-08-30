import { OperationalPage } from '../../../_components/operational-page';

export default async function Page({ params }: Readonly<{ params: Promise<{ documentId: string }> }>) {
  const { documentId } = await params;
  return (
    <OperationalPage
      eyebrow="Documents • Storage boundary"
      title="Upload de nova versão"
      description="O domínio já implementa prepareUpload, commitUpload e download assinado, mas o adapter de object storage deste ambiente ainda é explicitamente Unconfigured."
      status="Infraestrutura pendente"
      filters={[]}
      columns={[{ key: 'capability', label: 'Capability' }, { key: 'status', label: 'Status' }]}
      rows={[
        { id: 'prepare', capability: 'Preparar upload', status: 'Contrato API pronto' },
        { id: 'verify', capability: 'Verificar objeto e commitar versão', status: 'Contrato API pronto' },
        { id: 'download', capability: 'Gerar download temporário', status: 'Contrato API pronto' },
        { id: 'adapter', capability: 'Object storage provider', status: 'Não configurado' },
      ]}
      actions={[{ href: `/documentos/${documentId}`, label: 'Voltar ao documento', variant: 'secondary' }]}
      integrationNotes={[
        'Nenhuma credencial ou storageKey é solicitada manualmente pela Web.',
        'Quando o adapter real for configurado, esta página deve consumir o fluxo prepare → upload direto → commit.',
        'A versão documental só pode ser persistida depois que o adapter verificar o objeto enviado.',
      ]}
    />
  );
}
