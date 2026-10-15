<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Grouped, icon-led facts with a spacing rhythm (ui-fact-rhythm)

- **Plan**: context/changes/ui-fact-rhythm/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-15
- **Verdict**: NEEDS ATTENTION → all findings applied 2026-10-15 (implementer)
- **Findings**: 0 critical, 6 warnings, 3 observations

Przegląd: reviewer (Opus) z trzema subagentami Opus (zgodność z planem; jakość, a11y i wzorce ze zrzutami ekranu; nakładanie się z S-08 i lokatory e2e). Gałąź `feat/ui-fact-rhythm`, HEAD 226605c, baza c650a8a. Kodu nie zmieniałem. `change.md` celowo nie jest ostemplowany `impl_reviewed`, bo orkiestrator pozwolił zapisać tylko ten plik. Zrobi to orkiestrator albo implementer.

**Ważne: gałąź nie jest wypchnięta do HEAD.** `origin/feat/ui-fact-rhythm` = 698ffa7 (Phase 1 SHA write-back). Commity a6187fe, 4f34ad2, d4340e0 i 226605c są tylko lokalne. Zgadza się to z `change.md` („Not pushed: waiting for the reviewer"), ale nie z briefem orkiestratora („pushed, head 226605c").

## Bramki uruchomione w tym przeglądzie (HEAD 226605c)

- `npx astro check`: 0 errors, 0 warnings, 0 hints.
- `npm run lint`: czysto.
- `npm test`: 110 plików, 1993 passed, 1 skipped, 6 todo. `rhythm-roles.test.ts` daje 43/43.
- `npm run build`: OK. `build-sw` precache'uje 50 plików.
- Skan wartości zakodowanych na sztywno z Fazy 3 (oraz SkyEventList i NightStrip): pusto.
- E2E na świeżym preview, na **wolnych portach 4351/4451** (zarezerwowanych nie ruszałem), lokalny Supabase, klucze inline. Specyfikacje: what-to-expect, planets-on-tonight, sky-events, seven-night-planner, tonight-phone, tonight-targets, moon-as-target, moon-card, telescope-selector, finder-chart, red-night-mode, tonight-dashboard. Wynik: **25 passed, 3 skipped, 0 failed**. Pominięte to warunki samych specyfikacji (okno bez ciemności, Księżyc nie jest celem, brak przyćmionych obiektów). Serwery zatrzymałem, a `dist/server/.dev.vars` usunąłem.
- Całego zestawu e2e i smoke nie powtarzałem. W `evidence/README.md` jest zapis 64/4/0 oraz zielony smoke.

## Decyzje właściciela: wszystkie dotrzymane w kodzie

- Role w `global.css:662-684`, tylko w `@theme inline`: line 0.5rem, group 1.5rem, item 1.25rem (20 px z każdej strony linii, razem 40 px). Overline 13/20 px, 600, 0.04em, wielkość liter jak w zdaniu. Nigdzie nie ma `uppercase`, kolor jest stonowany.
- `StatPair` to `grid gap-line`, jedna kolumna, bez `grid-cols-2` i bez `max-w`. Okno jest nad Najlepiej, karty mają pełną szerokość przy każdej szerokości. W rozwiniętym wierszu para dziedziczy `pl-10`.
- `StatCard` to `rounded-lg border border-border bg-surface`. W trybie czerwonym zostaje `--border: #3a0000`, bez nadpisań `red:`.
- Ikony faktów są stonowane. Wyjątki: Eye w `text-primary-strong`, ostrzeżenie bezpieczeństwa w `text-marginal`, ikona rodzaju zdarzenia w kolorze nagłówka.
- Mapa ikon: `src/components/ui/fact-icons.ts`. Jest jedna ikona Księżyca (`FACT_ICONS.moon` to ta sama ikona co zaćmienie Księżyca), Eye tylko dla „see”, znaczniki widoczności to CircleCheck i CircleSlash.
- Etykiety planet: Jasność, Średnica kątowa, Faza, Pierścienie (EN: Brightness, Apparent size, Phase, Rings). Wartości: „−1,9 mag”, „62%”, „nachylone o 7°”, „tilted 7°”.
- Szczegóły zdarzenia: jeden `Fact kind="measure"` na wpis, bez łączenia „ · ”.
- Brzmienie na stronie Nights odłożone (C5). `reasonText` się nie zmienił.
- Kontrakt treści (F5) jest dotrzymany:
  - zdania w `<p>`, wartości w `<span>`;
  - znaczniki `data-expect`, `data-event-visibility` i `data-event-note` na korzeniu `Fact`;
  - bez par okularów nie ma faktu o okularze;
  - `FactList` to `div` i nie renderuje się, gdy jest pusty;
  - wyspy nie importują `Fact*` ani `fact-icons`.
