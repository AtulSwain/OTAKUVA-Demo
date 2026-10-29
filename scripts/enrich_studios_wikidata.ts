/**
 * OTAKUVA — STUDIO PROFILES + TIMELINE FROM WIKIDATA (2026-10-28)
 * Usage:
 *   npx tsx scripts/enrich_studios_wikidata.ts            # dry run: report only
 *   npx tsx scripts/enrich_studios_wikidata.ts --apply    # write
 *   options: --no-logos  --no-wikipedia
 *
 * Studios had almost no profile data: 2 of ~1,500 had a founded year, none a
 * description or logo. AniList has none of it and Jikan (MyAnimeList) is down.
 * Wikidata (CC0) has founding/closing dates, founders, HQ, official site,
 * logo, parent company and Wikipedia links for most notable studios.
 *
 * Matching — by id, never by name alone:
 *   1. Wikidata "MyAnimeList company ID" (P11490) = our studio's MAL id; or
 *   2. anime-anchored: a Wikidata anime item found by its AniList (P8729) or
 *      MAL (P4086) anime id lists the studio as production company (P272),
 *      AND that same anime is linked to one of our studios whose name (or
 *      native name / alias) matches the Wikidata item's label or alias.
 *   A Wikidata item that would match two of our studios (or a studio that
 *   would match two items) is skipped and listed in the log for review.
 *
 * Writes EMPTY fields only (an admin's or another source's value is never
 * replaced): foundedYear / foundedDate (date only when Wikidata has the day),
 * dissolvedDate, nativeName, aliases, website, wikipediaUrl, HQ city, logo
 * (downloaded into public/brand/studios/<Qid>.png — never hotlinked), short
 * description, Wikipedia intro as `about` (attributed on the page), MAL id.
 * country is never written (Wikidata had US/China for some Japanese studios):
 * Wikidata's value goes to metadataJson and disagreements are listed in the
 * log's review section. status → CLOSED only when Wikidata has a
 * dissolution date and the row still has the default ACTIVE.
 * Timeline: StudioHistoryEvent rows for founding / closing / joining a parent
 * company — dated events only, source Wikidata, UNVERIFIED (one per kind;
 * re-runs don't duplicate). Provenance: DataSourceRecord STUDIO/wikidata.
 * Log: scripts/import_logs/studios-wikidata-<time>.json (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';

const APPLY = process.argv.includes('--apply');
const LOGOS = !process.argv.includes('--no-logos');
const WIKIPEDIA = !process.argv.includes('--no-wikipedia');
const UA = 'OTAKUVA-catalog/1.0 (studio enrichment; dev.swainatul@gmail.com)';
const LOGO_DIR = path.join(process.cwd(), 'public', 'brand', 'studios');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, init: RequestInit = {}, tries = 4): Promise<any> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}

async function sparql(query: string): Promise<Record<string, string>[]> {
  const body = new URLSearchParams({ query });
  const data = await getJson('https://query.wikidata.org/sparql', {
    method: 'POST',
    body,
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return (data?.results?.bindings || []).map((b: any) => Object.fromEntries(Object.entries(b).map(([k, v]: any) => [k, v.value])));
}

const qid = (uri: string) => uri.replace(/^.*\//, '');

/** Loose company-name key: case, punctuation, legal suffixes and width ignored. */
function nameKey(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(co|ltd|inc|llc|corp|corporation|limited|company|kabushiki[ -]?gaisha|k\.?k)\b\.?/g, ' ')
    .replace(/株式会社|有限会社|合同会社/g, '')
    .replace(/[^a-z0-9぀-ヿ㐀-鿿]/g, '');
}

interface WdTime { year: number; date: Date | null }
function wdTime(claim: any): WdTime | null {
  const v = claim?.mainsnak?.datavalue?.value;
  if (!v?.time) return null;
  const m = /^([+-]\d+)-(\d\d)-(\d\d)/.exec(v.time);
  if (!m) return null;
  const year = Number(m[1]);
  if (!Number.isFinite(year) || year < 1800 || year > 2100) return null;
  // precision 11 = day. Anything coarser keeps only the year.
  const date = v.precision >= 11 ? new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]))) : null;
  return { year, date };
}

