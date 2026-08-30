import { FormPage } from '../../../_components/form-page';
export const metadata = { title: 'Nova empresa' };
export default function Page() {
  return (
    <FormPage
      eyebrow="Cadastros • Empresas"
      title="Nova empresa"
      description="Cadastro estruturado para entidade jurídica e unidade operacional inicial."
      backHref="/cadastros/empresas"
      groups={[
        {
          title: 'Identificação',
          description: 'Dados jurídicos e identidade da empresa.',
          fields: [
            { name: 'legalName', label: 'Razão social', required: true, wide: true },
            { name: 'tradeName', label: 'Nome fantasia', required: true },
            { name: 'document', label: 'CNPJ', required: true },
            { name: 'stateRegistration', label: 'Inscrição estadual' },
            {
              name: 'status',
              label: 'Status',
              required: true,
              options: ['Ativa', 'Em implantação', 'Inativa'],
            },
          ],
        },
        {
          title: 'Contato e endereço',
          description: 'Canal institucional e sede principal.',
          fields: [
            { name: 'email', label: 'E-mail', type: 'email', required: true },
            { name: 'phone', label: 'Telefone', type: 'tel' },
            { name: 'zipCode', label: 'CEP' },
            { name: 'street', label: 'Logradouro', wide: true },
            { name: 'number', label: 'Número' },
            { name: 'city', label: 'Cidade', required: true },
            { name: 'state', label: 'UF', required: true },
          ],
        },
        {
          title: 'Governança',
          description: 'Configurações iniciais de operação.',
          fields: [
            {
              name: 'timezone',
              label: 'Fuso horário',
              options: ['America/Sao_Paulo', 'America/Manaus', 'America/Cuiaba'],
            },
            { name: 'currency', label: 'Moeda', options: ['BRL'] },
            { name: 'code', label: 'Código interno' },
          ],
        },
      ]}
    />
  );
}
