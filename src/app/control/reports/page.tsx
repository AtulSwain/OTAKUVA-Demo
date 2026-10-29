import { ReportsPage } from '@control/ui/pages/ReportsPage';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { type?: string } }) {
  return <ReportsPage type={searchParams.type || 'overview'} />;
}
