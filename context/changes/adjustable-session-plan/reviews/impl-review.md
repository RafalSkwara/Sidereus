<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Adjustable Session Plan (M-3 S-08)

- **Plan**: context/changes/adjustable-session-plan/plan.md
- **Scope**: Full plan (Phases 1–6, head e57c574, main c650a8a)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 8 warnings, 2 observations

Przegląd wykonali reviewer Opus i czterej podagenci Opus: zgodność z planem; baza danych, bramki i trasy; offline i service worker; UI, a11y i i18n. Przegląd był tylko do odczytu. Migracji nie zastosowano do współdzielonego lokalnego Supabase. Nie uruchamiano serwerów, `test:db`, smoke, e2e ani `npm run build` (preview może serwować `dist` tego worktree). Wnioski o RLS pochodzą z lektury SQL i testów, nie z bazy.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Kryteria sukcesu: co sprawdzono

Uruchomione na e57c574:

| Polecenie | Wynik |
|---|---|
| `npm test` | 2162 passed, 1 skipped, 6 todo, exit 0 |
| `npm run lint` | exit 0 |
| `npx astro check` | 0 errors / 0 warnings / 0 hints |
| `npx prettier --check CLAUDE.md context/foundation/test-plan.md context/foundation/prd.md` | czysto |

Podagenci uruchomili też suity cząstkowe:

| Suita | Wynik |
|---|---|
| `src/lib/session-plans`, `plan-window`, `plan-edits`, `src/lib/finder` | 117/117 |
| `src/lib/offline` | 180/180 |
| `src/styles`, `src/i18n`, `plan-editor`, `plan-editor-view` | 28/28 |

Nieuruchomione tutaj, bo potrzebują bazy, serwera albo zmieniają `dist`: 1.1–1.3, 1.6, 3.3, 4.3, 4.4, 5.3–5.5. Zaufanie do nich opiera się na notatce w Progress: e2e 72 passed, 4 pominięte; smoke plan 1–7; build.

Kontrole ręczne:

- **6.2** czeka na właściciela.
- **5.6** odhaczone, ale „red rozróżnia kształtem” jest prawdą tylko w red. W dark i light `aria-disabled` rozróżnia wyłącznie kolor (F5).
- **5.7** („tylko klawiatura”) wykonano Playwrightem, nie ręcznie. Spec przenosi fokus przez `.focus()`, a nie Tab, więc kolejność tabulacji nie jest udowodniona.

Brak dowodów na odhaczanie na ślepo: każda pozycja ma SHA i ślad w diffie.

## Findings

### F1 — Nieudany odczyt `session_plans` gubi przyczynę i nie zostawia śladu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/load.ts:170
- **Detail**:
  - Store rzuca `Error("errors.load.sessionPlan", { cause })`. `loadTonight` zamienia go na `() => ({ edits: null, error: PLAN_EDITS_FAILED })`, odrzuca `cause` i niczego nie loguje.
  - Dla użytkownika stan D14 jest poprawny („unavailable”, bez `OfflineCopy`), ale produkcja nie dostaje żadnego sygnału. Regresja RLS albo grantu na `session_plans` sprawi, że edycje wszystkich płacących użytkowników znikną po cichu, a dashboard równie cicho pokaże plan sugerowany.
  - Analogiczny odczyt planu konta loguje stałą linię z kodem błędu (`src/lib/account-plan/index.ts:44-45`).
  - Narusza to regułę „never hide the evidence / no dropped error causes”.
- **Fix**: Jedna stała, allowlistowana linia (`eslint-disable-next-line no-console -- …` plus wpis z licznikiem w `ALLOWED_DISABLES`) ze słowem kroku i `error.name` albo kodem z `cause`, nigdy z treścią, wzorem `getAccountPlan` / `logMilestoneFailure`.
- **Decision**: ACCEPTED (2026-10-15, as proposed): one fixed, allowlisted log line with the step and the cause's code/name (never its content), `cause` kept; `ALLOWED_DISABLES` entry with its count.

