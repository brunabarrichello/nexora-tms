import { FormPage } from '../../../_components/form-page';
export const metadata = { title: 'Novo veículo' };
export default function Page() {
  return (
    <FormPage
      eyebrow="Cadastros • Veículos"
      title="Novo veículo"
      description="Cadastro técnico e operacional preparado para matching, manutenção e viagens."
      backHref="/cadastros/veiculos"
      groups={[
        {
          title: 'Identificação',
          description: 'Identidade do ativo e propriedade.',
          fields: [
            { name: 'plate', label: 'Placa', required: true },
            { name: 'renavam', label: 'RENAVAM' },
            {
              name: 'ownerType',
              label: 'Vínculo',
              options: ['Próprio', 'Terceiro', 'Agregado'],
              required: true,
            },
            {
              name: 'status',
              label: 'Status',
              options: ['Disponível', 'Indisponível', 'Manutenção'],
              required: true,
            },
          ],
        },
        {
          title: 'Configuração',
          description: 'Dados usados para compatibilidade de cargas.',
          fields: [
            {
              name: 'vehicleType',
              label: 'Tipo de veículo',
              options: ['Utilitário', '3/4', 'Toco', 'Truck', 'Carreta', 'Bitrem'],
              required: true,
            },
            {
              name: 'bodyType',
              label: 'Carroceria',
              options: ['Baú', 'Sider', 'Grade baixa', 'Graneleiro', 'Prancha'],
              required: true,
            },
            { name: 'capacityKg', label: 'Capacidade (kg)', type: 'number' },
            { name: 'capacityM3', label: 'Cubagem (m³)', type: 'number' },
            { name: 'length', label: 'Comprimento útil (m)', type: 'number' },
          ],
        },
        {
          title: 'Características',
          description: 'Dados complementares de operação.',
          fields: [
            { name: 'brand', label: 'Marca' },
            { name: 'model', label: 'Modelo' },
            { name: 'year', label: 'Ano', type: 'number' },
            { name: 'tracking', label: 'Rastreamento', options: ['Sim', 'Não'] },
            { name: 'antt', label: 'RNTRC / ANTT' },
          ],
        },
      ]}
    />
  );
}
