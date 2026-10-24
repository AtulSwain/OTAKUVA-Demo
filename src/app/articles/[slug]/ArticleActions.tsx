'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import styles from '../articles.module.css';

/** Author: delete own article. Moderator: hide it. Both are soft and confirmed first. */
export function ArticleActions({ slug, isAuthor }: { slug: string; isAuthor: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    const question = isAuthor ? 'Delete this article? It will be removed for everyone.' : 'Hide this article from the site?';
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove the article.');
      showToast(isAuthor ? 'Article deleted' : 'Article hidden', 'success');
      router.push('/articles');
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, 'error');
      setBusy(false);
    }
  };

  return (
    <button type="button" className={styles.removeBtn} onClick={remove} disabled={busy}>
      <Trash2 size={14} aria-hidden="true" /> {isAuthor ? 'Delete' : 'Hide'}
    </button>
  );
}
