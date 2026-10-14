<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Adjustable Session Plan (M-3 S-08)

- **Plan**: `context/changes/adjustable-session-plan/plan.md` (commit cacbac6, branch `feat/adjustable-session-plan`, off main 8f2f8d2)
- **Data**: 2026-10-14
- **Recenzent**: herdr agent „reviewer” (Opus), trzy podagenty Opus: twierdzenia o kodzie, wykonalność i kolejność faz, offline i UI
- **Fazy**: 5 · **Ustalenia**: 3 krytyczne, 7 ostrzeżeń (+ uwagi bez decyzji)
- **Stan Progress**: brak wierszy `- [x]`, implementacja nie ruszyła
- **change.md**: nie zmieniony. Orkiestrator pozwolił zapisać tylko ten plik, więc `status: planned` → `plan_reviewed` zostaje dla orkiestratora lub właściciela.
- **Decyzje D1–D15**: przegląd planu w obecnym brzmieniu, czyli na rekomendacjach ⭐. Wpływ odpowiedzi innych niż rekomendowane: sekcja „Gdzie inna odpowiedź na D1–D15 zmienia plan”.

## Werdykty

| Wymiar           | Werdykt    | Ustalenia  |
| ---------------- | ---------- | ---------- |
| Claim Accuracy   | FAIL ❌    | F2, F6     |
| Substance        | PASS ✅    |            |
| Feasibility      | WARNING ⚠️ | F4, F5, F7 |
| Sequencing       | FAIL ❌    | F1         |
| Architecture Fit | WARNING ⚠️ | F4         |
| Scope Discipline | PASS ✅    |            |
| Verifiability    | WARNING ⚠️ | F10        |
| Coverage         | FAIL ❌    | F3, F8, F9 |

**► Ogólnie: NEEDS ATTENTION.**

Z uwagi na trzy wymiary z FAIL rozważałem REJECTED, ale ich nie wystawiam, bo przesłanka planu się trzyma:

- model danych (jedna lista na użytkownika, miejsce i noc, nakładana na świeżo zbudowaną noc) pasuje do repo;
- determinizm jest zachowany: `applyPlanEdits` nie czyta zegara, `nextUp` już używa `selectionNow`, `reachable` idzie w kolejności katalogu, a `LOG_PENALTY` rusza tylko `rankScore`;
- bramka spełnia test-plan §6.4: strona jest darmowa z płatnym fragmentem, jak what-to-expect, a smoke plan 1 i 6 to przepis „A full-plan route”;
- tor offline jest poprawny (O1).

Każdy FAIL usuwa lokalna poprawka planu: przeniesienie bloku między fazami, poprawienie kontraktu albo dodanie kroku. Nowy `/10x-plan` nie jest potrzebny. Przed `/10x-implement` trzeba jednak zamknąć F1–F3.

## Findings

### F1 — Smoke z Fazy 3 zależy od Fazy 4, a ta czeka na ui-quiet-actions

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM, trzeba przemyśleć, co przenieść między fazami
- **Dimension**: Sequencing
- **Location**: plan.md „Phase 3 › 3. HTTP checks” (plan 2–5, Date note) oraz „Phase 4 › 1. Plan island”
- **Detail**:
  - Znaczniki `data-session-plan-edited`, `-locked` i `-held` renderuje dopiero Faza 4.1 (`PlanPageContent`). Podpięcie `readPlanEdits` w wyspie to też 4.1, bo Faza 2 dodaje tylko hook w `loadTonight`.
  - Przed Fazą 4 krok „plan 2 excludes edited” przechodzi pusto, a plan 3, 4 i 5 padają. Wiersz Progress 3.3 nie może więc być zielony.
  - D15 wstrzymuje Fazę 4 do merge'a ui-quiet-actions, więc Faza 3 jest de facto zablokowana na cudzej zmianie.
  - Podobnie: Date note każe czytać noc z „formularza w powłoce” (`name="night"`), a takiego formularza nie ma (`src/pages/tonight/plan.astro` nie ma formularza; patrz F10).
