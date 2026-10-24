'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import BadgeChip from '../badges/BadgeChip';
import { UserAvatar } from '../ui/UserAvatar';
import { pluralize } from '../../lib/badges/format';
import type { TierKey } from '../../lib/badges/tiers';
import styles from './CommunityMemberList.module.css';

interface Member {
  userId: string;
  username: string;
  avatarUrl: string | null;
  tier: TierKey;
  reviewCount: number;
  role: 'FOUNDER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
}

const GROUPS: { role: Member['role']; label: string }[] = [
  { role: 'FOUNDER', label: 'Founder' },
  { role: 'ADMIN', label: 'Admins' },
  { role: 'MODERATOR', label: 'Moderators' },
  { role: 'MEMBER', label: 'Members' },
];

const PAGE_SIZE = 50;

/**
 * Discord-style member sidebar: grouped by community role, each person with
 * their reviewer badge so readers know who they're talking to. Within a
 * group the API already orders highest badge first.
 */
export function CommunityMemberList({
  slug,
  refreshKey,
  onShowAll,
}: {
  slug: string;
  /** Change to force a refetch (e.g. after joining or leaving). */
  refreshKey?: unknown;
  onShowAll: () => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetch(`/api/communities/${encodeURIComponent(slug)}/badges?page=1&limit=${PAGE_SIZE}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        setMembers(d.members || []);
        setTotal(d.pagination?.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, refreshKey]);

  return (
    <aside className={styles.panel} aria-label="Members">
      {failed ? (
        <p className={styles.note}>Could not load members.</p>
      ) : !members ? (
        <p className={styles.note}>Loading members…</p>
      ) : (
        <>
          {GROUPS.map(({ role, label }) => {
            const group = members.filter((m) => m.role === role);
            if (group.length === 0) return null;
            return (
              <section key={role} className={styles.group}>
                <h3 className={styles.groupTitle}>
                  {label} — {group.length}
                </h3>
                <ul className={styles.list}>
                  {group.map((m) => (
                    <li key={m.userId}>
                      <Link href={`/profile/${encodeURIComponent(m.username)}`} className={styles.row}>
                        <UserAvatar username={m.username} avatarUrl={m.avatarUrl} size={34} />
                        <span className={styles.who}>
                          <span className={`${styles.name} ${styles[`name${role}`] || ''}`}>{m.username}</span>
                          <span className={styles.meta}>
                            <BadgeChip tier={m.tier} count={m.reviewCount} className={styles.chip} />
                            <span className={styles.count}>{pluralize(m.reviewCount, 'review')}</span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {total > members.length && (
            <button type="button" className={styles.more} onClick={onShowAll}>
              See all {total.toLocaleString()} members
            </button>
          )}
        </>
      )}
    </aside>
  );
}
