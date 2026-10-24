# OTAKUVA — Real-World Anime & Movie Schedule Intelligence System (Version 1.0)

> Persisted here on 2026-09-12, the same way `docs/OTAKUVA_MASTER_SPEC_v3.md`
> captured the main product spec — so this doesn't need to be re-pasted into
> chat. This is the user's schedule-subsystem spec, verbatim as given.
>
> See the "Current state vs. this spec" note the assistant added in chat
> when this was first received for a snapshot of what already exists
> against §01–§77 below (AiringSchedule model, ScheduleEngine, AniList/
> Jikan provider status, gaps) — that snapshot will drift out of date
> faster than this document will, so treat it as a starting point for
> the next audit, not a standing source of truth.

---

You are the senior backend architect, data engineer, full-stack engineer,
database architect, API designer, DevOps engineer, security engineer,
and QA engineer responsible for implementing the production-grade
OTAKUVA Schedule Intelligence System inside the EXISTING OTAKUVA project.

This is NOT a new standalone application.

This is an extension of the existing OTAKUVA platform.

============================================================
01. OBJECTIVE
============================================================

Build a real-world anime and movie release schedule system for OTAKUVA.

The system must allow users to discover:

- Currently airing anime
- Upcoming anime
- Upcoming episodes
- Recently released episodes
- Anime release dates
- Japanese broadcast times
- International release times where reliable data exists
- Sub release schedules
- Dub release schedules where reliable data exists
- Streaming/digital release events where legitimately sourced
- Movie theatrical release dates
- Regional release dates
- Delayed episodes
- Cancelled releases
- Hiatuses
- Schedule changes
- Release countdowns
- Calendar views
- Personal reminders
- "Up Next" recommendations

The system must NOT simply proxy an external API.

OTAKUVA must own and persist the schedule data.

============================================================
02. CORE ARCHITECTURE
============================================================

The architecture MUST be:

EXTERNAL DATA SOURCES
        ↓
PROVIDER ADAPTERS
        ↓
INGESTION
        ↓
RAW DATA
        ↓
NORMALIZATION
        ↓
ENTITY MATCHING
        ↓
DEDUPLICATION
        ↓
CONFLICT RESOLUTION
        ↓
VERIFICATION
        ↓
OTAKUVA DATABASE
        ↓
OTAKUVA SERVER/API
        ↓
OTAKUVA WEB APPLICATION

The frontend MUST NOT directly depend on:

AniList
AnimeSchedule.net
Jikan
or any other external provider.

The browser talks to OTAKUVA.

OTAKUVA talks to its database.

OTAKUVA's ingestion system talks to external providers.

============================================================
03. PRIMARY DATA SOURCES
============================================================

Use the following architecture:

PRIMARY METADATA SOURCE:

AniList GraphQL

Purpose:

- Anime identity metadata
- Anime relationships
- Episode information
- Airing information
- Airing timestamps
- Episode airing countdown
- Season information
- Status
- Production metadata where available

SCHEDULE SOURCE:

AnimeSchedule.net API v3

Purpose:

- Weekly timetable
- Japanese broadcast schedule
- Subtitle release timing
- Dub release timing where available
- Delays
- Schedule changes
- Timezone conversion
- Timetable-oriented release information

IMPORTANT:

Neither provider is OTAKUVA's source of truth.

They are ingestion sources.

OTAKUVA's database is the application source of truth.

============================================================
04. PROVIDER ABSTRACTION
============================================================

Never scatter AniList or AnimeSchedule.net requests throughout
React components or API routes.

Create a provider abstraction.

Conceptual structure:

providers/

    anilist/
        client
        queries
        mapper
        types

    animeschedule/
        client
        endpoints
        mapper
        types

ingestion/

    anime/
    episodes/
    schedules/
    releases/

normalization/

    anime/
    episodes/
    schedules/
    releases/

matching/

    anime/
    episodes/

verification/

    schedules/

The exact directory structure may adapt to the existing OTAKUVA
architecture.