/** Claims of one property, preferred rank first, deprecated dropped. */
function claims(entity: any, prop: string): any[] {
  const list = (entity?.claims?.[prop] || []).filter((c: any) => c.rank !== 'deprecated');
  return list.sort((a: any, b: any) => (a.rank === 'preferred' ? -1 : 0) - (b.rank === 'preferred' ? -1 : 0));
}
const itemIds = (entity: any, prop: string) => claims(entity, prop).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean) as string[];
const strings = (entity: any, prop: string) => claims(entity, prop).map((c) => c.mainsnak?.datavalue?.value).filter((v) => typeof v === 'string') as string[];

async function getEntities(ids: string[], props: string): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=${props}&languages=en|ja&ids=${chunk.join('|')}`;
    const data = await getJson(url);
    Object.assign(out, data?.entities || {});
    await sleep(300);
  }
  return out;
}

async function downloadLogo(file: string, q: string): Promise<string | null> {
  const dest = path.join(LOGO_DIR, `${q}.png`);
  const publicPath = `/brand/studios/${q}.png`;
  if (fs.existsSync(dest)) return publicPath;
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=360`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !/^image\/(png|jpeg|gif|webp)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200 || buf.length > 2_000_000) return null;
    fs.mkdirSync(LOGO_DIR, { recursive: true });
    fs.writeFileSync(dest, buf);
    return publicPath;
  } catch {
    return null;
  }
}

