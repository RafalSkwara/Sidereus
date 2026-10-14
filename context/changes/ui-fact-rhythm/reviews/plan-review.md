<!-- PLAN-REVIEW-REPORT -->
# Plan review: ui-fact-rhythm

- **Plan**: `context/changes/ui-fact-rhythm/plan.md` (commit 4c7e8d6 na main c650a8a, branch `feat/ui-fact-rhythm`, lokalny)
- **Data**: 2026-10-14
- **Recenzent**: herdr agent „reviewer” (Opus); subagenty Opus: weryfikacja twierdzeń oraz wykonalność/sekwencja/architektura
- **Fazy**: 5
- **Werdykt**: NEEDS ATTENTION. Kierunek i kolejność faz są dobre. Do poprawki przy triage: guard rytmu (Faza 5) jest czerwony na kodzie, który plan sam przepisuje; para kart przy 320 px w rozwijanym wierszu jest niesprawdzona; notatka o S-08 jest nieaktualna. Nie trzeba ponownego `/10x-plan`.
- **Ustalenia**: 0 krytycznych, 8 ostrzeżeń, 2 obserwacje
- **Status change.md**: nie zmieniony. Orkiestrator pozwolił zapisać tylko ten plik, więc `planned` → `plan_reviewed` pozostaje dla orkiestratora.
- **Założenie**: plan oceniony na domyślnych D1-D8; wpływ innych odpowiedzi właściciela opisuje sekcja „Wrażliwość na D1-D8”.

## Verdicts

| Wymiar | Werdykt | Ustalenia |
|---|---|---|
| Claim Accuracy | WARNING ⚠️ | F4, F5, F7 (oraz drobne w F10) |
| Substance | WARNING ⚠️ | F5 |
| Feasibility | WARNING ⚠️ | F2, F3 |
| Sequencing | PASS ✅ | (F10: uwaga o commitach 2/3) |
| Architecture Fit | WARNING ⚠️ | F7 |
| Scope Discipline | PASS ✅ | |
| Verifiability | FAIL ❌ | F1, F6 |
| Coverage | WARNING ⚠️ | F8, F10 |

## Sprawdzenie komend „Automated Verification”

| Komenda | Rozwiązuje się? | Uwagi |
|---|---|---|
| `npx vitest related src/styles/global.css src/lib/ui/fact-icons.ts …SkyEventList.astro …design.astro --run` (1.1) | tak | „No test files found, exiting with code 0”: przechodzi bez uruchomienia ani jednego testu. Guardy kolorów, red i kontrastu czytają pliki przez `readFileSync`, więc `related` ich nie znajduje; realnie chroni tylko `npm test`. To samo dotyczy 3.1 i 4.1 dla plików `.astro`. |
| `npx vitest related en.ts pl.ts format.ts --run` (2.1) | tak | 28 plików, 482 testy zielone |
| `npx playwright test --list <specy z Faz 3 i 4>` | tak | 18 plików, 46 testów. `offline` łapie też `finder-offline`, a `observation-log` łapie też `observation-log-management`. |
| `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`, `npm run smoke` | skrypty istnieją | Build i e2e nie uruchomione: build pisze `dist/` używane przez preview na 4331, a e2e potrzebuje serwerów, których nie wolno ruszać. |
| 3.4 „hardcoded-value scan” | brak komendy | Zob. F6 |
| 1.3 grep zbudowanego CSS | uruchamialne | Mało dowodzi: Tailwind v4 skanuje też `context/**/*.md` (F6) |

## Delegacja a reguła właściciela

| Faza | W planie | Ocena |
|---|---|---|
| 1. Tokeny, komponenty, `/design`, przeniesienie ikon | Opus high | OK |
| 2. Copy, `format.ts`, `build.test` | Sonnet high | OK (kod nie-UI) |
| 3. Widoki i asercje e2e | Opus high; capture Sonnet medium; ocena w sesji głównej | OK |
| 4. Events i Nights | Opus high; capture Sonnet medium | Brakuje linii „ocena zrzutów: sesja główna” (jest w Fazie 3) |
| 5. Guard | Sonnet high | OK, o ile allowlista jest wyliczona w planie (F1). Jeśli Sonnet ma sam rozstrzygać, która przerwa jest „rytmem pionowym”, to jest to osąd UI, czyli Opus. |
| 5. CLAUDE.md i komentarze | Sonnet medium | OK |
| 5. README dowodów | brak przypisania | Dopisać Sonnet medium |