DO NOT create duplicate provider infrastructure if an existing
provider layer already exists.

Audit the existing implementation first.

============================================================
05. ANILIST INTEGRATION
============================================================

Use AniList GraphQL.

Do not hardcode unstable assumptions.

Inspect the current AniList API/schema before implementation.

Use AniList primarily for:

Anime
Season
Year
Status
Episodes
Airing information
Relations
Production metadata

Map AniList records into OTAKUVA's canonical entities.

Never expose AniList IDs as OTAKUVA primary IDs.

============================================================
06. ANIMESCHEDULE.NET INTEGRATION
============================================================

Use AnimeSchedule.net API v3 for detailed schedule/timetable information
where permitted and technically appropriate.

Use it for:

Japanese timetable
Sub timetable
Dub timetable where available
Delays
Breaks
Timezone-aware scheduling
Weekly timetable

Do not blindly overwrite OTAKUVA schedule records.

Map external timetable records into canonical OTAKUVA release events.

Store source metadata.

============================================================
07. SOURCE PRIORITY
============================================================

Establish a source priority system.

Example:

OFFICIAL SOURCE
    ↓
ANILIST
    ↓
ANIMESCHEDULE.NET
    ↓
OTHER VERIFIED SOURCE

However, source priority must be configurable.

Do not hardcode assumptions that an external provider is always correct.

For conflicting data:

1. Preserve both source observations.
2. Compare timestamps.
3. Compare source confidence.
4. Prefer verified official information.
5. Flag unresolved conflicts.
6. Allow admin verification.

Never silently destroy conflicting source information.

============================================================
08. OTAKUVA CANONICAL IDENTIFIERS
============================================================

OTAKUVA MUST own its IDs.

Example:

animeId:
otakuva_anime_01J...

episodeId:
otakuva_episode_01J...

scheduleEventId:
otakuva_schedule_01J...

Provider IDs belong in mapping tables.

Example:

AnimeExternalId

id
animeId
provider
externalId
createdAt
updatedAt

EpisodeExternalId

id
episodeId
provider
externalId
createdAt
updatedAt

ScheduleExternalReference

scheduleEventId
provider
externalId
sourceUrl
lastSeenAt

Never use:

AniList ID
MAL ID
Jikan ID

as the canonical OTAKUVA primary key.

============================================================
09. UNIFIED RELEASE EVENT MODEL
============================================================

Do not model every release as a simple anime.releaseAt field.

Create a proper release event model.

Concept:

ReleaseEvent

id
animeId
episodeId nullable
contentType
releaseType
platform nullable
region nullable
country nullable
timezone
releaseAt
originalReleaseAt nullable
status
source
sourceUrl
verifiedAt
createdAt
updatedAt

============================================================
10. RELEASE TYPES
============================================================

Support:

BROADCAST
STREAMING
SUB
DUB
THEATRICAL
DIGITAL
PHYSICAL
SPECIAL
OTHER

Do not assume every anime has every release type.

============================================================
11. CONTENT TYPES
============================================================

The schedule system must support:

TV_SERIES
MOVIE
OVA
ONA
SPECIAL
TV_SPECIAL
MUSIC
OTHER

Movies must be treated as first-class content.

Do not force movie releases into episode scheduling.

============================================================
12. EPISODE SCHEDULE MODEL
============================================================

For TV/episodic content:

Episode

id
animeId
number
title
nativeTitle
airDate
releaseAt
duration
status
externalIds
createdAt
updatedAt

But the actual release schedule should be represented through
ReleaseEvent.

Example:

Episode 12

Japan broadcast:
Sunday 23:00 JST

International streaming:
Monday 10:00 IST

English dub:
Thursday 21:00 IST

These are separate release events.

============================================================
13. MOVIE RELEASE MODEL
============================================================

Movies require a different schedule representation.

Example:

SPIRITED AWAY

Theatrical release:
Japan
July 20, 2001

Another regional release:
Region X
Date Y

Digital release:
Platform
Date/time

Do NOT create:

Episode 1 / 1