### F2 — Po wolnym redirekcie po zapisie widać stary plan, a kopia offline się nie odświeża

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/sw.ts:587-612 (`networkFirst`), src/sw.ts:635 (`afterNavigation`), src/sw.ts:512-526 (`pagesStoring`)
- **Detail**:
  - **(a) Wolny redirekt.** POST trafia do bazy, ale nawigacja na `/tonight/plan?site=X&saved=plan` trwa ponad `NETWORK_TIMEOUT_MS` (4 s). To realne na słabym zasięgu pod ciemnym niebem, dla którego ten timeout istnieje.
    - Worker podaje wtedy kopię sprzed zapisu (`data-from-device`): bez tostu i bez `[data-store-after-save]`, więc `store-page` nie wychodzi.
    - Spóźniona odpowiedź sieci jest odrzucana, bo `saved` jest w `NOTICE_PARAMS`.
    - Użytkownik widzi stary plan bez potwierdzenia i może zapisać ponownie. Kopia offline zostaje nieaktualna do następnej wizyty online.
    - To ogólne zachowanie parametrów powiadomień, ale tutaj boli najbardziej, bo treścią strony jest właśnie edycja.
  - **(b) Drugi zapis.** `pagesStoring` porzuca drugi `store-page`, gdy pierwszy jest jeszcze w locie (do 30 s). Na urządzeniu może zostać lista A, choć serwer ma B.
- **Fix A ⭐ Recommended**: W gałęzi `late` w `afterNavigation`, gdy jedyną przeszkodą jest parametr tostu, worker sam uruchamia `storePageNow(withoutParams(url, TOAST_PARAMS))`. `pagesStoring` dostaje flagę „dirty”, która ponawia zapis raz po zakończeniu bieżącego, zamiast go porzucać.
  - Strength: Domyka D7 b w obu wyścigach i reużywa istniejącej, walidowanej ścieżki `storePageNow`.
  - Tradeoff: Kolejna logika w workerze. Potrzebny test e2e z opóźnionym redirektem (proxy z opóźnieniem).
  - Confidence: MED — scenariusz (a) wynika z kodu, nie został odtworzony.
  - Blind spot: Nie sprawdzono, czy proxy e2e potrafi opóźnić pojedynczą odpowiedź.
- **Fix B**: Nigdy nie podawać kopii z magazynu dla URL-a z parametrem tostu (czekać na sieć jak dla strony bez kopii).
  - Strength: Najprostsze: po zapisie użytkownik zawsze widzi wynik serwera.
  - Tradeoff: Na słabej sieci ekran po zapisie czeka dłużej. Nie naprawia (b).
  - Confidence: MED — zmiana jednego warunku, ale dotyczy wszystkich parametrów tostu w Tonight.
  - Blind spot: Wpływ na `logged` i `skyChecked` na innych stronach Tonight.
- **Decision**: ACCEPTED (owner, fixed in this change): Fix A extended. The after-save landing (`/tonight/plan` with `saved=plan|plan-reset`) no longer races the 4 s timeout: the worker waits for the network and falls back to the stored copy only when the fetch fails, so the user sees the server's answer with the toast and the page sends `store-page`. `pagesStoring` gets a dirty flag, so a `store-page` arriving while one is in flight re-runs once after it instead of being dropped. Proven by an e2e test with a delayed redirect and a deliberate-break check.

### F3 — Brak testów tras dla większości odmów (dryf od kryterium 3.1)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: src/pages/api/tonight/plan.ts:25-68, src/pages/api/tonight/plan/reset.ts
- **Detail**:
  - Kryterium 3.1 wymienia „route … cases”, ale nie ma testów handlerów. Testowane są pomocnicze `checks.ts`, `redirect.ts`, `schemas.ts` i `read.ts`.
  - Smoke pokrywa `needsFull`, zapis pustej listy, reset i stan bez logowania. E2e pokrywa tylko `nightOver`.
  - Nic nie przechodzi przez trasę dla: `errors.sessionPlan.notVisible` (F4), `errors.notFound.site` (cudze id stanowiska), odmowy `isKnownTarget` (`NGC1`), odmów schematu (duplikat, 31 kluczy) i fail-closed przy błędzie odczytu zapisanej listy.
  - Usunięcie linii `keysWithoutWindow(...)` (plan.ts:56) albo przesunięcie `siteStore.get` za zapis zostawi wszystko zielone. Render nadal nie narysuje wiersza bez okna, ale kontrakt trasy (kroki 4–7) nie jest przypięty.
