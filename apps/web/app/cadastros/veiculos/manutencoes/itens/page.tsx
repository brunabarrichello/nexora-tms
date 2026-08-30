import { QualificationResourcePage, type QualificationSearchParams } from '../../../../_components/qualification-resource-page';
import { qualificationConfigs } from '../../../../_lib/qualification-config';
export const metadata = { title: 'Itens de manutenção' };
export default function Page({ searchParams }: Readonly<{ searchParams: QualificationSearchParams }>) {
  return <QualificationResourcePage config={qualificationConfigs['asset-maintenance-item']} searchParams={searchParams} />;
}