Haiku nigdzie nie robi kodu. Każdy brief ma prefiks `nvm use`, zakaz źródeł z sieci, porty 4331/4401, klucze inline i zakaz `test:db`.

## Findings

### F1 — Guard rytmu jest czerwony na kodzie, który plan przepisuje

- **Severity**: ⚠️ WARNING (Verifiability FAIL)
- **Impact**: 🔎 MEDIUM — wymaga przemyślenia, nietrywialna edycja planu
- **Dimension**: Verifiability
- **Location**: plan.md „Phase 5 › 1. Rhythm guard”; kryterium 3.4
- **Detail**:
  - **Brak granicy wzorca.** Wzorzec `(m|p)(t|b|y)-<n>` (z `\b`, jak w `no-hardcoded-colors.test.ts`) dopasowuje `mt-4` wewnątrz `scroll-mt-4`. Ta klasa jest już w `ObjectCard.astro:38` i `PlanetCard.astro:29`, a S-08 dodaje ją do `ObjectRow`.
  - **Klasy przepisane przez sam plan** łapie wzorzec, a allowlista ich nie zawiera: `first:pt-0 last:pb-0` (Faza 3 §3/§4) oraz `gap-y-2` w rzędzie akcji (`TargetDetails.astro:63`, „keeping its `gap-x-5 gap-y-2`”).
  - **Klasy zostawione „bez zmian”** w plikach objętych guardem:
    - `SkyEventList`: `gap-3` (66), `mt-0.5` (68, ikona rodzaju), `space-y-1.5` (71), `gap-y-1` (72), `gap-1` (83, 91);
    - `NightStrip:61`: `gap-2` w nagłówku;
    - `MoonCard:69`: `<p class="mt-3">` wokół NotSeenMark, którego plan nigdzie nie wspomina;
    - `gap-2` w samym `Fact`;
    - `gap-1.5` w `<dt>` StatCard (experiment.diff).
  - **Wyjątek nie do zapisania wzorcem.** „Horizontal and `gap-3` grid gaps where they are not vertical rhythm” nie da się rozstrzygnąć wyrażeniem regularnym. Skończy się na ręcznym rozstrzyganiu w trakcie implementacji.
  - **Za wąski zakres.** Pomija `SolarSystemSection` i `SeenTag` (`mt-3`, w spisie 15 plików z research). Zdanie „a guard test stops the view family” jest więc na wyrost.
  - **Kryterium 3.4** („only py-4 and icon alignment in ui/ remain”) jest fałszywe z tych samych powodów.
- **Fix**: dopisać w planie konkretny wzorzec i listę wyjątków per plik.
  - Wzorzec, np. `(?<![\w-])-?(?:[a-z0-9-]+:)*(?:(?:m|p)[tby]?|space-y|gap-y)-\d+(?:\.\d+)?(?![\w.])`. Pomija `scroll-mt-*`, łapie warianty i ujemne marginesy, a gołe `gap-<n>` (poziome w wierszu flex) zostawia.
  - Klasy o wartości 8 px zamienić na role: `gap-y-2` → `gap-y-line`, `gap-2` w NightStrip → `gap-line`, `space-y-1.5` w nagłówku zdarzenia → `space-y-line` lub wyjątek.
  - Wyjątki per plik: `first:pt-0`/`last:pb-0`, `py-4` w ObjectRow, `py-2`/`mt-0.5` w StatCard, `mt-0.5` w Fact i przy ikonie rodzaju zdarzenia.
  - Dodać `SolarSystemSection` i `SeenTag`, a MoonCard `mt-3` przenieść na rolę.
  - Opcjonalnie wprowadzić guard już pod koniec Fazy 1 z kurczącą się allowlistą, żeby chronił Fazy 3-4 w trakcie pisania.
  - Strength: guard przechodzi od pierwszego uruchomienia, a Sonnet nie musi podejmować decyzji UI.
  - Tradeoff: kilka linii planu więcej.
  - Confidence: HIGH, bo wszystkie klasy zostały wygrepowane na HEAD.
  - Blind spot: dokładne klasy wewnętrzne nowych komponentów ustali dopiero Faza 1.
- **Decision**: ACCEPTED, applied: the reviewer's pattern, per-file allowlists and zero values exempt; SolarSystemSection and SeenTag guarded; the guard starts in Phase 1 and grows per phase (plan: Phase 1 §7, Phase 3 §7, Phase 4 §3, Phase 5 §1).