- **Fix**: Przenieść do Fazy 3 całą część wyspy, która nie potrzebuje nowych wariantów przycisków: bramkę w `PlanPageContent`, podpięcie `readPlanEdits`, cztery stany i ich znaczniki, linię blokady, `editsUnavailable` i wyświetlanie `?error=` (F3). Faza 4 zostaje z edytorem, dialogiem Reset, kafelkiem, `/design` i e2e.
  - Strength: Faza 3 domyka przepis §6.4 sama, a zależność od ui-quiet-actions dotyczy tylko kontrolek (Faza 4).
  - Tradeoff: Faza 3 rośnie o jeden plik `.astro` i klucze i18n. Linie stanu muszą użyć istniejących ról tekstu, bez nowych wariantów przycisków.
  - Confidence: HIGH. Grep po znacznikach i podpięciu w obu fazach planu.
  - Blind spot: przycisk Reset w pasku „Edited” to wyspa z Fazy 4. Do tego czasu pasek ma sam tekst.
  - Alternatywa: w Fazie 3 sprawdzić zapis przez odczyt administracyjny (smoke ma klucz inline), a powtórki wyspy przenieść do Fazy 4. Tańsze, ale §6.4 woli odczyt jako właściciel, a nie administrator.
- **Decision**: ACCEPTED (2026-10-14, owner): the island gate, edits read, marked states and `?error=` display moved into Phase 3; the editor stays in Phase 5 (was 4).

### F2 — Data nocy: zła sygnatura, zła kolejność odczytu, brak bramki dla `?night=next`

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM, kontrakt Fazy 2 i Fazy 3 do poprawienia
- **Dimension**: Claim Accuracy
- **Location**: plan.md „Critical Implementation Details” (Order of reads, Night race at dawn), „Phase 2 › 4. Build wiring”, „Phase 3 › 1. Routes” krok 5, D9
- **Detail**:
  - **Kolejność odczytu.** Plan twierdzi, że „`loadTonight` resolves the site and the night date before `buildTonight`”. To nieprawda: `loadTonight` ustala tylko miejsce i teleskop (`load.ts:134-135`), a datę nocy liczy dopiero `buildTonight` (`build.ts:684`: `tonightDateFor(engineSite, now, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG)`, plus 1 dzień dla `night: "next"`).
  - **Sygnatura.** Plan używa `tonightDateFor(now, site.timeZone)`. Prawdziwa funkcja to `tonightDateForSite(site, now)` (`src/lib/tonight/tonight-date.ts:9`), a przełom wyznacza wysokość Słońca w danym miejscu, nie strefa czasowa. Trasa, która liczy datę tylko ze strefy, odrzuci jako `nightOver` każdy zapis między lokalną północą a świtem cywilnym.
  - **D9 bez bramki.** Ani 2.4, ani 4.1, ani 4.5 nie każe pominąć `readPlanEdits`, `withPlanCandidates` i edytora przy `night === "next"`. Wyspa obsługuje `?night=next` (`requestedNight`), a worker renderuje tę kopię do każdej zapisanej strony planu. Skutek: zbędny odczyt i edytor z ukrytym `night` = jutro, który trasa zawsze odrzuci.
  - Pole `plan.night` z 2.4 dubluje istniejące `TonightView.date` (`build.ts:425`).
- **Fix**: Liczyć datę raz, przez `tonightDateForSite(site, now)` (+1 dla `next`). Przekazywać ją do `readPlanEdits` i jako opcję do `buildTonight`, żeby hook, budowa i formularz miały tę samą datę. Trasa porównuje ją z `tonightDateForSite(site, now)`. Hook, kandydaci i edytor działają tylko przy `night === "tonight"`. Wyrzucić `plan.night` na rzecz `view.date`. Dodać test w `load.test.ts`, że przy `night: "next"` hook nie jest wołany.
  - Strength: jedno źródło daty (`build.ts:684` już używa tej samej reguły).
  - Tradeoff: `buildTonight` dostaje jedną opcję więcej.
  - Confidence: HIGH. Sprawdzone w `load.ts`, `build.ts:684` i `tonight-date.ts:9`.
  - Blind spot: none significant.
- **Decision**: ACCEPTED: one night date via `tonightDateForSite(site, now)` computed in `loadTonight`, passed to the hook and `buildTonight`; hook, candidates and editor only for `night === "tonight"`; `plan.night` dropped for `view.date`; `load.test.ts` case added.

### F3 — Nic na `/tonight/plan` nie pokazuje `?error=`

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW, oczywista poprawka
- **Dimension**: Coverage
- **Location**: plan.md „Phase 3 › 1. Routes” (każdy błąd przekierowuje na `/tonight/plan?…&error=`) oraz „Phase 4”
- **Detail**:
  - `src/pages/tonight/plan.astro` nie czyta `Astro.url.searchParams.get("error")`, a `PlanPageContent` nie ma takiego propsa.
  - Po odrzuconym zapisie użytkownik widzi stary plan bez słowa wyjaśnienia. Dotyczy to wszystkich kluczy: `needsFull`, `nightOver`, `notVisible`, `save.sessionPlan` i `issueKey`.
  - To łamie regułę błędów z CLAUDE.md oraz twardą regułę „never hide the evidence”.
  - Wzorzec już istnieje: `planets.astro:25-31` (`errorParam` / `isMessageKey` / `pickTonightNotice`).
