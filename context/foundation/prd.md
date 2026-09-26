---
project: "Sidereus"
version: 2
status: draft
created: 2026-09-16
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
- FR-011: User can see the next 7 nights at a selected site. Nights 1-3 carry a go / marginal / no-go verdict. Nights 4-7 show moon and darkness data, which are exactly predictable, plus a cloud outlook with no verdict. Priority: must-have
  > Socrates: Counter-argument accepted: "cloud forecasts past ~3 days are close
  > to noise, and presenting night 6 with the same weight as tonight dresses up
  > a coin-flip as information." Resolution: FR amended - the verdict is
  > withheld where the data can't support it, while the astronomy half of the
  > forecast stays fully useful for planning.
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

### Cut order

Recorded 2026-09-15 in shape-notes. Every FR above is must-have; this is a
delivery plan, not a priority label. These are the first to drop at the week-2
checkpoint if the engine spike is not producing a sane top 5.

1. FR-011 and FR-012 - the 7-night strip and site switching. The data model
   stays multi-site regardless; only the UI is cut.
2. FR-022 - manual log entry. Marking from the ranking (FR-016) survives.
3. FR-003 - password reset, included only if the auth provider sends email with
   no extra setup.
4. FR-024 - red night mode. Dark theme by default (an NFR) survives; the red
   filter is the cut.
5. FR-026 Polish copy - added 2026-09-26 (v2). The language switch and message
   catalogue survive with English as the only language; translating every
   string into Polish is the cut.

## Non-Functional Requirements

- Identical inputs produce identical output: the same site, night, telescope and
  observation log always yield the same verdict and the same ranking.
- Altitude and timing results agree with an independent planetarium reference
  within a stated tolerance. Candidate: 1 degree of altitude and 5 minutes of
  time; the tolerance itself is uncalibrated (see Open Questions).
- All times are shown in the selected site's timezone and remain correct across
  daylight-saving transitions, including the 25-hour night of 25 October 2026.
- A signed-in session survives a rolling 30 days without re-authentication, so a
  session never expires on someone standing in a dark field.
- From the start of onboarding to the first ranked list takes under a minute of
  interaction, measured excluding sign-up form typing.
- A site's coordinates are rounded to approximately 1 km at capture, are never
  written to logs, and never leave the product except in the forecast and
  geocoding lookups that require them.
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

The user encounters both on one screen. The verdict answers whether to go out;
the ranking answers what to do once outside, with each entry carrying the single
factor that most distinguishes it from the others in the list.

### Invariants

Decided now. These do not vary and are not tuned.

- An object below the site's minimum altitude throughout the dark window never
  ranks.
- A no-go night shows no ranking.
- An object that does not fit an eyepiece's true field of view is not
  recommended for that eyepiece.
- A log entry rated 1-2 of 5 never deprioritizes its object.
- Nights 4-7 carry no verdict.

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
disabled in the MVP: sign-up leads straight into onboarding. Password reset uses
the auth provider's built-in flow rather than a hand-built screen, and is kept
only if the provider ships it without extra email setup (FR-003). The concrete
mechanism is decided at stack selection. Email verification and OAuth are
post-MVP.

Immediately after sign-up, onboarding uses equipment presets and a Bortle picker
to get the user to their first ranked list in under a minute. That target is
carried into Success Criteria and Non-Functional Requirements.

A read-only demo account is post-MVP.

## Non-Goals

Functional:

- **Astrophotography.** No exposure planning, tracking, guiding or imaging
  advice. The largest adjacent scope in the hobby and the one most likely to
  arrive as one more field on the equipment form.
- **Anything outside the Messier catalogue.** No planets, Moon, comets, double
  stars or NGC objects, in the ranking or the log. The catalogue is a filter
  change away, which is exactly why the boundary has to be written down.
- **Finding the object.** No star-hopping directions, sky charts or finder
  views. The user locates objects with other tools such as Stellarium or printed
  charts. Accepted boundary: the product answers whether to go out and what to
  look at, not how to find it. Partially mitigated by FR-013, which names each
  object's constellation and its altitude and compass direction at the best
  time. Named anchor stars remain post-MVP.
- **Hardware control.** No GoTo mount or telescope integration.
- **Notifications.** No push, email or "clear tonight" alerts.
- **Social and sharing features.** No shared sites, club accounts, public logs
  or comparison with other observers. Keeps the flat access model honest.
- **AI features.** The planner chat, object descriptions and summaries are
  post-MVP. Only the scoring functions' tool-callable shape is kept.

Non-functional:

- **Modelling seeing, transparency or light pollution.** No jet-stream or seeing
  forecasts, no light-pollution maps, no automatic Bortle class from
  coordinates. Sky quality stays a coarse number the user sets.
- **Native mobile app.** Web only; a responsive layout is sufficient.

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
    is cut.
12. **Geocoding terms** - confirm the geocoding endpoint's
    non-commercial fair-use terms before FR-004 depends on it.
