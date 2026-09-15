---
project: "Sidereus"
context_type: greenfield
created: 2026-09-15
updated: 2026-09-15
checkpoint:
  current_phase: 5
  phases_completed: [1, 2, 3, 4]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "decision paralysis is primary; data scattered across tools, workflow friction, and gear-blindness are its mechanism"
    - topic: "insight / why not already built"
      decision: "existing tools show data and assume the reader can interpret it; this gives a beginner a verdict and a reason. No claim to beat them - primarily a learning project."
    - topic: "primary persona scope"
      decision: "beginner amateur astronomers with a first telescope (100-200 mm), observing mostly from home in suburban skies; the author is the reference user for judgment calls"
    - topic: "public surface before sign-up"
      decision: "static landing page only (what it does, screenshots); every product route gated. Read-only demo account is post-MVP."
    - topic: "login shape"
      decision: "email + password in MVP, using the auth provider's built-in verification and reset flows; OAuth post-MVP; concrete mechanism decided at stack selection"
    - topic: "role model"
      decision: "flat - every user identical, owns their own sites, equipment and log"
    - topic: "first-flow critical path"
      decision: "map pin cut; email verification disabled in MVP (sign up -> straight to onboarding); password reset kept if the auth provider ships it. Both cut items are post-MVP. Location entry later revised during the Socratic round to geolocation plus place-name search, with coordinates rounded to ~1 km (see FR-004)."
    - topic: "observation log placement"
      decision: "second flow, still in MVP. Empty log is a no-op for ranking; deprioritization unit-tested with fixture logs. Build order: engine -> auth + onboarding -> Tonight -> log."
    - topic: "timeline cost"
      decision: "~6 weeks of after-hours work accepted eyes-open, with a week-2 cut trigger (drop 7-night strip and multi-site UI if the engine spike is not producing a sane top 5)"
    - topic: "priority vocabulary"
      decision: "schema's two values kept (must-have | nice-to-have); 'first to cut' nuance recorded in a separate ## Cut order block rather than as a third priority value"
    - topic: "last-eyepiece deletion"
      decision: "SUPERSEDED during the Socratic round. Original decision was to guard the last eyepiece like the last site and telescope; reversed to allow deletion always, with empty states carrying the weight (see FR-021)."
  frs_drafted: 23
  quality_check_status: pending
timeline_budget:
  mvp_weeks: 6
  hard_deadline: 2026-11-04
  after_hours_only: true
---

# Shape notes

## Seed idea (verbatim)

> Web app for amateur astronomers. Logged-in users manage observing sites
> (coordinates, Bortle class, minimum altitude), equipment (aperture, focal
> length, eyepieces) and an observation log. A pure, typed engine combines
> Open-Meteo forecasts with astronomy-engine moon and twilight data and the
> user's gear and site. It produces a per-night condition verdict (go /
> marginal / no-go) for the next 7 nights x sites, and a ranking of Messier
> objects with the best time window and a matching eyepiece (magnification,
> true FOV, exit pupil <= 7 mm). Already observed objects are deprioritized.
> The author likes astronomy but doesn't yet observe, so this is also a
> learning project. Target: 4 Nov 2026; the final week is reserved for tests,
> CI/CD, deployment and docs.
>
> Accepted scope cuts: Messier-only catalog (filtered from OpenNGC, so
> extending to NGC is a filter change), 7-night horizon, cloud cover +
> humidity only (no seeing/transparency, no light-pollution maps). AI is
> post-MVP and optional, done as tool-calling over engine functions, with BYOK.
>
> Decided: Night score (cloud + humidity within the astronomical darkness
> window) is separate from object score (altitude duration above the site
> minimum, moon separation x illumination, magnitude vs. limiting magnitude,
> coarse user-entered Bortle penalty on low-surface-brightness objects).
> Ranking rules are written explicitly in the PRD before implementation.
> Ephemeris is validated against Stellarium; the top-5 ranking is
> sanity-checked against Telescopius for 2-3 nights. Tests: engine unit tests
> on fixture forecasts, plus a Playwright E2E test (log in -> add site +
> equipment -> ranked list) with a fixture forecast adapter.
>
> Open: concrete weights and thresholds for both scores; DB and auth choice.


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
  Stellarium (ephemeris) and Telescopius (ranking sanity) on 2-3 nights.