- **Fix**: Powłoka czyta `error` i podaje go wyspie jako prop. Wyspa renderuje `ServerError` (`role="alert"`, `translateKey` z ogólnym fallbackiem) przy kontrolkach Edit i Reset. E2E sprawdza komunikat po wymuszonym błędzie. Najlepiej w Fazie 3 (F1). `error` już jest w `NOTICE_PARAMS`, więc taka strona nigdy nie trafia do pamięci offline.
- **Decision**: ACCEPTED: the shell reads `?error=` (planets.astro pattern) and the island renders `ServerError`, in Phase 3.

### F4 — Sprawdzenie okna w trasie to druga reguła okna i kłóci się z D4

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM, prawdziwy wybór; częściowo decyzja właściciela (PYTANIE 1)
- **Dimension**: Feasibility / Architecture Fit
- **Location**: plan.md „Phase 3 › 1. Routes” krok 6 (`visible.ts`), D4, „Phase 4 › 3. Editor island”
- **Detail**:
  - **Konflikt z D4.** D4 każe trzymać klucze bez okna na liście „Not on tonight's plan”, z możliwością usunięcia w edytorze. Jeśli edytor odeśle je przy zapisie, `hasWindow` odrzuci cały zapis z `notVisible`, gdy klucz nie ma okna astronomicznego (np. po podniesieniu minimalnej wysokości). Jeśli ich nie odeśle, znikną po cichu. Plan nie mówi, które z dwóch.
  - **Druga reguła okna.** `visible.ts` składa okno osobno (`darkWindow` + `objectTrack` + `bestWindow`). Szkodliwy kierunek to trasa odrzucająca kandydata, którego edytor zaproponował. Wystarczy, że różni się krok śladu (`DEFAULT_TRACK_STEP_MINUTES`, ranking liczy co 10 min), próg ciemności (`darknessThresholdDegForBortle(site.bortle)`, którego plan nie wymienia) albo okno planet. Okno planet nie ma eksportowanego helpera: `build.ts:825` składa je z `darkWindow(…, PLANET_WINDOW_SUN_ALTITUDE_DEG)`.
  - Kierunek odwrotny jest nieszkodliwy. Trasa nie zna teleskopu, więc przyjmie obiekt poza zasięgiem, a ten trafi do `notTonight`.
- **Fix**: Trasa sprawdza okno tylko dla kluczy nowych względem zapisanej listy, a stare klucze bez okna przechodzą i lądują w `notTonight`. `visible.ts` woła dokładnie te funkcje i progi co budowa (wydzielić wspólny helper z `build.ts`/`ranking.ts`). Test własności w `visibility-invariants.test.ts`: każdy klucz z `candidates` przechodzi `hasWindow` we wszystkich zasianych przypadkach.
  - Strength: strażnikiem pozostaje reguła renderu, a trasa nie odrzuci tego, co zaproponował edytor.
  - Tradeoff: trasa czyta zapisaną listę przed zapisem (jeden odczyt więcej).
  - Confidence: MED. Rozbieżność kroku i progu wykazana w kodzie, ale nie wywołana w teście.
  - Blind spot: czy właściciel chce, by klucze „Not on tonight's plan” przeżywały zapis (PYTANIE 1).
- **Decision**: ACCEPTED with the owner's answer: keys without a window stay on the saved list; the route checks the window only for keys newly added relative to the stored list, through the shared `plan-window.ts` helpers the build uses; property test that every candidate passes.