for a movie.

Use:

Movie
+
ReleaseEvent

============================================================
14. REGIONAL RELEASES
============================================================

Release dates may differ by:

Japan
India
United States
United Kingdom
Europe
Australia
etc.

Do not assume one global release timestamp.

ReleaseEvent must support:

region
country
timezone

Use ISO-compatible country/region identifiers where appropriate.

============================================================
15. TIMEZONE SYSTEM
============================================================

Store release timestamps in UTC internally.

Store source timezone where meaningful.

At display time:

convert to the user's selected timezone.

Default:

user's local timezone.

Allow:

Auto
Japan
India
US
UK
Custom timezone

Do not store only formatted strings such as:

"Sunday 11 PM"

Store an actual timestamp.

Example:

releaseAt:
2026-10-04T14:00:00Z

timezone:
Asia/Tokyo

Then calculate display time.

============================================================
16. DAYLIGHT SAVING TIME
============================================================

Do not manually calculate timezone offsets.

Use a proper IANA timezone implementation.

Examples:

Asia/Tokyo
Asia/Kolkata
America/New_York
Europe/London

Respect daylight-saving transitions.

============================================================
17. WEEKLY TIMETABLE
============================================================

OTAKUVA must support:

TODAY
TOMORROW
THIS WEEK
NEXT WEEK
CALENDAR

Example:

OTAKUVA / SCHEDULE

SATURDAY

08:30 PM

Anime X
Episode 10

TV Broadcast
Japan

10:00 PM

Anime Y
Episode 05

SUB
India

SUNDAY

...

The UI must be based on actual ReleaseEvent data.

============================================================
18. SCHEDULE STATUS
============================================================

Support:

SCHEDULED
RELEASED
DELAYED
CANCELLED
HIATUS
UNKNOWN

For content lifecycle:

UPCOMING
AIRING
COMPLETED

Do not confuse:

anime status

with:

release event status.

============================================================
19. DELAY SYSTEM
============================================================

Delays are first-class events.

Store:

originalReleaseAt
currentReleaseAt
status
delayReason where known
source
sourceUrl
verifiedAt

Example:

Episode 08

Originally:
September 13
8:00 PM

Updated:
September 20
8:00 PM

Status:
DELAYED

Do not overwrite the historical release time.

Maintain schedule history.

============================================================
20. SCHEDULE HISTORY
============================================================

Create:

ScheduleChange

id
releaseEventId
previousReleaseAt
newReleaseAt
previousStatus
newStatus
reason
source
changedAt

This allows OTAKUVA to show:

"Release date changed."

It also provides an audit trail.

============================================================
21. OFFICIAL VERIFICATION
============================================================

When a schedule is available from an official source:

store:

sourceType:
OFFICIAL

sourceName

sourceUrl

verifiedAt

verificationStatus

Possible statuses:

UNVERIFIED
VERIFIED
CONFLICT
OUTDATED

Never label an unverified provider estimate as official.

============================================================
22. INGESTION PIPELINE
============================================================

Implement:

FETCH
↓
VALIDATE
↓
NORMALIZE
↓
MATCH
↓
DEDUPLICATE
↓
COMPARE
↓
MERGE
↓
VERIFY
↓
UPSERT
↓
CACHE INVALIDATION

Every step should be observable.

============================================================
23. RAW DATA STORAGE
============================================================

Where appropriate, retain normalized/raw source observations.

Do not necessarily expose raw provider payloads to users.

A source observation can contain:

provider
externalId
payload/reference
fetchedAt
hash
version

This helps debug provider changes and data conflicts.

Do not store secrets inside raw payloads.

============================================================
24. IDEMPOTENT INGESTION
============================================================

Running the same ingestion job twice must NOT create duplicate:

Anime
Episode
ReleaseEvent
ScheduleChange

records.

Use:

external IDs
canonical matching
unique constraints
content hashes
timestamps

where appropriate.

============================================================
25. SCHEDULE DEDUPLICATION
============================================================

Two providers may describe the same event.

Example:

