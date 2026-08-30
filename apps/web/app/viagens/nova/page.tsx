import { FormPage } from '../../_components/form-page';
export const metadata = { title: 'Nova viagem' };
export default function Page() {
  return (
    <FormPage
      eyebrow="Execução • Viagens"
      title="Nova viagem"
      description="Programação de execução preparada para receber carga negociada e recursos disponíveis."
      backHref="/viagens"
      groups={[
        {
          title: 'Vínculo operacional',
          description: 'Carga e negociação que originam a viagem.',
          fields: [
            { name: 'load', label: 'Carga', required: true },
            { name: 'negotiation', label: 'Negociação aprovada' },
            { name: 'scheduledDate', label: 'Data programada', type: 'date', required: true },
          ],
        },
        {
          title: 'Recursos',
          description: 'Motorista, veículo e transportadora responsáveis.',
          fields: [
            { name: 'driver', label: 'Motorista', required: true },
            { name: 'vehicle', label: 'Veículo', required: true },
            { name: 'carrier', label: 'Transportadora / parceiro' },
          ],
        },
        {
          title: 'Execução',
          description: 'Parâmetros iniciais da viagem.',
          fields: [
            {
              name: 'tracking',
              label: 'Tracking',
              options: ['Obrigatório', 'Opcional', 'Não aplicável'],
            },
            { name: 'tollPlan', label: 'Plano de pedágio' },
            { name: 'fuelPlan', label: 'Plano de combustível' },
            { name: 'notes', label: 'Instruções operacionais', wide: true },
          ],
        },
      ]}
      checklist={[
        'Carga apta para programação',
        'Negociação aprovada',
        'Motorista disponível',
        'Veículo disponível',
        'Documentos sem bloqueio',
      ]}
    />
  );
}