### F2 — Para kart przy 320 px w rozwijanym wierszu: niesprawdzona i prawdopodobnie się łamie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — wymaga przemyślenia, prawdziwy kompromis
- **Dimension**: Feasibility (phone first)
- **Location**: plan.md „Phase 3 › 3. Rows”, D3, Testing Strategy
- **Detail**:
  - **Szerokość.** `ObjectRow` siedzi w regionie `max-h-128 … rounded-lg border px-3 py-1` (`TargetsPageContent.astro:246`). Przy 320 px: 288 − 26 (ramka i padding regionu) − 40 (`pl-10`) − 12 (`gap-3`) = 210, czyli 105 na kartę i **około 79 px na tekst** po ramce i `px-3` karty. W czołowej piątce (`ObjectCard`) jest około 112 px.
  - **Co się nie mieści.** „20:51–07:10” w `font-mono text-body` (16 px, semibold, cyfry tabelaryczne) to około 88-95 px, więc łamie się po półpauzie. „Widoczność” z ikoną 14 px i odstępem to około 85 px; jednego słowa nie da się złamać, więc wchodzi na padding.
  - **Dlaczego nic tego nie złapie.**
    - `tonight-phone.spec.ts:119-145` mierzy tylko `documentElement.scrollWidth`, przy zamkniętych wierszach, a `overflow-y-auto` regionu i tak obcina oś x.
    - `capture.mjs` robi zrzuty tylko przy 390 i 1280 px i nie otwiera wierszy.
    - Kolumna 320 px w `/design` jest szersza niż realna treść: 288 px dla karty, 222 px dla wiersza.
    - Eksperyment nie uchwycił otwartego wiersza przy 320 px.
- **Fix**:
  - Dodać specimen `/design` w szerokości wnętrza wiersza (około 222 px).
  - Rozszerzyć test 320 px w `what-to-expect.spec.ts:82-120` (otwiera wiersz) o `scrollWidth <= clientWidth` dla każdego `dt`/`dd` pary.
  - Rozstrzygnąć w planie wariant awaryjny dla wiersza: wartość w `text-label`, `px-2.5`, albo para bez wcięcia `pl-10`.
  - Strength: łapie ryzyko, które brief nazywa „main risk”, zanim powstanie kod.
  - Tradeoff: jeden specimen i jedna asercja więcej.
  - Confidence: MED, bo szerokości glifów Archivo są oszacowane (±10%).
  - Blind spot: nie zmierzone w przeglądarce, bo serwerów nie wolno było uruchamiać.
- **Decision**: OWNER (2026-10-14): measure first. Phase 1 builds the pair on its /design specimen in a Targets expanded-row frame at 320 px (EN/PL, three themes) with fallbacks (a)/(b)/(c), then STOPS for the owner's choice; the opened-row overflow assertion goes into what-to-expect.spec (Phase 3 §8).

### F3 — Fakty Księżyca tracą odstępy w slocie wyspy; dowód „pary za darmo” nie istnieje

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — oczywista, wąska poprawka
- **Dimension**: Feasibility / Claim Accuracy
- **Location**: plan.md „Phase 3 › 5. The Moon”, Key Discoveries (Moon)
- **Detail**:
  - **Odstępy.** `MoonTimeSlider.tsx:70` opakowuje dzieci w `space-y-2`. Astro wstawia je jednak w `<astro-slot>` z `display:contents`, więc margines trafia na element bez pudełka. Na `before/moon-phone-en-dark.jpg` linie „Sets”/„Moon up” stoją ciasno. Fakty `Fact` ułożą się tak samo.
  - **Dowód.** `exp-stat-cards/moon-phone-en-dark.jpg` nie zawiera bloku celu Księżyca, więc twierdzenie, że Księżyc „gets the stat pair … for free (experiment, moon-phone-en-dark.jpg)”, nie ma pokrycia.
- **Fix**: dzieci slotu opakować w `FactList` (który przeniesie `space-y-line` do środka slotu) i dodać specimen `MoonCard` z celem w `/design`, bo noc z Księżycem jako celem nie jest pewna przy capture.
- **Decision**: ACCEPTED, applied: the Moon's slider children sit in one FactList; a c-moon-card specimen with a Moon target; the "for free" claim corrected.