AniList:
Episode 10 airs at timestamp X.

AnimeSchedule.net:
Episode 10 airs at timestamp X.

These must resolve to ONE canonical OTAKUVA release event.

Do not display:

Episode 10
11:00 PM

Episode 10
11:00 PM

as two releases.

============================================================
26. ENTITY MATCHING
============================================================

Schedule records must resolve to canonical OTAKUVA Anime and Episode IDs.

Matching should use:

provider IDs
external IDs
existing canonical relationships

Fallback matching may consider:

title
native title
episode number
season/year
release metadata

But fuzzy matching must never automatically merge high-risk entities
without sufficient confidence.

Flag uncertain matches for admin review.

============================================================
27. API LAYER
============================================================

Expose OTAKUVA-owned APIs.

Examples:

GET /api/schedule
GET /api/schedule/today
GET /api/schedule/week
GET /api/schedule/calendar
GET /api/anime/:id/schedule
GET /api/anime/:id/episodes/:episodeId/releases

User-specific:

GET /api/me/schedule
GET /api/me/reminders

Do not expose:

GET /api/jikan/...
GET /api/animeschedule/...

as the primary frontend architecture.

The frontend should not care which provider supplied the data.

============================================================
28. SCHEDULE API FILTERS
============================================================

Support:

date
startDate
endDate
timezone
region
country
releaseType
contentType
status
followedOnly
libraryOnly

Example:

GET /api/schedule?date=2026-09-12

Server resolves:

user timezone
date boundaries
release events

Do not calculate the user's local day incorrectly.

============================================================
29. PERSONAL "UP NEXT"
============================================================

Create:

UP NEXT

based on:

anime in user's library
watching status
followed anime
interested anime where appropriate

Example:

UP NEXT

Attack on Titan
Episode 12
Today · 8:30 PM

Frieren
Episode 17
Tomorrow · 7:00 PM

Anime X
Episode 04
Sunday

Only show actual scheduled events.

============================================================
30. FOLLOWED ENTITIES
============================================================

Schedule can personalize around:

followed anime
followed studios
followed people

Example:

FROM STUDIOS YOU FOLLOW

Studio XYZ
Episode release
Friday

Do not notify users about irrelevant schedule events.

============================================================
31. REMINDERS
============================================================

Support optional reminders.

Examples:

Remind me 30 minutes before.

Remind me 1 hour before.

Remind me on release.

Store:

Reminder

id
userId
releaseEventId
offsetMinutes
status
createdAt
sentAt

Prevent duplicate reminders.

============================================================
32. NOTIFICATION INTEGRATION
============================================================

If OTAKUVA already has notifications:

REUSE THE EXISTING SYSTEM.

Do not build a second notification architecture.

Possible notifications:

Episode releasing soon.
Release delayed.
Release date changed.
Followed anime released.
Followed studio announced a new production.

============================================================
33. SCHEDULE + LIBRARY
============================================================

The schedule system must integrate with:

UserAnime
EpisodeProgress
AnimeInterest
Follow

Example:

User is watching Anime X.

Episode 12 is scheduled tomorrow.

OTAKUVA can show:

EPISODE 12
Tomorrow
8:30 PM

[Set Reminder]

After release:

[Mark Watched]

Mark Watched must use the canonical Episode ID.

============================================================
34. SCHEDULE + NEWS
============================================================

Schedule changes should connect to news/announcements where available.

Example:

Anime X
Episode 08 delayed.

↓
ScheduleEvent updated.

↓
Announcement/news relation.

Anime page:

SCHEDULE
Episode 08
DELAYED

NEWS
Episode 08 delayed due to production schedule.

Do not fabricate the reason.

============================================================
35. SCHEDULE + ANIME PAGE
============================================================

Anime dossier should contain:

UPCOMING RELEASE

Episode 12
September 20
8:30 PM IST

Status:
Scheduled

[Set Reminder]

For movies:

THEATRICAL RELEASE

India
October 18, 2026

Japan
October 10, 2026

Where information is unavailable:

