import './helpers/cssStub';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TIERS } from '../src/lib/badges/tiers';
import { GLYPHS } from '../src/lib/badges/glyphPaths';
import Seal from '../src/components/badges/Seal';
import BadgeChip from '../src/components/badges/BadgeChip';
import TierProgress from '../src/components/badges/TierProgress';
import BadgeLadder from '../src/components/badges/BadgeLadder';
import BadgeDistribution from '../src/components/badges/BadgeDistribution';
import SegmentedBadgeBar from '../src/components/badges/SegmentedBadgeBar';

// Components rely on Next's automatic JSX runtime; tsx uses the classic one, so expose React.
(globalThis as any).React = React;
const h = React.createElement;

describe('badge components render for every tier and size', () => {
  for (const t of TIERS) {
    test(`${t.key}: seal (3 sizes) and chip carry an accessible label`, () => {
      for (const size of ['lg', 'md', 'sm'] as const) {
        const html = renderToStaticMarkup(h(Seal, { tier: t.key, size, count: t.min }));
        assert.match(html, /role="img"/);
        assert.match(html, new RegExp(`${t.name} reviewer`));
        assert.ok(html.includes('<path'), 'glyph outlines are inlined (no font dependency)');
      }
      const chip = renderToStaticMarkup(h(BadgeChip, { tier: t.key, count: t.min }));
      assert.match(chip, new RegExp(`${t.name} reviewer`));
      // Chips never render kanji.
      assert.ok(!/[\u3040-\u30ff\u4e00-\u9fff]/.test(chip));
    });
  }

  test('every seal character has outlined glyph data', () => {
    for (const t of TIERS) for (const ch of Array.from(t.kanji)) assert.ok(GLYPHS[ch], `missing glyph ${ch}`);
  });

  test('shoshinsha is the dashed empty state', () => {
    const html = renderToStaticMarkup(h(Seal, { tier: 'shoshinsha' }));
    assert.match(html, /not yet earned/);
  });

  test('progress: next tier text, and a graceful top tier', () => {
    const mid = renderToStaticMarkup(h(TierProgress, { count: 532 }));
    assert.match(mid, /Next: Tatsujin at 700 reviews/);
    assert.match(mid, /168 to go/);
    const top = renderToStaticMarkup(h(TierProgress, { count: 1500 }));
    assert.match(top, /Top tier reached/);
  });

  test('ladder shows eight chips, locked ones marked', () => {
    const html = renderToStaticMarkup(h(BadgeLadder, { current: 'sensei' }));
    assert.equal((html.match(/<li/g) ?? []).length, 8);
    assert.match(html, /Tatsujin reviewer, not yet earned/);
  });

  test('distribution keeps a minimum bar for tiny counts', () => {
    const html = renderToStaticMarkup(h(BadgeDistribution, { counts: { kohai: 5000, densetsu: 1 } }));
    assert.match(html, /Densetsu: 1 reviews/);
    const widths = [...html.matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]));
    assert.ok(widths.every((w) => w >= 2));
  });

  test('segmented bar renders a segment and legend entry per present tier', () => {
    const html = renderToStaticMarkup(h(SegmentedBadgeBar, { counts: { kohai: 10, senpai: 5 } }));
    assert.match(html, /Members by badge: Kōhai 10, Senpai 5/);
  });
});

describe('tier data lives only in the config', () => {
  test('no other source file hard-codes tier colours or seal kanji', () => {
    const root = path.join(__dirname, '..', 'src');
    const banned = TIERS.flatMap((t) => [t.fill, t.ink, t.stroke, t.dark?.fill, t.dark?.stroke].filter(Boolean) as string[]).map((c) => c.toLowerCase());
    const kanji = TIERS.flatMap((t) => Array.from(t.kanjiFull));
    const allowed = ['lib/badges/tiers.ts', 'lib/badges/glyphPaths.ts'];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(tsx?|css)$/.test(e.name)) {
          const rel = p.slice(root.length + 1).split(path.sep).join('/');
          if (allowed.includes(rel)) continue;
          const text = fs.readFileSync(p, 'utf8');
          const lower = text.toLowerCase();
          if (rel.startsWith('components/badges') || rel.startsWith('lib/badges') || rel.startsWith('app/badges')) {
            if (banned.some((c) => lower.includes(c))) offenders.push(`${rel} (colour)`);
            if (kanji.some((k) => text.includes(k))) offenders.push(`${rel} (kanji)`);
          }
        }
      }
    };
    walk(root);
    assert.deepEqual(offenders, []);
  });
});
