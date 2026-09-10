'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Users, MessageSquare, ArrowLeft, Plus, Check, Heart } from 'lucide-react';
import { sanitizePublicEntityName } from '../../../lib/normalizers';
import { useAuth } from '../../../context/AuthContext';
import styles from '../spaces.module.css';

export default function SpaceDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user, openAuthModal } = useAuth();

  const [space, setSpace] = useState<any>(null);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSpaceData() {
      setLoading(true);
      try {
        const [spaceRes, discRes] = await Promise.all([
          fetch(`/api/communities/${slug}`),
          fetch(`/api/discussions?communitySlug=${slug}`),
        ]);

        if (spaceRes.ok) {
          const spaceData = await spaceRes.json();
          setSpace(spaceData.community);
          setIsJoined(Boolean(spaceData.community?.membershipStatus));
        }

        if (discRes.ok) {
          const discData = await discRes.json();
          setDiscussions(discData.discussions || []);
        }
      } catch (e) {
        console.error('Failed to load space detail:', e);
      } finally {
        setLoading(false);
      }
    }

    loadSpaceData();
  }, [slug]);

  const handleToggleJoin = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    setIsJoined((p) => !p);
  };

  const cleanName = space ? sanitizePublicEntityName(space.name) : 'Space';

  return (
    <div className={styles.container}>
      <Link href="/spaces" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
        <ArrowLeft size={14} />
        <span>Back to All Spaces</span>
      </Link>

      {/* Space Hero Card */}
      <div style={{ padding: '28px', backgroundColor: 'var(--surface-base)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className={styles.categoryTag}>{space?.category || 'Community Hub'}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{space?.memberCount || 1} Members</span>
            </div>
            <h1 className={styles.title}>{cleanName}</h1>
          </div>

          <button
            type="button"
            onClick={handleToggleJoin}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isJoined ? 'var(--surface-elevated)' : 'var(--text-primary)',
              color: isJoined ? 'var(--accent-primary-hover)' : 'var(--text-inverse)',
              border: isJoined ? '1px solid var(--border-default)' : 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {isJoined ? <Check size={14} /> : <Plus size={14} />}
            <span>{isJoined ? 'Joined Space' : 'Join Space'}</span>
          </button>
        </div>

        {space?.description && (
          <p className={styles.subtitle}>{space.description}</p>
        )}
      </div>

      {/* Discussion Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Discussions & Reviews
        </h2>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>Loading feed...</div>
        ) : discussions.length === 0 ? (
          <div style={{ padding: '32px', backgroundColor: 'var(--surface-base)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)' }}>
            No discussions in this space yet. Be the first to start a conversation!
          </div>
        ) : (
          discussions.map((d) => (
            <div
              key={d.id}
              style={{
                padding: '16px 20px',
                backgroundColor: 'var(--surface-base)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {sanitizePublicEntityName(d.title || 'Discussion')}
              </span>
              {d.content && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {d.content}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '6px' }}>
                <span>{d.user?.username || 'Community Member'}</span>
                <span>·</span>
                <span>{new Date(d.createdAt || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
