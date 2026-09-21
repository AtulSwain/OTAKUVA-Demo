'use client';

import BadgeUnlockToast from '../../../components/badges/BadgeUnlockToast';

/** Client wrapper so the server-rendered lab page can show the toast without passing a function prop. */
export default function LabToast() {
  return <BadgeUnlockToast tier="meijin" title="New badge: Meijin" body="You are now a Meijin (Grand master)." onClose={() => {}} durationMs={3_600_000} />;
}