- Lokatory e2e z planu są nienaruszone. Pliku `tonight-phone.spec.ts` nikt nie edytował (pusty diff).

## Decyzje samego agenta

- **`py-item` na wierszach jednogrupowych** (NightStrip:34, wiersz przyćmiony w TargetsPageContent:276): **akceptuję**. Każdy wiersz stoi 40 px od następnego. Z `py-group` byłoby 48 px, czyli więcej niż między pełnymi pozycjami. Decyzja jest zapisana w D1.
- **Nowe układy szkieletu `nights`/`events` oraz liczba wierszy (Moon 3→1, Planets 4→7)**: **akceptuję jako uzasadnione**. Gałąź `plan` szkieletu jest nietknięta.
  - Kryterium z planu, „the skeleton swap without a jump”, nie jest jednak spełnione dosłownie. README zapisuje różnice do ok. 350 px (Targets −342 px przy 1280). Paski kart mają jednolite `h-14`, a prawdziwe karty Okno i Najlepiej mają ok. 58 i 78 px. Zob. F9.
  - Zmiana jest zapisana w `change.md`, ale nie w planie.
- **`cn()` nauczony ról** (`src/lib/utils.ts`, tailwind-merge 3.7.0): **akceptuję, naprawia realny błąd**. Bez tej zmiany `cn("text-overline", "text-muted-foreground")` gubi `text-overline`. Subagent zweryfikował łączenie skryptem:
  - `mt-line` z `mt-group` daje `mt-group`;
  - `mt-2` z `mt-line` daje `mt-line`;
  - `py-item` z `pt-0` zostawia obie klasy;
  - `scroll-mt-4` zostaje obok `mt-group`.

  Żadne wywołanie w zmienionych plikach nie polega na tym, że przetrwają dwie sprzeczne klasy odstępu.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Strażnik rytmu łatwo obejść

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/styles/rhythm-roles.test.ts:23-24, :76
- **Detail**: Wzorzec łapie `mt-4`, `space-y-3`, `gap-y-2`, `sm:mt-4`, `-mt-2`, `my-2` i `py-1.5`, także w `cn()`, `class:list` i w wariantach. Komentarze są poprawnie wygaszane. Strażnik ma jednak cztery luki:
  - (a) Lista dozwolonych sprawdza tylko obecność tokenu (`allowed.includes(token)`), nie liczbę wystąpień. Drugie `mt-0.5` w SkyEventList, drugie `py-4` w ObjectRow albo kolejne `py-2` w StatCard przejdą. Potwierdzone skryptem.
  - (b) Wzorzec wymaga `\d+`, więc przechodzą `mt-[13px]`, `py-(--x)`, `mt-px` oraz pionowy odstęp przez goły `gap-2` w `flex flex-col` lub `grid`. Żaden inny test nie zakazuje wartości arbitralnych. Reguła „no arbitrary values” w CLAUDE.md istnieje tylko jako proza.
  - (c) Przekonwertowany `TonightPageSkeleton.astro` nie jest pilnowany. Wciąż ma `mb-4` i `mt-5 … gap-y-2`, choć ma odzwierciedlać rytm wierszy.
  - (d) `TargetsPageContent` jest wyłączony celowo (S-08), zob. F6.
