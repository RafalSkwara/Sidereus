<!-- PLAN-REVIEW-REPORT -->

# Plan Review: ui-quick-nav (M-4 S-10, #214)

- **Plan**: `context/changes/ui-quick-nav/plan.md` (branch `feat/ui-quick-nav`, d6a9903)
- **Date**: 2026-10-17
- **Reviewer**: herdr agent `reviewer` (Opus, medium)
- **Phases**: 3 · **Progress**: nothing done yet (all `- [ ]`)
- **Verdict**: **NEEDS ATTENTION** (drobne; poprawki w triage, bez ponownego `/10x-plan`)
- **Findings**: 0 critical · 3 warnings · 4 observations
- **change.md**: not touched (herdr reviewer mode: the lead flips `planned` → `plan_reviewed`)

```
═══════════════════════════════════════════════════════════
  PLAN REVIEW: Quick navigation to Tonight's pages (ui-quick-nav)
  Phases: 3  |  Date: 2026-10-17
  Findings: 0 critical  3 warnings  4 observations
═══════════════════════════════════════════════════════════

  Claim Accuracy        PASS    ✅
  Substance             PASS    ✅
  Feasibility           WARNING ⚠️   (F1, F4)
  Sequencing            PASS    ✅
  Architecture Fit      PASS    ✅
  Scope Discipline      PASS    ✅
  Verifiability         WARNING ⚠️   (F2, F3, F5)
  Coverage              PASS    ✅   (F6, F7 as observations)

  ► Overall: NEEDS ATTENTION
═══════════════════════════════════════════════════════════
```

## Podsumowanie

Plan jest dobry: twierdzenia o kodzie się zgadzają, kolejność faz jest sensowna (rebase na #212 → kontrakt bez zmian
wizualnych → komponent z testami najpierw → stany, zrzuty, reguła), a decyzje D1-D10 pasują do wymagań właściciela.
Jedyna realna pułapka to reguła „zamknij przy `focusout`" w skrypcie (F1), która w WebKit i przy dotknięciu
nieaktywnego miejsca panelu zamknie panel zanim link zadziała. Reszta to dopracowanie testów pod rubrykę diety i
dwie drobne luki.

## Sprawdzone twierdzenia (Claim Accuracy: PASS)

| Twierdzenie planu | Repo | Werdykt |
| --- | --- | --- |
| `TONIGHT_NAV` + `currentTonightPage` (dokładne dopasowanie ścieżki) | `src/lib/navigation.ts:56-74` | CONFIRMED |
| Reguła TabBar: zalogowany i nie `/onboarding` | `src/components/TabBar.astro:13` | CONFIRMED |
| Sub-nav to zwykłe ścieżki, bez `data-needs-network`; site/teleskop z ciasteczek | `TonightSubNav.astro:12-13,33-38` | CONFIRMED (ten sam wzór, tylko id w ciasteczkach, żadnych współrzędnych w URL) |
| Gołe ścieżki Tonight = zapamiętana strona offline | `copies.ts:150-162` (`tonightPageOf`, `siteIdOf`) | CONFIRMED |
| Panel ustawień: native `popover="auto"`, `data-theme`, `sm:top-23`, `right-topbar-edge` | `TopbarControls.tsx:55-61,192-213` (main); `:48-52` na #212 | CONFIRMED |
| Korzeń wyspy jest `display: contents` (jedna przerwa 8 px) | `<astro-island>` ma `display: contents`; korzeń React to `div.flex.gap-2` | CONFIRMED (to `astro-island`, nie div; efekt jak w planie) |
| `header nav` jako lokator pigułki | `navigation.spec.ts:16-19`, `tonight-subnav.spec.ts:24,40-41` | CONFIRMED |
| Reguła F6 „jedno `aria-current="page"` na stronę" przypięta w spec | `tonight-subnav.spec.ts:88-93,125` | CONFIRMED |
| #212: `SEGMENT_FOCUS_CLASS`, `--topbar-strip-height` (4.5 / 5.5 rem), `sky-mode-control` kopiuje motyw na `beforetoggle` | `origin/feat/ui-sky-modes` **d94bb65** (nie f6b8c97, patrz F6) | CONFIRMED — nazwy bez zmian |
| `nav.quickNav` nie istnieje; `tonight.subnav.label` istnieje | `en.ts` (grep) | CONFIRMED |
| Żadnej nazwy view-transition w menu | `global.css:444` (cross-document VT), nazwy tylko na pigułce/TabBar/chipie | CONFIRMED — plan słusznie nie dodaje nazw |
| Inne spece nie złapią ukrytych linków menu | spece używają `main a[href^=…]` lub `getByRole` (ukryty popover nie jest w drzewie a11y) | CONFIRMED |

