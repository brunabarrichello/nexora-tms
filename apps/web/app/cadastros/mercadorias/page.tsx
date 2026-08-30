import {
  ApiCollectionPage,
  collectionBoolean,
  collectionText,
  type CollectionSearchParams,
} from '../../_components/api-collection-page';

export const metadata = { title: 'Mercadorias' };

export default function Page({ searchParams }: Readonly<{ searchParams: CollectionSearchParams }>) {
  return (
    <ApiCollectionPage
      searchParams={searchParams}
      endpoint="/api/v1/master-data/commodities"
      basePath="/cadastros/mercadorias"
      eyebrow="Wave 0016 • Commodities"
      title="Mercadorias"
      description="Catálogo reutilizável de mercadorias com classificação de risco e controle de temperatura."
      filters={[
        {
          label: 'Perigosa',
          name: 'hazardous',
          options: [
            { label: 'Sim', value: 'true' },
            { label: 'Não', value: 'false' },
          ],
        },
        {
          label: 'Temperatura',
          name: 'temperature',
          options: [
            { label: 'Controlada', value: 'true' },
            { label: 'Livre', value: 'false' },
          ],
        },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Mercadoria' },
        { key: 'cargoType', label: 'Tipo de carga padrão' },
        { key: 'hazardous', label: 'Perigosa' },
        { key: 'temperature', label: 'Temperatura' },
        { key: 'status', label: 'Status' },
      ]}
      filterItem={(item, values) => {
        if (values.hazardous && String(item.isHazardous) !== values.hazardous) return false;
        if (values.temperature && String(item.requiresTemperatureControl) !== values.temperature) return false;
        return true;
      }}
      mapRow={(item) => ({
        id: item.id,
        code: collectionText(item.code),
        name: collectionText(item.name),
        cargoType: collectionText(item.defaultCargoTypeId),
        hazardous: collectionBoolean(item.isHazardous),
        temperature: collectionBoolean(item.requiresTemperatureControl, 'Controlada', 'Livre'),
        status: item.isActive === true ? 'Ativo' : 'Inativo',
      })}
    />
  );
}
