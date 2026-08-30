import { RecordEditorPage } from '../../../_components/record-editor-page';

export const metadata = { title: 'Novo veículo' };

export default function Page() {
  return <RecordEditorPage resource="vehicle" mode="create" />;
}