Release date not yet announced.

============================================================
36. SCHEDULE + MOVIES
============================================================

Movies can have:

world premiere
festival premiere
Japanese theatrical release
regional theatrical release
international theatrical release
digital release
physical release

Treat these as separate ReleaseEvents.

Do not collapse them into one date.

============================================================
37. CALENDAR
============================================================

Create a calendar-compatible schedule representation.

Views:

Month
Week
Day

Each event should contain:

title
content type
episode number where relevant
release type
releaseAt
timezone
status

Do not create unnecessary large cards.

Use compact editorial timeline rows.

============================================================
38. SCHEDULE UI
============================================================

Visual direction:

KEEP CURRENT OTAKUVA COLORS.

Do NOT change OTAKUVA's established color identity.

Do not introduce a new color palette.

Do not introduce neon gradients.

Do not turn the schedule into a generic SaaS dashboard.

Preferred:

editorial timeline
compact rows
strong typography
subtle metadata
minimal borders
clear time hierarchy
natural artwork thumbnails
open layout

Example:

SATURDAY

08:30 PM
Anime X
Episode 10
TV Broadcast · Japan

10:00 PM
Anime Y
Episode 05
Sub · India

No giant cards around every event.

============================================================
39. CONTENT TYPE INDICATORS
============================================================

Clearly distinguish:

TV
MOVIE
OVA
ONA
SPECIAL

Use typography and compact labels.

Do not rely only on color.

============================================================
40. RELEASE TYPE INDICATORS
============================================================

Clearly show:

Broadcast
Sub
Dub
Streaming
Theatrical
Digital

Example:

EPISODE 12
08:30 PM IST
SUB

or:

MOVIE
THEATRICAL
18 OCT
INDIA

============================================================
41. USER TIMEZONE
============================================================

On first use:

detect user's timezone from browser/application context where appropriate.

Allow manual override.

Do not rely on IP geolocation.

Do not store precise location unnecessarily.

User timezone preference can be stored.

Example:

timezone:
Asia/Kolkata

Display:

8:30 PM IST

instead of:

3:00 PM UTC

============================================================
42. DATA FRESHNESS
============================================================

Schedules change.

Every schedule record must support freshness metadata.

Examples:

lastSyncedAt
sourceUpdatedAt
verifiedAt
expiresAt where appropriate

Do not permanently cache a schedule without refresh.

============================================================
43. INGESTION FREQUENCY
============================================================

Use appropriate scheduled jobs.

Examples:

daily broad synchronization
frequent upcoming episode synchronization
more frequent refresh for near-term releases
on-demand admin refresh

Do not continuously poll providers unnecessarily.

Respect provider rate limits.

============================================================
44. RATE LIMITING
============================================================

Provider clients must implement:

request throttling
retry
exponential backoff
timeouts
deduplication
caching
failure handling

Do not issue one provider request per user page load.

============================================================
45. FAILURE HANDLING
============================================================

If AniList is unavailable:

OTAKUVA continues using stored data.

If AnimeSchedule.net is unavailable:

OTAKUVA continues using stored data.

If both are unavailable:

Existing schedule data remains visible.

Admin receives provider health information.

Do not expose provider failure as a broken public page.

============================================================
46. CACHE STRATEGY
============================================================

Public schedule:

public/schedule/{date}/{timezone}/{region}

Anime schedule:

public/anime/{animeId}/schedule

Private:

user/{userId}/schedule
user/{userId}/reminders

Never allow private user data to enter public cache keys.

Invalidate cache after schedule changes.

============================================================
47. DATABASE INDEXES
============================================================

Index:

animeId
episodeId
releaseAt
timezone
region
country
releaseType
status

Composite indexes should support:

date + region
animeId + releaseAt
episodeId + releaseAt
status + releaseAt

Inspect actual query patterns before creating excessive indexes.

============================================================
48. DATABASE CONSTRAINTS
============================================================

Prevent duplicate release events.

A suitable uniqueness strategy may include:

