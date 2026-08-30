import { QualificationResourcePage, type QualificationSearchParams } from '../../../_components/qualification-resource-page';
import { qualificationConfigs } from '../../../_lib/qualification-config';
export const metadata = { title: 'Qualificações de motoristas' };
export default function Page({ searchParams }: Readonly<{ searchParams: QualificationSearchParams }>) {
  return <QualificationResourcePage config={qualificationConfigs['driver-qualification']} searchParams={searchParams} />;
}
