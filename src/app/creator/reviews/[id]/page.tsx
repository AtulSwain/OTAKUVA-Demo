'use client';

import { CreatorReviewEditor } from '../../../../components/creator/CreatorReviewEditor';

/** /creator/reviews/:id — edit your own draft or published Creator Review. */
export default function EditCreatorReviewPage({ params }: { params: { id: string } }) {
  return <CreatorReviewEditor reviewId={params.id} />;
}
