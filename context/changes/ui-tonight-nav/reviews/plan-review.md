<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Tonight sub-nav and Progress as a destination

- **Plan**: context/changes/ui-tonight-nav/plan.md
- **Mode**: Deep (weryfikacja w kodzie wykonana bezpośrednio, bez sub-agenta)
- **Date**: 2026-10-15
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Ścieżki 16/17 ✓ (`scripts/skeleton-heights.mjs` ✗ — leży w archiwum, zob. F2), symbole 7/7 ✓ (`NAV_ITEMS`, `isCurrentPage`,
`TONIGHT_PAGES`, `scrollbar-hidden`, `--text-label`, `--text-caption`, `::view-transition-group(nav-current)`),
brief↔plan ✓ poza jednym zdaniem (F5). Progress↔fazy: 3/3 fazy, 16/16 kryteriów zgodnych, brak checkboxów poza Progress ✓.

Potwierdzone w kodzie: pasek `night-sky bg-zenith` w `GearShell.astro:36-41` jest poza `<main>` i wyspą, więc slot
`subnav` renderuje się raz; `TonightPageSky.astro:25,30` i `TonightPageSkeleton.astro:47,75` mają domyślny
`backHref = "/tonight"`; kafle linkują gołe ścieżki (`TonightTiles.astro:127-197`); `TONIGHT_PAGES` ma Events na końcu;
`isCurrentPage` (prefiks) oznaczyłby Log i Progress naraz; `text-label` = 15 px (większe niż dzisiejsze `text-sm`),
co pomiar C5 uwzględnia. Żaden istniejący spec nie szuka po stronie linków o nazwach z sub-navu bez zawężenia
(`tonight-dashboard.spec.ts:90` i `sky-events.spec.ts:58` są w `main` i plan je przepina).

## Findings

### F1 — Strażnik rytmu (`rhythm-roles.test.ts`) nie jest w plikach Fazy 2

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 — §4 „The back link only for the finder”
- **Detail**: `src/styles/rhythm-roles.test.ts:80-95` liczy dokładne wystąpienia klas odstępów w
  `TonightPageSkeleton.astro` (`"mt-1": 3`, `"sm:mt-2": 1`, …). Faza 2 każe warunkowo renderować `BackLink` i jego
  wrapper oraz „dopasować górny odstęp tytułu bez back linku” — każda zmiana klas `mt-1 sm:mt-2` wokół `PageHeader`
  zmienia te liczniki, a test pada w bramce 2.2. Plan nie wymienia tego pliku ani nie mówi, czy liczniki mają się
  zmienić (i dlaczego), więc implementer albo „poprawi test pod kod”, albo będzie zgadywał, który odstęp jest właściwy.
- **Fix**: Dopisać `src/styles/rhythm-roles.test.ts` do plików Fazy 2 §4 z decyzją: jakie klasy ma nagłówek bez
  back linku (w skeletonie i w `TonightPageSky` identyczne) i jakie liczniki z tego wynikają, z komentarzem przy wpisie.
- **Decision**: ACCEPTED — applied to plan.md (2026-10-15)

### F2 — `skeleton-heights.mjs`: zła ścieżka, brak strony Plan, brak przepisu na seed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 — §4 i kryterium 2.5
- **Detail**: Plan odwołuje się do `scripts/skeleton-heights.mjs`, a skrypt istnieje tylko jako
  `context/archive/2026-10-14-ui-fact-rhythm/evidence/scripts/skeleton-heights.mjs`. Jego lista `PAGES` to
  `targets, planets, moon, nights, events, finder…` — bez `plan`, choć kryterium 2.5 mówi o „sześciu stronach”
  (szkielet `layout="plan"` jest najbardziej odrębny). Skrypt wymaga też `state-ui-fact.json` (zasianego użytkownika
  z pełnym planem) w katalogu nadrzędnym `outDir`, czego plan nie wspomina.
- **Fix**: Skopiować skrypt do `context/changes/ui-tonight-nav/evidence/scripts/`, dodać `plan` do `PAGES`, opisać
  w planie (i w evidence/README) jak przygotować storage state; kryterium 2.5 wskazać ten plik.
- **Decision**: ACCEPTED — applied to plan.md (2026-10-15)

### F3 — Układ współrzędnych `chip.left` w `scrollLeftFor` nieokreślony

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 2 — §2 „The component” (`subnav.ts`)
- **Detail**: Kontrakt `scrollLeftFor(chip: {left, width}, row: {width, scrollWidth})` nie mówi, względem czego jest
  `left`. Naturalny wybór `chip.offsetLeft` liczy się względem `offsetParent`, a wiersz (`overflow-x-auto`) nie jest
  pozycjonowany — offset wyjdzie względem dalszego przodka i centrowanie będzie przesunięte o padding/kontener
  (szczególnie przy „bleedzie” do krawędzi ekranu na telefonie). Testy jednostkowe czystej funkcji tego nie złapią;
  złapie najwyżej e2e przy 390 px, i to tylko dla dwóch stron.
- **Fix**: Zapisać w kontrakcie: `left` = pozycja chipa w treści wiersza (`chipRect.left - rowRect.left + row.scrollLeft`
  albo `offsetLeft` przy wierszu z `relative`).
- **Decision**: ACCEPTED — applied to plan.md (2026-10-15)

### F4 — Lokator chipa „Plan” w e2e dopasuje też „Planets”

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 2 — §5 E2E (`tonight-subnav.spec.ts`, „Clicking Plan from Targets”)
- **Detail**: `getByRole("link", { name })` w Playwright domyślnie dopasowuje podciąg bez rozróżniania wielkości liter.
  W sub-navie EN „Plan” ⊂ „Planets”, PL „Plan” ⊂ „Planety” — lokator bez `exact: true` trafi w dwa linki i padnie na
  strict mode (albo, z `.first()`, kliknie nie to, co trzeba przy innej kolejności).
- **Fix**: W kontrakcie e2e zapisać `exact: true` dla linków sub-navu (jak już robi `tonight-dashboard.spec.ts:90`).
- **Decision**: ACCEPTED — applied to plan.md (2026-10-15)

### F5 — Brief twierdzi, że Fazy 1 i 2 dotykają rozłącznych plików

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: plan-brief.md — „Architecture / Approach”; plan — „Implementation Approach”
- **Detail**: Obie fazy edytują `src/lib/navigation.ts`, `navigation.test.ts`, `en.ts` i `pl.ts` (Faza 1: Progress i
  `currentDestination`; Faza 2: `TONIGHT_NAV` i `tonight.subnav`). Plan mówi poprawnie, że fazy są niezależne
  logicznie, ale brief pisze „disjoint files” — przy równoległym uruchomieniu w osobnych worktree’ach dałoby to konflikt
  (do rozwiązania, ale nie zero).
- **Fix**: Zmienić zdanie w briefie na „niezależne; wspólne pliki: navigation.ts (+test) i komunikaty i18n”.
- **Decision**: ACCEPTED — applied to plan.md (2026-10-15)
