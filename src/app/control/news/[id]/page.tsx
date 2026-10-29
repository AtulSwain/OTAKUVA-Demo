import { NewsFormPage } from '@control/ui/pages/NewsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <NewsFormPage id={params.id} />;
}
