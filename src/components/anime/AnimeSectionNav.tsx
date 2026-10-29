'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './AnimeSectionNav.module.css';

export interface SectionLink {
  id: string;
  label: string;
}

/**
 * Sticky jump bar for the anime page (Overview · Episodes · Watch · …).
 * Only lists sections that are actually on the page; the chip for the
 * section you're reading is highlighted as you scroll.
 */
export function AnimeSectionNav({ sections }: { sections: SectionLink[] }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const barRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const ids = sections.map((s) => s.id).join('|');

  // Scroll-spy: the active section is the last one whose top has passed
  // just under the bar.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = (barRef.current?.getBoundingClientRect().bottom ?? 120) + 24;
      let current: string | null = sections[0]?.id ?? null;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      // At the very bottom, the last section wins even if it's short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections[sections.length - 1]?.id ?? current;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  // Keep the active chip visible inside the bar (scrolls the bar, never the page).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !active) return;
    const chip = rail.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!chip) return;
    const left = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [active]);

  if (sections.length < 2) return null;

  const go = (id: string) => (e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActive(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav ref={barRef} className={styles.bar} aria-label="On this page">
      <div ref={railRef} className={styles.rail}>
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            data-id={s.id}
            className={`${styles.chip} ${active === s.id ? styles.chipActive : ''}`}
            aria-current={active === s.id ? 'location' : undefined}
            onClick={go(s.id)}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