- **Fix A ⭐ Recommended**: Dodać kroki smoke: `plan 8` dla `notVisible` (nowy klucz bez okna, np. obiekt pod horyzontem tej nocy), `plan 9` dla cudzego `site`, `plan 10` dla `NGC1` i duplikatu. Każdy z dokładnym `location`.
  - Strength: Smoke już ma pełnego użytkownika, stanowisko i noc z wyspy. Wzór kroków plan 1–7 jest gotowy.
  - Tradeoff: Potrzebny klucz bez okna, deterministyczny na fiksturze. Wybór obiektu zależy od daty.
  - Confidence: MED — wybór klucza „bez okna” musi być stabilny w czasie.
  - Blind spot: Jak smoke wybiera stanowisko (szerokość) w CI.
- **Fix B**: Testy jednostkowe handlerów z zamockowanym `locals` (supabase, `requireFullPlan`, `siteStore`, `sessionPlanStore`).
  - Strength: Szybkie, deterministyczne, pokrywają też kolejność kroków.
  - Tradeoff: Repo nie ma dziś testów w `src/pages`, więc to nowy wzorzec i dużo mocków.
  - Confidence: MED.
  - Blind spot: Import `astro:env` i innych wirtualnych modułów w Vitest.
- **Decision**: ACCEPTED (as proposed, Fix A): smoke steps for the refusals with exact `location`s: `notVisible` (a newly added key that never rises at smoke's site), a foreign site id (`errors.notFound.site`), an unknown catalogue key (`NGC1`) and a duplicate key.

### F4 — Test izolacji nie łapie usunięcia warunku użytkownika w polityce INSERT

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/db/isolation.test.ts:95-97, :175-188; tests/db/session-plans.test.ts:98-140
- **Detail**:
  - Generyczny przypadek „another user cannot insert a row owned by the first user” wysyła `rowOn(siteOfA)` z `user_id` A. Dla `session_plans` taki wiersz odrzuca już sam warunek stanowiska, więc komentarz „only the user fails” jest dla tej tabeli fałszywy.
  - Żaden test nie wstawia jako B wiersza `{ site_id: siteOfB, user_id: a.userId }`, czyli jedynego, który pada wyłącznie na warunku użytkownika. „Hand over” izoluje ten warunek tylko dla UPDATE.
  - Uproszczenie `with check` INSERT do samego `exists(...)` pozwoliłoby B podrzucać wiersze na swoim stanowisku pod `user_id` A, a suite zostałby zielony.
  - Sama migracja jest dziś poprawna.
- **Fix**: W `session-plans.test.ts` dodać przypadek insertu B na stanowisku B z `user_id` A (oczekiwane `42501`), z kontrolą pozytywną (insert B na stanowisku B pod własnym `user_id`), i poprawić komentarz w `isolation.test.ts:95-97`.
- **Decision**: ACCEPTED (as proposed): B inserting on B's site under A's `user_id` → `42501`, with B's own-row positive control; the `isolation.test.ts` comment corrected. Deliberate-break check: drop the user check from the INSERT policy, the new case turns red.

### F5 — Krańcowe przyciski Move rozróżnia tylko kolor (dark/light, WCAG 1.4.1)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/PlanEditor.tsx:47, src/components/ui/button.tsx:46
- **Detail**:
  - To znany problem z Progress. Kształt (przerywana ramka) dla `aria-disabled` jest tylko za wariantem `red:`. W dark i light wariant `quiet` zmienia jedynie kolor tekstu.
  - Kontrast między włączoną a wyłączoną ikoną:

    | Motyw | Włączona | Wyłączona | Kontrast |
    |---|---|---|---|
    | dark | #c3d0ff | #a9b1c5 | 1,41:1 |
    | light | #23439f | #3c465c | 1,07:1 |

  - W light to sama zmiana odcienia. Osoba z zaburzeniem widzenia barw nie odróżni nieaktywnego „Przesuń wyżej” w pierwszym wierszu, naciśnie go i nic się nie stanie.
  - Kryterium 5.6 sprawdzało to tylko w red.
- **Fix**: Usunąć prefiks `red:` z reguły ramki `aria-disabled` (jedna reguła dla wszystkich motywów) albo dodać niekolorowy sygnał (np. `aria-disabled:[&_svg]:opacity-40`), i poprawić notkę „red mode only” na `/design`.
- **Decision**: ACCEPTED (as proposed): a non-colour signal for `aria-disabled` Move in every theme (the dashed outline no longer only under `red:`), `/design` note updated.

### F6 — Edytor nie ogłasza skutków Move/Remove/Add czytnikowi ekranu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/PlanEditor.tsx:97-110, :252-256
- **Detail**:
  - Edytor nie ma `role="status"` ani `aria-live`. Po przesunięciu fokus wraca na ten sam przycisk, więc czytnik co najwyżej powtórzy jego nazwę.
  - Użytkownik nie usłyszy nowej pozycji ani tego, że pojawiła się wskazówka D2. Po Add fokus zostaje na Add i nic nie mówi, że cel dopisano.
  - Plan tego nie wymagał (D6 i F7 mówią tylko o fokusie), więc to luka planu, nie dryf.
- **Fix**: Jeden ukryty wizualnie region `role="status"` w edytorze, aktualizowany przy każdej akcji. Nowe klucze EN/PL, np. `movedTo({ name, position, count })`, `removed({ name })` i `added({ name })`, plus opcjonalnie dopisek `endsBeforePrevious`.
  - Strength: Standardowy wzorzec dla list z przyciskami przesuwania. Zmiana mieści się w jednej wyspie.
  - Tradeoff: Nowe klucze w obu językach i asercja e2e na tekst regionu.
  - Confidence: HIGH — wzorzec dobrze znany.
  - Blind spot: Zachowanie VoiceOver przy szybkich kolejnych zmianach (debounce).
- **Decision**: ACCEPTED (owner, fixed in this change): one visually hidden `role="status"` region in the editor announcing Move (new position of count, plus the D2 hint when it applies), Remove and Add; EN/PL keys; e2e asserts its text.

### F7 — Polskie teksty: zły przypadek w nazwach dostępnych, mylący `held` i drobne poprawki

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/i18n/messages/pl.ts (`tonight.pages.plan.*`, `errors.sessionPlan.notVisible`), src/i18n/messages/en.ts:1290 (`held`)
- **Detail**:
  - **Nazwy dostępne.** `moveUp`, `moveDown` i `remove` wstawiają nazwę w mianowniku po czasowniku wymagającym biernika: „Przesuń M31 · Galaktyka Andromedy wyżej”, „Usuń Mars z planu”. Katalog rozwiązuje to już dwukropkiem (`open: Otwórz: ${page}`, z komentarzem o formie podstawowej).
  - **`held`.** Teksty obiecują powrót zmian „gdy noc będzie nadawać się do obserwacji” (EN: „on a night that clears”). Lista jest jednak per (użytkownik, stanowisko, **noc**), więc wróci tylko, jeśli dzisiejsza noc się poprawi. Użytkownik czekający na jutrzejszą pogodną noc ich nie zobaczy.
  - **Pozostałe propozycje:**

    | Klucz | Obecnie | Propozycja |
    |---|---|---|
    | moveUp | `Przesuń ${name} wyżej` | `Przesuń wyżej: ${name}` |
    | moveDown | `Przesuń ${name} niżej` | `Przesuń niżej: ${name}` |
    | remove | `Usuń ${name} z planu` | `Usuń z planu: ${name}` |
    | held (PL) | Zapisane zmiany wrócą, gdy noc będzie nadawać się do obserwacji. | Zapisane zmiany na dziś wrócą, jeśli ta noc będzie nadawać się do obserwacji. |
    | held (EN) | Your saved changes come back on a night that clears. | Your saved changes for tonight return if the night turns good enough to observe. |
    | endsBeforePrevious | Jego okno kończy się przed najlepszą porą celu wyżej. | Okno kończy się przed najlepszą porą poprzedniego celu. |
    | locked | W pełnym planie możesz zmieniać kolejność celów, usuwać je i dodawać nowe. | Pełny plan: możesz tu zmieniać kolejność celów, usuwać je i dodawać nowe. |
    | reset / resetConfirm / resetDone | …plan proponowany… | …proponowany plan… (np. „Przywróć proponowany plan”, „Przywrócono proponowany plan.”) |
    | saved | Plan zapisany | Zapisano plan. (wzór „Zapisano stanowisko.”) |
    | addNoMatch | Nie pasuje żaden cel z oknem na dziś. | Żaden cel widoczny dziś nie pasuje. |
    | addFull | Plan mieści do 30 celów. Usuń któryś, aby dodać nowy. | `Plan mieści najwyżej ${max} celów. Usuń jeden, aby dodać kolejny.` (z parametrem, zob. F10) |
    | notVisible | Jeden z dodanych obiektów… | Jeden z dodanych celów nie ma dziś okna widoczności. |

- **Fix**: Zastosować formy z dwukropkiem dla `moveUp`, `moveDown` i `remove` (EN może zostać albo przejść na „Move up: …”), poprawić `held` w obu językach i przyjąć pozostałe propozycje według uznania właściciela.
- **Decision**: ACCEPTED (owner): the reviewer's Polish fixes, all rows of the table, with button names using a colon ("Przesuń wyżej: M31 · Galaktyka Andromedy", "Usuń z planu: Mars") and `held` saying the edits are saved for today (EN aligned); `addFull` takes `{ max }`.

### F8 — `planEditable` pomija testy także na stanach awarii

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/helpers.ts:207-212 (używane w session-plan-store.spec.ts:63-64, session-plan-edit.spec.ts:55, tonight-phone.spec.ts:166)
- **Detail**:
  - Helper zwraca `false` dla każdego stanu poza `suggested` i `edited`, w tym dla `unavailable` (awaria odczytu planu lub edycji) i `locked`, a spec robi wtedy `test.skip`.
  - Na fiksturze (bezchmurnie, Madryt z ciemnością przez cały rok) uzasadniony pomijany stan `held` praktycznie nie występuje.
  - Jedyny realny powód pominięcia to więc regresja, np. zepsute RLS albo odczyt `session_plans`. Zamienia ona specy zapisu i edycji w ciche pominięcia zamiast czerwonego przebiegu.
- **Fix**: Pomijać tylko `held`. Na `unavailable` i `locked` padać przez `expect(state).toMatch(/^(suggested|edited)$/)`.
- **Decision**: ACCEPTED (as proposed): `planEditable` skips only on `held` and fails on `locked`, `unavailable` or a missing marker.

### F9 — Dryf w plan-window i nieścisłości CLAUDE.md

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/tonight/plan-window.ts:44-102, src/lib/session-plans/checks.ts:20-33, CLAUDE.md
- **Detail**:
  - **`solarSystemWindow`.** Plan mówił o wydzieleniu go z `build.ts` tak, by build też go używał. Wydzielono tylko `planetWindowFor`. Wiersze planet i Księżyca nadal pochodzą z `rankPlanets` / `moonTarget`, a `solarSystemWindow` powiela ich reguły (próg apertury dla lodowych olbrzymów, oświetlenie Księżyca). Zgodność trzyma tylko `plan-window.test.ts:144-194`.
  - **Sprawdzenie okna w trasie.** Sprawdzenie F4 obejmuje tylko geometrię: bez zasięgu teleskopu i bez progu apertury. Bezpośredni POST może więc dopisać klucz, który build pokaże w „Poza dzisiejszym planem”. Jest to udokumentowane i nieszkodliwe (wiersz nigdy nie powstaje poza oknem), ale słabsze niż planowane „by the build's own rule”.
  - **Nieścisłości w CLAUDE.md:**
    - `unavailable` obejmuje też `plan === null` (PlanPageContent.astro:83-84), a wtedy `OfflineCopy` jest renderowane;
    - akapit o finder chart (linia 17) wciąż podaje `from=targets|planets`, bez `plan`;
    - reguła „Clickables” wylicza użycia `hairline` wyczerpująco, a nie ma w niej „Edytuj plan” ani „Dodaj”.
- **Fix**: Zaktualizować CLAUDE.md w tych trzech miejscach (przy okazji 6.2) i dopisać do planu notkę, że `solarSystemWindow` jest pilnowany testem zgodności, a nie wspólnym kodem.
- **Decision**: ACCEPTED (as proposed): CLAUDE.md fixed in the three places (`unavailable` with `plan === null` keeps `OfflineCopy`; finder `from=plan`; Clickables `hairline` list), and a plan note that `solarSystemWindow` is held to the build by a parity test, not shared code.

### F10 — Drobne: literał limitu, teksty stanów, pusty zapis, fokus dialogu, zakres `store-page`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: en.ts/pl.ts `addFull`; PlanPageContent.astro:75; PlanEditor.tsx:160-165; PlanResetButton.tsx; src/lib/offline/copies.ts:204; src/sw.ts:574-575, :776
- **Detail**:
  - **(a)** `addFull` ma na sztywno „30”, co dubluje `SESSION_PLAN_MAX_TARGETS` (znany problem). Liczba powinna przychodzić parametrem `{ max }`.
  - **(b)** `editsUnavailable` („Nie udało się wczytać Twoich zmian…”) pokazuje się przy każdym `unknown` odczycie planu konta, także użytkownikowi bez żadnych edycji. Lepsze byłoby neutralne „Edycja planu jest teraz niedostępna, dlatego widzisz proponowany plan.”
  - **(c)** Zapis bez zmian utrwala sugestię jako „Zmieniony przez Ciebie” i odcina późniejsze zmiany sugestii (D1). Można zablokować Save, gdy stan równa się początkowemu.
  - **(d)** Add z wpisanym, ale niewybranym tekstem tylko przywraca fokus pickerowi, bez wyjaśnienia.
  - **(e)** Dialog resetu nie oddaje fokusu jawnie triggerowi. Safari po kliknięciu myszą ląduje na `body`; ta sama luka jest w `DeleteButton`.
  - **(f)** `storeRequestFrom` akceptuje wszystkie siedem stron Tonight, także `/tonight`. Pobranie jej przez workera wywołuje `record_sky_verdict`, choć wiadomość wysyła tylko `/tonight/plan`. Wąska allowlista (`/tonight/plan`) lepiej oddaje „narrow” z planu.
  - **(g)** Puste `catch` w `storePageNow` i `.catch(() => undefined)` w handlerze wiadomości są zgodne z istniejącym `storeNextCopy`, ale obejmują też `commit` / `afterCommit`, więc błąd programistyczny zniknie bez śladu.
  - **(h)** Wiersze „Poza dzisiejszym planem” pokazują sam label („M7”), a wiersze planu „M31 · Galaktyka Andromedy”.
  - **(i)** E2e: kilka odczytów `editorKeys` bez `expect.poll` (session-plan-edit.spec.ts:135, 177, 181, 186, 269-273). Brak pokrycia fokusu po Add, krańcowego Move down, powrotu fokusu po Escape w dialogu i resetu w specu store.
- **Fix**: Zebrać jako jedną poprawkę porządkową. Najpierw (a), (b), (f) i (i), pozostałe według uznania.
- **Decision**: ACCEPTED (as proposed, at the reviewer's priority): (a) `addFull` with `{ max }`; (b) neutral `editsUnavailable`; (f) `storeRequestFrom` accepts only `/tonight/plan` (also Fable #3, owner); (i) `expect.poll` for `editorKeys`, focus after Add, the edge Move down, focus back after Escape, reset in the store spec; (c) Save disabled while the list equals the opened one; (e) the reset dialog returns focus to its trigger; (h) "Not on tonight's plan" rows use the same label as plan rows. Not done: (d) (low value, the picker keeps focus) and (g) (the same best-effort pattern as `storeNextCopy`, and the worker has no logging channel); both left as recorded observations.

## Zweryfikowane bez zastrzeżeń (skrót)

**Migracja**

- RLS włączone, dokładnie cztery polityki `to authenticated` z `(select auth.uid()) = user_id`.
- `with check` w INSERT i UPDATE wymaga własnego stanowiska; UPDATE ma też `using`.
- B nie może przepiąć `site_id` na stanowisko A ani `user_id` na A.
- `on delete cascade` dla użytkownika i stanowiska, `site_id NOT NULL`, unikalne `(user_id, site_id, night)`.
- CHECK-i na liście celów:
  - regex jest wiernym odpowiednikiem `observations_target_key`, z poprawnym zakotwiczeniem (`M0`, `M01`, `M111`, `NGC0`, `NGC10000`, `ngc1`, `M31x` są odrzucane);
  - osobno odrzucane są przecinek w elemencie, pusty element, `NULL` (`array_position`) i 31 elementów;
  - `{}` jest akceptowane.
- Wpis `TABLES` z `needsSite` i test strukturalny są w porządku.

**Bramka pełnego planu**

- Strona i wyspa: `readPlanEditsFor` sprawdza `getAccountPlan === "full"` przed zapytaniem.
- Wyciek URL-a wyspy, wyspa bez logowania: nic nie renderuje.
- Plan free: linia blokady, bez edycji, kandydatów i propsów edytora.
- Plan `unknown` albo nieudany odczyt edycji: `unavailable`, bez linii blokady i bez `OfflineCopy` (D10, D14).
- Dashboard zachowuje `OfflineCopy` przy `planEditsError`.

**Obie trasy POST**

- Kolejność kroków 1–9 zgodna z planem: `requireFullPlan` przed jakimkolwiek odczytem, fail-closed przy błędzie odczytu zapisanej listy.
- Okno sprawdzane tylko dla nowych kluczy (F4) helperami buildu.
- Redirekty niosą tylko stałe klucze, a `site=` tylko po `isGearId`.
- `/api/tonight` jest w `PROTECTED_ROUTES`; `checkOrigin` Astro działa jak w innych trasach.

**Data nocy (D9)**

- `tonightDateForSite` jest liczone raz w `loadTonight` i przekazywane do hooka i buildu.
- Hook i kandydaci są tylko dla `tonight`; build dodatkowo ignoruje edycje dla `next`.
- Trasa porównuje noc z formularza z `tonightDateForSite`; reset również.

**Offline (D7, D11)**

- `saved` jest w `NOTICE_PARAMS`.
- `storeRequestFrom` sprawdza: to samo origin, dokładną ścieżkę, jedyny parametr `site` przechodzący `isGearId`, odrzuca `night=next` i parametry powiadomień, usuwa hash.
- Worker działa pod `waitUntil`, bierze scope przed fetchem, używa `redirect: "manual"`, a commit przechodzi przez `copyMetaFor` (wymaga `data-offline-copy`, owner i site).
- Stan free renderuje `OfflineCopy`, więc kopia zostaje zastąpiona przy następnej odpowiedzi online; plan-loss drop nie istnieje (D11).
- E2e store stosuje regułę z lessons: proxy zamknięte, potem asercja `html[data-from-device]`.

**Brak współrzędnych w URL-ach i logach**

- Brak nowych `console.*` i `eslint-disable`; `ALLOWED_DISABLES` bez zmian.
- Linki `from=plan` niosą tylko id.

**Edytor**

- Klucze Reacta są per cel.
- Fokus:
  - po otwarciu przechodzi na listę (`tabIndex=-1`);
  - Cancel wraca do „Edytuj plan”;
  - Move zostaje na tej samej kontrolce, także `aria-disabled`, która pozostaje fokusowalna z połkniętym kliknięciem;
  - Remove przechodzi do następnego Remove, a w razie jego braku na listę.
- Picker jest poza formularzem zapisu.
- `data-needs-network` jest tylko na Edit, Save oraz triggerze i potwierdzeniu resetu.
- Jeden `default` na ekran.
- Dialog resetu: `role="alertdialog"`, początkowy fokus na Anuluj, Escape zamyka.

**Warianty z #163**

- Move i Remove: `quiet` / `icon` (44 px).
- Edit i Add: `hairline` / `sm`.
- Cancel: `quiet` / `bare` z ikoną.
- Brak arbitralnych wartości i literalnych kolorów; testy kolorów, kontrastu i red przechodzą.

**i18n**

- Parytet EN i PL (test przechodzi).
- PL mieści się w 320 px (`tonight-phone`).

**Zakres**

- Dodatki poza planem są pomocnicze albo wymuszone:
  - `checks.ts`, `read.ts`, `plan-editor-view.ts`, `PlanEditRow.astro`, `PlanNote.astro`;
  - `data-object-card` i selektor w `what-to-expect.spec.ts`;
  - roadmapa;
  - formatowanie prettier w b78e3e3.
- Asercje nie zostały osłabione.

## Uwagi dla orkiestratora

- `change.md` ma nadal `status: implementing`. Zgodnie z zakresem zadania zapisano tylko ten plik raportu, a stempel `impl_reviewed` (i `updated: 2026-10-15`) zostaje do nadania przez orkiestratora.
- Triaż: decyzje właściciela i orkiestratora z 2026-10-15 wpisane przy każdym znalezisku (F1–F10 przyjęte). Z drugiej opinii (Fable, tylko do odczytu, werdykt SHIP) przyjęto: Reset także w stanie `held` (Fable #2) i `storeRequestFrom` tylko dla `/tonight/plan` (Fable #3 = F10 f); Fable #1 (D11 z założenia) i #4 (kosmetyczne) bez zmian.
