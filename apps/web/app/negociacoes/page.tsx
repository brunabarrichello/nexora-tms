import { ModulePage } from '../_components/module-page';

export default function NegociacoesPage() {
  return (
    <ModulePage
      eyebrow="Módulo 04"
      title="Negociação"
      description="Fluxo comercial entre carga e transportador com ofertas, contrapropostas, validade, aceite e trilha completa de decisão."
      status="Planejado"
      highlights={[
        { title: 'Ofertas', description: 'Valor proposto, condições de pagamento, validade e observações comerciais.' },
        { title: 'Contrapropostas', description: 'Histórico estruturado de rodadas de negociação e responsáveis por cada ação.' },
        { title: 'Aceite', description: 'Consolidação das condições acordadas antes da criação e despacho da viagem.' },
      ]}
    />
  );
}