### Secondary
- Multi-site comparison pays off: the user can see "Thursday at home is
  marginal, Saturday at the dark site is go" and make the drive decision on it.

### Guardrails
- Home coordinates stay private. A site's lat/long is where the user lives; it
  never appears in a shared URL, a log line, or any third-party request beyond
  the forecast lookup that needs it.
- Never recommends the physically impossible. No object below the site's minimum
  altitude, outside the darkness window, or below the horizon. A beginner who
  goes out and finds nothing there does not come back.
- Never a confident "go" on a clouded-out night. A false "go" wastes a setup and
  an evening; a false "no-go" costs only a night. Where the forecast is
  uncertain, "marginal" must be reachable rather than rounding up to "go".
- Forecast outage degrades, never blanks. With weather data unavailable, moon,
  twilight and altitude results remain usable behind an explicit "no weather
  data" state rather than an error page.

## User Stories

### US-01: New user reaches tonight's ranked targets

- **Given** a visitor with no account
- **When** they sign up, set a location, pick a sky type, and accept a telescope
  and eyepiece-kit preset
- **Then** they see tonight's verdict with its darkness window and, if the
  verdict is go or marginal, a ranked top-5 of Messier objects, each with a best
  observing window, a recommended eyepiece from their own kit, and a one-line
  reason

#### Acceptance Criteria
- The path from sign-up to the ranked list takes under a minute of interaction
  and requires no value the user has to look up.
- Every ranked object is above the site's minimum altitude for at least part of
  its stated window, and that window falls inside astronomical darkness.
- The recommended eyepiece is one the user owns, and yields an exit pupil of
  7 mm or less with the active telescope.
- On a no-go night, or at a site with no astronomical darkness, the verdict and
  its reason are shown in place of the ranking.
- All times are rendered in the selected site's timezone.

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
  > on the auth provider shipping it with no extra setup, and first in the cut
  > order.

### Onboarding
- FR-004: New user can set a home observing site using browser geolocation or place-name search; stored coordinates are rounded to approximately 1 km. The site is created with the default name "Home" and a default minimum altitude, both editable via FR-007. Priority: must-have
  > Socrates: Two counter-arguments accepted: "geolocation returns the user's
  > home address to metre precision, colliding with the privacy guardrail", and
  > "typed lat/long is beginner-hostile for a persona who doesn't know where M13
  > is." Resolution: coordinates rounded to ~1 km (identical accuracy for weather
  > and twilight), and the manual fallback becomes place-name search rather than
  > decimal coordinates. Open-Meteo publishes a geocoding endpoint, so this is
  > the same vendor already depended on rather than a fourth integration -
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
- FR-010: User can see a go / marginal / no-go verdict and the astronomical darkness window for a selected site and night, with all times shown in the site's timezone. Priority: must-have
  > Socrates: Counter-arguments considered: "astronomical darkness is the wrong
  > threshold at a light-polluted site", "a three-level verdict overstates
  > forecast confidence", "site-local time serves a case the persona doesn't
  > have." Resolution: stands. The verdict is the product's core answer, and
  > times must be in the timezone the user is standing in.
- FR-011: User can see the next 7 nights at a selected site. Nights 1-3 carry a go / marginal / no-go verdict. Nights 4-7 show moon and darkness data, which are exactly predictable, plus a cloud outlook with no verdict. Priority: must-have
  > Socrates: Counter-argument accepted: "cloud forecasts past ~3 days are close
  > to noise, and presenting night 6 with the same weight as tonight dresses up
  > a coin-flip as information." Resolution: FR amended - the verdict is
  > withheld where the data can't support it, while the astronomy half of the
  > forecast stays fully useful for planning.
