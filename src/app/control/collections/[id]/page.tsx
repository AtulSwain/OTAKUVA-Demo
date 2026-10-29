import { CollectionFormPage } from '@control/ui/pages/CollectionPages';

export default function Page({ params }: { params: { id: string } }) {
  return <CollectionFormPage id={params.id} />;
}