### F4 — Notatka o S-08 jest nieaktualna; ryzyka rebase niedoprecyzowane

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — wymaga przemyślenia, koordynacja dwóch zmian
- **Dimension**: Claim Accuracy
- **Location**: plan.md Key Discoveries (S-08), Critical Implementation Details („S-08 rebase”), plan-brief „Open Risks”
- **Detail**:
  - **Stan S-08.** HEAD to `8bc0c1b`, nie 9bf8043 (Fazy 1-4 zacommitowane). Faza 5 jest niezacommitowana i zmienia `design.astro` (+165 linii), `TonightPageSkeleton`, `TonightTiles`, `en.ts`/`pl.ts` i dodaje nowe komponenty planu. S-08 prawie na pewno zmerguje się pierwsze.
  - **Konflikt tekstowy.** S-08 zmienia **tę samą linię** washed-out `<li>` w `TargetsPageContent.astro` (`flex min-h-11 items-center gap-3 py-3` → `… scroll-mt-4 …`), a Faza 3 zmienia tam `py-3` → `py-group`. Oprócz tego S-08 dotyka `FinderContent.astro:48` (bez konfliktu z linią expect) i `tests/e2e/helpers.ts`.
  - **Regresja S-08, która trafi w tę zmianę.** `id="object-…"` S-08 na `ObjectRow` i washed-out `<li>` zepsuje `what-to-expect.spec.ts:92-101`.
    - `li[id^="object-"]` zacznie liczyć zamknięte wiersze, a ich `[data-expect]` są w DOM, ale niewidoczne, więc `toBeVisible` padnie.
    - Wiersze washed-out zawyżą licznik.
    - S-08 tego specu nie zmienia. Faza 3 tej zmiany uruchamia go, więc po rebase zrobi się czerwony nie z naszej winy. Sprawdzone: diff S-08 kontra test.
  - **Nietrafione twierdzenie.** Plan i research mówią, że obie zmiany edytują `tonight-phone.spec.ts`, ale ten plan go nie edytuje. To nieszkodliwe, ale należy to poprawić.
- **Fix**:
  - Uaktualnić notatkę: SHA, konflikt na linii washed-out `<li>` z wynikiem `flex min-h-11 scroll-mt-4 items-center gap-3 py-group`, wyjątek `scroll-mt-*` w guardzie (F1).
  - Orkiestrator przekazuje agentowi S-08, że jego `id` psuje `what-to-expect.spec.ts:92-101` (selektor powinien zawęzić się do `ol > li[data-object]` czołowej piątki, czyli zmiana po stronie S-08).
  - Strength: rebase przestaje być „careful”, a staje się listą kroków.
  - Tradeoff: brak.
  - Confidence: HIGH, sprawdzone na `git diff main` w worktree S-08.
  - Blind spot: kolejność merge'ów to decyzja człowieka.
- **Decision**: ACCEPTED, applied: S-08 at 8bc0c1b, the merged washed-out <li> line, data-object-card and the skeleton's plan branch named; what-to-expect.spec:92-101 is S-08's to narrow (orchestrator relays); the tonight-phone.spec claim corrected.

### F5 — Kontrakt treści `Fact`: `first-letter`, etykieta przy bloku i pusty zestaw okularów

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — oczywista, wąska poprawka
- **Dimension**: Substance / Claim Accuracy
- **Location**: plan.md Critical Implementation Details („Whitespace in slotted text”), Faza 3 §2/§5, Faza 4 §2, Testing Strategy (telescope-selector)
- **Detail**:
  - **`first-letter`.** `::first-letter` nie działa na kontenerze flex (korzeń `Fact`) ani na inline `<span>`. `NightStrip:71` (`reasonText`), `ObjectDetails:54` i `MoonCard:99` potrzebują `<p class="first-letter:uppercase">`. Plan dopuszcza „`<p>` or `<span>`” bez rozróżnienia.
  - **Etykieta przy bloku.** `label` zakończony spacją, po którym idzie blokowy `<p>`, ląduje w osobnej linii.
  - **Odwrócone twierdzenie.** `telescope-selector.spec.ts:160-161` sprawdza, że przy braku okularów ranking **nie** zawiera „Find with” ani prefiksu `noneFit`. Plan opisuje to odwrotnie („the "Find with" label stays in the DOM”). Konsekwencja: `Fact kind="eyepiece"` nie może się renderować, ani nieść etykiety, gdy `pair` jest null.
  - **Niespójny zapis.** Przegląd Fazy 2 zapisuje „Brightness · mag −1.9”, a kontrakt `Fact` to etykieta + spacja.