- **Fix A ⭐ Recommended**: Zamienić listę dozwolonych na mapę token→liczba (`{"mt-0.5": 1}`) i zgłaszać każde nadmiarowe użycie. Dodać do wzorca gałąź `-\[`, `-\(` i `-px` dla utility pionowych. Szkielet dodać do `GUARDED` z listą dozwolonych dla gałęzi `plan` i nagłówka.
  - Strength: strażnik naprawdę „gryzie” tak, jak obiecuje plan (F1, „A failing check beats a rule”). Wartości arbitralne zyskują test zamiast samej prozy.
  - Tradeoff: kilkanaście linii testu i listy dozwolonych do utrzymania. Gałąź `plan` szkieletu to plik S-08, więc lista dozwolonych musi uwzględnić jej kroki po rebase.
  - Confidence: HIGH — luki potwierdzone skryptem (scratchpad `rx.mjs`).
  - Blind spot: liczby wystąpień w gałęzi `plan` szkieletu po scaleniu S-08 trzeba zmierzyć dopiero po rebase.
- **Fix B**: Zostawić strażnika jak jest i dopisać jego granice (obecność zamiast liczby, bez wartości arbitralnych, szkielet niepilnowany) do nagłówka testu i do CLAUDE.md.
  - Strength: zero zmian w kodzie.
  - Tradeoff: luki zostają. Następny agent może dodać `mt-[13px]` w pilnowanym pliku i test będzie zielony.
  - Confidence: MED.
  - Blind spot: None significant.
