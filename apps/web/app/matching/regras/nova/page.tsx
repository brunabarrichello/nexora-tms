import { FormPage } from '../../../_components/form-page';

export const metadata = { title: 'Nova Regra de Matching' };

export default function Page() {
  return (
    <FormPage
      eyebrow="Motor de decisão"
      title="Nova regra de Matching"
      description="Defina uma regra tenant-scoped com código estável, categoria, comportamento bloqueador e peso de pontuação."
      backHref="/matching/regras"
      groups={[
        {
          title: 'Identificação',
          description: 'Código e descrição funcional usados no histórico de explicabilidade.',
          fields: [
            {
              name: 'code',
              label: 'Código',
              placeholder: 'ex.: tracking_unavailable',
              required: true,
            },
            {
              name: 'name',
              label: 'Nome',
              placeholder: 'Disponibilidade de rastreamento',
              required: true,
            },
            {
              name: 'category',
              label: 'Categoria',
              required: true,
              options: [
                'eligibility',
                'capacity',
                'equipment',
                'compliance',
                'availability',
                'commercial',
                'preference',
              ],
            },
            {
              name: 'description',
              label: 'Descrição',
              placeholder: 'Explique quando e por que a regra é aplicada.',
              wide: true,
            },
          ],
        },
        {
          title: 'Decisão e pontuação',
          description: 'Configure o efeito da regra sem permitir expressões livres de política.',
          fields: [
            { name: 'version', label: 'Versão', type: 'number', required: true },
            { name: 'weight', label: 'Peso', type: 'number', required: true },
            { name: 'blocking', label: 'Bloqueadora', options: ['false', 'true'], required: true },
            { name: 'active', label: 'Ativa', options: ['true', 'false'], required: true },
          ],
        },
      ]}
      checklist={[
        'Código único por tenant',
        'Versão maior que zero',
        'Peso não negativo',
        'Configuração validada pelo backend',
        'Mudanças futuras não alteram execuções históricas',
      ]}
    />
  );
}
