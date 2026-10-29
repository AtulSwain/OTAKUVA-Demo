import ChartEditorPage from '@control/ui/pages/ChartEditorPage';

export default function Page({ params }: { params: { id: string } }) {
  return <ChartEditorPage id={params.id} />;
}
