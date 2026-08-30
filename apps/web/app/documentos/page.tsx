import { ModulePage } from '../_components/module-page';

export default function DocumentosPage() {
  return (
    <ModulePage
      eyebrow="Módulo 06"
      title="Documentos"
      description="Gestão documental transversal para arquivos, versões, validações, vencimentos e vínculos tipados com pessoas, ativos, cargas e viagens."
      status="Planejado"
      highlights={[
        { title: 'Core documental', description: 'Metadados, tipos, armazenamento, versões e integridade dos arquivos.' },
        { title: 'Validação', description: 'Status, vencimentos, análise, aprovação, rejeição e bloqueios relacionados.' },
        { title: 'Vínculos', description: 'Associação controlada com motoristas, veículos, clientes, cargas e viagens.' },
      ]}
    />
  );
}
