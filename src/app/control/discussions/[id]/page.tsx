import { DiscussionDetailPage } from '@control/ui/pages/CommunityDetailPages';
export const dynamic = 'force-dynamic';
export default function Page({ params }: { params: { id: string } }) { return <DiscussionDetailPage id={params.id} />; }
