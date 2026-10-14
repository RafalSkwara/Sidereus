<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Quieter per-item actions (ui-quiet-actions)

- **Plan**: `context/changes/ui-quiet-actions/plan.md`
- **Scope**: Full plan (fazy 1–3; w Fazie 3 czekają ręczne sprawdzenia właściciela 3.5 i 3.6)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 6 observations
- **Reviewer**: herdr agent „reviewer” (Opus) z dwoma podagentami Opus (zgodność z planem; bezpieczeństwo, jakość i wzorce)
- **Branch**: `feat/ui-refine`, baza 1389bc1. Commity wdrożenia: 2e2b903 (p1), 73d233d (p2), adea9d0 (p3), 70645ab (Progress). Do tego 40503e1 (ESLint pomija `context/**`).
- **change.md**: nie zmieniony. Orkiestrator pozwolił zapisać tylko ten plik, więc `status: impl_reviewed` zostaje dla orkiestratora lub właściciela.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F2) |
| Scope Discipline | WARNING (F4, nieszkodliwe) |
| Safety & Quality | WARNING (F3) |
| Architecture | PASS |
| Pattern Consistency | WARNING (F5, F6) |
| Success Criteria | WARNING (F1) |

**Kod zgadza się z planem w każdym punkcie.** Zastrzeżenia dotyczą procesu (kto i jak wykonał ręczne sprawdzenia), braków w dowodach oraz skryptów w `context/`. Szczegóły zgodności:
- **Wywołania `action`.** Przeniesiono wszystkie 12 wywołań produktowych w 10 plikach oraz te z `/design`, a `action` został usunięty z `buttonVariants`:
  - `hairline`/`sm`: Mark observed (`TargetDetails.astro:40`) i trzecia gałąź `/gear` Add (`gear/index.astro:97`);
  - `quiet`/`bare`: pozostałe, w tym BackLink, Pager, GearCard Manage, MoonCard, nagłówek /log, /log/progress, confirm-email i MilestoneCelebration.
- **Token `--control-border`** ma wartości w dark (`#646e8a`), light (`#808a9e`) i red (`#c80000`), nie ma go w `.night-sky`. Kontrasty wyliczone z hexów:

  | Motyw | tło | powierzchnia |
  |---|---|---|
  | dark | 3,90 | 3,68 |
  | light | 3,38 | 3,17 |
  | red | 3,42 | 3,33 |

  `contrast.test.ts` przypina je dla wszystkich trzech motywów. Helper czyta właściwe bloki: `[data-theme="red"]` scala się z dark, a `[data-theme="light"] .night-sky` nie przecieka do light. `primary-strong` ma ≥4,5 na tle, powierzchni, zenicie i horyzoncie w trzech motywach. Wartości graniczne: light zenit 4,90, red horyzont 4,89. Wiersze `action` zostały dla odpowiedzi sky-check i medalionu.
- **Podkreślenie w trybie red** (`@custom-variant red`, `global.css:18`) działa spoczynkowo na linkach `quiet`. Linki z podziękowaniami za dane (`Attribution.astro:12`, `onboarding.astro:29`) dostają `red:decoration-current`, a skompilowana kolejność CSS jest poprawna. Strażnik e2e (`red-night-mode.spec.ts`) jest solidny:
  - otwiera „Back to sign in” na `/auth/confirm-email` bez zalogowania;
  - szuka linku po roli i nazwie;
  - sprawdza wyliczone `textDecorationLine`: red → `underline`, dark → `none`;
  - najpierw upewnia się, że `data-theme` jest ustawione.
- **Offline.** Kreska została w `var(--border)` (decyzja właściciela F1). Reset koloru `svg` jest poza warstwami, więc wycisza ikonę hairline. Reguła poza warstwami zdejmuje też czerwone podkreślenie i podkreślenie przy najechaniu. Linki `quiet` mają obramowanie o szerokości 0, więc kreska się na nich nie pokazuje.
- **Wysokości.** Cele 44 px zostają: bazowe `min-h-11`, a `bare` nie ma `has-[>svg]:px-*`, więc konflikt twMerge z F9 planu nie występuje. Karty Gear mają tę samą wysokość: Manage ma 44 px tak jak wcześniej, więc `GEAR_CARD_MIN_HEIGHT_CLASS` i skeleton nadal pasują. `TILE_CUE_CLASS` zachowuje pudełko `size-6`, więc wiersz nagłówka kafelka ma tę samą wysokość.
- **`/design`.** Są oba nowe warianty w tabeli i w `sizeOf`, filtr fokusu, uwaga o disabled, okazy offline, polskie zawijanie, próbka koloru `control-border`, podkreślenie przy najechaniu na BackLink i Pager oraz przeniesione okazy Manage.
- **CLAUDE.md.** Reguła Clickables (`:101`) obejmuje każdy punkt kontraktu, a akapit Finder (`:17`) i Gear cards (`:103`) są zaktualizowane. Grep z 3.4 trafia już tylko na nazwę slotu `action` w `Band.astro:4` i `band.tsx:8`, co jest w porządku.
- **Brak regresji** w `SkyAnswerForm`, `RESTING_BORDER_CLASS` i medalionie. W `SkyCheckCard` zmieniono nazwę `quietAction` → `inlineAction`.