### F5 — Warstwa DB: harness `needsSite`, dziury w CHECK, wspólny lokalny stack

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM, kilka konkretnych poprawek kontraktu Fazy 1
- **Dimension**: Feasibility
- **Location**: plan.md „Phase 1 › 1. Migration” (Checks), „3. Isolation harness and entry”, „Success Criteria” 1.1–1.3
- **Detail**:
  - **Harness.** Test „hand its own row over” (`tests/db/isolation.test.ts:161-176`) każe B wstawić `row` jako B. Z `site_id` A po scaleniu strażnik miejsca odrzuci to (42501) i test się wysypie, więc B potrzebuje własnego miejsca. `valid: TablesInsert<"session_plans">` wymaga `site_id` (NOT NULL, bez domyślnej), więc wpis bez niego nie przejdzie typowania `TableCase`. `describe.each` zbiera `valid` już przy zbieraniu testów (`:65-68`), więc id miejsca trzeba scalać leniwie.
  - **CHECK.** `observations_target_key` (`20261006190000_…:17-21`) to trzy osobne predykaty (dwa zakotwiczone regexy i lista `IN`), więc KEY trzeba złożyć ręcznie bez kotwic. W lokalnym Postgresie złożona wersja odrzuca `M111`, `NGC0` i `Foo`, przyjmuje `{}`, a `array_position(t, null)` działa. **Przechodzą jednak `{""}` i `{"M31,M42"}`.**
  - **Wspólny stack.** `npx supabase migration up` na współdzielonym lokalnym stacku sprawi, że `tests/db/structure.test.ts` w każdym innym worktree padnie („table in neither list”), a ich `db:types` wciągnie tabelę. Także „no drift” z 1.2 zależy od tego, co nałożyły inne gałęzie.
- **Fix**:
  - `needsSite` tworzy miejsce dla A i dla B; B wstawia własne `site_id`. Typ `TableCase` dopuszcza `valid` bez `site_id`, gdy `needsSite: true`. Id scalane w `beforeAll` lub w samym teście.
  - Do CHECK dodać `'' <> all(targets)` i brak przecinka w elemencie (albo sprawdzać KEY per element), z przypadkami `{""}` i `{"M31,M42"}` w `session-plans.test.ts`.
  - W planie dodać notkę o koordynacji migracji z innymi worktree.
  - Strength: każda poprawka ma dowód (numery linii, zapytanie SELECT w lokalnym Postgresie).
  - Tradeoff: harness rośnie bardziej, niż zakłada brief.
  - Confidence: HIGH.
  - Blind spot: które inne worktree używają teraz `test:db`.
- **Decision**: ACCEPTED: `needsSite` creates sites for A and B and merges lazily; `valid` omits `site_id`; CHECK adds `'' <> all(...)` and no comma per element with `{""}` / `{"M31,M42"}` cases; shared-stack sequencing (announced windows, `local-down.sql`, no reset, `db:types` only at main + this migration) in Critical Implementation Details.

### F6 — Kontrakt schematu i tras: `isKnownTarget` nie jest bezpieczny dla wysp, powtórzone `targets`, `?site=` przed parsowaniem

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Claim Accuracy
- **Location**: plan.md „Phase 1 › 5. Store and schemas” (`savePlanSchema` „island-safe … `isKnownTarget`”), „Phase 3 › 1. Routes” kroki 2–3, smoke plan 1
- **Detail**:
  - `isKnownTarget` siedzi w `src/lib/targets/labels.ts`, który importuje `@/lib/catalogue` (JSON katalogu). Repo opisuje go jako tylko serwerowy, a trasy logu wołają go w trasie, nie w schemacie.
  - Wzorzec trasy `Object.fromEntries(formData)` (`api/log/sky/[id].ts`) gubi powtórzone `targets`.
  - Krok 2 przekierowuje na `/tonight/plan?error=…` przed parsowaniem, a smoke plan 1 oczekuje `?site=<id>&error=…`. Zachowanie `site` wymaga odczytu surowej wartości z formularza przed walidacją.
  - `WriteResult` jest w `src/lib/gear/store.ts:21`.
- **Fix**: Schemat sprawdza tylko `isTargetKey`, a `isKnownTarget` przenieść do trasy. W trasie `formData.getAll("targets")`. `site` przed parsowaniem przepuścić przez `isGearId` albo nie przenosić go do URL odmowy. Ujednolicić smoke plan 1 i dodać pin §6.4 `absent:` z niepustą listą.
- **Decision**: ACCEPTED: schema checks `isTargetKey` only, `isKnownTarget` in the route; `formData.getAll("targets")`; raw `site` passes `isGearId` before it reaches a redirect; smoke plan 1 pins `absent: "M31"`.