animeId
episodeId
releaseType
region
platform
releaseAt

BUT do not blindly apply this exact composite key if the data model
requires multiple legitimate events.

Design uniqueness according to real schedule semantics.

============================================================
49. ADMIN SCHEDULE CONTROL
============================================================

Admin Control Center must include:

SCHEDULE

Today's releases
Upcoming releases
Delayed releases
Cancelled releases
Conflicting schedules
Unverified schedules
Recently changed schedules

Admin actions:

View
Verify
Edit
Correct
Merge
Mark delayed
Mark cancelled
Restore
Inspect source
Inspect history

Sensitive actions must be audited.

============================================================
50. SOURCE CONFLICT SCREEN
============================================================

Example:

ANIME X
EPISODE 08

ANILIST
September 20
20:30 JST

ANIMESCHEDULE.NET
September 21
20:30 JST

OFFICIAL
September 20
20:30 JST

OTAKUVA
September 20
20:30 JST

VERIFIED

This is extremely valuable for data quality.

============================================================
51. SCHEDULE HISTORY UI
============================================================

Example:

EPISODE 08

Originally:
September 13

Changed:
September 20

Reason:
Production delay

Source:
Official announcement

Updated:
September 10

Only display reason when source-backed.

============================================================
52. COUNTDOWN
============================================================

Support countdowns:

2h 14m
Tomorrow
3 days

Calculate countdown dynamically.

Do not store countdown values.

Store releaseAt.

============================================================
53. RELEASED STATE
============================================================

When:

currentTime >= releaseAt

the event can become:

RELEASED

But do not rely only on client-side time.

Server-side jobs should update status.

Handle delays and cancellations.

============================================================
54. DATE BOUNDARY TESTING
============================================================

Test:

UTC
JST
IST
PST
EST
GMT
DST regions

Test:

11:59 PM
12:00 AM
23:59
00:00

Ensure events do not appear on the wrong calendar day.

============================================================
55. SECURITY
============================================================

Provider credentials must exist ONLY server-side.

Never expose:

API secrets
private provider credentials
R2 credentials

Never use:

NEXT_PUBLIC_*

for secrets.

Validate all API inputs.

Protect admin schedule editing.

============================================================
56. API SECURITY
============================================================

Public schedule endpoints may be public.

Private endpoints require authentication.

Admin endpoints require authorization.

Never trust:

client userId
client role
client schedule ownership
client reminder ownership

Derive identity from authenticated session.

============================================================
57. TESTING
============================================================

Create tests for:

AniList ingestion
AnimeSchedule ingestion
normalization
entity matching
episode matching
release-event deduplication
timezone conversion
DST
delay handling
cancelled events
movie releases
regional releases
sub/dub releases
cache isolation
user reminders
admin edits
provider failures

Critical:

Same event from two providers
→ one OTAKUVA event.

Provider unavailable
→ stored schedule remains available.

Timezone changes
→ display changes correctly without changing canonical timestamp.

============================================================
58. OBSERVABILITY
============================================================

Track:

provider request count
provider failures
ingestion jobs
successful syncs
failed syncs
conflicts
duplicate candidates
schedule changes
stale records
verification status

Never log secrets.

============================================================
59. DATA QUALITY
============================================================

Never fabricate:

air dates
release times
delays
platforms
dub dates
theatrical dates
regional dates

When data is unknown:

"Release date not yet announced."

"Schedule not yet available."

"Release time unavailable."

Never guess.

============================================================
60. EXTERNAL API CHANGE RESILIENCE
============================================================

Provider APIs can change.

Keep provider logic isolated.

If AniList changes:

update the AniList adapter.

The rest of OTAKUVA should continue working.

If AnimeSchedule.net changes:

update its adapter.

The OTAKUVA database and frontend contract should remain stable.

============================================================
61. API-BASED PLATFORM PROTECTION
============================================================

This is a HARD REQUIREMENT.

DO NOT build:

Frontend
→ AniList

Frontend
→ AnimeSchedule.net

Frontend
→ Jikan

Instead:

