<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Quick navigation to Tonight's pages (ui-quick-nav)

- **Plan**: `context/changes/ui-quick-nav/plan.md`
- **Scope**: Full plan (PR #220, `feat/ui-quick-nav` @ 7c6d854, diff base `origin/main`)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-17
- **Reviewer**: herdr agent `reviewer` (Opus, high) + one Opus subagent (runtime: build, e2e, WebKit/Chromium probes)
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 2 warnings · 3 observations
- **change.md**: not touched (herdr reviewer mode: the lead flips `implementing` → `impl_reviewed`)

```
═══════════════════════════════════════════════════════════
  IMPLEMENTATION REVIEW: ui-quick-nav (M-4 S-10, #214)
  Scope: Full plan (phases 1-4)  |  Date: 2026-10-17
  Findings: 0 critical  2 warnings  3 observations
═══════════════════════════════════════════════════════════

  Plan Adherence        PASS    ✅
  Scope Discipline      PASS    ✅
  Safety & Quality      WARNING ⚠️   (F1, F2, F3)
  Architecture          PASS    ✅
  Pattern Consistency   PASS    ✅
  Success Criteria      WARNING ⚠️   (F4, F5)

  ► Overall: NEEDS ATTENTION
═══════════════════════════════════════════════════════════
```

## Podsumowanie

Implementacja jest wierna planowi i decyzjom właściciela: przycisk z siatką (`LayoutGrid`) przed pędzlem i suwakami,
wiersze ikona + nazwa + opis (EN+PL, 14 tekstów), widoczny tylko po zalogowaniu i poza `/onboarding` (`appNavVisible`
wspólne z TabBarem), arkusz od dołu poniżej `sm` i panel od 640 px, mniejsza nazwa „Sidereus” poniżej 360 px,
pigułka bez zawijania przy 768 px, wspólny moduł `ui/topbar-popover.ts` i wspólny helper `attachSheetSwipe` dla obu
arkuszy. Wszystkie automatyczne kryteria przechodzą, łącznie z całym pakietem e2e (63/63).

**Poprawka F1 z przeglądu planu działa**: w WebKit zarejestrowano dokładnie sekwencję `pointerdown → mousedown →
focusout (relatedTarget = null) → click → nawigacja`, czyli Safari wysyła `focusout` z pustym celem przed kliknięciem,
a strażnik `null` ratuje dotknięcie (mysz przy 1280 px i dotyk przy 390 px, Chromium i WebKit).

Do poprawy są dwie rzeczy w geście przesunięcia (F1: pierwszy `touchmove` w granicy 8 px jest anulowany, co na iOS
prawdopodobnie blokuje przewijanie listy; F2: dotknięcie w trakcie 200 ms animacji zamykania otwiera arkusz z powrotem
i może otworzyć stronę, której użytkownik nie wybrał) oraz trzy drobiazgi.

## Automated verification (re-run by this review)

| Command | Result |
| --- | --- |
| `npm run test:reference` | PASS: 108 files, 761 passed, 1 skipped |
| `npm run lint` | PASS (exit 0) |
| `npx astro check` | PASS: 0 errors, 0 warnings (2 hints in `scripts/lib/designations.mjs`, untouched) |
| `npm run test:guards` (incl. `no-hardcoded-colors`) | PASS: 14 files, 52 tests |
| `npm run build` | PASS (SW precaches 63 files) |
| `npx playwright test quick-nav sheet-swipe navigation tonight-subnav tonight-phone landing red-night-mode` | PASS: 12/12 (preview :4335, forecast fixture :4405, local Supabase) |
| `sheet-swipe.spec.ts --repeat-each=3` | PASS: 3/3 |
| whole e2e suite | PASS: 63/63 |

## Runtime probes (focus areas from the lead)

| Probe | Result |
| --- | --- |
| Safari F1: click/tap a row (WebKit 2203, 1280 px mouse and 390 px touch) | PASS: navigates; null-target `focusout` observed before `click` and ignored |
| Tab past the last row (1280 px) | PASS: focus to the theme button, panel closed, `aria-expanded="false"` |
| Shift+Tab from the first row | PASS: focus on the trigger, panel open; a second Shift+Tab leaves it open (F3) |
| Fit, PL, `/log` and `/tonight/targets` | 320: 288/288, 16 px gutter, wordmark 15 px · 359: 327/327, 16 px, 15 px · 360: 328/328, 16 px, 22 px · 375: 343/343, 16 px · 768: no overflow, pill → trigger gap 12 px, every label one line. Fallback font (Archivo blocked): no overflow at 320/359 |
| Themes (390 px, `/tonight/targets`, inside `.night-sky`) | PASS: light sheet `rgb(242,245,248)` = page `--surface` (not navy); dark and red match the page surface; current row readable in all three (red: fill + black text) |
| Placement | Sheet top 127 px at 320×568 and 403 px at 390×844, never over the Topbar (72 px); panel at 92 px top, right edge under the trigger at 1440 |
| One auto popover at a time, Esc | PASS: Settings closes the quick nav (`aria-expanded` back to `false`); Esc closes both and returns focus |
| Back after following a row | PASS (panel closed), but the probes saw `pageshow.persisted = false`: the `pagehide` close itself is unproven (F5) |
| `aria-current` exception | PASS: one `page` mark per Tonight page outside `[data-quick-nav]`, finder 0, documented in CLAUDE.md and the spec comment |
| Tokens only | PASS: guards 0 hits; only scale values (`size-4.5`, `py-1.5`, `translate-y-16` in a `/design` specimen), `--breakpoint-xs` instead of `max-[360px]:` |
| Test diet | PASS: one journey in `quick-nav.spec.ts`, one test in `sheet-swipe.spec.ts`, no new test in `navigation.spec.ts` (fit asserts folded in), `tonight-subnav.spec.ts` only rescoped; one check is vacuous (F4) |

## Findings

### F1 — The first `touchmove` inside the slop is cancelled, which can block the list's scroll on iOS

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/ui/sheet-swipe.ts:120-137` (`move` returns `dy >= 0`), `:166-169` (`onTouchMove`)
- **Detail**: Dotyk w ciele arkusza przewiniętym do góry uzbraja gest. Zanim gest stanie się przeciąganiem (próg 8 px),
  `move()` już zwraca `true` dla każdego ruchu w dół (`dy >= 0`), więc `onTouchMove` wywołuje `preventDefault()`.
  Syntetyczny `touchmove` +2 px w dół dostaje `defaultPrevented = true`, a ruch kontrolny w górę nie. Chromium
  tłumi `touchmove` w swojej strefie ~15 px (pierwszy doręczony ruch był 28 px od startu), więc e2e tego nie widzi.
  iOS Safari doręcza każdy `touchmove` i anulowanie pierwszego blokuje przewijanie przez cały dotyk. Palec, który
  drgnie 1-2 px w dół i potem przesuwa listę w górę, nie przewinie listy. Dzieje się to na niskim telefonie, gdzie
  lista się przewija. Tego nie da się potwierdzić bez iPhone'a: to ten sam ręczny punkt co 3.4. Dodatkowo przy
  320×568 lista się mieści (scrollHeight 360 = clientHeight 360), więc ruch w górę na arkuszu przewija stronę pod nim
  (`window.scrollY` 0 → 21): `overscroll-contain` nie zatrzymuje łańcucha, gdy kontener nie ma nadmiaru.
- **Fix A ⭐ Recommended**: anulować dopiero zajęty gest: `return gesture.dragging && dy >= 0;` (wewnątrz progu nic
  nie anulować), a ruch w górę w ciele dalej zwalnia gest.
  - Strength: drgnięcie w dół nie zabija przewijania listy. Uchwyt i tak ma `touch-none`, więc tam nic się nie zmienia.
  - Tradeoff: na iOS pierwszy nieanulowany ruch może rozpocząć „gumkę” listy, zanim gest zostanie zajęty. Ciało jest
    wtedy na górze, a `overscroll-contain` ogranicza efekt do samej listy.
  - Confidence: MED — wynik z syntetycznych zdarzeń. Zachowanie iOS przy anulowaniu późniejszych `touchmove` trzeba
    sprawdzić na urządzeniu.
  - Blind spot: brak prawdziwego iPhone'a w tej recenzji.
- **Fix B**: zostawić kod i dopisać do ręcznego punktu 3.4 jawny krok („zacznij przewijać listę z małym drgnięciem w
  dół na niskim ekranie”). Poprawiać dopiero, gdy błąd się pojawi.
  - Strength: zero zmian w kodzie przed testem na urządzeniu.
  - Tradeoff: ryzyko trafia do właściciela i na produkcję, jeśli punkt ręczny zostanie pominięty.
  - Confidence: MED — ten sam brak dowodu z urządzenia.
  - Blind spot: przewijanie strony pod arkuszem przy 320×568 zostaje w obu wariantach (osobna decyzja: blokada
    przewijania tła, poza zakresem planu).
- **Decision**: PENDING

### F2 — A touch during the 200 ms close animation reopens the sheet and can follow an unintended row

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/ui/sheet-swipe.ts:104-113` (`start` → `reset()`), `:60-86` (`settle`)
- **Detail**: Po długim przesunięciu arkusz zjeżdża przez 200 ms (`settling`). Nowy `touchstart` w tym czasie woła
  `start()` → `reset()`. To czyści timer `hidePopover()` i `translate`, więc arkusz wraca otwarty na miejsce, a
  nasłuch `transitionend` zostaje osierocony. Sonda przy 320×568: dotknięcie około 33 ms po puszczeniu otworzyło
  arkusz z powrotem, a kliknięcie trafiło w wiersz, który akurat był pod palcem. Przeglądarka przeszła do
  `/tonight/nights` i `/tonight/planets`, stron, których użytkownik nie wybrał. Przy `touchcancel` arkusz zostaje
  otwarty (`aria-expanded="true"`). Przypadek brzegowy, ale skutek to nawigacja bez zamiaru.
- **Fix**: podczas zamykania ignorować nowe dotknięcia i wskaźnik. W `onTouchStart` i `onPointerDown` wyjść, gdy
  zamknięcie jest w toku (flaga `closing` ustawiana w `close()`). W kliknięciu w fazie przechwytywania połykać
  klik, gdy `panel.dataset.sheetDrag === "settling"`. Jedna wartownia i jeden warunek w kliknięciu, bez zmiany progów.
- **Decision**: PENDING

### F3 — Shift+Tab out past the trigger leaves the panel open with `aria-expanded="true"`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/QuickNav.astro` (script, `panel.addEventListener("focusout", …)`)
- **Detail**: Plan zamyka panel, gdy fokus wyjdzie poza panel i przycisk, ale nasłuch jest tylko na panelu. Shift+Tab
  z pierwszego wiersza przenosi fokus na przycisk (poprawnie, panel otwarty). Drugi Shift+Tab idzie na link `/gear`
  w pigułce, a panel zostaje otwarty z `aria-expanded="true"` nad stroną. Esc i kliknięcie obok nadal go zamykają.
  APG tego nie wymaga, ale zachowanie jest niespójne z Tabem w przód.
- **Fix**: przenieść nasłuch `focusout` na `<nav data-quick-nav>` (obejmuje przycisk i panel) i zamykać, gdy
  `relatedTarget` jest węzłem spoza `nav`. Strażnik `null` (F1 z przeglądu planu) zostaje bez zmian.
- **Decision**: PENDING

### F4 — `sheet-swipe.spec.ts`: the "list scrolls, heading stays" check is vacuous at 320×568

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/e2e/sheet-swipe.spec.ts` (the `scrollTo({ top: body.scrollHeight })` block and the "heading does not scroll with the list" assert)
- **Detail**: Komentarz spec mówi, że to jedyna ochrona wymagania P2 B (lista przewija się w arkuszu, nagłówek stoi).
  Przy 320×568 lista się mieści (scrollHeight 360 = clientHeight 360): `scrollTo` nic nie robi, „Noce” jest widoczne
  od początku, a „nagłówek nie przesunął się” jest prawdą z definicji. Przewijana lista ani gest „z ciała przewiniętego
  do góry” po przewinięciu nie są tu naprawdę sprawdzane. Przy 320×480 lista się przewija (360 vs 327).
- **Fix**: w tym samym teście dodać `expect(scrollHeight).toBeGreaterThan(clientHeight)` po ustawieniu wysokości,
  przy której lista nie mieści się (np. 320×480), albo zmienić rozmiar okna tylko na ten krok. Bez nowego testu
  (rubryka diety).
- **Decision**: PENDING

### F5 — Manual checks pending; Phase 1 before/after screenshots missing; `pagehide` path unproven

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` Progress 1.5, 2.5-2.7, 3.4-3.5, 4.3-4.5; `context/changes/ui-quick-nav/evidence/impl/`
- **Detail**: Wszystkie punkty ręczne są `[ ]`, uczciwie odłożone w trybie autonomicznym, bez odhaczania na ślepo.
  Brakuje jednak plików `evidence/impl/phase1-*` (przed i po panelu ustawień), które 1.5 wymienia z nazwy. Brama
  zrzutów ma tylko stan „po” (`settings-*`). Zamknięcie na `pagehide` (F4 z przeglądu planu) jest w kodzie, ale sondy
  widziały `pageshow.persisted = false`, więc ścieżka bfcache nie została wykonana (strony SSR prawdopodobnie i tak
  nie trafiają do bfcache). Kosmetyka: w czerwonym motywie przy 320 px górna krawędź arkusza ledwo odcina się od
  tła i tylko pasek uchwytu ją zaznacza.
- **Fix**: lead zbiera punkty ręczne od właściciela (lista niżej). Brak `phase1-*` zastąpić porównaniem
  `settings-sheet-390-*` / `settings-panel-1440-*` z `main` albo odnotować w Progress, że 1.5 sprawdza się na
  zrzutach „po”.
- **Decision**: PENDING

## Owner items (manual, from Progress)

1. iPhone Safari (3.4): każdy arkusz podąża za palcem z uchwytu, wraca po krótkim ruchu, zamyka się po szybkim
   machnięciu. Lista przewija się bez ruszania arkusza (**w tym start przewijania z drgnięciem w dół, F1**), a ruch w
   dół z góry listy zamyka arkusz.
2. „Ogranicz ruch” (3.5): brak podążania, długie przesunięcie zamyka od razu.
3. VoiceOver na macOS Safari (2.7): punkt orientacyjny „Szybka nawigacja”, „Strony nocy, przycisk, zwinięty /
   rozwinięty”, lista, „bieżąca strona”, Esc wraca do przycisku.
4. Telefon PL/EN przy 320 i 375 px (2.5) oraz motywy na `/log` i stronie Tonight (2.6). Sondy potwierdziły liczby;
   zostaje ocena wzrokowa, w tym krawędź arkusza w czerwonym (F5).
5. `/design` (4.3), brama zrzutów vs makiety (4.4), reguła w CLAUDE.md czytana „świeżym okiem” (4.5).