### F7 — Edytor: TargetPicker nie pasuje, Cancel offline, fokus, warianty przycisków, test `.tsx` się nie uruchomi

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM, kilka decyzji UI (część w PYTANIU 2)
- **Dimension**: Feasibility
- **Location**: plan.md „Phase 4 › 3. Editor island”, „4. Reset”, Manual 4.6–4.7
- **Detail**:
  - **TargetPicker.** `TargetOption` to `{key, id, label, detail, names}` (`target-search.ts:15-25`). Kształt `{key,label,detail}` nie pasuje, a bez `id` i `names` wpisanie „31” albo „Andromeda” nic nie znajdzie. Picker ma na sztywno `submitOnEnter` (`TargetPicker.tsx:66`), więc Enter bez podświetlonej opcji wyśle cały formularz zapisu (`Combobox.tsx:154`). Dodaje też ukryte `name="target"` (`:71`) i nie ma propsa do resetu.
  - **Offline.** `data-needs-network` na całym formularzu blokuje także Cancel, Move, Remove i Add. Mechanizm działa, bo `page-state.ts:22,118-124,152-155` łapie przyciski w fazie capture, a MutationObserver obejmuje hydrację. Gdy urządzenie straci sieć przy otwartym edytorze, nie da się go zamknąć.
  - **Fokus.** Przy „Up disabled on the first row” i „focus to the moved row's same control” przesunięcie wiersza na pozycję 1 zostawia fokus na wyłączonym przycisku, więc fokus spada na `<body>`.
  - **Warianty.** Według nowej reguły Clickables z ui-quiet-actions `hairline`/`sm` to przycisk per element (Mark observed, /gear Add), więc „Edit plan” jako `hairline` to nowe użycie. Reguła nic nie mówi o przyciskach z samą ikoną. Rozmiar `icon` (`size-11` = 44 px) istnieje, a precedensem jest `ghost`/`icon` w `OnboardingWizard.tsx:755-765`. Plan nie określa kształtów w trybie red, gdzie wyłączona ikona `quiet` (`#c40000`) prawie nie różni się od aktywnej (`#ff0000`).
  - **Test.** `PlanEditor.test.tsx` się nie uruchomi: `vitest.config.ts` obejmuje `src/**/*.test.ts` w środowisku node, a repo nie ma jsdom ani testing-library.
- **Fix**:
  - Kandydaci jako przefiltrowane `targetOptions(locale)` (`src/lib/observations/target-options.ts:16`) z nadpisanym `detail` po stronie serwera. Picker poza formularzem zapisu albo `Combobox` bez `submitOnEnter`.
  - `data-needs-network` tylko na Edit, Save oraz wyzwalaczu i potwierdzeniu Reset.
  - Fokus na drugi przycisk Move albo `aria-disabled` (fokusowalny). Skrajne Move jako `invisible`.
  - Ikony jako `quiet` lub `ghost` z rozmiarem `icon` (do wyboru: PYTANIE 2).
  - Logika move, remove i add jako czysty reducer `.ts` z testem, a przesunięcia fokusu z 4.7 w e2e.
  - Strength: każda poprawka ma wskazany plik i linię.
  - Tradeoff: kontrakt edytora rośnie.
  - Confidence: HIGH.
  - Blind spot: ostateczne nazwy wariantów, póki Faza 3 ui-quiet-actions jest niezacommitowana.
- **Decision**: ACCEPTED with the owner's answer: Move up / Move down / Remove are `quiet` size `icon` (44 px); candidates from `targetOptions(locale)` with server `detail`; picker outside the save form; `data-needs-network` only on Edit, Save and Reset; edge moves `aria-disabled` and focusable; pure reducer `plan-editor.ts` tested in Vitest, focus in e2e.

### F8 — Gałąź `empty` w PlanPageContent połyka nowe stany; skeleton i sygnał gotowości dla stanu D14

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Coverage
- **Location**: plan.md „Phase 4 › 1. Plan island”, „2. Timeline”; `src/components/tonight/PlanPageContent.astro:46`
- **Detail**:
  - `empty = plan === null || plan.rows.length === 0` renderuje „nothing to place” i link do nocy. To zasłania trzy nowe stany: pustą listę po edycji (`editedEmpty` z Reset), listę, w której wszystko jest w `notTonight`, oraz linię `held` w noc bez przejścia i bez planet.
  - `TonightPageSkeleton layout="plan"` nie ma paska na linię Edit, blokady lub „Edited” nad liniami nocy, więc podmiana skacze.
  - Specy e2e (`tonight-phone:55`, `offline.spec:55,71`, `toasts.spec`, `sky-events.spec`) czekają na `[data-offline-copy]` jako znak gotowości wyspy, a stan D14 go nie ma.
  - Kafelek na dashboardzie przy `planEditsError` dalej renderuje `OfflineCopy` i nadpisuje zapisany `nextUp` po edycji. To niespójne z D14, choć mało ważne.
- **Fix**: Rozgałęzić `empty` na stany edited, held i suggested w 4.1 i 4.2. Dodać jeden pasek 44 px do skeletonu. Dodać `data-session-plan-state="edited|suggested|locked|held|unavailable"` jako znacznik gotowości. W 4.5 jednym zdaniem przesądzić, czy dashboard idzie za D14.
- **Decision**: ACCEPTED: `empty` split into edited-empty, all-not-tonight, held and suggested; one 44 px skeleton bar; `data-session-plan-state` readiness marker; the dashboard keeps `OfflineCopy` on a failed edits read (D14 is the plan page only).