- FR-012: User can switch the selected site and see the same 7-night view for it. Priority: must-have
  > Socrates: Counter-arguments considered: "the real question is a comparison,
  > not a switch", "it serves the secondary persona." Resolution: stands. It is
  > the cheapest form of multi-site and is already first in the cut order.
- FR-020: On a no-go night, user sees the verdict, its reason, and the next night that is not a no-go, instead of an empty or misleading ranking. Priority: must-have
  > Socrates: Counter-argument accepted: "'clouded out tonight' and 'no
  > astronomical darkness this season' are unrelated conditions with unrelated
  > remedies - one resolves tomorrow, the other in three months - and one empty
  > state will serve both badly." Resolution: FR split. FR-020 now covers the
  > weather no-go only; the seasonal case becomes FR-023.
- FR-023: At a site and season with no astronomical darkness, user sees an explanation of the latitude and season cause, and the date astronomical darkness returns. Priority: must-have
  > Socrates: Counter-arguments considered: "naming the return date is a forward
  > search rather than a calculation", "it's a property of the site, not the
  > night", "the reference user may never reproduce it locally." Resolution:
  > stands. This is the case that makes the engine return nothing, and a blank
  > screen with no explanation is the worst outcome for a beginner.

### Object ranking
- FR-013: User can see up to five ranked Messier objects for a selected site, night and telescope, each with its best observing window. Only objects clearing a minimum object score are shown, and the view states how many cleared it. Priority: must-have
  > Socrates: Counter-argument accepted: "five is arbitrary and forces filler -
  > on a marginal night under a bright moon there may be two objects genuinely
  > worth the effort, and padding puts bad recommendations beside good ones with
  > no visible distinction." Resolution: FR amended - the list is gated by a
  > quality bar and the count itself becomes information about the night.
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
- FR-016: User can mark a ranked object as observed. The entry stores the observing night (the evening date), prefilled from the ranking's selected night, which the user can confirm or edit in the form. Priority: must-have
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

## Cut order

Recorded 2026-09-15. These FRs are in the MVP as planned; they are the first to
drop at the week-2 checkpoint if the engine spike is not producing a sane top 5.
This is a delivery plan, not a priority label - all remain must-have until cut.

1. FR-011 and FR-012 - the 7-night strip and site switching. The data model
   stays multi-site regardless; only the UI is cut.
2. FR-022 - manual log entry. Marking from the ranking (FR-016) survives.
3. FR-003 - password reset, included only if the auth provider sends email with
   no extra setup.

## Timeline acknowledgment

Acknowledged on 2026-09-15: 6-week MVP requires sustained dedication; user
accepted. Capacity is 40-55 hours across 6-7 weeks (~7-8 h/week), against a hard
deadline of 2026-11-04 with the final week reserved for tests, CI/CD, deployment
and documentation. A cut trigger is pre-committed: if the engine spike is not
producing a sane top 5 by the end of week 2, the 7-night strip and multi-site UI
are dropped immediately rather than in week 6.

## Access Control

Accounts are required. The user model is flat: every user is identical and owns
their own observing sites, equipment and observation log. No roles, no sharing,
no cross-user visibility.

Public surface is a static landing page only - what the product does, plus
screenshots. Every product route is gated; an unauthenticated request to a gated
route returns the user to sign-in and continues to the requested page afterwards.

Sign-up and sign-in are email + password for the MVP, using the auth provider's
built-in verification and password-reset flows rather than hand-built screens.
The concrete mechanism is decided at stack selection. OAuth is post-MVP.

Immediately after sign-up, onboarding uses equipment presets and a Bortle picker
to get the user to their first ranked list in under a minute. That target is
carried into Success Criteria and Non-Functional Requirements.

A read-only demo account is post-MVP.