- **Fix**: w Critical details dopisać trzy rzeczy. Zdania (zwłaszcza z `first-letter:uppercase`) idą w `<p>`, krótkie wartości w `<span>`. `label` tylko z treścią inline. Fakt okularów nie renderuje się przy `pair === null`, a test telescope-selector zostaje bez zmian. Poprawić „Brightness · mag” na format etykiety.
- **Decision**: ACCEPTED, applied: sentences in <p> (first-letter), values in <span>, label only with inline content, no eyepiece fact when pair is null (telescope-selector unchanged), "Brightness mag −1.9" format.

### F6 — Część kontroli nie jest uruchamialna lub dowodzi mniej, niż deklaruje

- **Severity**: ⚠️ WARNING (Verifiability FAIL razem z F1)
- **Impact**: 🏃 LOW — oczywiste, wąskie poprawki
- **Dimension**: Verifiability
- **Location**: kryteria 1.1, 1.3, 1.4/1.5, 3.3, 3.4, 4.3, Faza 3 §7, Faza 4 §3
- **Detail**:
  1. **Asercja „zgubionej spacji” zależy od daty** (Faza 3 §7). `planets-on-tonight.spec.ts:35-38` pomija test, gdy żadna planeta nie jest nad horyzontem. Jego `beforeEach` ustawia EN, a „Polish context as the spec's helpers do” nie istnieje: `helpers.ts` nie ma pomocnika locale, inne specy dodają ciasteczko `LOCALE_COOKIE`.
  2. **3.4** „hardcoded-value scan” nie ma komendy.
  3. **Specy e2e bez środowiska.** `playwright.config.ts` nie ma `webServer`. Trzeba wypisać `BASE_URL=http://localhost:4331`, fixture na 4401 i `SUPABASE_URL`/`SUPABASE_SECRET_KEY` inline (to samo było w F3 przeglądu ui-quiet-actions).
  4. **Niepełna lista speców Fazy 3.** Brakuje `observing-milestones` (odwiedza `/tonight/planets`) i `tonight-dashboard` (otwiera każdą stronę).
  5. **Konflikt portu w Fazie 1.** 1.5 używa `astro dev` na 4331, a 1.4 preview też na 4331. Trzeba je wykonać kolejno.
  6. **1.3** dowodzi tylko, że klucze theme się kompilują: Tailwind v4 skanuje też `context/**/*.md`, gdzie te klasy są wymienione.
  7. **1.1/3.1/4.1** dla plików `.css`/`.astro` uruchamiają 0 testów (sprawdzone: exit 0, „No test files found”).
  8. **Faza 4 §3.** `NightsPageContent` nie ma „Times in” `mb-4`. Ta linia jest w `NightStrip.astro:45`, który Faza 4 §2 i tak obejmuje.
- **Fix**:
  - Do Fazy 3 §7 dodać asercję niezależną od daty: po polsku na Targets (fixture all-clear zawsze daje cele) żaden tekst `[data-fact]` nie pasuje do `/\p{L}:\S/u` (godziny „22:10” przechodzą). Asercję planetarną zostawić, z ciasteczkiem PL ustawionym w teście.
  - Dla 3.4 podać grep, a do 3.3/4.3/5.3 dopisać prefiks środowiska.
  - Do 3.3 dodać `observing-milestones` i `tonight-dashboard`.
  - Rozdzielić 1.4 i 1.5 w czasie.
  - W 1.1/3.1/4.1 zaznaczyć, że realną bramką jest `npm test`.
  - Poprawić Fazę 4 §3.
- **Decision**: ACCEPTED, applied: the runnable e2e environment line, observing-milestones and tonight-dashboard added, astro dev and preview never together on 4331, npm test named as the real unit gate, the role sizes checked by computed height instead of the CSS grep, a date-independent Polish spacing check on Targets, the NightsPageContent claim corrected, a grep for 3.4.

