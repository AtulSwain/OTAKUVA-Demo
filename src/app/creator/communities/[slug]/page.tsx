'use client';

/**
 * /creator/communities/:slug — manage one community you own: who can join
 * (owner only; members-only needs creator mode), invitations for
 * members-only communities, and members (remove = explicit, separate from
 * revoking an invitation). Every action is checked again on the server.
 */
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, UserMinus, ExternalLink } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import { PageHead } from '../../../../components/ui/PageHead';
import { UserAvatar } from '../../../../components/ui/UserAvatar';
import { InvitePanel } from '../../../../components/creator/InvitePanel';
import styles from '../../creator.module.css';

interface CommunityInfo {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  ownerId: string;
  memberCount: number;
}
interface Member {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

const VISIBILITY = [
  { key: 'PUBLIC', title: 'Public', text: 'Anyone can find it and join.' },
  { key: 'REQUEST_TO_JOIN', title: 'Request to join', text: 'Anyone can find it; you approve each member.' },
  { key: 'PRIVATE', title: 'Members-only', text: 'Hidden. Joining needs your invitation link and key.' },
] as const;

export default function ManageCommunityPage({ params }: { params: { slug: string } }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [community, setCommunity] = useState<CommunityInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const slug = decodeURIComponent(params.slug);

  const load = useCallback(async () => {
    const r = await fetch(`/api/communities/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    const c = d.community ?? d;
    if (!r.ok || !c?.id) {
      setError(d.error || 'Community not found.');
      return;
    }
    setCommunity({ id: c.id, name: c.name, slug: c.slug, visibility: c.visibility, ownerId: c.ownerId ?? c.owner?.id, memberCount: c.memberCount });
  }, [slug]);

  const loadMembers = useCallback(
    async (p: number) => {
      const r = await fetch(`/api/communities/${encodeURIComponent(slug)}/members?page=${p}&limit=30`, { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setMembers((prev) => (p === 1 ? d.members : [...prev, ...d.members]));
      setPage(p);
      setPages(d.pagination?.totalPages ?? 1);
    },
    [slug]
  );

  useEffect(() => {
    load();
    loadMembers(1);
  }, [load, loadMembers]);

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
        <Link href="/creator" className={styles.btn} style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={15} aria-hidden="true" /> Dashboard
        </Link>
      </div>
    );
  }
  if (!community || !user) return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;
  if (community.ownerId !== user.id) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>Only the owner can manage this community.</p>
      </div>
    );
  }

  const setVisibility = async (next: string) => {
    if (next === community.visibility) return;
    const msg =
      next === 'PRIVATE'
        ? 'Make it members-only? It disappears from discovery and new people need an invitation link + key. Current members stay.'
        : 'Open this community up? Your invitations stop being needed to join.';
    if (!window.confirm(msg)) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/communities/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not change who can join.');
      showToast('Saved', 'success');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: Member) => {
    if (!window.confirm(`Remove @${m.username}? They lose access${community.visibility === 'PRIVATE' ? ' and would need a valid invitation to come back' : ''}.`)) return;
    const r = await fetch(`/api/communities/${encodeURIComponent(slug)}/members/${encodeURIComponent(m.userId)}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast(`Removed @${m.username}`, 'success');
      setMembers((prev) => prev.filter((x) => x.userId !== m.userId));
    } else showToast(d.error || 'Could not remove them.', 'error');
  };

  return (
    <div className={styles.page}>
      <PageHead
        kicker="Manage community"
        title={community.name}
        actions={
          <>
            <Link href="/creator" className={styles.btn}>
              <ArrowLeft size={15} aria-hidden="true" /> Dashboard
            </Link>
            <Link href={`/community/${community.slug}`} className={styles.btn}>
              <ExternalLink size={15} aria-hidden="true" /> Open
            </Link>
          </>
        }
      >
        Name, description, rules and channels are edited from the community&apos;s own settings.
      </PageHead>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Who can join</h2>
        <div className={styles.choiceGrid} role="radiogroup" aria-label="Who can join" style={{ marginTop: 12 }}>
          {VISIBILITY.map((v) => (
            <button
              key={v.key}
              type="button"
              role="radio"
              aria-checked={community.visibility === v.key}
              className={`${styles.choice} ${community.visibility === v.key ? styles.choiceOn : ''}`}
              onClick={() => setVisibility(v.key)}
              disabled={saving}
            >
              <strong>{v.title}</strong>
              <span>{v.text}</span>
            </button>
          ))}
        </div>
      </section>

      {community.visibility === 'PRIVATE' && <InvitePanel slug={community.slug} communityName={community.name} />}

      <section className={styles.card}>
        <div className={styles.sectionHead}>
          <h2 className={styles.cardTitle}>Members</h2>
          <span className={styles.small}>{community.memberCount.toLocaleString('en-US')} total</span>
        </div>
        <ul className={styles.list}>
          {members.map((m) => (
            <li key={m.userId} className={styles.row}>
              <UserAvatar username={m.username} avatarUrl={m.avatarUrl} size={36} />
              <div className={styles.rowMain}>
                <Link href={`/profile/${m.username}`} className={styles.rowTitle}>
                  @{m.username}
                </Link>
                <span className={styles.small}>
                  {m.role === 'OWNER' ? 'Owner' : m.role.charAt(0) + m.role.slice(1).toLowerCase()} · joined {new Date(m.joinedAt).toLocaleDateString()}
                </span>
              </div>
              {m.role !== 'OWNER' && m.userId !== user.id && (
                <div className={styles.rowActions}>
                  <button type="button" className={`${styles.btnDanger} ${styles.btnSm}`} onClick={() => remove(m)}>
                    <UserMinus size={14} aria-hidden="true" /> Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {page < pages && (
          <div className={styles.actionsRow} style={{ marginTop: 12 }}>
            <button type="button" className={styles.btn} onClick={() => loadMembers(page + 1)}>
              Load more
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