### F9 — Dodane wiersze spod progu linkują do nieistniejącej kotwicy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW, ale to decyzja UI (PYTANIE 2)
- **Dimension**: Coverage
- **Location**: plan.md „Phase 4 › 2. Timeline” („Rows stay full-width links”), D3; `build.ts:1173-1184`
- **Detail**:
  - Wiersze linkują do `/tonight/targets#object-<id>`, a Targets pokazuje tylko obiekty, które przeszły próg, i wyblakłe.
  - Obiekt spod progu dodany z `reachable` (D3) wskazuje kotwicę, której nie ma. Jego finder chart odpowiada `not-ranked`.
  - Trzeba też sprawdzić, czy wiersze wyblakłe mają pasującą kotwicę.
- **Fix**: Dla wierszy spoza listy Targets: wiersz bez linku (sama treść, bez `<a>`) albo inny cel. Dodać test w `build.test.ts` na `href` takiego wiersza.
- **Decision**: ACCEPTED with the owner's answer: a below-bar added row links to `/tonight/finder?object=<id>&from=plan` (new `FinderFrom` value; the finder resolves below-bar objects only with `from=plan`); `ObjectRow` and washed-out rows gain `object-<id>` anchors.

### F10 — Weryfikacja: luki w smoke, brak helpera „noc nie przechodzi”, `npm run format` to zapis

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Verifiability
- **Location**: plan.md „Phase 3 › 3. HTTP checks”, „Phase 4 › 7. Browser spec”, Progress 1.2, 4.4, 5.1
- **Detail**:
  - **Smoke.**
    - Nie przechwytuje id miejsca: tworzenie przekierowuje na `/gear?saved=site`, a id jest w `data-site-id` wyspy.
    - Noc trzeba czytać z `data-night-date` w `OfflineCopy` wyspy (`OfflineCopy.astro:50`), nie z formularza powłoki.
    - O tym, czy noc jest „held”, czy „edited”, trzeba decydować z treści wyspy, bo okno dat `inNoDarknessWindow` pokrywa tylko brak ciemności, a nie pogodę.
    - `request()` wysyła `URLSearchParams(form)`, więc powtórzone `targets` trzeba podać jako tablicę par.
    - `replayIsland` jest przywiązany do `islandUrl` findera, więc kroki planu potrzebują własnego przechwycenia.
  - **E2E.** Wspólnego helpera „pomiń, gdy noc nie przechodzi” nie ma: istnieje tylko `inNoDarknessWindow` (`tests/e2e/helpers.ts:205`), a §6.5 każe pomijać inline. Test 3 powinien też sprawdzić, że lądowanie po Save nie jest `data-from-device`, bo przy wolnym łączu `networkFirst` po 4 s pokaże starą kopię (`sw.ts:517-545`).
  - **5.1.** `npm run format` = `prettier --write .`, czyli przepisuje całe repo i niczego nie sprawdza. Lepiej `npx prettier --check <zmienione pliki>`.
  - **Uruchomione komendy.** `npx supabase migration up` istnieje w CLI 2.117.0 (nie uruchamiane, bo modyfikuje stan). Skrypty `test`, `test:db`, `smoke`, `test:e2e`, `db:types`, `lint`, `build` (z `postbuild` → `build-sw.mjs`) istnieją. `npx vitest run src/lib/session-plans` się rozwiązuje (na razie brak plików). Nie uruchamiałem: `migration up`, `db:types`, `test:db`, smoke, e2e, `build`, `format` (wszystkie modyfikują stan albo zajmują porty innych agentów).
- **Fix**: Dopisać te kroki do kontraktu smoke i e2e. 5.1 zamienić na `npx prettier --check`. Dodać wspólny helper pomijania w `tests/e2e/helpers.ts`, oparty na znaczniku `data-session-plan-state` z F8.
- **Decision**: ACCEPTED: smoke reads site id and night from the island's `OfflineCopy`, decides held/edited from `data-session-plan-state`, sends repeated `targets` as pairs, uses its own capture variable; shared e2e helper `planEditable`; the store spec asserts the landing is not `data-from-device`; 6.1 is `npx prettier --check`.

## Uwagi bez decyzji