## Kryteria sukcesu (uruchomione w tym przeglądzie)

| Komenda | Wynik |
|---|---|
| `npm test` | ✅ 109 plików, 1950 passed, 1 skipped, 6 todo |
| `npx astro check` | ✅ 0 errors, 0 warnings, 0 hints |
| `npm run lint` (`eslint . --max-warnings 0`) | ✅ exit 0 |
| `grep -rn 'variant: "action"' src` | ✅ pusty |
| `grep -nE '\`action\`\|action link\|tinted\|bordered chip' CLAUDE.md src -r` | ✅ tylko slot `action` w `Band` |
| e2e (2.4, 3.2), smoke (3.3), `npm run build` | ⏸ nie uruchamiane ponownie: porty 4331/4401 należą do innych agentów, a build nadpisuje `dist/`. Opieram się na zapisach w Progress (73d233d, adea9d0). |

Ręczne: 1.5 i 2.6–2.8 są `[x]`, ale wykonał je agent (F1). 3.5 i 3.6 są `[ ]` i słusznie czekają na właściciela.

## Findings

### F1 — Ręczne sprawdzenia 1.5 i 2.6–2.8 odhaczone przez agenta; 2.7 nie wykonane tak, jak opisuje plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` Progress 1.5, 2.6, 2.7, 2.8; `context/changes/ui-quiet-actions/evidence/README.md` („Manual checks run by the agent”); `evidence/scripts/checks.mjs`
- **Detail**:
  - Plan każe po Fazie 1 i po Fazie 2 zatrzymać się na potwierdzenie przez człowieka. Wszystkie cztery punkty mają SHA adea9d0 i według README sprawdził je agent wdrażający.
  - Dowody są prawdziwe: wycinki `/design`, wyliczone kolory i obramowania, wysokości kart 136 i 148 px, Manage 44 px. Ale:
    - **2.7** zasymulowano ręcznie ustawionym `<html data-offline>` w `checks.mjs`, a plan wymaga zapisanej strony Tonight przy niedostępnym serwerze (zgodnie z lekcją „Make the server unreachable”).
    - **1.5** zrobiono tylko przy 1280 px, a plan wymaga też 390 px.
    - **2.8** nie ma pomiaru „przed”: wynik porównano z klasami `min-h`.
  - README to ujawnia, więc to nie ukrywanie, tylko rozjazd z procesem.
- **Fix**: Oznaczyć 1.5 i 2.6–2.8 w Progress jako „agent-verified, owner to confirm” i dołączyć je do przeglądu właściciela razem z 3.5 i 3.6. 2.7 powtórzyć na zapisanej stronie przy zamkniętym proxy (jak w `offline.spec.ts`) albo dodać do `offline.spec.ts` jedną asercję wyliczonego koloru ikony Mark observed.
- **Decision**: PENDING

### F2 — Luki w dowodach dla właściciela, m.in. brak wycinka F7 z /gear

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `context/changes/ui-quiet-actions/evidence/` (`after/`, `crops/`, `design/`, `README.md`); plan Faza 3.2
- **Detail**: Plan 3.2 wymaga wycinków par F7 w trybie red oraz ujęć `/design` i kilku stron. Jest:
  - para Targets (outline vs hairline) w red i light.
  - Brakuje:
    - wycinka pary z /gear (Add przy pustym paśmie, outline, obok Add przy paśmie z elementami, hairline); README odsyła do całej strony `after/gear-empty-phone-pl-red.jpg`;
    - ujęć `/design` dialogu milestone i okazów zdarzenia w VerdictCard (zrobiono button, back-link, pager, gear-row, tile i events-tile);
    - ujęć Nights i `/log/progress`;
    - ujęć desktop w dark.
  - Pełna macierz 180 ujęć powstała, ale nie jest w repo. Plan dopuszcza wybrany zestaw, więc to w porządku.
  - Sam README zauważa, że w trybie red hairline (`#c80000`) i outline (`#ff0000`) na /gear wyglądają „almost the same”. To właśnie ryzyko F7 z przeglądu planu, które właściciel ma ocenić w 3.6.