async function wikipediaIntro(title: string): Promise<string | null> {
  const data = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`).catch(() => null);
  const text = typeof data?.extract === 'string' ? data.extract.trim() : '';
  if (data?.type === 'disambiguation' || text.length < 60) return null;
  return text;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'dry run'}`);

  // ── Our side ──────────────────────────────────────────────────────────
  const studios = await prisma.studio.findMany({
    where: { status: { not: 'MERGED' } },
    select: {
      id: true, name: true, slug: true, nativeName: true, alternativeNamesJson: true, externalId: true, externalSource: true,
      foundedYear: true, foundedDate: true, dissolvedDate: true, status: true, country: true, city: true, region: true,
      website: true, wikipediaUrl: true, imageUrl: true, about: true, shortDescription: true, externalLinksJson: true,
      metadataJson: true, hasAdminOverride: true,
    },
  });
  const studioById = new Map(studios.map((s) => [s.id, s]));
  const studioKeys = new Map<string, Set<string>>();
  for (const s of studios) {
    const keys = new Set([nameKey(s.name), nameKey(s.nativeName)]);
    try {
      for (const a of JSON.parse(s.alternativeNamesJson || '[]')) keys.add(nameKey(a));
    } catch {}
    keys.delete('');
    studioKeys.set(s.id, keys);
  }
  const byMalCompany = new Map(studios.filter((s) => s.externalSource === 'mal' && s.externalId).map((s) => [s.externalId!, s.id]));

  const anime = await prisma.anime.findMany({ where: { OR: [{ anilistId: { not: null } }, { malId: { not: null } }] }, select: { id: true, anilistId: true, malId: true } });
  const byAnilist = new Map(anime.filter((a) => a.anilistId).map((a) => [String(a.anilistId), a.id]));
  const byMal = new Map(anime.filter((a) => a.malId).map((a) => [String(a.malId), a.id]));
  const links = await prisma.animeStudio.findMany({ select: { animeId: true, studioId: true, anime: { select: { year: true, startYear: true } } } });
  const studiosOfAnime = new Map<string, string[]>();
  const latestWork = new Map<string, number>();
  for (const l of links) {
    studiosOfAnime.set(l.animeId, [...(studiosOfAnime.get(l.animeId) || []), l.studioId]);
    const y = l.anime.year ?? l.anime.startYear;
    if (y && y > (latestWork.get(l.studioId) ?? 0)) latestWork.set(l.studioId, y);
  }

  // ── Wikidata: anime → production company, and studios with a MAL id ────
  console.log('Querying Wikidata…');
  const pairs = await sparql(`SELECT ?al ?mal ?s WHERE { { ?a wdt:P8729 ?al } UNION { ?a wdt:P4086 ?mal } ?a wdt:P272 ?s . }`);
  const malCompanies = await sparql(`SELECT ?s ?malco WHERE { ?s wdt:P11490 ?malco . }`);
  console.log(`  ${pairs.length} anime→studio statements, ${malCompanies.length} studios with a MAL company id`);

  const candidateQs = new Set<string>([...pairs.map((p) => qid(p.s)), ...malCompanies.map((m) => qid(m.s))]);
  const labels = await getEntities([...candidateQs], 'labels|aliases');
  const qKeys = (q: string) => {
    const e = labels[q];
    const keys = new Set<string>();
    for (const l of Object.values<any>(e?.labels || {})) keys.add(nameKey(l.value));
    for (const list of Object.values<any>(e?.aliases || {})) for (const a of list) keys.add(nameKey(a.value));
    keys.delete('');
    return keys;
  };

  // votes[q][studioId] = evidence count
  const votes = new Map<string, Map<string, number>>();
  const vote = (q: string, sid: string, w: number) => {
    if (!votes.has(q)) votes.set(q, new Map());
    const m = votes.get(q)!;
    m.set(sid, (m.get(sid) || 0) + w);
  };
  for (const m of malCompanies) {
    const sid = byMalCompany.get(m.malco);
    if (sid) vote(qid(m.s), sid, 100);
  }
  for (const p of pairs) {
    const animeId = (p.al && byAnilist.get(p.al)) || (p.mal && byMal.get(p.mal));
    if (!animeId) continue;
    const q = qid(p.s);
    const keys = qKeys(q);
    for (const sid of studiosOfAnime.get(animeId) || []) {
      const ours = studioKeys.get(sid)!;
      if ([...ours].some((k) => keys.has(k))) vote(q, sid, 1);
    }
  }

  const review: any[] = [];
  const qToStudio = new Map<string, string>();
  for (const [q, m] of votes) {
    const ranked = [...m.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 1 && ranked[1][1] >= ranked[0][1]) {
      review.push({ reason: 'item matches several studios', q, studios: ranked.map(([sid, n]) => ({ name: studioById.get(sid)?.name, n })) });
      continue;
    }
    qToStudio.set(q, ranked[0][0]);
  }
  const studioToQ = new Map<string, string[]>();
  for (const [q, sid] of qToStudio) studioToQ.set(sid, [...(studioToQ.get(sid) || []), q]);
  for (const [sid, qs] of studioToQ) {
    if (qs.length > 1) {
      review.push({ reason: 'studio matches several items', studio: studioById.get(sid)?.name, items: qs });
      for (const q of qs) qToStudio.delete(q);
    }
  }
  console.log(`  matched ${qToStudio.size} studios (${review.length} ambiguous, left for review)`);

  // ── Full entities for the matches + labels of the items they point at ──
  const full = await getEntities([...qToStudio.keys()], 'labels|aliases|descriptions|claims|sitelinks');
  const refIds = new Set<string>();
  for (const e of Object.values<any>(full)) for (const p of ['P17', 'P159', 'P112', 'P749', 'P1365', 'P1366', 'P127']) for (const id of itemIds(e, p)) refIds.add(id);
  const refs = await getEntities([...refIds], 'labels');
  const label = (id: string) => refs[id]?.labels?.en?.value || full[id]?.labels?.en?.value || refs[id]?.labels?.ja?.value || null;

  const log: any = { mode: APPLY ? 'apply' : 'dry-run', at: new Date().toISOString(), matched: qToStudio.size, review, studios: [] };
  const totals: Record<string, number> = {};
  const bump = (k: string) => (totals[k] = (totals[k] || 0) + 1);

  for (const [q, sid] of qToStudio) {
    const e = full[q];
    const s = studioById.get(sid)!;
    if (!e) continue;
    const inception = wdTime(claims(e, 'P571')[0]);
    let dissolved = wdTime(claims(e, 'P576')[0]);
    // A "closed" studio with works after that year is probably a revived
    // company under the same name — don't mark it closed, list it instead.
    if (dissolved && (latestWork.get(sid) ?? 0) > dissolved.year + 1) {
      review.push({ reason: 'dissolved but has later works', studio: s.name, dissolved: dissolved.year, latestWork: latestWork.get(sid), q });
      dissolved = null;
    }
    const site = strings(e, 'P856').find((u) => /^https?:\/\//.test(u)) || null;
    const logoFile = strings(e, 'P154')[0] || null;
    const hq = itemIds(e, 'P159').map(label).find(Boolean) || null;
    const country = itemIds(e, 'P17').map(label).find(Boolean) || null;
    const founders = itemIds(e, 'P112').map(label).filter(Boolean) as string[];
    const parents = claims(e, 'P749').map((c) => ({ id: c.mainsnak?.datavalue?.value?.id as string, start: wdTime({ mainsnak: { datavalue: { value: c.qualifiers?.P580?.[0]?.datavalue?.value } } }) })).filter((p) => p.id);
    const predecessors = itemIds(e, 'P1365').map(label).filter(Boolean) as string[];
    const successors = itemIds(e, 'P1366').map(label).filter(Boolean) as string[];
    const ja = e.labels?.ja?.value || null;
    const aliases = [...new Set<string>((e.aliases?.en || []).map((a: any) => a.value as string))].filter((a: string) => nameKey(a) !== nameKey(s.name)).slice(0, 6);
    const enwiki = e.sitelinks?.enwiki?.title || null;
    const malco = strings(e, 'P11490')[0] || null;
    const desc = e.descriptions?.en?.value || null;

    const data: Record<string, any> = {};
    if (inception && s.foundedYear == null) (data.foundedYear = inception.year), bump('foundedYear');
    if (inception?.date && !s.foundedDate) (data.foundedDate = inception.date), bump('foundedDate');
    if (dissolved?.date && !s.dissolvedDate) (data.dissolvedDate = dissolved.date), bump('dissolvedDate');
    if (dissolved && s.status === 'ACTIVE') (data.status = 'CLOSED'), bump('closed');
    if (ja && !s.nativeName && nameKey(ja) !== nameKey(s.name)) (data.nativeName = ja), bump('nativeName');
    if (aliases.length && !s.alternativeNamesJson) (data.alternativeNamesJson = JSON.stringify(aliases)), bump('aliases');
    if (site && !s.website) (data.website = site), bump('website');
    if (enwiki && !s.wikipediaUrl) (data.wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(enwiki.replace(/ /g, '_'))}`), bump('wikipedia');
    if (hq && !s.city && !s.region && hq !== country) (data.city = hq), bump('city');
    // Country is never written: Wikidata's value is kept in metadata and any
    // disagreement is listed for review (it was wrong for some Japanese studios).
    if (country && s.country && country !== s.country) {
      review.push({ reason: 'country differs', studio: s.name, ours: s.country, wikidata: country, q });
      bump('countryForReview');
    }
    if (desc && !s.shortDescription) (data.shortDescription = desc.charAt(0).toUpperCase() + desc.slice(1)), bump('shortDescription');
    if (malco && !s.externalId) Object.assign(data, { externalId: malco, externalSource: 'mal' }), bump('malId');

    let intro: string | null = null;
    if (WIKIPEDIA && enwiki && !s.about) {
      intro = await wikipediaIntro(enwiki);
      await sleep(150);
      if (intro) (data.about = intro), (data.descriptionSource = 'PROVIDER'), bump('about');
    }
    if (LOGOS && logoFile && !s.imageUrl && APPLY) {
      const logo = await downloadLogo(logoFile, q);
      await sleep(150);
      if (logo) (data.imageUrl = logo), bump('logo');
    } else if (LOGOS && logoFile && !s.imageUrl) bump('logo (would download)');

    // Links + metadata (merged, never replaced).
    let ext: any[] = [];
    try { ext = JSON.parse(s.externalLinksJson || '[]'); } catch {}
    if (!Array.isArray(ext)) ext = [];
    if (!ext.some((x) => x?.provider === 'wikidata')) {
      ext.push({ provider: 'wikidata', externalId: q, url: `https://www.wikidata.org/wiki/${q}`, lastVerifiedAt: new Date().toISOString() });
      if (malco && !ext.some((x) => x?.provider === 'mal')) ext.push({ provider: 'mal', externalId: malco, url: `https://myanimelist.net/anime/producer/${malco}`, lastVerifiedAt: new Date().toISOString() });
      data.externalLinksJson = JSON.stringify(ext);
    }
    let meta: any = {};
    try { meta = JSON.parse(s.metadataJson || '{}') || {}; } catch {}
    const wd = {
      wikidataId: q,
      country: country || undefined,
      founders: founders.length ? founders : undefined,
      parentCompany: parents.map((p) => label(p.id)).filter(Boolean)[0] || undefined,
      predecessors: predecessors.length ? predecessors : undefined,
      successors: successors.length ? successors : undefined,
      aboutSource: intro ? 'wikipedia' : meta.aboutSource,
    };
    const nextMeta = { ...meta, wikidata: { ...(meta.wikidata || {}), ...JSON.parse(JSON.stringify(wd)) } };
    if (JSON.stringify(nextMeta) !== JSON.stringify(meta)) data.metadataJson = JSON.stringify(nextMeta);

    // Timeline events (dated only).
    const events: any[] = [];
    if (inception) {
      const by = founders.length ? ` by ${founders.length > 1 ? `${founders.slice(0, -1).join(', ')} and ${founders.at(-1)}` : founders[0]}` : '';
      const from = predecessors.length ? ` Successor of ${predecessors.join(', ')}.` : '';
      events.push({ eventType: 'FOUNDING', title: `${s.name} is founded`, shortDescription: by || from ? `${by ? `Founded${by}.` : ""}${from}`.trim() : null, eventYear: inception.year, eventDate: inception.date, importance: 'MAJOR' });
    }
    for (const p of parents) {
      const name = label(p.id);
      if (p.start && name) {
        const related = [...qToStudio.entries()].find(([pq]) => pq === p.id)?.[1] || null;
        events.push({ eventType: 'COMPANY_CHANGE', title: `Becomes part of ${name}`, shortDescription: null, eventYear: p.start.year, eventDate: p.start.date, importance: 'IMPORTANT', relatedStudioId: related });
      }
    }
    if (dissolved) {
      const to = successors.length ? `Succeeded by ${successors.join(', ')}.` : null;
      events.push({ eventType: 'COMPANY_CHANGE', title: `${s.name} closes`, shortDescription: to, eventYear: dissolved.year, eventDate: dissolved.date, importance: 'MAJOR' });
    }

    const entry = { studio: s.name, slug: s.slug, wikidata: q, set: Object.keys(data), events: events.map((x) => `${x.eventYear} ${x.title}`) };
    log.studios.push(entry);

    if (APPLY) {
      if (Object.keys(data).length) await prisma.studio.update({ where: { id: sid }, data });
      for (const ev of events) {
        const exists = await prisma.studioHistoryEvent.findFirst({ where: { studioId: sid, source: 'Wikidata', title: ev.title }, select: { id: true } });
        if (exists) continue;
        await prisma.studioHistoryEvent.create({
          data: {
            studioId: sid,
            ...ev,
            source: 'Wikidata',
            sourceUrl: `https://www.wikidata.org/wiki/${q}`,
            sourceType: 'DATABASE',
            verificationStatus: 'UNVERIFIED',
            publicationState: 'PUBLISHED',
          },
        });
        bump('events');
      }
      await prisma.dataSourceRecord.upsert({
        where: { entityType_entityId_provider: { entityType: 'STUDIO', entityId: sid, provider: 'wikidata' } },
        create: { entityType: 'STUDIO', entityId: sid, provider: 'wikidata', externalId: q, payload: JSON.stringify({ inception, dissolved, site, logoFile, hq, country, founders, enwiki, malco }) },
        update: { externalId: q, lastVerifiedAt: new Date(), payload: JSON.stringify({ inception, dissolved, site, logoFile, hq, country, founders, enwiki, malco }) },
      });
    } else {
      for (const _ of events) bump('events (would add)');
    }
  }

  log.totals = totals;
  const dir = path.join(process.cwd(), 'scripts', 'import_logs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `studios-wikidata-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(log, null, 2));
  console.log('Totals:', totals);
  console.log(`Log: ${file}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