- **Stan ui-quiet-actions w planie jest nieaktualny.** Na `feat/ui-refine` Faza 1 (2e2b903) i Faza 2 (73d233d, `action` usunięty) są zacommitowane, a Faza 3 (reguła Clickables w CLAUDE.md, `global.css`, `contrast.test`) jest w toku. Warianty: `default`, `destructive`, `outline`, `secondary`, `ghost`, `hairline`, `quiet`, `link`. Rozmiary: `default`, `sm`, `bare`, `lg`, `icon`.
- **Wspólne pliki** z ui-quiet-actions: `en.ts` (niskie ryzyko), `design.astro` (umiarkowane, ui-refine zmienia 88 linii), `CLAUDE.md` (umiarkowane, ui-refine edytuje akapit Finder tuż obok planowanego wstawienia) i `global.css`, jeśli dojdą style. ui-refine nie dotyka `PlanPageContent`, `SessionTimeline`, `plan.astro`, `TonightPageSky`, `TonightTiles` ani `TonightContent`. Rekomendacja D15 jest słuszna: budowanie na `action` da pewne błędy TS po rebase.
- **D11 / OQ23**: decyzja jest dobra, ale uzasadnienie powinno stać na własnych nogach, nie na O-2 („public data”). Płatna jest _możliwość edycji_. Kopia na urządzeniu B (do 36 h po degradacji) jest tylko do odczytu, a edycja wymaga sieci i bramki serwera. To zgodne z kandydatem z OQ23 („a copy keeps what the plan allowed when it was stored”, `prd.md:772-774`). Kopie `?night=next` nigdy nie niosą edycji. Finder O-4 jest inny, bo tam produktem płatnym jest sam wykres.
- **Tor offline jest poprawny.** POST przechodzi przez `networkOrOffline`, przekierowanie z trybem `manual` wraca do przeglądarki, nowy GET trafia na trasę stron zapisanych, a wyspa pobiera się świeżo i `commitIsland` zapisuje parę. Wyspa bez `[data-offline-copy]` po prostu nie zapisuje się (`copies.ts:236-237`, `sw.ts:424-446`), nic nie jest czyszczone ani osierocone, a precedensem jest `PlanPageContent:59`.
- **Kolejność odczytów.** `await getAccountPlan` przed `loadTonightFor` szereguje dwa zapytania (dziś `void getAccountPlan` je zrównolegla). Sprawdzanie planu wewnątrz `readPlanEdits` zachowuje równoległość. Oba odczyty dzielą jedno zapytanie (`readOnce`).
- **Faza 2 zostawia repo zielone.** Nikt nie buduje `TonightSessionPlan` ręcznie, a `/design` buduje go przez `buildTonight`. Testy rankingu nie używają snapshotów.
- **Reset poza `SessionTimeline`.** `/design` renderuje timeline ze stałych danych, więc pasek „Edited · Reset” lepiej umieścić w `PlanPageContent`. Plan powinien też powiedzieć, czy timeline chowa się przy otwartym edytorze, bo dwie listy tych samych celów na telefonie to dużo. W wierszach edytora nazwa dostaje `min-w-0 break-words`: przy 320 px trzy przyciski po 44 px zostawiają około 140 px na polską nazwę.
- **i18n.** `moveUp`, `moveDown` i `remove` muszą być funkcjami (`moveUp({ name })`). Brakuje kluczy: `candidateDetail({ window })`, placeholder i `noMatch` pickera, etykieta listy edytora i jej stan pusty, przyciski dialogu, nagłówek `notTonight` i Remove dla jego pozycji.
- **Drobne przesunięcia linii** w Current State (`cardPasses` 749, `planObjects` 774, `rowOf` 1122-1144, `windowEnds` 1195) nie mają wpływu na implementację.

## Gdzie inna odpowiedź na D1–D15 zmienia plan

- **D1 (diff zamiast listy)**: schemat to trzy tablice (dropped, added, order) z nowymi CHECK-ami. `applyPlanEdits` potrzebuje reguły scalania nowych sugestii i kolejności. Zmienia się generator inwariantu, payload edytora, smoke z pustą listą i CLAUDE.md. Fazy 1–4.
- **D2**:
  - (b): flaga per wiersz z `applyPlanEdits` i budowy, plus i18n i `/design`. Mała zmiana.
  - (c): nowy moduł slotów, inwariant „slot w oknie” (akceptacja PRD przechodzi na sloty), przerysowany timeline i `nextUp` po slotach. Wypada linia „No time slots”. Duża zmiana w Fazach 2 i 4.
