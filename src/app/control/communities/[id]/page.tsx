import { CommunityDetailPage } from '@control/ui/pages/CommunityDetailPages';
export const dynamic = 'force-dynamic';
export default function Page({ params }: { params: { id: string } }) { return <CommunityDetailPage id={params.id} />; }
