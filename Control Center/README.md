# OTAKUVA Control Center

The owner's admin panel. Open **`/control`** on the site and sign in with the
control-center account (ADMIN or SUPER_ADMIN only; everyone else is refused,
on the page and on every API route).

All of its code lives in this folder. The site only mounts it: the files under
`src/app/control/**` and `src/app/api/control/**` are one-line pointers to the
code here (imported as `@control/...`).

```
Control Center/
  lib/     server logic (database reads/writes, validation)
    access.ts       who may use it; image / trailer link checks
    overview.ts     counts for the dashboard
    dashboard.ts    active vs not-active accounts, premiering soon,
                    on air, most hyped / reviewed / rated
    animeForm.ts    the anime form (create + edit, every field)
    editor.ts       quick image edits (anime, creators, characters, studios)
    charts.ts       your Top 10 / Top 100 / OTAKUVA Choice charts
    dailyPicks.ts   the homepage's OTAKUVA Choice pick for each day
    editorial.ts    news stories, articles, collections
    http.ts         shared request/response helpers
  api/     request handlers (mounted under /api/control/...)
  ui/      the screens (sidebar, sign-in, forms, pages/)
```

## Sections

| Sidebar | What you can do |
|---|---|
| Dashboard | Accounts active / not active, sign-ups, premiering soon, on air now, most hyped, most reviewed, most rated, what's missing |
| Anime | Add an anime by filling the form, or import by AniList / MAL id; edit any field, poster, banner, trailer, genres, studios, streaming links |
| Creators / Characters / Studios | Add or change photos and logos |
| Charts | Make ranked charts (Top 10/25/50/100) and publish them at `/charts/<name>` |
| OTAKUVA Choice | Pick the homepage spotlight for each day |
| News | Write OTAKUVA news stories |
| Articles | Write long-form articles |
| Collections | Make public collections of anime |
| Users | See every account, when it was last active, change roles |
| Analytics → Anime | Page views, most viewed, library adds, retention, genres, formats, decades, catalog completeness |
| Analytics → News | Stories published, stories opened, most opened, your own stories, categories, sources |
| Analytics → Collections & charts | Collections created and viewed, largest, most-collected anime, chart views |
| Analytics → Members | Sign-ups, active / not active, members who did something each day, most active, most followed, roles |
| Analytics → Community | Reviews, episode ratings, hype votes per day, top reviewers, communities, articles, reports |

Images: **Choose from computer** uploads a file; or paste a link and press
**Use this link** — the control center downloads the picture and keeps its
own copy, so it never breaks later. Page views are counted from 28 Oct 2026.

## How it reaches the website

The control center and the website use **the same database**, so everything
you save is real site data immediately. After every save, `lib/publish.ts`
also clears the site's short-lived speed caches (homepage, Explore, news,
studios, charts, Top Picks, hype board), so the change shows on otakuva
straight away — no waiting, no extra button.

Every form has a **"View on the site" / "Open public page"** link, and the
sidebar has **View site**. On the website, an admin account sees
**Control center** in the account menu (top right).

## Good to know

- Anything you set by hand is **protected**: the automatic AniList/MAL sync
  never overwrites a field you edited. Clearing a field hands it back to sync.
- Images can be an `https://` link or a file you upload.
- Create / reset the control-center account:
  `npx tsx scripts/create_control_admin.ts --username=<name>`