### F7 — Mapa ikon kłóci się z „jedno pojęcie, jedna ikona”; miejsce pliku

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — wymaga przemyślenia, kompromis słownikowy
- **Dimension**: Architecture Fit
- **Location**: plan.md „Phase 1 › 2. The icon map”, kryterium 1.5 („every icon in the map is distinct”)
- **Detail**:
  - **Przeniesienie ikon jest bezpieczne.** `lucide-react` 1.45.0 ma wszystkie 17 nazw, a mapa `.ts` komponentów React działa w `.astro`. Zdanie „no other imports” jest jednak nieścisłe, bo `satisfies Record<SkyEventKind, …>` wymaga `import type { SkyEventKind } from "@/lib/engine"`. Import tylko typu znika w runtime, ale trzeba go nazwać, żeby nie zatrzymał implementującego.
  - **Księżyc ma trzy ikony.** `moonUp` MoonStar i `moonFaint` CloudMoon na `/tonight/moon`, `moon` Moon na Nights, a Moon to też ikona rodzaju zaćmienia Księżyca.
  - **Eye znaczy dwie rzeczy.** To jednocześnie „co zobaczysz” (`expect`/`see`) i znacznik „Visible” zdarzenia.
  - **Cloud nie pasuje do każdego powodu.** Opakowuje `reasonText`, który bywa powodem wilgotności, braku prognozy lub brakujących godzin.
  - **Sprzeczność w kryterium 1.5.** „Every icon is distinct” przeczy samej mapie (Eye ×3, Compass ×2, Info ×2).
  - **Miejsce pliku.** `src/lib/ui/` nie istnieje, a CLAUDE.md przeznacza `src/lib` na logikę biznesową. Prezentacyjni sąsiedzi leżą przy komponentach: `ui/tile.ts`, `tonight/sky-band.ts`, `range-classes.ts`.
- **Fix**:
  - Kluczować mapę po pojęciu, nie po miejscu: jedna ikona „Księżyc tej nocy”, neutralna ikona dla powodu werdyktu.
  - Kryterium 1.5 zmienić na „każde pojęcie ma jedną ikonę”.
  - Plik przenieść do `src/components/ui/fact-icons.ts`.
  - Strength: realizuje zasadę z briefu i wzorzec repo.
  - Tradeoff: kilka zmian w planie i w CLAUDE.md.
  - Confidence: HIGH dla faktów, a dobór ikon to osąd.
  - Blind spot: właściciel może woleć różne ikony dla wschodu i zachodu Księżyca.
- **Decision**: OWNER (2026-10-14): one concept, one icon. One Moon icon everywhere; the Eye only for "what you'll see"; CircleCheck/CircleSlash for Visible/Not visible; Info for every "why" (incl. the verdict reason); the map moves to src/components/ui/fact-icons.ts; criterion reworded to "one icon per concept".

