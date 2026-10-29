import AnimeFormPage from '@control/ui/pages/AnimeFormPage';

export default function EditAnimePage({ params }: { params: { id: string } }) {
  return <AnimeFormPage id={params.id} />;
}
