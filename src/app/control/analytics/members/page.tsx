import { MemberAnalyticsPage, parseDays } from '@control/ui/pages/AnalyticsPages';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { days?: string } }) {
  return <MemberAnalyticsPage days={parseDays(searchParams.days)} />;
}