## Komendy z Automated Verification

| Komenda | Rozwiązuje się? | Pierwsza linia |
| --- | --- | --- |
| `npm run test:reference` | tak | `Tests 760 passed \| 1 skipped (761)` |
| `npx playwright test --list navigation.spec.ts red-night-mode.spec.ts tonight-subnav.spec.ts tonight-phone.spec.ts landing.spec.ts` | tak | `Total: 10 tests in 5 files` (nie uruchamiane: wymagają preview + lokalnego Supabase) |
| `npm run lint`, `npx astro check`, `npm run test:e2e`, `npm run smoke` | skrypty istnieją w `package.json` | nie uruchamiane (lint OOM w worktree / wymagany serwer) |
| „The hardcoded-value scan" | **brak komendy** | patrz F5 |

## Findings

### F1 — Zamykanie na `focusout` zje kliknięcie w Safari i zamknie panel po dotknięciu nagłówka

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Feasibility
- **Location**: plan.md „Critical Implementation Details › Focus and the top layer"; Phase 2 › 3 (client script)
- **Detail**: Skrypt przenosi fokus do panelu przy otwarciu i zamyka go `hidePopover()` na `focusout`, ignorując tylko
  `relatedTarget` w panelu lub na przycisku. `relatedTarget === null` nie jest wykluczony, a `null` pojawia się w dwóch
  zwykłych sytuacjach: (1) dotknięcie / kliknięcie nieaktywnego miejsca panelu (nagłówek, uchwyt arkusza, odstęp
  między wierszami) przenosi fokus na `body`; (2) Safari (macOS i iOS) nie ustawia fokusu na linku przy kliknięciu
  myszą / dotknięciu, więc `mousedown` na innym wierszu zabiera fokus z wiersza ustawionego przy otwarciu → `focusout`
  z `null` → panel znika przed `click` → nawigacja nie następuje. E2E działa tylko w Chromium, więc tego nie złapie;
  wyszłoby dopiero w ręcznym kroku VoiceOver/iPhone.
- **Fix**: Zamykać na `focusout` tylko gdy `relatedTarget` jest elementem **poza** panelem i przyciskiem (`null` ignorować:
  wyjście „w nicość" obsługuje już light dismiss popovera), i zapisać to wprost w Critical Implementation Details.
  - Strength: Tab poza panel nadal zamyka (relatedTarget = następny przycisk), a kliknięcia poza panelem zamyka natywny light dismiss.
  - Tradeoff: Fokus może zostać „w panelu" po kliknięciu jego tła — panel zostaje otwarty, co jest oczekiwane.
  - Confidence: MED — zachowanie WebKit (brak fokusu na linkach przy kliknięciu) jest znane; nie odtworzone tu w przeglądarce.
  - Blind spot: Nie sprawdzono, czy WebKit już wspiera „popover invoker focus navigation" (patrz F7).
- **Decision**: PENDING

### F2 — Dieta testów: nowy test 320 px i powtórzone oznaczenia menu na sześciu stronach

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Verifiability
- **Location**: Phase 2 › 1 (`navigation.spec.ts`, `tonight-subnav.spec.ts`)
- **Detail**: (a) Plan dodaje **nowy** test 320×700 PL na `/log`, a istniejący „the TabBar's four Polish tabs fit a 320 px
  phone" (`navigation.spec.ts:35`) robi już dokładnie to samo ustawienie (onboarding, PL, 320×700, `/log`, fonty
  gotowe) — nowy test to druga rejestracja użytkownika i dodatkowy test w 56-testowym budżecie. (b) „On each focused
  page assert the quick nav's own mark is that page's row" powtarza to, co `quick-nav.spec.ts` już chroni
  (`aria-current` na Moon po nawigacji), a reguła jest jedna (`currentTonightPage`, już używana przez sub-nav). Lekcja
  „Name the risk a test is the only protection of" i test-plan §6/§7 (diet).
