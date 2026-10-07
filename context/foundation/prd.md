---
project: "Sidereus"
version: 3
status: draft
created: 2026-09-16
updated: 2026-10-07
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 6
  hard_deadline: 2026-11-04
  after_hours_only: true
---

# Sidereus - Product Requirements Document

## Vision & Problem Statement

A beginner amateur astronomer with a first telescope - typically 100-200 mm of
aperture, observing from a suburban back garden - looks outside on a clear
evening and cannot answer two questions: is tonight actually worth setting up
for, and what should I point at? The information needed exists, but it is
scattered across a weather app, a moon-phase site, an altitude chart and the
eyepiece specs in a drawer, and none of it is expressed as a decision. The cost
is nights that go unused and a telescope that gathers dust.

Existing tools - Clear Outside, Astrospheric, Telescopius - present this data
and assume the reader can interpret it. Interpreting it is precisely the skill a
beginner does not yet have. The insight is that the interpretation can be made
explicit: a verdict for the night, and a ranked shortlist of targets each
carrying the reason it was chosen and the eyepiece to use. This product does not
claim to beat those tools; it is built primarily as a learning project, with the
author as the reference user for judgment calls.

Version 3 (2026-10-07) records what the second milestone shipped and widens the
promise for the third. Deciding what to look at is only half of a beginner's
night: the other half is finding it, knowing what it will look like, and having
a reason to come back. Sidereus now covers the Moon, the planets and bright
non-Messier objects, lays the night out as a plan, and works at a dark site
without signal. Next it helps the user find each target from a star they can
already see, tracks what they have seen against the classic lists, flags the
sky events worth planning around, and lets them shape the night's plan
themselves.

## User & Persona

Beginner amateur astronomer. First telescope, typically 100-200 mm aperture.
Observes mostly from home under suburban skies, with one or two darker sites
within driving distance. Knows the famous objects by name, but not where they
are in the sky or when they are up. Reaches for the product on a clear-looking
evening, or a day or two ahead when deciding whether the drive is worth it.

The author is the reference user for judgment calls: interested in astronomy,
not yet observing, building toward their own first sessions.

## Success Criteria

### Primary
- A new user goes from the landing page to a ranked top-5 for tonight in under a
  minute of interaction, without having to look up a single number they do not
  already have.
- The top-5 ranking for a sampled site and date survives a cross-check against
  an independent planetarium
  reference (ephemeris) and an independent observation planner (ranking
  sanity) on 2-3 nights.

### Secondary
- Multi-site comparison pays off: the user can see "Thursday at home is
  marginal, Saturday at the dark site is go" and make the drive decision on it.
- Sidereus alone gets a beginner to the target: from a ranked object, the finder
  chart leads from a star visible to the naked eye to the object, with no
  planetarium app needed for that step (added v3).
- A reason to come back: the user can see how far they are through the Messier
  and Caldwell lists and which tonight's targets they have never seen (added v3).

