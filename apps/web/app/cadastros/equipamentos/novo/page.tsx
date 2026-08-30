import { RecordEditorPage } from '../../../_components/record-editor-page';

export const metadata = { title: 'Novo equipamento' };

export default function Page() {
  return <RecordEditorPage resource="implement" mode="create" />;
}