- **Fix**: Dopisać asercje szerokości nagłówka i 16 px marginesu do istniejącego testu 320 px (zmienić tytuł na „…tabs and
  the Topbar row fit…"), a w `tonight-subnav.spec.ts` tylko wykluczyć `[data-quick-nav]` z liczenia (z komentarzem
  o zmianie wymagań), bez nowych asercji na menu.
- **Decision**: PENDING

### F3 — Sprawdzenie 768/1024 „pigułka kończy się przed kontrolkami" przestanie widzieć nowy przycisk

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Verifiability
- **Location**: Phase 2 › 1 i 4; `tests/e2e/navigation.spec.ts:93-99`
- **Detail**: Test bierze pudełko kontrolek jako rodzica przycisku ustawień (`getByRole("button", { name:
  pl.nav.settings }).locator("..")`), czyli `div.flex.gap-2` wyspy. Po zmianie `QuickNav` stoi **przed** tym divem
  (w nowym wrapperze), więc nachodzenie pigułki na przycisk „Strony nocy" nie zostanie wykryte — a to dokładnie ryzyko
  przy ~6 px zapasu przy 768 px. Plan zmienia tylko lokator pigułki, nie to pudełko.
- **Fix**: Mierzyć do lewej krawędzi przycisku `[data-quick-nav-trigger]` (albo nowego wrappera klastra), a nie rodzica przycisku ustawień.
- **Decision**: PENDING

### F4 — Powrót „Wstecz" może przywrócić otwarty panel (bfcache)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Feasibility
- **Location**: Phase 2 › 3 (client script)
- **Detail**: Menu, w przeciwieństwie do panelu ustawień, prawie zawsze kończy się nawigacją. Przy powrocie z
  bfcache dokument wraca w stanie sprzed wyjścia, z popoverem `:popover-open` i fokusem w wierszu — użytkownik zobaczy
  otwarte menu nad stroną, z której przyszedł.
- **Fix**: W skrypcie `pagehide` → `hidePopover()` (lub zamknięcie przy kliknięciu wiersza), jedna linijka w Critical Implementation Details.
- **Decision**: PENDING

### F5 — „The hardcoded-value scan" nie ma komendy

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Verifiability
- **Location**: Phase 2 › Automated Verification (2.3)
- **Detail**: Wiersz 2.3 nie mówi, czym skanować. `no-hardcoded-colors.test.ts` jest teraz w projekcie `guards`
  (CI-only, `vitest.config.ts:39-53`), więc `npm run test:reference` z 2.4 go **nie** uruchamia.