- **Decision**: Fix A applied (owner, 2026-10-15). Allowlists are token→count maps; the pattern also rejects `px`, `[…]` and `(…)` vertical values and a bare `gap-*` in a `flex-col`/`grid` class string; `TonightPageSkeleton.astro` is guarded (header and S-08's `plan` branch allowlisted, to re-measure after the rebase). Break check: a second `mt-0.5` in Fact, `mt-[13px]` in PlanetCard and `flex flex-col gap-2` in NightStrip all went red with file:line, then restored (evidence README).

### F2 — Ikona `Diameter` wygląda jak „Niewidoczne” (CircleSlash)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/fact-icons.ts:68 (`size: Diameter`) i :98 (`notVisible: CircleSlash`)
- **Detail**: Przy 16 px lucide `Diameter` to przekreślone koło, prawie nie do odróżnienia od `CircleSlash`, czyli znacznika „Niewidoczne”. Widać to w `evidence/crops/planet-after-red.jpg` przy „Apparent size 34″” i w `evidence/after/planets-narrow-pl-dark.jpg` przy „Średnica kątowa”: czyta się jak znak zakazu albo „niewidoczne” obok planety, która jest widoczna. Reguła „jedna ikona = jedno pojęcie” (F7) formalnie obowiązuje, bo to różne glify, ale wizualnie jest złamana. To decyzja UI, więc należy do właściciela.
- **Fix**: Wymienić glif rozmiaru na jednoznaczny, np. `MoveHorizontal` albo `Scan`. `Ruler` jest zajęty przez `measure`. Potem ponownie zrobić zrzut `c-fact-icons` i kropy planety.
  - Strength: znika fałszywy sygnał „niewidoczne” na stronie, którą właściciel ogląda najczęściej. Zmiana jednej linii mapy.
  - Tradeoff: nowy glif musi przejść ocenę właściciela, a zrzuty `/design` trzeba odświeżyć.
  - Confidence: HIGH — podobieństwo widać na zrzutach.
  - Blind spot: którą alternatywę właściciel uzna za czytelną.
- **Decision**: Owner: `MoveHorizontal` replaces `Diameter` for the size fact (`fact-icons.ts`); planet crops recaptured.

### F3 — Asercja „nie wylewa się” w e2e pary statystyk praktycznie nie może się nie powieść

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/e2e/what-to-expect.spec.ts:126-139 i :146-154
- **Detail**:
  - `fits` (`scrollWidth <= clientWidth` na każdym `dt`/`dd`) jest prawie zawsze prawdziwe. `StatPair` to `grid` z niejawną kolumną `auto`, więc nierozerwalna wartość poszerzyłaby kartę poza `dl`, a nie wylała się z własnego `dd`. Region przewija się, więc test szerokości dokumentu też tego nie złapie. Realnie chroni tylko `oneLine`: przy `grid-cols-2` zrobił się czerwony, co pokazuje break check w README.
  - Polska asercja `/\p{L}:\S/u` wymaga tylko `facts.length > 0`, a fakt „why” jest zawsze. Gdyby nie wyrenderowała się para okularów, test przejdzie, nic nie sprawdzając.
- **Fix**: Dodać `dl.scrollWidth <= dl.clientWidth` (albo porównać prawą krawędź każdej karty z krawędzią wiersza). W polskiej części sprawdzić, że któryś fakt zawiera `pl.tonight.object.findWith`.
- **Decision**: Applied. The 320 px test adds `dl.scrollWidth <= clientWidth`, at least two cards, and each card's right edge within the row region's inner right; the Polish part requires an eyepiece fact containing `findWith`. Break checks: `min-w-96` on ObjectRow's body → red on the card-edge assertion; no eyepiece fact → red on the Polish assertion; both restored.

### F4 — Plan nie nadąża za zmianą właściciela z 2026-10-15 ani za kodem

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/ui-fact-rhythm/plan.md:154, :271, :322, :325, :355, :410, :417, :677, :854, :121-122, :814
- **Detail**: Kod odpowiada decyzjom, ale tekst planu im przeczy:
  - Faza 1 §1 podaje `--spacing-item: 2.5rem`.
  - §4 mówi „side by side” i `grid grid-cols-2 gap-3 sm:max-w-md`.
  - §6 mówi „the desktop cap”.
  - Kryteria :410, :417 i Progress 1.5 mówią o „40 px” i „capped on desktop”.
  - W D3 zostało zdanie o rozciąganiu karty Okno.
  - W Fazie 4 Intent jest „rows use the group role”, a kontrakt mówi `py-item`.
  - Notatka o S-08 („S-08 to narrow… goes red”, :121-122, :814) jest nieaktualna. S-08 39f3f1c już zawęził spec do `li[data-object-card]`.
  - Niezapisane odstępstwa: `SeenTag` ma dozwolone `py-0.5` (rhythm-roles.test.ts:44, plan mówi „none”), MoonCard ma wrapper `<div class="space-y-line">` (:52), są też nowe układy szkieletu.
- **Fix**: Jedna aktualizacja planu: przekreślić albo zaktualizować te linie, a w Decisions dopisać addendum z SeenTag `py-0.5`, wrapperem MoonCard i układami szkieletu `nights`/`events`.
- **Decision**: Applied. Superseded plan lines struck through or annotated, S-08 notes marked done (39f3f1c), and a Decisions addendum records SeenTag `py-0.5`, the MoonCard wrapper, the skeleton layouts, Progress 1.5's title and the F2 icon.

### F5 — CLAUDE.md sam sobie przeczy w sprawie wyjątku pudełkowego

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md:103 (oraz :99)
- **Detail**:
  - Linia 103 wciąż mówi „**Gear cards** … are the one deliberate boxed exception”, a ten sam punkt dalej dodaje „stat cards … are the second deliberate boxed exception”. Następny agent dostanie sprzeczną regułę.
  - Linia 99 mówi o „two icon exceptions”. To prawda dla ikon `Fact`, ale ikona rodzaju zdarzenia też zostaje w kolorze nagłówka (D4), więc sformułowanie można odczytać jako obejmujące wszystkie ikony.
- **Fix**: Zmienić „the one deliberate boxed exception” na „the first of two deliberate boxed exceptions”, a w :99 dopisać „(of Fact icons; the event kind icon keeps heading ink)”.
- **Decision**: Applied. CLAUDE.md: gear cards are "the first of two deliberate boxed exceptions"; the icon exceptions are scoped to `Fact` icons (the event kind icon keeps heading ink). The guard's new rules and `fact-islands.test.ts` are named there too.

### F6 — Rebase na S-08: zły wybór w jedynym realnym konflikcie przejdzie po cichu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/components/tonight/TargetsPageContent.astro:276; src/components/tonight/TonightPageSkeleton.astro (komentarz nagłówka)
- **Detail**: `git merge-tree` HEAD z `origin/feat/adjustable-session-plan` (39f3f1c) pokazuje tylko 2 konflikty tekstowe w 12 wspólnych plikach.
  - (1) Klasa wiersza przyćmionego: HEAD `… py-item` kontra S-08 `… scroll-mt-4 … py-3`. Poprawny wynik to `flex min-h-11 scroll-mt-4 items-center gap-3 py-item`. Plik nie jest pilnowany, więc wzięcie którejkolwiek strony w całości zostawi zielone CI: `py-3` przejdzie, a brak `scroll-mt-4` zmieni tylko przesunięcie przewijania.
  - (2) Komentarz nagłówka szkieletu: zachować zdanie S-08 o `plan` i dopisać zdania o `nights`/`events`. Unia typu `"rows" | "plan" | "nights" | "events"` scala się sama.
  - Pozostałe pliki scalają się czysto:
    - `ObjectRow` zachowuje `id`/`scroll-mt-4`, a `ObjectCard` zachowuje `data-object-card`;
    - klucze i18n i sekcje `/design` z obu stron;
    - CLAUDE.md;
    - `what-to-expect.spec.ts`: zawężenie z S-08 i nowe asercje tej gałęzi współistnieją.
  - Strażnik na scalonym drzewie: 14/14 plików zielonych.
- **Fix A ⭐ Recommended**: S-08 scala się pierwszy, potem rebase tej gałęzi z dwiema rozdzielczościami powyżej. Po rebase uruchomić `rg -n 'min-h-11 scroll-mt-4 items-center gap-3 py-item' src/components/tonight/TargetsPageContent.astro`, potem `npm test`, `astro check` oraz e2e: what-to-expect, tonight-targets, tonight-sky, tonight-phone i session-plan-edit.
  - Strength: zgodne z planem („Critical Implementation Details → S-08 rebase”). Konflikt jest mały i znany co do linii.
  - Tradeoff: ręczny krok weryfikacji, bo żaden test nie zauważy złej rozdzielczości.
  - Confidence: HIGH — merge-tree wykonany na aktualnych głowicach.
  - Blind spot: pełnego `npm test` ani `astro check` na scalonym drzewie nie uruchomiono, bo eksport kopii był zablokowany.
- **Fix B**: Dodać `TargetsPageContent` do strażnika z listą dozwolonych dla jego kroków spoza zakresu (`:150`, `:207`, `:221`, `:241`).
  - Strength: zła rozdzielczość (`py-3`) robi się czerwona.
  - Tradeoff: lista dozwolonych dla kodu spoza zakresu, który S-08 też edytuje, czyli więcej tarcia przy rebase.
  - Confidence: MED.
  - Blind spot: liczba kroków po scaleniu S-08.
- **Decision**: Fix A (owner): S-08 (#165) merged first; this branch rebases with the two resolutions (washed-out row `flex min-h-11 scroll-mt-4 items-center gap-3 py-item`, the skeleton comment kept from both sides), checked by `rg`, then the whole e2e suite and smoke before the PR.

### F7 — Ramka „Targets expanded row” w /design nie odwzorowuje już wiersza

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/design.astro:1793
- **Detail**: Ramka ma `pb-5 pl-10`, a prawdziwy `ObjectRow.astro:64` ma `pb-item pl-10`. Dziś to te same 20 px, ale specimen rozjedzie się przy następnej zmianie roli.
- **Fix**: `pb-5` → `pb-item` w ramce.
- **Decision**: Applied: the frame is `pb-item pl-10`.

### F8 — Stan Progress i dowodów niespójny z change.md

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md:880, :892 (Progress 3.5, 4.4); evidence/README.md:3
- **Detail**:
  - `change.md` mówi „Manual checks 3.5, 4.4 done by the agent with screenshots”, a w Progress oba punkty są `[ ]`. Zrzuty istnieją (`after/`, `crops/`) i subagent je obejrzał:
    - pary statystyk są ułożone jedna pod drugą;
    - Eye ma akcent;
    - w trybie czerwonym widać słabą ramkę;
    - nadkreślenia są czytelne;
    - nic się nie przelewa przy 320 px, także po polsku.
  - README podaje zrzut na „`feat/ui-refine` (head 4f34ad2)”. Gałąź nazywa się `feat/ui-fact-rhythm`. Po 4f34ad2 zmieniły się tylko komentarz w PlanetCard i liczba wierszy szkieletu, więc zrzuty widoków są aktualne.
  - 5.4 (akceptacja właściciela) czeka, i słusznie.
- **Fix**: Zaznaczyć 3.5 i 4.4 jako `[x]` z SHA, jeśli agent uznaje je za zrobione. Poprawić nazwę gałęzi w README.
- **Decision**: Applied: Progress 3.5 and 4.4 ticked with d4340e0 (the agent's screenshot checks; 5.4 stays with the owner); README names `feat/ui-fact-rhythm`.

### F9 — Drobne: skok szkieletu, FactList, strażnik wysp, próbki nocy

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/tonight/TonightPageSkeleton.astro; src/components/ui/FactList.astro:16; src/components/design/night-samples.ts:16
- **Detail**:
  - (a) Szkielet ląduje do ok. 350 px od strony (README). Kryterium „without a jump” z Fazy 3 jest spełnione tylko częściowo. Paski kart mają jednolite `h-14`, a prawdziwe karty Okno i Najlepiej mają ok. 58 i 78 px.
  - (b) `FactList` renderuje slot dwa razy, co jest nieszkodliwe. Komentarz HTML albo `&nbsp;` wśród dzieci uczyniłby listę „niepustą”, ale dziś to nie występuje.
  - (c) Zakaz importu `Fact*` i `fact-icons` w wyspach istnieje tylko w komentarzu. Dziś jest dotrzymany.
  - (d) `night-samples.ts` wpisuje `THRESHOLD_DEG = -18` zamiast stałej z `parameters.ts`. To plik tylko dla `/design`.
- **Fix**: (a) Drugi pasek karty wyższy (Best z linią `sub`), a różnicę skoku zapisać w README dla oceny właściciela. (b) Jedna linia w komentarzu `FactList`: dziećmi są tylko `Fact` albo warunki. (c) i (d) Opcjonalnie: dopisać zakaz do istniejącego strażnika importów i użyć stałej.
- **Decision**: (a) Owner: skeletons matched to the new layout before the PR: default rows mirror a target row (stat cards 58/78 px, facts, actions), row counts per page (Targets 5, Planets 5, Moon 0, Finder 2); measured before/after in the evidence README (every page within 76 px except the finder at +129/−295, from −923/−1267). (b) FactList's comment says its children are only Facts or conditionals. (c) `src/components/ui/fact-islands.test.ts` keeps Fact*, StatCard/StatPair and fact-icons out of MoonTimeSlider, TonightSkyView and `src/lib/sky-view/`. (d) night-samples uses `darknessThresholdDegForBortle(4)`.