### Guardrails
- Home coordinates stay private. A site's lat/long is where the user lives; it
  never appears in a shared URL, a log line, or any third-party request beyond
  the forecast lookup that needs it. One consented exception (amended
  2026-10-07, roadmap S-09 / GitHub #73): map tiles are requested only after the
  user chooses "Pick from map". Those tile requests reveal the area being
  viewed, which may start at the site's or the device's location; only the
  rounded pick is stored.
- Never recommends the physically impossible. No object below the site's minimum
  altitude, outside the darkness window, or below the horizon. A beginner who
  goes out and finds nothing there does not come back. Amended v3, recording
  M-2: the Moon and the planets are bright enough for twilight, so their window
  is the sun below −6° rather than the dark window; deep-sky objects keep the
  dark window. The same rule applies to a plan the user edits: no target is
  scheduled outside its window.
- Never a confident "go" on a clouded-out night. A false "go" wastes a setup and
  an evening; a false "no-go" costs only a night. Where the forecast is
  uncertain, "marginal" must be reachable rather than rounding up to "go".
- Forecast outage degrades, never blanks. With weather data unavailable, moon,
  twilight and altitude results remain usable. The last successful forecast is
  shown with its age where one exists; otherwise an explicit "no weather data"
  state is shown. Neither case produces an error page.

## User Stories

### US-01: New user reaches tonight's ranked targets

- **Given** a visitor with no account
- **When** they sign up, set a location, pick a sky type, and accept a telescope
  and eyepiece-kit preset
- **Then** they see tonight's verdict with its dark window and, if the verdict is
  go or marginal, a ranked list of Messier objects, each with its best observing
  window, a finding and detail eyepiece pair from their own kit, and a one-line
  reason

#### Acceptance Criteria
- The path from sign-up to the ranked list takes under a minute of interaction
  and requires no value the user has to look up.
- Up to five objects above the minimum score are shown, with a stated count.
- Each object carries a finding and detail eyepiece pair, using the exit-pupil
  parameter.
- The ranking uses the user's telescope; the selector is shown only when there
  are several.
- Each object's best window falls within the site's dark window.
- On a no-go night, or where the site has no dark window, the verdict and its
  reason are shown in place of the ranking.
- All times are rendered in the selected site's timezone.

### US-02: User is told why tonight is a no-go and when to try next

- **Given** a signed-in user with a site and telescope
- **When** they open the Tonight view on a night the forecast rules no-go
- **Then** they see the no-go verdict with its reason and the next night that is
  not a no-go, in place of a ranking

#### Acceptance Criteria
- No object ranking is shown on a no-go night (FR-020, Business Logic
  invariant).
- Where the site has no dark window for the night, the explanation names the
  latitude and season cause and the date the dark window returns, instead of a
  weather reason (FR-023).
- With no weather data, the view falls back to the last forecast with its age or
  an explicit "no weather data" state, never an error page.

### US-03: User compares nights across two sites to decide on a drive

- **Given** a signed-in user with a home site and a darker second site
- **When** they view the next 7 nights and switch between the two sites
- **Then** they see, for each site, a verdict on nights 1-3 and moon and
  darkness data with a cloud outlook on nights 4-7, so a "marginal at home
  Thursday, go at the dark site Saturday" decision can be read off

#### Acceptance Criteria
- Nights 4-7 show no verdict (FR-011, Business Logic invariant).
- All times are rendered in the selected site's timezone, including across the
  2026-10-25 daylight-saving transition.
- Switching sites re-runs the same 7-night view for the selected site (FR-012).

### US-04: User logs an observation and sees it reflected in later rankings

- **Given** a signed-in user looking at tonight's ranking
- **When** they mark an object as observed, confirm the night, and rate it
  3 or above
- **Then** later rankings show that object mildly deprioritized and, where it
  still ranks, tagged "seen N times - last [date]"

#### Acceptance Criteria
- The entry stores object, observing night, rating, site and telescope; the
  night is prefilled and editable before saving (FR-016).
- An entry rated 1-2 applies no penalty, so the object stays on the list
  (FR-018, Business Logic invariant).
- The user can edit or delete the entry afterwards (FR-017), and entries remain
  readable after their site or telescope is deleted (FR-021).

### US-05: User finds a ranked target from a star they can see

- **Given** a signed-in user looking at a ranked deep-sky object or a planet on
  a go or marginal night
- **When** they open the object's finder chart
- **Then** they see the nearest star bright enough to see with the naked eye
  from their site, the hop from that star to the object, the field of their
  finder and of their finding eyepiece drawn to scale, and a line on what the
  object will look like in their telescope

#### Acceptance Criteria
- The starting star is above the site's minimum altitude at the object's best
  time (FR-037, Business Logic invariant).
- The eyepiece circle uses the user's own finding eyepiece from FR-014.
- The what-to-expect line reflects the object's type, size and brightness, the
  telescope's aperture and the site's sky quality (FR-038).

### US-06: User sees their progress and what they have not seen yet

- **Given** a signed-in user with observation log entries
- **When** they open their progress, or Tonight's targets
- **Then** they see the Messier and Caldwell checklists with counts, the planets
  and the Moon as "firsts", any milestones reached, and a "not seen yet" mark on
  tonight's targets they have never logged

#### Acceptance Criteria
- An object counts as seen only through an entry rated 3 or above (FR-039).
- Deleting or re-rating an entry updates the counts and the marks.
- A milestone is shown once, when the log entry that reaches it is saved, and
  stays listed on the progress page (FR-041).

### US-07: User plans around a sky event

- **Given** a signed-in user with a site
- **When** they open the dashboard on a night with a notable event, or the
  events page
- **Then** they see the event on the dashboard, the next 30 days of events with
  their times in the site's timezone and whether each is visible from the
  site, and tonight's event named next to the sky verdict

#### Acceptance Criteria
- Events are computed by the product, with no external feed (FR-042).
- An event below the site's horizon is shown as not visible from the site, never
  as something to go out for.

### US-08: User shapes tonight's session plan

- **Given** a signed-in user looking at the session plan for a site and night
- **When** they reorder targets, drop one, or add another visible object
- **Then** the plan keeps their changes on every device, including the stored
  offline copy, and can be reset to the suggested plan

#### Acceptance Criteria
- An added target is placed only within its own visibility window (Guardrails).
- Edits are saved per user, site and night (FR-044); another user never sees
  them.

## Functional Requirements

### Accounts
- FR-001: Visitor can create an account with email and password. Priority: must-have
  > Socrates: Counter-argument considered: "an account is a barrier to a
  > 30-second answer; a local-first profile would do." Resolution: stands.
  > Per-user persistence across devices is a real requirement and the account is
  > the honest way to get it.
- FR-002: User can sign in and sign out. Priority: must-have
  > Socrates: Counter-argument accepted: "a session that expires mid-session is
  > hostile - the user is outdoors, dark-adapted, and now has to type a
  > password." Resolution: FR stands; a session-longevity constraint is carried
  > into Non-Functional Requirements.
- FR-003: User can reset a forgotten password. Priority: must-have
  > Socrates: Counter-argument considered: "it drags back the email dependency
  > that cutting verification removed." Resolution: stands. Already conditional
  > on the auth provider shipping it with no extra setup, and in the cut order
  > (position 3).
  > Resolution 2026-09-28 (S-09, user): cut to Parked. The condition failed:
  > Supabase's built-in email only delivers to the project's team members and
  > allows 2 messages an hour, so reset for real users needs custom SMTP and a
  > redirect-URL allowlist in the hosted dashboard. Cut-order #3 applied.

### Onboarding
- FR-004: New user can set a home observing site using browser geolocation or place-name search; stored coordinates are rounded to approximately 1 km. The site is created with the default name "Home" and a default minimum altitude, both editable via FR-007. Priority: must-have
  > Socrates: Two counter-arguments accepted: "geolocation returns the user's
  > home address to metre precision, colliding with the privacy guardrail", and
  > "typed lat/long is beginner-hostile for a persona who doesn't know where M13
  > is." Resolution: coordinates rounded to ~1 km (identical accuracy for weather
  > and twilight), and the manual fallback becomes place-name search rather than
  > decimal coordinates. The forecast provider also publishes a geocoding
  > endpoint, so this is the same vendor already depended on rather than a
  > fourth integration -
  > terms to be confirmed at implementation.