- **Fix**: Wpisać konkretnie: `npm run test:guards` plus grep z `/10x-ui` (wzorzec z research „Pre-audit") na czterech plikach.
- **Decision**: PENDING

### F6 — #212 poszedł dalej niż f6b8c97 i dotyka 156 plików

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Coverage
- **Location**: plan.md nagłówek i „Open Risks › #212 overlap"
- **Detail**: Head #212 to teraz **d94bb65** (OPEN, MERGEABLE). Nazwy, na których stoi plan, są bez zmian
  (`SEGMENT_FOCUS_CLASS`, `--topbar-strip-height`, `right-topbar-edge`, `sm:top-23` w `panelClass`), ale #212 zmienia
  też `tests/e2e/helpers.ts`, `src/pages/design.astro` (+116), `TopbarControls.tsx` (stan ładowania języka) i auth.
  Konflikty dotkną Phase 3 (`/design`) i helperów e2e, nie tylko Phase 1. Plan słusznie każe robić rebase dopiero po
  merge'u.
- **Fix**: Zaktualizować sha w nagłówku na d94bb65 i dopisać `design.astro` + `helpers.ts` do listy nakładających się plików.
- **Decision**: PENDING

### F7 — Kolejność w DOM: panel bezpośrednio po przycisku

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Coverage
- **Location**: Critical Implementation Details › „its tab order follows the invoker"
- **Detail**: Plan opiera Tab z przycisku do panelu na „popover invoker focus navigation". Jeśli panel stoi w DOM
  zaraz po przycisku wewnątrz `<nav>`, kolejność Tab jest poprawna także w przeglądarce bez tej funkcji; jeśli gdzieś
  dalej (np. na końcu `<header>`), nie jest.
- **Fix**: Zapisać w kontrakcie Phase 2 › 3: `<nav>` > `<button>` + zaraz po nim `<div popover>`.
- **Decision**: PENDING

## Zakres zadania od orkiestratora (krótko)

- **a11y menu**: wzorzec disclosure navigation (nie `role="menu"`) jest właściwy dla linków; `aria-expanded` ustawiany
  ręcznie, Esc + powrót fokusu natywnie, landmark „Szybka nawigacja" odróżniony od sub-nava. Poprawki: F1, F4, F7.
- **Duplikaty `aria-current` / view-transition**: brak nazw VT w menu ✓; dodatkowe `aria-current="page"` (na
  dashboardzie i sześciu stronach) jest niewidoczne dla czytnika, dopóki panel jest zamknięty (popover zamknięty =
  `display: none`). Akceptuję D2 jako świadomą zmianę reguły F6, z wykluczeniem w spec i zapisem w `CLAUDE.md`.
- **Parametry site/telescope**: zwykłe ścieżki, wybór w ciasteczkach, tylko id — tak samo jak sub-nav i kafelki ✓.
- **Offline**: bez `data-needs-network`, zapisane kopie albo `/offline` ✓.
- **Telefon 320/360 PL**: budżet zmierzony (19 px przy D8), zrzut `topbar-320-pl-dark-recommended.png` się zgadza ✓; F2/F3 dotyczą testów.
- **Niezalogowani**: ukryte (D3) ✓.
- **#212**: patrz F6.
- **Tylko tokeny**: brak nowych kolorów, `--breakpoint-xs` i `topbar-panel-top` zamiast wartości arbitralnych ✓ (F5 dla weryfikacji).
- **Dieta testów**: F2.

## Pytania właściciela P1-P7 — moje zdanie

- **P1 (ikona)**: **A, Siatka.** Dwa księżyce obok siebie (B) to realne pomylenie z przyciskiem motywu; hamburger (D) obiecuje całe menu.
- **P2 (zawartość)**: **A, ikona + nazwa.** Opisy (B) dają 14 nowych tekstów i arkusz na cały mały ekran; nazwy są już znane z sub-nava.
- **P3 (na stronach Tonight)**: **A, wszędzie.** Właściciel napisał „z każdego ekranu"; znikający przycisk (B/C) przesuwa pasek między stronami. Podwójne oznaczenie strony jest niewidoczne, dopóki panel jest zamknięty.
- **P4 (niezalogowani)**: **A, ukryty.** Każda strona nocy wymaga logowania, a przy 320 px PL nie ma miejsca (353 px).
- **P5 (kolejność)**: **A, [Strony nocy][Motyw][Ustawienia].** Ustawienia zostają przy krawędzi, a komponent nie wchodzi do wyspy React (C by tego wymagało).
- **P6 (forma panelu)**: **A, arkusz od dołu / panel jak Ustawienia.** Zasięg kciuka i jeden wygląd obu paneli; B zostawia listę u góry ekranu telefonu.
- **P7 (miejsce przy 320 px)**: **A, mniejsza nazwa poniżej 360 px.** Zachowuje wszystkie 44 px i przycisk trybu czerwonego; B traci nazwę aplikacji, C ma 0 px zapasu, D łamie decyzję „czerwony jednym dotknięciem".
