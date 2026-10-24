'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Briefcase } from 'lucide-react';
import { isProviderPlaceholderImage } from '../../lib/mediaResolver';
import styles from './StaffRail.module.css';

export interface StaffMember {
  id?: string;
  name?: string;
  role?: string;
  slug?: string;
  image?: string;
  imageUrl?: string;
  person?: {
    id?: string;
    name?: string;
    imageUrl?: string;
    slug?: string;
  };
}

interface StaffRailProps {
  staff?: StaffMember[];
  onViewAll?: () => void;
}

/** One person with every role they had on this anime. */
interface Credit {
  key: string;
  name: string;
  roles: string[];
  image: string | null;
  href: string | null;
  rank: number;
}

/** Lead creative roles, best first; these people get the big portrait cards. */
const KEY_ROLES: [RegExp, number][] = [
  [/^director$|^chief director|^series director/i, 0],
  [/original creator|original story|original work|^author$/i, 1],
  [/series composition/i, 2],
  [/character design/i, 3],
  [/^music|composer/i, 4],
  [/script|screenplay/i, 5],
  [/art director|animation director|chief animation/i, 6],
];
const roleRank = (role: string) => KEY_ROLES.find(([re]) => re.test(role.trim()))?.[1] ?? 99;
const MAX_KEY = 6;

function mergeCredits(staff: StaffMember[]): Credit[] {
  const byKey = new Map<string, Credit>();
  staff.forEach((p, idx) => {
    const name = String(p.name || p.person?.name || '').trim();
    if (!name) return;
    const role = (p.role || 'Staff').trim();
    // Never guess a slug from the display name — fall back to the raw id,
    // which /person/[slug] resolves as well as a slug.
    const slug = p.slug || p.person?.slug || p.id || p.person?.id || null;
    const key = slug || `name:${name.toLowerCase()}`;
    const raw = p.image || p.imageUrl || p.person?.imageUrl || null;
    const image = raw && !isProviderPlaceholderImage(raw) ? raw : null;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
      existing.rank = Math.min(existing.rank, roleRank(role));
      existing.image = existing.image || image;
    } else {
      byKey.set(key, { key: `${key}-${idx}`, name, roles: [role], image, href: slug ? `/person/${slug}` : null, rank: roleRank(role) });
    }
  });
  return Array.from(byKey.values()).map((c) => ({ ...c, roles: c.roles.sort((a, b) => roleRank(a) - roleRank(b)) }));
}

/** Photo, or the person's initials on a soft graphite tile — never a broken image. */
function Portrait({ name, image, sizes, className }: { name: string; image: string | null; sizes: string; className: string }) {
  const [failed, setFailed] = React.useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span className={className}>
      {image && !failed ? (
        <Image src={image} alt={name} fill sizes={sizes} className={styles.photo} unoptimized onError={() => setFailed(true)} />
      ) : (
        <span className={styles.initials} aria-hidden="true">
          {initials || '·'}
        </span>
      )}
    </span>
  );
}

function Wrap({ href, className, title, children }: { href: string | null; className: string; title: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  ) : (
    <span className={className} title={title}>
      {children}
    </span>
  );
}

/**
 * "Staff & Key Creators" (v2, 2026-10-22 — owner: "boxy; make the circle
 * better and modern"). People are merged (one card per person, all their
 * roles); the lead creatives (director, original creator, composition,
 * character design, music…) get tall portrait cards, everyone else a slim
 * row of rounded-square avatars. No boxes; provider "no photo" stand-ins
 * show initials instead.
 */
export const StaffRail: React.FC<StaffRailProps> = ({ staff = [], onViewAll }) => {
  const credits = React.useMemo(() => mergeCredits(Array.isArray(staff) ? staff : []), [staff]);
  const key = credits.filter((c) => c.rank < 99).sort((a, b) => a.rank - b.rank).slice(0, MAX_KEY);
  const keySet = new Set(key.map((k) => k.key));
  const rest = credits.filter((c) => !keySet.has(c.key));

  return (
    <div className={styles.section} aria-label="Staff &amp; Key Creators">
      <div className={styles.headerRow}>
        <div>
          <p className={styles.kicker}>The people behind it</p>
          <h3 className={styles.headerTitle}>Staff &amp; Key Creators</h3>
        </div>
        {onViewAll && credits.length > 0 && (
          <button type="button" className={styles.viewAllLink} onClick={onViewAll}>
            View all <ChevronRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {credits.length === 0 ? (
        <div className={styles.emptyContainer}>
          <Briefcase size={18} className={styles.emptyIcon} aria-hidden="true" />
          <span className={styles.emptyText}>Staff and production committee details are being indexed.</span>
        </div>
      ) : (
        <>
          {key.length > 0 && (
            <div className={styles.keyRail}>
              {key.map((c) => (
                <Wrap key={c.key} href={c.href} className={styles.keyCard} title={`${c.name} — ${c.roles.join(', ')}`}>
                  <Portrait name={c.name} image={c.image} sizes="160px" className={styles.keyPhoto} />
                  <span className={styles.keyShade} aria-hidden="true" />
                  <span className={styles.keyText}>
                    <span className={styles.keyRole}>{c.roles[0]}</span>
                    <strong className={styles.keyName}>{c.name}</strong>
                    {c.roles.length > 1 && <span className={styles.keyMore}>+{c.roles.length - 1} more role{c.roles.length > 2 ? 's' : ''}</span>}
                  </span>
                </Wrap>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className={styles.railScroll}>
              {rest.map((c) => (
                <Wrap key={c.key} href={c.href} className={styles.staffCard} title={`${c.name} — ${c.roles.join(', ')}`}>
                  <Portrait name={c.name} image={c.image} sizes="64px" className={styles.avatarWrapper} />
                  <span className={styles.staffName}>{c.name}</span>
                  <span className={styles.staffRole}>{c.roles.join(' · ')}</span>
                </Wrap>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
