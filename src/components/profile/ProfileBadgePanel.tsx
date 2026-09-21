'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Seal, BadgeTooltip } from '../badges';
import TierProgress from '../badges/TierProgress';
import BadgeLadder from '../badges/BadgeLadder';
import { getTier, isTierKey, progressToNext, type TierKey } from '../../lib/badges/tiers';
import { BADGE_STRINGS, glossFor } from '../../lib/badges/strings';
import { formatCompact, pluralize } from '../../lib/badges/format';
import styles from './ProfileBadgePanel.module.css';

interface CommunityRow {
  slug: string;
  name: string;
  memberCount: number;
  role: 'FOUNDER' | 'MEMBER' | 'MODERATOR';
}

interface BadgeData {
  username: string;
  tier: TierKey;
  countedReviewCount: number;
  helpfulVotes: number;
  isCritic: boolean;
  communities: CommunityRow[];
  foundedCount: number;
}

/** A stable, muted colour per community name for its initial tile. */
function tileColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 38% 38%)`;
}

export function ProfileBadgePanel({ username }: { username: string }) {
  const [data, setData] = useState<BadgeData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${encodeURIComponent(username)}/badges`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && isTierKey(d.tier)) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (!data) return null;
  const tier = getTier(data.tier);
  const progress = progressToNext(data.countedReviewCount);
  const communityHeader = `${pluralize(data.communities.length, 'community', 'communities')}${
    data.foundedCount ? ` · ${data.foundedCount} founded` : ''
  }`;

  return (
    <section className={styles.panel} aria-label="Reviewer badge">
      <div className={styles.head}>
        <BadgeTooltip tier={tier}>
          <Seal tier={tier} size="lg" count={data.countedReviewCount} />
        </BadgeTooltip>
        <div className={styles.headText}>
          <h2 className={styles.username}>{data.username}</h2>
          <p className={styles.title}>{BADGE_STRINGS.titleWithMeaning(tier.name, glossFor(tier.glossKey))}</p>
          <p className={styles.meta}>
            <span>{pluralize(data.countedReviewCount, 'review')}</span>
            <span aria-hidden="true">·</span>
            <span>{formatCompact(data.helpfulVotes)} helpful votes</span>
            <span aria-hidden="true">·</span>
            <span>{pluralize(data.communities.length, 'community', 'communities')}</span>
          </p>
        </div>
      </div>

      <TierProgress progress={{ ...progress, current: tier }} />

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>{BADGE_STRINGS.ladderTitle}</h3>
        <BadgeLadder current={tier} />
      </div>

      {data.communities.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Communities</h3>
          <p className={styles.blockSub}>{communityHeader}</p>
          <ul className={styles.communities}>
            {data.communities.map((c) => (
              <li key={c.slug} className={styles.community}>
                <span className={styles.tile} style={{ background: tileColor(c.name) }} aria-hidden="true">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span className={styles.communityText}>
                  <Link href={`/community/${c.slug}`} className={styles.communityName}>
                    {c.name}
                  </Link>
                  <span className={styles.communityMeta}>{`${formatCompact(c.memberCount, 10000)} ${c.memberCount === 1 ? 'member' : 'members'}`}</span>
                </span>
                <span className={`${styles.role} ${c.role === 'FOUNDER' ? styles.roleFilled : styles.roleOutlined}`}>
                  {c.role === 'FOUNDER' ? 'Founder' : c.role === 'MODERATOR' ? 'Moderator' : 'Member'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