- FR-005: New user can select their sky quality from a plain-language Bortle picker. Priority: must-have
  > Socrates: Counter-argument considered: "self-assessed Bortle is
  > systematically wrong and silently poisons the object score." Resolution:
  > stands. Coarse by design, user-editable, and a rough sky estimate beats no
  > sky estimate.
- FR-006: New user can select a telescope preset and an eyepiece-kit preset, and edit the values before saving. The preset set is fixed and named in the specification rather than left open. Priority: must-have
  > Socrates: Inverted counter-argument accepted: "the presets are load-bearing
  > for the under-a-minute Primary criterion, so the FR should specify how many
  > and which rather than leaving it open." Resolution: FR amended to require a
  > fixed, named preset set. The exact list is routed to Open Questions.
  >
  > Update (2026-10-06, M-2 S-12): a catalogue search was added in front of the
  > fixed presets, which stay as the "Not sure" fallback.

### Sites & equipment
- FR-007: User can create, view, update and delete observing sites (name, coordinates, Bortle class, minimum altitude). Priority: must-have
  > Socrates: Counter-argument considered: "most users will have exactly one
  > site forever." Resolution: stands. Sites are the unit the engine runs
  > against, and the Secondary criterion depends on more than one existing.
- FR-008: User can create, view, update and delete telescopes (name, aperture, focal length). Priority: must-have
  > Socrates: Counter-argument considered: "the persona owns one telescope, so
  > CRUD plus switcher is machinery for a second scope they don't have."
  > Resolution: stands. Users upgrade, and gear is the input the engine runs on.
- FR-009: User can create, view, update and delete eyepieces (name, focal length, apparent field of view), which belong to the user and can be used with any telescope. Kit presets carry correct apparent-FOV values; manual entry offers an eyepiece-type picker (Plossl ~50 deg, wide-field ~68 deg, ultra-wide ~82 deg) rather than a bare number field. Priority: must-have
  > Socrates: Counter-argument accepted: "beginners don't know their apparent
  > field of view - it's in a lost spec sheet, and a guessed value breaks the
  > true-FOV calculation silently while still looking authoritative."
  > Resolution: FR amended - presets supply AFOV, and manual entry asks for a
  > type description instead of a recalled number.
- FR-019: Where the user owns one telescope it is used automatically and no selector is shown. Where they own two or more, a telescope selector appears on the Tonight view and the ranking states which telescope it is for. Priority: must-have
  > Socrates: Two counter-arguments accepted: "'active telescope' is hidden
  > global state that silently changes every ranking", and "it teaches a mode to
  > a persona who owns one telescope, before it ever pays off." Resolution: FR
  > rewritten - the mode disappears for single-telescope users, and where it
  > exists the ranking names the telescope it applies to, so no result is
  > unexplained.
- FR-021: User can delete any site, telescope or eyepiece. With no site or no telescope, the Tonight view shows an empty state linking to adding one; with no eyepieces, the ranking still shows, without eyepiece recommendations. Log entries referencing a deleted site or telescope remain readable. Priority: must-have
  > Socrates: Counter-argument accepted: "the guard blocks replacement - the
  > most common real action - and channels users into editing gear in place,
  > which is the history-rewriting problem it was meant to avoid." Resolution:
  > FR reversed. Deletion is always allowed and the empty states carry the
  > weight. This supersedes the earlier decision to guard the last eyepiece.