- **Fix**: Przed 3.5 i 3.6 dograć wycinek F7 z /gear i dwa brakujące ujęcia `/design` (skrypty `capture.mjs` i `design-sections.mjs` już to umieją), a resztę dopisać w README jako świadomie pominięte.
  - Strength: właściciel ocenia F7 na tym, o co prosił, a nie na całej stronie.
  - Tradeoff: potrzebny podgląd na 4331 (port agenta wdrażającego).
  - Confidence: HIGH: lista ujęć sprawdzona w katalogach `evidence/`.
  - Blind spot: czy właściciel ocenił już F7 na całej stronie.
- **Decision**: PENDING

### F3 — Skrypty seed nie pilnują lokalnego stacku, a teraz nie są lintowane

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `context/changes/ui-quiet-actions/evidence/scripts/seed.mjs:11-13`, `context/changes/ui-refine/evidence/seed.mjs:9-11`
- **Detail**:
  - Oba skrypty zakładają prawdziwe konto przez serwer pod `BASE_URL`. Kopia z ui-refine ma port 4331 na sztywno, bez możliwości nadpisania.
  - Według CLAUDE.md lokalne `.env` i `.dev.vars` wskazują na **hostowany** Supabase. Uruchomienie skryptu przeciw serwerowi dev, który nie stoi na lokalnym stacku, założy konta `…@example.com` na produkcji.
  - `--empty-eyepieces` pisze przez `process.env.SUPABASE_URL` bez sprawdzenia, czy to adres lokalny. Dla porównania `scripts/account-plan.mjs` odmawia adresu nielokalnego bez `--hosted`.
  - Kluczy, JWT ani prawdziwych adresów e-mail w skryptach nie ma. Nic w `src`, `tests` ani `scripts` ich nie importuje. Nie ma też zacommitowanych `state-*.json` ani `email-*.txt`.
- **Fix**: Na początku obu skryptów odmówić, gdy `SUPABASE_URL` nie wskazuje `127.0.0.1` ani `localhost`, oraz dodać komentarz „local stack only”. W kopii ui-refine honorować `BASE_URL`.
- **Decision**: PENDING

### F4 — `context/**` poza ESLint: bezpieczne, ale spoza planu

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `eslint.config.js:94-97` (commit 40503e1)
- **Detail**:
  - To globalny ignore: obiekt ma tylko `ignores`.
  - Jedyne pliki niebędące dokumentami w `context/` to sześć skryptów `.mjs` z dowodami. W archiwum nie ma skryptów.
  - Hook `end-of-turn.sh:87` i tak pomija `context/*`, a lint-staged używa `--no-warn-ignored`. Strażnik no-console skanuje tylko `src/`, a vitest bierze tylko `src/**/*.test.ts`.
  - `tsconfig.json` obejmuje `**/*`, więc przyszły plik `.ts` w `context/` byłby sprawdzany typami, ale nie lintowany. To akceptowalne, bo `context/` to dokumenty i dowody.
  - Zmiana nie jest częścią planu ui-quiet-actions, tylko chore ui-refine (skrypty dowodów psuły lint całego repo).
- **Fix**: Wspomnieć o tym w opisie PR. Ewentualnie dopisać zdanie do Tripwires w CLAUDE.md: „`context/` is docs and evidence; never product code”.
- **Decision**: PENDING

### F5 — Reguła „always with its lucide icon” ma drugi wyjątek, którego CLAUDE.md nie wymienia

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/tonight/MoonCard.astro:49-52`; `CLAUDE.md:101`
- **Detail**: Link „washed-out” w MoonCard (`quiet`/`bare`) ma tekstową strzałkę „→” zamiast ikony lucide. Nowa reguła Clickables zwalnia z ikony tylko Pager („labels carry their own arrows”).
- **Fix**: Dać ikonę lucide `ArrowRight` (`aria-hidden`) albo dopisać MoonCard do wyjątku w regule.
- **Decision**: PENDING

### F6 — Odstęp ikona–etykieta zależy od sposobu złożenia klas (6 px albo 8 px)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/ui/button.tsx` (baza `gap-2` + `bare` `gap-1.5`)
- **Detail**:
  - cva nie scala klas, więc do markupu trafiają oba odstępy.
  - Tam, gdzie jest `cn()` (BackLink, Pager, confirm-email, progress), wygrywa `gap-1.5` (6 px).
  - Tam, gdzie jest goły `class:list` (GearCard, TargetDetails, MoonCard, nagłówek /log, MilestoneCelebration), `.gap-2` stoi dalej w CSS i wygrywa (8 px).
  - Ten wzorzec istniał już przy `sm`. Mała, ale widoczna niespójność.
