import { ModulePage } from '../../_components/module-page';

export default function LocaisPage() {
  return (
    <ModulePage
      eyebrow="Cadastros · Rede logística"
      title="Locais e pontos operacionais"
      description="Cadastro geográfico para origens, destinos, armazéns, unidades, pontos de coleta e entrega usados em toda a operação."
      status="Em construção"
      highlights={[
        { title: 'Endereçamento', description: 'Endereço estruturado, município, UF, coordenadas e referências de acesso.' },
        { title: 'Operação', description: 'Janelas, restrições, contatos, instruções e características de carga e descarga.' },
        { title: 'Relacionamentos', description: 'Vínculos com clientes, unidades, freight lanes e pontos recorrentes de operação.' },
      ]}
    />
  );
}
