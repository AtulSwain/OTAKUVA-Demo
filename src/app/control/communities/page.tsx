import { CommunitiesDeskPage } from '@control/ui/pages/PlatformPages';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { q?: string } }) {
  return <CommunitiesDeskPage q={searchParams.q || ''} />;
}
