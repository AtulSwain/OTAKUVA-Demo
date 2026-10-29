import { ActivityDeskPage } from '@control/ui/pages/PlatformPages';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { kind?: string } }) {
  return <ActivityDeskPage kind={searchParams.kind || ''} />;
}
