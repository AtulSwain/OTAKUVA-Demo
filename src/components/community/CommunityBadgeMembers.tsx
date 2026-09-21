'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import BadgeChip from '../badges/BadgeChip';
import SegmentedBadgeBar from '../badges/SegmentedBadgeBar';
import { UserAvatar } from '../ui/UserAvatar';
import { pluralize } from '../../lib/badges/format';
import type { TierKey } from '../../lib/badges/tiers';
import styles from './CommunityBadgeMembers.module.css';

interface Member {
  userId: string;
  username: string;
  avatarUrl: string | null;
  tier: TierKey;
  reviewCount: number;
  role: 'FOUNDER' | 'MODERATOR' | 'ADMIN' | 'MEMBER';
}

interface Payload {
  distribution: Record<string, number>;
  members: Member[];
  pagination: { page: number; totalPages: number; total: number };
}

const ROLE_LABEL: Record<string, string> = { FOUNDER: 'Founder', MODERATOR: 'Moderator', ADMIN: 'Admin' };

/**
 * Members by badge + the member list, highest badge first. Badges are
 * display only: they never grant extra authority in a community (role tags
 * come from CommunityMember.role alone).
 */
export function CommunityBadgeMembers({ slug }: { slug: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetch(`/api/communities/${encodeURIComponent(slug)}/badges?page=${page}&limit=20`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setState('ok');
        }
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, page]);

  if (state === 'error') return <p className={styles.empty}>Could not load members.</p>;
  if (!data) return <p className={styles.empty}>Loading members…</p>;

  return (
    <div className={styles.wrap}>
      <section className={styles.card} aria-label="Members by badge">
        <h3 className={styles.title}>Members by badge</h3>
        <SegmentedBadgeBar counts={data.distribution} />
      </section>

      <section className={styles.card} aria-label="Members">
        <h3 className={styles.title}>{pluralize(data.pagination.total, 'member')}</h3>
        <ul className={styles.list}>
          {data.members.map((m) => (
            <li key={m.userId} className={styles.row}>
              <UserAvatar username={m.username} avatarUrl={m.avatarUrl} size={36} />
              <Link href={`/profile/${m.username}`} className={styles.name}>
                {m.username}
              </Link>
              <BadgeChip tier={m.tier} count={m.reviewCount} />
              <span className={styles.count}>{pluralize(m.reviewCount, 'review')}</span>
              {ROLE_LABEL[m.role] && (
                <span className={`${styles.role} ${m.role === 'FOUNDER' ? styles.roleFilled : styles.roleOutlined}`}>
                  {ROLE_LABEL[m.role]}
                </span>
              )}
            </li>
          ))}
        </ul>
        {data.pagination.totalPages > 1 && (
          <div className={styles.pager}>
            <button type="button" disabled={page <= 1 || state === 'loading'} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>{`Page ${page} of ${data.pagination.totalPages}`}</span>
            <button type="button" disabled={page >= data.pagination.totalPages || state === 'loading'} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
