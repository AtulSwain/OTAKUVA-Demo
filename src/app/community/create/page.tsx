'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Plus, Shield, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { MediaPicker } from '../../../components/community/MediaPicker';
import { CommunityTopicPicker, type TopicAnime } from '../../../components/community/CommunityTopicPicker';
import { isCreator } from '../../../lib/roles';
import { InviteCredentials } from '../../../components/creator/InvitePanel';
import styles from './create.module.css';

export default function CreateCommunityPage() {
  const { user, openAuthModal } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('GENRE');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [topicAnime, setTopicAnime] = useState<TopicAnime | null>(null);
  const [genreIds, setGenreIds] = useState<string[]>([]);

  // "Create one" on an anime page links here with ?anime=<slug>: start from
  // that anime and its genres (all still editable before creating).
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('anime');
    if (!slug) return;
    Promise.all([
      fetch(`/api/anime/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/genres').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([animeData, genreData]) => {
        const a = animeData?.anime;
        if (!a?.id) return;
        setCategory('ANIME');
        setTopicAnime({ id: a.id, slug: a.slug, title: a.title || a.canonicalTitle, posterUrl: a.posterImage || a.posterUrl || null, year: a.year ?? null });
        const names: string[] = Array.isArray(a.genres) ? a.genres : [];
        const ids = (genreData?.genres || []).filter((g: { name: string }) => names.includes(g.name)).map((g: { id: string }) => g.id);
        setGenreIds(ids.slice(0, 5));
      })
      .catch(() => {});
  }, []);

  // Media state
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconSource, setIconSource] = useState<'UPLOAD' | 'URL'>('URL');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerSource, setBannerSource] = useState<'UPLOAD' | 'URL'>('URL');

  const [rules, setRules] = useState([
    { title: 'Be Respectful', content: 'No harassment, hate speech, or toxic arguments.' },
    { title: 'Spoiler Etiquette', content: 'Mark episode and manga spoilers clearly.' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Members-only communities come back with their first invitation (key shown once).
  const [created, setCreated] = useState<{ name: string; slug: string; invitation: { path: string; key: string } } | null>(null);
  const creator = isCreator(user?.role);
  const [error, setError] = useState<string | null>(null);

  const handleAddRule = () => {
    setRules([...rules, { title: '', content: '' }]);
  };

  const handleUpdateRule = (index: number, field: 'title' | 'content', value: string) => {
    const updated = [...rules];
    updated[index][field] = value;
    setRules(updated);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }

    if (name.trim().length < 3) {
      setError('Community name must be at least 3 characters');
      return;
    }

    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          visibility,
          animeId: topicAnime?.id,
          genreIds,
          iconUrl: iconUrl || undefined,
          iconSource,
          bannerUrl: bannerUrl || undefined,
          bannerSource,
          rules: rules.filter((r) => r.title.trim() && r.content.trim()),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create community');
      }

      if (data.invitation?.key) {
        setCreated({ name: data.community.name, slug: data.community.slug, invitation: data.invitation });
        window.scrollTo({ top: 0 });
        return;
      }
      router.push(`/community/${data.community.slug}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (created) {
    return (
      <div className={styles.createPage}>
        <div className={styles.formCard} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Your members-only community is ready</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.55 }}>
            Share the link and the key together with your channel members (for example in a members-only post). Anyone
            with both can join; nobody can join with just the link.
          </p>
          <InviteCredentials path={created.invitation.path} accessKey={created.invitation.key} communityName={created.name} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/community/${created.slug}`} className={styles.submitBtn} style={{ textDecoration: 'none' }}>
              Open the community
            </Link>
            <Link href={`/creator/communities/${created.slug}`} className={styles.backLink}>
              Manage invitations &amp; members
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.createPage}>
      <Link href="/community" className={styles.backLink}>
        <ArrowLeft size={16} />
        <span>Back to Communities</span>
      </Link>

      <div className={styles.formCard}>
        <div className={styles.header}>
          <Users size={28} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Create a Community</h1>
            <p className={styles.subtitle}>
              Build a dedicated home for your favorite anime, genre, manga, or discussion topic.
            </p>
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Community Name */}
          <div className={styles.field}>
            <label className={styles.label}>Community Name *</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Vinland Saga Society, Psychological Anime Club"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label className={styles.label}>Description *</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="What is this community about? Describe the discussions and atmosphere."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Category & Visibility */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <select
                className={styles.select}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="ANIME">Specific Anime</option>
                <option value="GENRE">Genre / Theme</option>
                <option value="MANGA">Manga &amp; Light Novels</option>
                <option value="REGIONAL">Regional &amp; Language</option>
                <option value="INTEREST">General Interest / Sakuga</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Visibility</label>
              <select
                className={styles.select}
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="PUBLIC">Public (Anyone can join)</option>
                <option value="REQUEST_TO_JOIN">Request to Join (Moderator approval)</option>
                {creator && <option value="PRIVATE">Members-only (invite link + key)</option>}
              </select>
              {visibility === 'PRIVATE' ? (
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Hidden from discovery. You get an invitation link and an access key to share with your channel
                  members — people need both to join. There&apos;s no public Join button.
                </p>
              ) : !creator ? (
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Members-only communities (invite link + key) are for <Link href="/creator">creator accounts</Link>.
                </p>
              ) : null}
            </div>
          </div>

          {/* What it's about: puts the community on matching anime pages */}
          <div className={styles.field}>
            <CommunityTopicPicker
              anime={topicAnime}
              onAnimeChange={setTopicAnime}
              genreIds={genreIds}
              onGenresChange={setGenreIds}
            />
          </div>

          {/* Dual-Mode Media Pickers for Icon and Banner */}
          <div className={styles.mediaSection}>
            <MediaPicker
              label="Community Icon"
              type="icon"
              currentUrl={iconUrl}
              currentSource={iconSource}
              onImageChange={(url, source) => {
                setIconUrl(url);
                setIconSource(source);
              }}
            />

            <MediaPicker
              label="Community Banner"
              type="banner"
              currentUrl={bannerUrl}
              currentSource={bannerSource}
              onImageChange={(url, source) => {
                setBannerUrl(url);
                setBannerSource(source);
              }}
            />
          </div>

          {/* Rules */}
          <div className={styles.rulesSection}>
            <div className={styles.rulesHeader}>
              <label className={styles.label} style={{ marginBottom: 0 }}>Community Guidelines &amp; Rules</label>
              <button
                type="button"
                className={styles.addRuleBtn}
                onClick={handleAddRule}
              >
                <Plus size={13} />
                <span>Add Rule</span>
              </button>
            </div>

            {rules.map((rule, idx) => (
              <div key={idx} className={styles.ruleItem}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder={`Rule ${idx + 1} Title`}
                    value={rule.title}
                    onChange={(e) => handleUpdateRule(idx, 'title', e.target.value)}
                  />
                  {rules.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeRuleBtn}
                      onClick={() => handleRemoveRule(idx)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Short explanation..."
                  value={rule.content}
                  onChange={(e) => handleUpdateRule(idx, 'content', e.target.value)}
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className={styles.spin} />
                <span>Creating Community...</span>
              </>
            ) : (
              <span>Create Community</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
