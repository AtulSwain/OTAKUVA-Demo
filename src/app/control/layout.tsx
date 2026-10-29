import type { Metadata } from 'next';
import { getAuthUserFromCookies } from '@/lib/auth';
import { canUseControl } from '@control/lib/access';
import { ControlLogin } from '@control/ui/ControlLogin';
import { ControlShell } from '@control/ui/ControlShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Control center · OTAKUVA',
  robots: { index: false, follow: false },
};

/**
 * The owner's control center (2026-10-28). Only ADMIN / SUPER_ADMIN accounts
 * get past this gate; everyone else sees the control-center sign-in. Every
 * /api/control route checks the role again on the server.
 */
export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUserFromCookies();
  if (!user || !canUseControl(user.role)) return <ControlLogin signedInAs={user?.username ?? null} />;
  return (
    <ControlShell username={user.username} role={user.role}>
      {children}
    </ControlShell>
  );
}