### Night conditions
- FR-010: User can see a go / marginal / no-go verdict and the dark window for a selected site and night, with all times shown in the site's timezone. The dark window runs between the site's Bortle-dependent sun-altitude thresholds (tunable parameter #7). Priority: must-have
  > Socrates: Counter-arguments considered: "astronomical darkness is the wrong
  > threshold at a light-polluted site", "a three-level verdict overstates
  > forecast confidence", "site-local time serves a case the persona doesn't
  > have." Resolution: stands. The verdict is the product's core answer, and
  > times must be in the timezone the user is standing in.
  > Resolution (2026-10-02, moonlight-and-the-verdict): the verdict is a sky
  > forecast and is worded as one. Its computation and thresholds are
  > unchanged; go / marginal / no-go stay as its internal levels, but the
  > headline names what the forecast checks, chosen from the level and the
  > reason: Clear (go), Partly clear (marginal on cloud), Clear, but damp
  > (humidity cap), Clear (old forecast) (saved-copy cap), No forecast (no
  > weather data), Cloudy (no-go on cloud), No dark window (no darkness). The
  > Moon is not part of it: Tonight shows it in its own card.
- FR-011: User can see the next 7 nights at a selected site. Nights 1-3 carry a go / marginal / no-go verdict. Nights 4-7 show moon and darkness data, which are exactly predictable, plus a cloud outlook with no verdict. Priority: must-have
  > Socrates: Counter-argument accepted: "cloud forecasts past ~3 days are close
  > to noise, and presenting night 6 with the same weight as tonight dresses up
  > a coin-flip as information." Resolution: FR amended - the verdict is
  > withheld where the data can't support it, while the astronomy half of the
  > forecast stays fully useful for planning.
  > Resolution (2026-10-02, moonlight-and-the-verdict): nights 1-3 carry the
  > same sky headline as the verdict card (FR-010), and the next-night line of
  > FR-020 names it too ("Next clearer night: Fri 9 Oct (partly clear)").
  > Nights 4-7 still carry none.
- FR-012: User can switch the selected site and see the same 7-night view for it. Priority: must-have
  > Socrates: Counter-arguments considered: "the real question is a comparison,
  > not a switch", "it serves the secondary persona." Resolution: stands. It is
  > the cheapest form of multi-site and is already first in the cut order
  > (position 1, together with FR-011).
- FR-020: On a no-go night, user sees the verdict, its reason, and the next night that is not a no-go, instead of an empty or misleading ranking. Priority: must-have
  > Socrates: Counter-argument accepted: "'clouded out tonight' and 'no
  > astronomical darkness this season' are unrelated conditions with unrelated
  > remedies - one resolves tomorrow, the other in three months - and one empty
  > state will serve both badly." Resolution: FR split. FR-020 now covers the
  > weather no-go only; the seasonal case becomes FR-023.
- FR-023: Where the sun never reaches the site's darkness threshold for a night, user sees an explanation of the latitude and season cause, and the date the dark window returns. Priority: must-have
  > Socrates: Counter-arguments considered: "naming the return date is a forward
  > search rather than a calculation", "it's a property of the site, not the
  > night", "the reference user may never reproduce it locally." Resolution:
  > stands. This is the case that makes the engine return nothing, and a blank
  > screen with no explanation is the worst outcome for a beginner.

### Object ranking
- FR-013: User can see up to five ranked Messier objects for a selected site, night and telescope, each with its best observing window, its constellation, and its altitude and compass direction at that time (for example "SW, 45 deg"). Only objects clearing a minimum object score are shown, and the view states how many cleared it. Priority: must-have
  > Socrates: Counter-argument accepted: "five is arbitrary and forces filler -
  > on a marginal night under a bright moon there may be two objects genuinely
  > worth the effort, and padding puts bad recommendations beside good ones with
  > no visible distinction." Resolution: FR amended - the list is gated by a
  > quality bar and the count itself becomes information about the night.
  > Further amended at the closing cross-check: each entry also carries its
  > constellation (already present in the catalogue data) and its altitude and
  > compass direction at the best time, which orients a beginner without
  > crossing into the star-hopping non-goal.
- FR-014: User can see a recommended pair of their own eyepieces for each ranked object: a finding eyepiece (widest true field of view) and a detail eyepiece (the highest magnification that still fits the object and respects the exit-pupil floor). Priority: must-have
  > Socrates: Two counter-arguments accepted: "a 7 mm exit-pupil ceiling is a
  > young person's pupil - past roughly 40 it's nearer 5 mm, and under suburban
  > light pollution a large exit pupil washes out contrast regardless of age",
  > and "DSO observing needs two eyepieces, not one - find at low power, then
  > push higher." Resolution: FR amended to recommend a pair, and the
  > exit-pupil ceiling becomes a specification parameter defaulting to ~5-6 mm
  > rather than a hardcoded 7 mm. With a two-eyepiece stock kit the pair is
  > simply both of them.
- FR-015: User can see a plain-language reason for each object's placement, leading with the score component where that object most stands out from the others in the same list. Priority: must-have
  > Socrates: Counter-argument accepted: "the objects that rank highly rank
  > highly for the same reasons, so five 'why' lines will read near-identically,
  > and repetition is how a reader learns to skip text." Resolution: FR amended
  > - each line leads with the differentiating component, so the five differ by
  > construction rather than by luck, and the user learns which factor mattered
  > tonight.

### Observation log
- FR-016: User can mark a ranked object as observed. The entry stores the object, the observing night (the evening date), a 1-5 rating of how well it went, and the site and telescope used. The night is prefilled from the ranking's selected night, and the site and telescope from the ranking's selection; the user can confirm or edit all of them in the form. Priority: must-have
  > Socrates: Counter-argument accepted: "prefilling tonight will often be
  > wrong - logging happens next morning from memory, and confidently wrong
  > entries then feed the deprioritization rule." Resolution: FR amended - the
  > log's unit becomes the observing night rather than a calendar timestamp,
  > which survives the after-midnight case, and the value is confirmable before
  > saving.
- FR-017: User can view, edit and delete their observation log entries. Priority: must-have
  > Socrates: Counter-arguments considered: "observing logs are append-only in
  > practice", "deleting silently re-promotes an object." Resolution: stands.
  > Users mistype and log the wrong object; journals in software are edited.
- FR-018: User sees already-logged objects mildly deprioritized in later rankings - a logged object can still rank when conditions favour it. Entries rated low (1-2 of 5) carry no penalty, so a failed attempt stays on the list. A logged object that ranks anyway is tagged "seen N times - last [date]". Priority: must-have
  > Socrates: Two counter-arguments accepted: "beginners learn by revisiting -
  > demoting an object the moment it's been glimpsed once pushes them onward
  > exactly when they should stay put", and "the demotion is invisible and
  > unexplained, which contradicts the verdict-with-a-reason promise."
  > Resolution: FR amended - the penalty is mild, suppressed entirely for
  > low-rated entries, and made visible via a tag. This introduces a 1-5 rating
  > on log entries, which FR-016, FR-017 and FR-022 all touch.
- FR-022: User can add a log entry manually for any Messier object, not only from the ranking. Priority: must-have
  > Socrates: Counter-arguments considered: "it solves the wrong half of the gap
  > - the things a beginner most wants to log are Jupiter, the Moon, a meteor",
  > "two entry points, one record, two validation paths." Resolution: stands. It
  > is already in the cut order, and a log you can only write from tonight's
  > ranking is a strange log.

### Night usability
- FR-024: User can switch the interface to a red night mode that preserves dark adaptation. Priority: must-have
  > Socrates: Raised during Phase 5 rather than the FR round. It answers the
  > dark-adaptation counter-argument offered against FR-016 - which was not the
  > counter-argument accepted there - so it is new scope, not a carried
  > resolution. Recorded as an FR with a cut-order entry rather than as a
  > priority value the schema does not have.

### Interface
- FR-025: User can switch the interface between a dark theme (the default) and a light theme; the choice is remembered on the device. Priority: must-have
  > Added 2026-09-26 (v2) by the user after S-02 and S-04 had shipped UI, not
  > from the shaping round: theming was never designed, and retrofitting it
  > after every view exists costs more than building on shared colour tokens
  > now. The dark default (NFR) and the red night mode (FR-024) are unchanged;
  > the red mode becomes one more theme on the same tokens.
- FR-026: User can switch the interface language between English and Polish. All product copy, including verdict reasons, object explanations and error messages, and all date and time formatting follow the selected language. Priority: must-have
  > Added 2026-09-26 (v2) by the user, for the same reason as FR-025: every
  > view built with hard-coded English copy is rework later. The language
  > infrastructure is must-have; the Polish copy itself is in the cut order
  > (position 5), so English-only can ship if time runs out.

### Shipped in M-2 (recorded in v3)

These record scope that M-2 ("First real nights", closed 2026-10-07) shipped
under the roadmap charter while the PRD still said v2. Each names its roadmap
slice; details live in the archived change folders.

- FR-027: User can see the planets above the site's minimum altitude on Tonight, each with its best time, altitude and direction, a detail eyepiece and a reason, and can log one as observed (roadmap S-01). Priority: must-have
- FR-028: User can see the Moon as a target in its own right - phase, when it is up, what is worth looking at - and can log it (roadmap S-02). Priority: must-have
- FR-029: User can see bright deep-sky objects beyond the Messier catalogue (the Caldwell objects visible from mid-northern latitudes) ranked with the same scoring, reasons and eyepiece pair, and can log them (roadmap S-03). Priority: must-have
- FR-030: User lands on a Tonight dashboard of tiles - verdict, Moon, planets, targets, session plan, the next nights and the sky check - each opening its own focused page, with a live sky showing what is up through the night (roadmap S-11). Priority: must-have
- FR-031: User can open a session plan: the night from sunset to sunrise as a timeline with the dark window, the Moon's span and each recommended target at its best time (roadmap S-05). Priority: must-have
- FR-032: User can install Sidereus and open the Tonight pages last loaded for a site with no network, marked with when they were prepared; network-only controls say so instead of failing (roadmap S-06). Priority: must-have
- FR-033: User can say whether a past night's sky matched the verdict and see a tally of how often verdicts matched (roadmap S-07). Priority: must-have
- FR-034: User adding or editing a site can use "Use my location", asked for only after that click, or "Pick from map", whose map loads only after that click (roadmap S-08, S-09). Priority: must-have
- FR-035: User adding a telescope or eyepiece can pick a real model from a searchable catalogue that fills in the fields, which stay editable (roadmap S-12). Priority: must-have
- FR-036: The interface has a distinct visual identity of its own in the light and dark themes, with red night mode unchanged in function (roadmap S-10). Priority: must-have

### Finding the object (v3)
- FR-037: User can open a finder chart for any ranked deep-sky object and any planet on Tonight: the nearest star bright enough to see with the naked eye from the site at the object's best time, the hop from it to the object through intermediate stars where needed, and two circles drawn to scale - the finder's field and the true field of the user's finding eyepiece (FR-014) - oriented as the user faces that part of the sky. Plan: full (FR-045). Priority: must-have
- FR-038: User sees, with each ranked object, a plain-language line on what to expect in their own telescope from their site - for example "a faint grey smudge; use averted vision" or "a bright, tight ball of stars that resolves at the edge" - derived from the object's type, size and brightness, the aperture and the site's sky quality. Plan: full (FR-045). Priority: must-have

### Progress and goals (v3)
- FR-039: User can see their progress: the Messier and Caldwell checklists with a count each ("47 / 110"), and the planets and the Moon as "firsts", filled from observation log entries rated 3 or above. Priority: must-have
- FR-040: User sees a "not seen yet" mark on tonight's targets they have never logged with a rating of 3 or above. Priority: must-have
- FR-041: User sees a milestone celebrated when the log entry that reaches it is saved - from a fixed, named set such as first planet, first galaxy, first globular cluster, 10 / 25 / 50 / 110 Messier objects and all planets seen - and every milestone reached is listed on the progress page. Priority: must-have

### Sky events (v3)
- FR-042: User can see the sky events of the next 30 days for the selected site - meteor shower peaks, planet oppositions, Mercury and Venus greatest elongations, close Moon-planet and planet-planet pairings, and solar and lunar eclipses - each with its time in the site's timezone and whether it is visible from the site. Events are computed by the product, with no external data feed. Priority: must-have
- FR-043: User sees the next notable event as a dashboard tile linking to the events page, and an event happening tonight named next to the sky verdict. Priority: must-have

### Session plan (v3)
- FR-044: User can adjust the session plan for a site and night - reorder targets, drop one, add another object visible that night - and reset it to the suggested plan. Edits are saved to the user's account per site and night, so they reach every device and the stored offline copy; editing needs the network. Plan: full (FR-045). Priority: must-have

### Plans and entitlements (v3)
- FR-045: Every account is on the free plan or the full plan. Everything shipped before v3, and the progress and sky-event features (FR-039 to FR-043), stay free. The features marked "Plan: full" (FR-037, FR-038, FR-044) are shown to a free account as what they do and that they need the full plan - never as an error or an empty state - and the server enforces the plan, not only the interface. Priority: must-have
- FR-046: The operator can create a new account on the full plan, or move an existing account to it and back, with one command and no payment ("complimentary" accounts, for the author and testers). Priority: must-have

### Cut order

Recorded 2026-09-15 in shape-notes. Every FR above is must-have; this is a
delivery plan, not a priority label. These are the first to drop at the week-2
checkpoint if the engine spike is not producing a sane top 5.

1. FR-011 and FR-012 - the 7-night strip and site switching. The data model
   stays multi-site regardless; only the UI is cut.
2. FR-022 - manual log entry. Marking from the ranking (FR-016) survives.
3. FR-003 - password reset, included only if the auth provider sends email with
   no extra setup. Applied 2026-09-28: the condition failed (see FR-003).
4. FR-024 - red night mode. Dark theme by default (an NFR) survives; the red
   filter is the cut.
5. FR-026 Polish copy - added 2026-09-26 (v2). The language switch and message
   catalogue survive with English as the only language; translating every
   string into Polish is the cut.

The v3 requirements (FR-037 to FR-044) carry no cut order: the M-3 roadmap
sequences them, and its slices can be parked like M-2's.

## Non-Functional Requirements

- Identical inputs produce identical output: the same site, night, telescope and
  observation log always yield the same verdict and the same ranking.
- Altitude and timing results agree with an independent planetarium reference
  within a stated tolerance. Candidate: 1 degree of altitude and 5 minutes of
  time; the tolerance itself is uncalibrated (see Open Questions).
- All times are shown in the selected site's timezone and remain correct across
  daylight-saving transitions, including the 25-hour night of 25 October 2026.
- A signed-in session survives a rolling 30 days without re-authentication, so a
  session never expires on someone standing in a dark field. It ends after 30
  days without use (S-09).
- From the start of onboarding to the first ranked list takes under a minute of
  interaction, measured excluding sign-up form typing.
- A site's coordinates are rounded to approximately 1 km at capture, are never
  written to logs, and never leave the product except in the forecast and
  geocoding lookups that require them, and in the map tiles of "Pick from map"
  (amended 2026-10-07, roadmap S-09 / GitHub #73): requested only after the user
  chooses it, they reveal the area being viewed, which may start at the site's
  or the device's location.
- No user can read or modify another user's data, verified by a test that
  exercises the boundary outside the user interface.
- With current weather data unavailable, the most recent successful forecast for
  that site is shown together with its age, or an explicit "no weather data"
  state where none has been fetched; moon, twilight and altitude results remain
  usable in both cases.
- The product stays within the forecast provider's non-commercial fair-use
  limits.
- The Tonight view renders within about 2 seconds against warm data, and ranking
  the full Messier catalogue completes in under a second.
- The interface is dark by default and usable without destroying dark
  adaptation.
- Phone first (added v3): at 360-390 px wide, every view leads with its primary
  answer, nothing needs horizontal scrolling, and the Tonight dashboard shows
  the sky verdict and its first tiles on the first screen. A finder chart is
  legible on a phone held at arm's length in red night mode.
- Data sources whose licences require attribution are credited in the product.

## Business Logic

For a given site, night and telescope, Sidereus decides whether the night is
worth setting up for and which Messier objects the user can realistically see,
when, and with which eyepieces.

The rule consumes what the user has told the product about where they observe
(location, sky quality, and the lowest altitude they can usefully see down to),
what they own (a telescope's aperture and focal length, and each eyepiece's
focal length and apparent field of view), and what they have already seen and
how well it went. To that it adds the conditions for each night ahead: the cloud
and humidity forecast, the moon's position and illumination, and the times at
which the sky is dark enough to observe.

It produces two separate judgments. The first is about the night: whether the
sky will be usable, expressed as a verdict with its reason and the window of
darkness it applies to. The second is about the objects: which of them clear a
quality bar for that night and telescope, in what order, during which window
each is best placed, and which two of the user's own eyepieces to use - one to
find it, one to look closely. Objects already seen are pushed down gently rather
than removed, and an object the user tried and could not make out is not pushed
down at all.

> Resolution (2026-10-02, moonlight-and-the-verdict): the night judgment is
> the sky alone - cloud and humidity over the dark window - and every surface
> words it as the sky ("Clear", "Partly clear", "Cloudy" and the reason-specific
> headlines of FR-010), never as "go". Whether a night is worth setting up for
> also depends on the Moon and on what the user wants to see; Tonight shows the
> Moon beside the sky verdict and judges moonlight per object in the ranking,
> not inside the verdict.

The user encounters both on one screen. The verdict answers whether to go out;
the ranking answers what to do once outside, with each entry carrying the single
factor that most distinguishes it from the others in the list.

> Added v3: two more outputs follow from the same inputs. For each target, how
> to find it - a starting star the user can see and a hop to the object, drawn
> with the fields of their own finder and eyepiece - and what it will look like
> through their telescope from their site. And from the log, how far the user is
> through the classic lists. Both are deterministic: identical inputs give the
> identical chart, hop, expectation line and counts. Sky events are computed the
> same way, from the site and the date alone.

### Invariants

Decided now. These do not vary and are not tuned.

- An object below the site's minimum altitude throughout the dark window never
  ranks.
- A no-go night shows no ranking.
- An object that does not fit an eyepiece's true field of view is not
  recommended for that eyepiece.
- A log entry rated 1-2 of 5 never deprioritizes its object.
- Nights 4-7 carry no verdict.
- A finder chart never starts from a star below the site's minimum altitude at
  the object's best time, and never from one too faint to see with the naked eye
  from the site (added v3).
- A log entry rated 1-2 of 5 never ticks a checklist or reaches a milestone
  (added v3).
- An event below the site's horizon is never presented as something to go out
  for (added v3).

### Tunable parameters

Every number in the scoring is a tunable parameter with an uncalibrated
candidate value, listed by name in Open Questions and resolved at the end of the
engine-spike milestone. They are recorded as candidates rather than decisions so
that nothing downstream treats an armchair guess as settled.

## Access Control

Accounts are required. The user model is flat: every user is identical and owns
their own observing sites, equipment and observation log. No roles, no sharing,
no cross-user visibility.

Public surface is a static landing page only - what the product does, plus
screenshots. Every product route is gated; an unauthenticated request to a gated
route returns the user to sign-in and continues to the requested page afterwards.

Sign-up and sign-in are email + password for the MVP. Email verification is
disabled in the MVP: sign-up leads straight into onboarding. Password reset is
not in the MVP: it was kept only if the provider shipped it without extra email
setup (FR-003), and Supabase's built-in email reaches only the project's team,
so it is parked. The concrete mechanism is decided at stack selection. Email verification and OAuth are
post-MVP.

Immediately after sign-up, onboarding uses equipment presets and a Bortle picker
to get the user to their first ranked list in under a minute. That target is
carried into Success Criteria and Non-Functional Requirements.

A read-only demo account is post-MVP.

Plans (added v3): every account carries a plan, free or full (FR-045). This is
an attribute of the account, not a role: users stay identical in what data they
can reach, and only the full plan's features differ. The operator grants the
full plan from the command line with the service credentials (FR-046); there is
no admin interface. Checkout, pricing and subscriptions are not in v3.

## Non-Goals

Functional:

- **Astrophotography.** No exposure planning, tracking, guiding or imaging
  advice. The largest adjacent scope in the hobby and the one most likely to
  arrive as one more field on the equipment form.
- **Comets, double stars, variable stars and other transient objects.** Narrowed
  in v3: the planets, the Moon and the Caldwell objects are in scope (FR-027 to
  FR-029). Comets need a refreshed external feed, and double stars were parked by
  the user (roadmap S-04).
- **A sky atlas or planetarium.** Narrowed in v3 from "Finding the object": the
  finder chart (FR-037) shows only the stretch of sky between a starting star and
  its target. No pan-and-zoom star atlas, no stars fainter than the finder
  shows, no camera or augmented-reality view, no plate solving.
- **Hardware control.** No GoTo mount or telescope integration.
- **Notifications.** No push, email or "clear tonight" alerts.
- **Social and sharing features.** No shared sites, club accounts, public logs
  or comparison with other observers. Keeps the flat access model honest. The v3
  progress (FR-039 to FR-041) is private: no leaderboards, no badges to share,
  no points beyond the fixed milestone set.
- **AI features.** The planner chat, object descriptions and summaries are
  post-MVP. Only the scoring functions' tool-callable shape is kept.

Non-functional:

- **Modelling seeing, transparency or light pollution.** No jet-stream or seeing
  forecasts, no light-pollution maps, no automatic Bortle class from
  coordinates. Sky quality stays a coarse number the user sets.
- **Native mobile app.** Web only; a responsive layout is sufficient, installable
  since M-2 (FR-032).

Commercial (added v3):

- **Payments.** No checkout, pricing, subscriptions, invoices or trials in v3.
  Plans exist (FR-045) and the full plan is granted by hand (FR-046); taking
  money is its own later milestone, after Open Question 21.
- **An admin interface.** Account plans are changed from the command line only.

## Open Questions

Tunable scoring parameters (1-9) carry uncalibrated candidate values so the
engine spike can start. Owner: user. Resolution point: end of the engine-spike
milestone, approximately 2026-09-30.

1. **Component weights for the object score** - candidate (uncalibrated):
   altitude duration 0.35, moon interference 0.30, brightness versus limiting
   magnitude 0.25, Bortle surface-brightness penalty 0.10.
2. **Verdict cloud thresholds** - candidate (uncalibrated): go if there is a
   contiguous run of at least 2 hours below 30% cloud within the dark window;
   marginal if at least 1 hour below 65%; otherwise no-go. Humidity above 90%
   caps the verdict at marginal. Scored on the longest contiguous clear run
   rather than a mean, so that a late clearance is not averaged away.
3. **Minimum object score** - candidate (uncalibrated): 0.45 on a 0-1 scale.
4. **Exit-pupil ceiling and floor** - candidate (uncalibrated): 5.5 mm ceiling,
   0.7 mm floor.
5. **Bortle penalty** - candidate (uncalibrated): applies to objects fainter
   than about 21 mag/arcsec2 surface brightness, scaling from 0 at Bortle 1-2 to
   0.40 at Bortle 8-9. The catalogue source does not carry surface brightness for every
   Messier object, clusters especially, so where it is missing the penalty falls
   back to object type (galaxies and diffuse nebulae penalized).
6. **Log penalty size** - candidate (uncalibrated): 0.15 subtracted for entries
   rated 3 or above; zero for entries rated 1-2.
7. **Darkness threshold by Bortle class** - candidate (uncalibrated): sun at
   -18 degrees for Bortle 1-4, -15 for 5-6, -12 for 7-9. At 52 degrees north
   this means -12 is always reached, -15 is missed only around the solstice, and
   -18 is missed from roughly late May to mid-July.
8. **Default minimum altitude** - candidate (uncalibrated): 15 degrees. Peak
   altitude from 52 degrees north is 38 degrees plus declination, so 15 keeps
   objects down to about -23 declination and excludes roughly 14 Messier
   objects. A 25-degree default would have excluded roughly 28, including all of
   Sagittarius and Scorpius. Users with obstructed horizons raise it per site.
9. **Ephemeris tolerance** - candidate (uncalibrated): 1 degree of altitude and
   5 minutes of time against an independent planetarium reference.
10. **Which telescope and eyepiece-kit presets ship** - the fixed, named preset
    set required by FR-006. Owner: user. Blocks the under-a-minute onboarding
    claim in Success Criteria.
11. **Database and authentication choice** - deferred to stack selection. The
    auth provider must ship password reset without extra email setup, or FR-003
    is cut. Answered 2026-09-28: Supabase does not (built-in email reaches only
    the project's team), so FR-003 is cut.
12. **Geocoding terms** - confirm the geocoding endpoint's
    non-commercial fair-use terms before FR-004 depends on it.

Added v3 (2026-10-07), for M-3. Owner: team unless marked; each is settled in
the plan of the slice that needs it.

13. **The finder's field** - the equipment model has no finder. Candidate: a
    standard 6×30 finder (about 7° across) for every telescope, plus the
    concentric rings of a 1× reflex finder; a later change may let the user
    pick their finder. Owner: user.
14. **Star depth for the chart** - the bundled stars stop at magnitude 4.5,
    while a 6×30 finder shows stars to about magnitude 8. Candidate: a deeper,
    redistributable subset of the same source, loaded only with the chart;
    licence and page weight are checked in the plan.
15. **Naked-eye limit for the starting star** - candidate (uncalibrated): by
    Bortle class, magnitude 4.5 at Bortle 1-4, 3.5 at 5-6, 2.5 at 7-9.
16. **Hop length** - candidate (uncalibrated): each step at most one finder
    field, through stars the finder shows.
17. **What-to-expect wording** - candidate: a fixed set of phrases chosen by
    object type, surface brightness against the site's sky quality, and
    aperture; judged without an observer, like M-2's advice (roadmap Open
    Question 2).
18. **The milestone set** - candidate: first planet, first galaxy, first
    globular cluster, first nebula, the Moon's terminator, 10 / 25 / 50 / 110
    Messier objects, all Caldwell objects in the list, all planets. Owner: user.
19. **Meteor shower data** - a fixed table of the major showers' peak dates and
    radiants from a public source whose terms allow reuse; checked in the plan.
20. **Which pairings are "close"** - candidate (uncalibrated): Moon-planet and
    planet-planet pairs within 3°, only when both are above the horizon in the
    site's darkness or twilight window.

21. **Commercial licences before charging** - the forecast and place search use
    Open-Meteo's free API, which is for non-commercial use, and this PRD's NFR
    keeps within those limits; OpenStreetMap's tile policy gives no service
    guarantee and discourages heavy use. Before any payment is taken, move to a
    commercial forecast and geocoding plan (or provider) and confirm the map
    tiles' terms. Owner: user. Blocks: the payments milestone, not M-3.
22. **Pricing, payment provider and the plan's name** - deferred to the
    payments milestone. Owner: user.
23. **Paid features in a stored offline copy** - candidate: a copy keeps what
    the account's plan allowed when it was stored, and is purged on sign-out as
    today.