- **Fix**: W wywołaniach `quiet`/`bare` składać klasy przez `cn(buttonVariants(...))` albo przenieść `gap-2` z bazy do rozmiarów.
- **Decision**: PENDING

### F7 — Kilka zachowań z kontraktu nie ma automatycznego strażnika

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/e2e/red-night-mode.spec.ts`, `tests/e2e/offline.spec.ts`, `src/styles/global.css` (komentarz „never on a sky header”)
- **Detail**: Bez strażnika zostają trzy zachowania:
  - **Kolor podkreślenia linków z podziękowaniami w trybie red.** Powrót do `decoration-border` (#3a0000 na #080000, prawie niewidoczne) przeszedłby wszystkie testy.
  - **Zdejmowanie czerwonego podkreślenia offline.** Sprawdził to tylko ręczny `checks.mjs`.
  - **„Hairline nigdy na nagłówku z niebem”.** To tylko komentarz: `--control-border` nie ma wartości dla `.night-sky`, a na jasnym zenicie daje 1,92:1.
- **Fix**: Dodać w `red-night-mode.spec.ts` asercję `textDecorationColor` linku z `Attribution` (kolor = `color`). Asercję offline dołączyć do poprawki F1.
- **Decision**: PENDING

### F8 — Reset koloru `svg` offline ma szerszy zasięg niż kontrolki

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/styles/global.css:571-573`
- **Detail**:
  - `:root[data-offline] [data-needs-network] svg { color: inherit; }` nie ma, w odróżnieniu od reguły nad nim, ani `:not([aria-current="page"])`, ani zawężenia do `:is(a,button)`.
  - Obejmuje więc też ikonę bieżącej zakładki TabBar i chevron selecta w GearCard.
  - Sprawdziłem: dziś nic nie widać. Chevron dziedziczy wyciszony kolor z `<form data-needs-network>`, bo `GearSelectField` nie ustawia własnego koloru. `--primary` = `--heading` we wszystkich motywach, więc ikona TabBar też się nie zmienia.
  - Podagent zgłosił, że chevron rozjaśnia się offline. Po sprawdzeniu `native-select.tsx` i `GearCard.astro:59-66` to się nie potwierdza.
  - Drobiazg obok: na wyłączonym `<button>` hairline ikona zostaje w `text-primary-strong` (utility `[&_svg]:` wygrywa z `disabled:`). Widać to tylko w `/design`, bo nie ma produktowego hairline jako `<button>`.
- **Fix**: Zawęzić selektor do `:root[data-offline] :is(a,button)[data-needs-network]:not([aria-current="page"]) svg, :root[data-offline] [data-needs-network] :is(a,button) svg`, żeby zamiar był jawny.
- **Decision**: PENDING

### F9 — Ryzyko rebase'u i nakładanie się z adjustable-session-plan

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: branch `feat/ui-refine` vs main 8f2f8d2 oraz `feat/adjustable-session-plan`
- **Detail**:
  - **Main** od bazy 1389bc1 zmienił 10 plików, wszystkie w `context/` (archiwum sky-events, prd, roadmap, handoff). Zero wspólnych plików z tym branchem, więc rebase powinien przejść czysto.
  - **adjustable-session-plan** planuje zmiany w `CLAUDE.md`, `design.astro` i `en.ts`/`pl.ts`. Ten branch zmienia tam tylko regułę Clickables, sekcje przycisków `/design` i jeden komentarz w `en.ts:1054`, więc spodziewane są wyłącznie konflikty tekstowe.
  - Dwie rzeczy dla tamtego planu:
    - `quiet` stylizuje tylko `disabled:`, nie `aria-disabled`, więc przyciski Move z `aria-disabled` na krawędziach listy potrzebują własnego wyciszenia;
    - rozmiar `icon` istniał przed tą zmianą.
- **Fix**: Merge ui-quiet-actions przed Fazą 4 adjustable-session-plan (jej D15). Obie uwagi przekazać do triage'u przeglądu planu adjustable-session-plan (F7 tamtego raportu).
- **Decision**: PENDING

## Pytania do właściciela

1. **(F2, 3.6)** README dowodów zauważa, że w trybie red hairline (`#c80000`) i outline (`#ff0000`) na /gear wyglądają prawie tak samo. Czy przed oceną 3.6 chcesz wycinek pary z /gear (Add przy pustym i niepustym paśmie), czy ocenisz na pełnej stronie `after/gear-empty-phone-pl-red.jpg`?
2. **(F1)** Ręczne punkty 1.5 i 2.6–2.8 wykonał agent, a nie Ty. Czy potwierdzasz je razem z 3.5 i 3.6 przy przeglądzie zrzutów (rekomendacja), czy akceptujesz weryfikację agenta tak, jak jest?