- **D3**:
  - (b): odpada `reachable` (2.1). Budowa planu dostaje nieograniczoną listę obiektów, które przeszły próg, i wyblakłe. Inwariant i kandydaci się kurczą, F9 znika.
  - (c): obiekty poza zasięgiem nie mają okna (`scoreObject` zwraca null przy `vMag > limit` przed liczeniem okna), więc potrzebne jest drugie liczenie okien po `DEEP_SKY`. Ręczny krok 3 się odwraca.
- **D4 (ciche pominięcie)**: znikają `notTonight` i jego teksty. Zapisanych kluczy nie da się już zobaczyć ani usunąć, a F4 się zaostrza.
- **D5 (edycje w każdą noc z ciemnym oknem)**: `rankObjects` musi działać poza bramką `cardPasses`. Znikają `heldEdits`, znacznik held i notka dat w smoke, a inwariant „noc bez przejścia nie rysuje edycji” się odwraca. Znaczenia nabiera maskowanie planet do godzin bez chmur, a reguła pomijania w e2e się zmienia.
- **D6**:
  - (b): po jednej trasie na move, remove i add, wyścig read-modify-write, więcej kroków smoke, zapis kopii po każdym tapnięciu. Nie ma `PlanEditor`, a problemy F7 z pickerem i fokusem odpadają.
  - (c): biblioteka drag-and-drop, alternatywa klawiaturowa, testy e2e przeciągania i praca dla trybu red.
- **D7**:
  - (b): zmiany w `sw.ts` i `copies.ts` (nowy komunikat), parametr toastu w `toasts.ts`, testy workera.
  - (c): parametr w `NOTICE_PARAMS`, więc test e2e 3 odpada albo się odwraca, co osłabia FR-044.
- **D8 (reset od razu)**: zwykły formularz Astro, bez wyspy z dialogiem.
- **D9 (także następna noc)**: trasa przyjmuje tonight+1, a hook i edytor działają przy `?night=next`. Zmienia się reguła `nightOver`, smoke i e2e, a część F2 o bramce znika. Edycja jutra trafia do kopii next-night dopiero po `NEXT_REFRESH_MS` (1 h).
- **D10 (explainer jak FinderLocked)**: wyższy blok ze stałym przykładem, czyli większy skeleton, specimen `/design` i sprawdzenie przepełnienia na telefonie.
- **D11**:
  - (b): `dropPlanCopies` na wzór `dropFinderCopies` z `freeSince`, znacznik na `OfflineCopy` i testy workera. „No worker change” przestaje obowiązywać.
  - (c): usuwanie w `account-plan.mjs` albo trigger na `account_plans` (migracja i `test:db`). Smoke plan 5 się odwraca.
- **D12 (`set null`)**: nullable `site_id` z migawką nazwy. Unikalny klucz jest NULLS DISTINCT, więc rosną osierocone wiersze. Znika `needsSite` (część F5), a test kaskady staje się testem set null.
- **D13 (zawsze sugerowany plan)**: odpada 4.5, a kafelek i strona planu się rozjeżdżają.
- **D14 (traktuj jak free)**: `OfflineCopy` renderuje się zawsze i przejściowy błąd nadpisuje kopię po edycji. Płacący użytkownik nie może wtedy zobaczyć linii blokady, a `editsUnavailable` znika.
- **D15 (budować na `action`)**: `action` jest już usunięty na `feat/ui-refine`, więc to pewne błędy TS po rebase. Ta odpowiedź zdejmuje jednak blokadę, którą F1 nakłada na Fazę 3. Lepiej zostać przy rekomendacji i przenieść część wyspy do Fazy 3 (F1).

## Decisions recorded (2026-10-14)

Owner: D1–D15 all ⭐ except D2 = (b) and D7 = (b); F4, F7, F9 answered as above. Applied to `plan.md` and `plan-brief.md`; ui-quiet-actions status updated (Phases 1–2 committed, `action` removed; editor phase builds on it after merge).

## Pytania do właściciela

1. **(F4, uzupełnienie D4)** Gdy użytkownik zapisuje listę, w której są cele z „Nie ma w dzisiejszym planie”: czy te cele mają zostać na liście (trasa sprawdza okno tylko dla nowo dodanych; rekomendacja), czy edytor ma je usuwać przy zapisie i o tym informować?
2. **(F9, F7, UI)** Wiersz obiektu spod progu, dodany przez użytkownika, nie ma swojego miejsca na stronie Targets: czy ma być wierszem bez linku (rekomendacja), czy linkować gdzie indziej? Oraz: czy przyciski Move i Remove z samą ikoną mają być `quiet` z rozmiarem `icon` (rekomendacja), czy `ghost`, jak w onboardingu?
