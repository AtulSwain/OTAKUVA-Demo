import { ArticleFormPage } from '@control/ui/pages/ArticlePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ArticleFormPage id={params.id} />;
}