Frontend
→ OTAKUVA API
→ OTAKUVA DB

And separately:

AniList
→ OTAKUVA ingestion

AnimeSchedule.net
→ OTAKUVA ingestion

Official sources
→ OTAKUVA verification

============================================================
62. FUTURE PROVIDER SUPPORT
============================================================

Design provider architecture so future providers can be added without
rewriting the application.

Potential future sources:

Jikan
MAL-derived data
AniDB
official broadcaster sources
publisher sources
streaming platform release information
regional distributors

Adding a provider should mean:

implement adapter
map data
run ingestion

not:

rewrite frontend.

============================================================
63. HOME INTEGRATION
============================================================

Homepage can expose:

UP NEXT
TODAY'S RELEASES
UPCOMING THIS WEEK
NEWLY ANNOUNCED
TRENDING RELEASES

Example:

UP NEXT

Frieren
Episode 17
Today · 8:30 PM

Anime X
Episode 04
Tomorrow · 9:00 PM

Theatre Movie X
India
Saturday

============================================================
64. DISCOVERY INTEGRATION
============================================================

Schedule should influence discovery.

Example:

UPCOMING

Anime X
2027
TV
12 episodes
4.2K interested

User can:

View
Interested
Follow
Add to Library

============================================================
65. ANIME PAGE INTEGRATION
============================================================

Anime pages should expose:

STATUS
AIRING

NEXT EPISODE
Episode 12

RELEASE
September 20 · 8:30 PM IST

RELEASE TYPE
Broadcast / Sub

[Set Reminder]

Then:

View full schedule →

============================================================
66. MOVIE PAGE INTEGRATION
============================================================

Movie page:

SPIRITED AWAY

MOVIE · 2001 · 2H 05M

RELEASE HISTORY

Japan
July 20, 2001
Theatrical

India
...

Digital
...

Do not treat theatrical and digital releases as the same event.

============================================================
67. PERSONAL SCHEDULE
============================================================

Create:

MY SCHEDULE

Based on:

Watching
Interested
Followed
Library

Example:

TODAY

Anime X
Episode 10
8:30 PM

TOMORROW

Anime Y
Episode 04
7:00 PM

THIS WEEK

...

============================================================
68. PERSONAL REMINDERS
============================================================

A user can select:

Notify me when released.

Notify me 30 minutes before.

Notify me 1 hour before.

Notify me 1 day before.

Respect user notification settings.

============================================================
69. UI DESIGN RULE
============================================================

Keep the current OTAKUVA visual identity.

DO NOT change the current colors.

DO NOT replace the existing OTAKUVA blue accent.

Do not introduce neon gradients.

Do not turn the schedule into a card-heavy SaaS dashboard.

Use:

open editorial layouts
strong typography
compact metadata
timeline hierarchy
minimal borders
subtle separators
natural anime artwork
clear release times

The schedule should feel like:

ANIME EDITORIAL CALENDAR

not:

ADMIN DASHBOARD

============================================================
70. MOBILE
============================================================

Mobile schedule:

TODAY

08:30 PM
Anime X
EP 10
SUB

10:00 PM
Anime Y
EP 05
BROADCAST

Use horizontal date navigation.

Support:

Today
Tomorrow
This Week

Calendar can open as a dedicated view.

Do not shrink desktop tables onto mobile.

============================================================
71. ACCESSIBILITY
============================================================

Schedule must be usable without color.

Every event should communicate:

title
time
date
release type
status

Use semantic time elements where appropriate.

Keyboard navigation.

Screen-reader labels.

Accessible calendar controls.

Accessible filters.

============================================================
72. PERFORMANCE
============================================================

Do not fetch the entire season to render today's schedule.

Query only required events.

Use pagination where necessary.

Use server-side data fetching where appropriate.

Cache public schedule data.

Lazy load secondary information.

Optimize images.

Avoid N+1 queries.

============================================================
73. IMPLEMENTATION PROCESS
============================================================

STEP 1

Audit the existing OTAKUVA codebase.