### F8 — Tryb czerwony: „wypełnienie niesie kształt” jest nieprawdą; dwie ramki obok przycisku hairline

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — decyzja wizualna właściciela
- **Dimension**: Coverage (red mode)
- **Location**: plan.md D3, plan-brief „Open Risks › Red mode”, kryteria 1.5/3.5/4.4
- **Detail**:
  - **Pomiar z heksów `global.css`:**

    | Para | Red | Dark | Light |
    |---|---|---|---|
    | surface (#170000) na background (#080000) | **1.03:1** | 1.06 | 1.07 |
    | `--border` (#3a0000) na surface | 1.14:1 | | |

    Wypełnienia w praktyce nie widać, kształt daje tylko bardzo słaba ramka (widać to na `exp-stat-cards/targets-red.jpg`).
  - **Dwie ramki na element.** Każdy element dostaje dwa obramowane pudełka tuż obok przycisku hairline „Mark observed” (`--control-border`, 3.33:1). To osłabia regułę ui-quiet-actions „ramka = przycisk na elemencie”.
  - **Overline traci kontrast.** W trybie czerwonym nagłówki nocy i grup spadają z `text-primary` (#ff0000, 5.20:1 przy 15 px) do muted (#c40000, 3.31:1 przy 13 px). Przypięte minimum 3:1 jest spełnione, ale tekst jest wyraźnie cichszy.
  - **Kontrast już pokryty.** Wszystkie nowe pary (muted na surface: red 3.23, heading na surface: red 5.07) mieszczą się w istniejących pinach `contrast.test.ts`, więc nowy pin nie jest potrzebny.
- **Fix**:
  - Poprawić brzmienie D3 („w czerwonym kształt niesie słaba ramka”).
  - Do 1.5/3.5/4.4 dopisać jawny punkt dla trybu czerwonego: karta nie czyta się jak przycisk obok hairline, a overline pozostaje czytelny.
  - Rozważyć wariant awaryjny dla trybu czerwonego (np. bez ramki, z samym podziałem) do decyzji właściciela.
- **Decision**: OWNER (2026-10-14): in red the stat cards keep the faint border like the gear cards; the plan's claim that the fill carries the shape is corrected (fill 1.03:1, the border carries it); explicit red checks in 1.6/3.5/4.4.

### F9 — D4 działa wbrew ustaleniu audytu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja właściciela
- **Dimension**: Coverage
- **Location**: plan.md D4; audit.md ustalenie 2
- **Detail**: Audyt nazwał problem wprost: linia „what to expect” „looks like its neighbours” (research C1). D4 wycisza jej Eye z `text-primary-strong` do muted i zostawia atrament foreground jak w linii okularów, więc linia staje się *mniej* wyróżniona niż dziś. Pierwsze miejsce zostaje jako jedyny wyróżnik.
- **Fix**: jeśli właściciel chce wyróżnienia, `Fact kind="expect"` dostaje `iconClass="text-primary-strong"`. Para jest już przypięta w kontraście, a wyjątek trafia do CLAUDE.md obok ikony bezpieczeństwa.
- **Decision**: OWNER (2026-10-14): the Eye on "what you'll see" stays text-primary-strong, an exception to D4; every other fact icon muted (safety keeps amber).

### F10 — Drobne braki pokrycia i spójności

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — do zebrania jedną edycją
- **Dimension**: Coverage / Claim Accuracy
- **Location**: różne
- **Detail**:
  - `TonightPageSkeleton` (wiersze `space-y-3 py-5`, komentarz „one data point per line”) nie podąża za `py-item`, więc skeleton „skoczy” przy podmianie.
  - **Odstępy w TargetsPageContent bez rozstrzygnięcia:**
    - `SeenTag` `mt-3` i `MoonCard:69` `mt-3` nie są przeniesione (zob. F1);
    - linia licznika ma `expectLocked ? "mb-2" : "mb-4"` (178);
    - linia locked ma `mb-4` (184);
    - wstęp washed-out ma `mb-4` (268).
  - **Pominięta poprawka z research.** „Window card shorter than Best” (research, trzecia poprawka) zniknęła z planu bez słowa. Przyjęte jest rozciągnięcie gridu? Warto to zapisać.
  - **Pusty `FactList`.** „Renders nothing” wymaga `await Astro.slots.render("default")` i `trim()`, bo `Astro.slots.has` jest prawdą dla każdego przekazanego slotu.
  - **Za mało zrzutów „przed”.** `evidence/before/` ma 14 zrzutów. Brakuje większości macierzy 390/1280 × EN/PL × 3 motywy (planety light/red, desktop) oraz „przed” dla wycinków planety w light/red. Trzeba je zrobić z main c650a8a **przed** Fazą 3.
  - **Skrypt `design-sections.mjs`** ma zaszyte identyfikatory sekcji z ui-quiet-actions i wymaga edycji.
  - **Nieaktualny CLAUDE.md.** Akapit What-to-expect opisuje marker jako `<p data-expect="<key>">`, a po zmianie to `div`, i żadna faza tego nie aktualizuje. Akapit S-07 nie ma zdania o ikonach do „przepięcia” (Faza 5 §2).
  - **Planety bez etykiet między commitami.** Między commitami Fazy 2 i 3 planety pokazują wartości bez etykiet (PL „62%”, „nachylone o 7°”). W jednym PR bez deployu to akceptowalne, ale czyściej scalić Fazę 2 z pierwszym commitem Fazy 3.
  - **Co jest w porządku:** dashboard nie jest dotknięty (`TonightTiles` czyta tylko `moonCard.phaseText` i `entries[0].reason`, oba bez zmian), a `dl > div > dt+dd` to poprawny HTML.
- **Fix**: jedna edycja planu zbierająca powyższe punkty: skeleton w Fazie 3, rozstrzygnięcie odstępów TargetsPageContent, zdanie o nierównych kartach, implementacja pustego `FactList`, capture „przed” na starcie Fazy 3, aktualizacja `design-sections.mjs`, dwa akapity CLAUDE.md w Fazie 5.
- **Decision**: ACCEPTED, applied: the skeleton follows the new rhythm (non-plan layout only), every TargetsPageContent spacing decided, the stretched Window card recorded, the empty FactList via Astro.slots.render, the full before matrix (51 curated images from c650a8a) committed now, design-sections.mjs repointed in Phase 1, the two CLAUDE.md paragraphs in Phase 5, Phase 2 lands with Phase 3's first commit.

## Wrażliwość na D1-D8 (inne odpowiedzi właściciela)

- **D1, role responsywne** (np. item 24 px na telefonie i 32 px od `sm`). Dziś 32 px przekracza telefonowy odstęp Band (24 px).
  - Wartości z `@theme inline` nie da się nadpisać media query (`global.css:645`), więc potrzebne są warianty `sm:` w każdym widoku albo przeniesienie ról do `:root` z wpisami w każdym bloku motywu.
  - Guard musi akceptować `sm:py-item`, a CLAUDE.md i `/design` pokazują oba kroki.
  - To średnia zmiana planu (Fazy 1, 3, 4, 5).
- **D2, overline w primary albo wersalikami.**
  - Zmienia się tylko klasa i opis.
  - Wersaliki wydłużają polskie daty przy 320 px, więc trzeba sprawdzić widoczność `h3` w `sky-events`.
  - Primary przywraca kontrast 5.2:1 w trybie czerwonym (F8).
- **D3, Best w jednej linii albo karta bez ramki.**
  - „03:21, NNE, 87°” to około 115 px: łamie się już w ObjectCard (112 px) i mocno w ObjectRow (79 px), więc wariant awaryjny z F2 staje się konieczny.
  - Karta bez ramki zmienia tylko StatCard i punkt kontroli trybu czerwonego (F8).
- **D4, pozostawienie wyróżnionego Eye.** `iconClass` dla expect i jedno zdanie w CLAUDE.md (F9). Nowy pin kontrastu nie jest potrzebny.
- **D5, inna kolejność.** Zmienia się tylko kolejność w wywołaniach. Notatka Księżyca na końcu to stan dzisiejszy.
- **D6, inne polskie etykiety.** Tylko copy i regexy w `build.test.ts` (Faza 2).
- **D7, zachowanie łączenia „ · ”.** Mniej faktów na zdarzenie, `event.details.join` zostaje, a Faza 4 §1 jest prostsza.
- **D8, C5 teraz.** To nowa faza między 3 a 4 (Sonnet high):
  - rodzina kluczy dla 7 wariantów w EN i PL;
  - pole rodzaju powodu w `TonightNight` (`build.ts:331`);
  - testy w `build.test` i parytet i18n;
  - uwaga na dokładne teksty w `seven-night-planner`;
  - ponowny capture.

## Pytania do właściciela

QUESTION FOR OWNER: Czy przy D3 akceptujesz w rozwijanych wierszach Targets (telefon 320 px) wariant awaryjny pary kart: wartość w mniejszym kroku `text-label` zamiast `text-body` albo parę bez wcięcia `pl-10`? Czy wolisz, żeby agent najpierw zmierzył to na specimenie i pokazał zrzut (F2)?

QUESTION FOR OWNER: Czy linia „co zobaczysz” ma zachować wyróżnioną (niebieską) ikonę Eye, wbrew D4, skoro audyt skarżył się, że ta linia wygląda jak sąsiednie (F9)?

QUESTION FOR OWNER: Czy w trybie czerwonym karty Window/Best mają mieć słabą ramkę jak karty sprzętu (wypełnienie jest tam praktycznie niewidoczne, 1.03:1), czy wolisz wariant bez ramki, żeby nie przypominały przycisku „Oznacz jako obserwowane” (F8)?

QUESTION FOR OWNER: Czy Księżyc ma mieć jedną ikonę wszędzie (strona Księżyca, Nights, zaćmienie), zamiast trzech różnych (MoonStar, CloudMoon, Moon), zgodnie z zasadą „jedno pojęcie, jedna ikona” (F7)?

## Owner decisions and triage (2026-10-14)

Recorded by the ui-refine agent from the orchestrator's relay.

- **D1-D8**: every agent default kept, except **D1 = looser rhythm**: line 8 px, group 24 px, item 40 px, fixed at every width.
- **Review questions**: F2 = measure first and stop after Phase 1; F7 = one concept, one icon, map in `src/components/ui/`; F8 = the faint border stays in red; F9 = the accent Eye stays.
- **All findings F1-F10** are applied to `plan.md` and `plan-brief.md` as the reviewer proposed. `change.md` → `plan_reviewed`.

