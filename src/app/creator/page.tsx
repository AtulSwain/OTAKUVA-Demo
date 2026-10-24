'use client';

/**
 * /creator — Creator Mode entry (2026-10-24). The dashboard itself lives in
 * the creator's own profile (tab "Creator dashboard"), so profile and
 * dashboard are one place (owner). Here:
 *   - a creator is sent straight to /profile/<them>?tab=dashboard
 *   - anyone else gets the explicit "turn on creator mode" step
 *     (POST /api/creator/upgrade), then lands on that same tab.
 */
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { PageHead } from '../../components/ui/PageHead';
import { CreatorOnboarding } from '../../components/creator/CreatorDashboard';
import { isCreator } from '../../lib/roles';
import styles from './creator.module.css';

const dashboardHref = (username: string) => `/profile/${encodeURIComponent(username)}?tab=dashboard`;

export default function CreatorPage() {
  const { user, isLoading, openAuthModal } = useAuth();
  const router = useRouter();
  const creator = Boolean(user && isCreator(user.role));

  useEffect(() => {
    if (user && creator) router.replace(dashboardHref(user.username));
  }, [user, creator, router]);

  if (isLoading || creator) return <div className={styles.page}><p className={styles.muted}>Opening your dashboard…</p></div>;
  if (!user) {
    return (
      <div className={`${styles.page} ${styles.narrow}`}>
        <PageHead kicker="Creator mode" title="Sign in to continue" />
        <button type="button" className={styles.btnPrimary} onClick={() => openAuthModal('login')} style={{ alignSelf: 'flex-start' }}>
          Sign in
        </button>
      </div>
    );
  }
  return <CreatorOnboarding onDone={() => router.replace(dashboardHref(user.username))} />;
}