STEP 2

Find existing:

anime model
episode model
provider integration
schedule routes
database
cache
authentication
notifications

STEP 3

Reuse existing infrastructure.

STEP 4

Design migration.

STEP 5

Implement canonical ReleaseEvent model.

STEP 6

Implement provider adapters.

STEP 7

Implement ingestion.

STEP 8

Implement normalization.

STEP 9

Implement deduplication.

STEP 10

Implement conflict handling.

STEP 11

Implement OTAKUVA schedule API.

STEP 12

Connect frontend.

STEP 13

Add personal schedule.

STEP 14

Add reminders.

STEP 15

Add admin controls.

STEP 16

Run tests.

STEP 17

Run typecheck.

STEP 18

Run lint.

STEP 19

Run production build.

STEP 20

Test desktop/tablet/mobile.

============================================================
74. DO NOT REBUILD EXISTING FUNCTIONALITY
============================================================

If OTAKUVA already has:

schedule
episodes
anime
notifications
library
authentication
provider
database
cache

reuse it.

Do not create:

second schedule model
second notification system
second provider layer
second episode tracker
second caching system

unless the existing architecture is fundamentally unsuitable.

If refactoring is necessary:

migrate safely.

============================================================
75. MIGRATION SAFETY
============================================================

Never delete existing production data casually.

Before schema changes:

inspect
backup/migrate
test
verify

Preserve existing anime and episode relationships.

Backfill canonical IDs where necessary.

============================================================
76. DEFINITION OF DONE
============================================================

The schedule system is complete only when:

✓ AniList ingestion works.

✓ AnimeSchedule.net ingestion works.

✓ Provider adapters are isolated.

✓ OTAKUVA owns canonical schedule records.

✓ Frontend does not directly depend on providers.

✓ Anime IDs are canonical OTAKUVA IDs.

✓ Episode IDs are canonical OTAKUVA IDs.

✓ Schedule events are canonical OTAKUVA IDs.

✓ Anime and movie schedules are supported.

✓ Regional releases are supported.

✓ Timezones are supported.

✓ Delays are supported.

✓ Cancellations are supported.

✓ Schedule history is retained.

✓ Duplicate provider events are merged.

✓ Source conflicts can be inspected.

✓ Admin can verify/correct schedules.

✓ User schedule works.

✓ Reminders integrate with existing notification system.

✓ Cache is correctly isolated.

✓ Provider failure does not break existing schedule data.

✓ No fake schedule information exists.

✓ Mobile UI works.

✓ Accessibility works.

✓ Tests pass.

✓ Production build passes.

============================================================
77. FINAL ARCHITECTURAL PRINCIPLE
============================================================

AniList is NOT OTAKUVA.

AnimeSchedule.net is NOT OTAKUVA.

Jikan is NOT OTAKUVA.

They are data suppliers.

OTAKUVA is the canonical product.

The final architecture must be:

                    ANILIST
                       │
                       ↓
              ┌────────────────┐
              │                │
              │   INGESTION    │
              │                │
              └───────┬────────┘
                      │
ANIMESCHEDULE.NET ────┤
                      │
OFFICIAL SOURCES ────┤
                      ↓
              ┌────────────────┐
              │  NORMALIZATION │
              └───────┬────────┘
                      ↓
              ┌────────────────┐
              │ DEDUPLICATION  │
              └───────┬────────┘
                      ↓
              ┌────────────────┐
              │  VERIFICATION  │
              └───────┬────────┘
                      ↓
              ┌────────────────┐
              │ OTAKUVA DATABASE│
              └───────┬────────┘
                      ↓
              ┌────────────────┐
              │  OTAKUVA API   │
              └───────┬────────┘
                      ↓
              ┌────────────────┐
              │ OTAKUVA WEB APP│
              └────────────────┘

This architecture must remain the foundation.

Build a schedule system that users can trust,
that survives provider failures,
that supports anime AND movies,
that understands real-world release events,
and that becomes a permanent part of the OTAKUVA knowledge graph.
</content>
