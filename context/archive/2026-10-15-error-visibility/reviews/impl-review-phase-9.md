<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Production Error Visibility (M-4 S-07)

- **Plan**: context/changes/error-visibility/plan.md
- **Scope**: Phase 9 of 9 (raportowanie z wysp i przeglądarki, ostatnia faza)
- **Reviewed phases**: 9
- **Date**: 2026-10-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations
- **Reviewed at**: `b23a9b9` (feat/error-visibility-islands), diff `161ba59..b23a9b9`, kod w `a7cf889`
- **Reviewer**: agent herdr `reviewer` (tylko do odczytu: ten plik to jedyny zapis; `change.md` nie jest stemplowany, zgodnie z regułami orkiestratora)

Faza 9 jest zrobiona dobrze. Filtr własnych skryptów jest szczelny wobec podróbek originu, wejścia z konsoli i błędu „Script error.” z innego originu. Payload to wyłącznie `{ step, name }`. Strażnik importów zamyka F3 z przeglądu Fazy 8, a logger nie trafia do paczki przeglądarki. Pełne e2e w trybie CI i smoke są zapisane z liczbami. Ostrzeżenie F1 dotyczy założenia samego D15: nie każdy nasz skrypt mieszka pod `/_astro/`.

## Verdicts

| Dimension           | Verdict                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Adherence      | PASS                                                                                                                                                  |
| Scope Discipline    | PASS (`gear/catalogue/load.test.ts` ponad plan, uzasadniony: przypina odzyskanie po zresetowaniu pamięci podręcznej, na które powołuje się allowlist) |
| Safety & Quality    | WARNING (F1)                                                                                                                                          |
| Architecture        | PASS                                                                                                                                                  |
| Pattern Consistency | PASS                                                                                                                                                  |
| Success Criteria    | PASS (obserwacje F2, F3; 9.7 czeka na właściciela)                                                                                                    |

## Evidence

**Bramki przy `b23a9b9`** (Node 24.21.0; worktree czysty przed i po, bez `playwright-report/` i `test-results/`): `npm test` (oba projekty) 867 zaliczone, 1 pominięty (zgodnie z zapisem w 9.6); `npm run lint` czysto; `npx astro check` 0 błędów, 0 ostrzeżeń, 3 podpowiedzi; `npm run build` OK.

**Paczka przeglądarki.** W `dist/client/_astro/*.js` nie ma śladów loggera: kroki serwerowe (`forecast.cache-missing`, `config.rate-limit`) i szablon linii `sidereus: ${…}` występują 0 razy. Reporter strony (`island.unhandled-rejection`) siedzi w jednym wspólnym chunku (`client.*.js`), więc skrypt Layoutu i wszystkie wyspy dzielą jedną instancję, czyli jeden limit 5 i jedną deduplikację. W `dist/client/sw.js` nie ma `unhandledrejection`, więc barrel nie trafił do workera.

**Filtr D15** (`browser.ts`, `isOwnScript`):

- Warunek to `filename.startsWith(\`${location.origin}/_astro/\`)`. Ukośnik po originie sprawia, że podróbka `https://<nasz-host>.evil.example/_astro/x.js`nie przechodzi, podobnie jak`blob:`, `chrome-extension://`, pusty `filename`(konsola w Chromium) i`"undefined"`(konsola w WebKit). Wartość spoza ciągu znaków daje`false`.
- `event.error` równe `null` lub `undefined` (błąd „Script error.” z innego originu, nieudane wczytanie zasobu) jest odrzucane przed filtrem.
- `island.hydration` rozpoznaje `/hydrat/i` w `message`. Komunikat służy tylko do tego testu, nigdy nie jest zapisywany ani wysyłany (test jednostkowy to sprawdza).
- `unhandledrejection` idzie bez filtra, zgodnie z D15.
- Instalacja jest idempotentna (`WeakSet` na `window`). Moduł nie dotyka `window` przy imporcie, więc import po stronie SSR w wyspach jest bezpieczny.

**Payload.** Rdzeń z Fazy 7 wysyła tylko `{ step, name? }`. e2e `client-errors.spec.ts` sprawdza klucze dokładnie `["name","step"]` i brak współrzędnych, e-maila oraz nazwy skryptu w ciele. `send` wysyła beacon `text/plain` (z `Origin` strony, więc przechodzi `checkOrigin` Astro), a gdy beacon jest niedostępny albo go odrzuci, `fetch` z `keepalive` (test na oba przypadki).

**Wyszukiwanie miejsc** (`LocationPicker.tsx`): `report("island.geocode", …)` stoi po `if (controller.signal.aborted) return;`, zgodnie z F7 rundy 3. Czy potrzebny jest test, oceniam w F2.

**Strażnik importów** (`client-imports.test.ts`): moduły w `observability/client/` nie mogą importować silnika, katalogu, `log-failure`, `client-report`, `rate-limit`, `cloudflare:*`, `astro:*` ani wbudowanych modułów Node. Sprawdza to zarówno przez alias, jak i ścieżkę względną. `sw.ts` i `offline/report.ts` nie mogą importować barrela ani loggera. Test ma sprawdzenie niepustości (dokładna lista plików i ich prawdziwe importy) oraz próbkę każdej zakazanej rodziny.

**Red-first i łamania** (`implementation-notes.md`, „Phase 9”):

- `browser.test.ts` został napisany na stubie, 9 z 9 czerwonych.
- Allowlist obniżono przed konwersją; strażnik pokazał dokładnie 6 miejsc.
- Mutacje jednostkowe: filtr, sprawdzenie `null`, hydracja, idempotencja, limit 5 → 6, `false` z beacona. Do tego import loggera i barrela w strażniku importów oraz usunięcie resetu pamięci podręcznej w `load.ts`.
- Trzy łamania na zbudowanej stronie: filtr zawsze `true`, usunięty raport w `TelescopeForm` i usunięte `installErrorReporting()`. Każde ma wskazany czerwony przypadek e2e.

**Pełne e2e i smoke** (9.6): świeży build, fixture, lokalny stack, klucze inline, `CI=1`. Unit 134 pliki, 867 zaliczonych; `npm run test:e2e` 69 zaliczonych, bez flaków i skipów; smoke wszystkie kroki zaliczone. To zamyka F1 z przeglądu Fazy 8.

## Findings

### F1 — Pięć naszych skryptów jest wstawianych do HTML, więc filtr D15 pomija ich błędy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/observability/client/browser.ts (`isOwnScript`); D15 w plan.md; context/foundation/lessons.md (nowe zdanie o `/_astro/`)
- **Detail**: D15 i nowa lekcja zakładają, że „the build's own files live under `/_astro/`”. Astro jednak wstawia małe przetworzone `<script>` bez importów bezpośrednio do strony (`<script type="module">…</script>`). Manifest buildu (`inlinedScripts` w `dist/server/chunks/entrypoints_*.mjs`) wymienia sześć takich skryptów: `GearCard.astro`, `NotSeenMark.astro`, `TonightSubNav.astro`, `Notice.astro`, `offline.astro` oraz `design.astro`, który jest tylko w dev. Błąd rzucony w takim skrypcie, także w jego handlerach `click`, `change` czy `MutationObserver`, ma w `ErrorEvent.filename` adres strony, a nie `/_astro/…`. Filtr go więc odrzuca. To błędy naszego kodu na Tonight i `/offline`, które nigdy nie staną się `island.uncaught`, i nic tego nie mówi. Nic się nie psuje, ale pokrycie jest mniejsze, niż obiecują runbook i lekcja („our code threw outside a handler”). Samego zdarzenia z takiego skryptu nie sprawdzałem w przeglądarce; wniosek wynika z tego, jak `filename` działa dla skryptów inline.
- **Fix A ⭐ Recommended**: Zapisać tę lukę jako świadomą w D15, w wierszu `island.uncaught` w runbooku i w lekcji (np. „Astro inlines small scripts with no imports; their errors carry the page URL and are not reported”). Do tego otworzyć follow-up na Fix B.
  - Strength: Nic nie zmienia w buildzie ani w paczce offline. Dokumenty przestają obiecywać więcej, niż kod robi. Te skrypty to drobny kod DOM (wybór, tooltip, przewijanie, ogłaszanie notki, lista `/offline`) o małym ryzyku.
  - Tradeoff: Błąd w tych pięciu skryptach dalej jest niewidoczny.
  - Confidence: HIGH — lista pochodzi z manifestu buildu.
  - Blind spot: Nie mierzyłem, jak często te skrypty mogłyby się wywracać.
- **Fix B**: Wyłączyć wstawianie skryptów (`vite.build.assetsInlineLimit: 0` w `astro.config`, albo import pomocniczy w każdym z pięciu skryptów), żeby każdy nasz skrypt był plikiem pod `/_astro/`, a filtr pokrywał wszystko.
  - Strength: D15 staje się prawdą bez wyjątków; filtr się nie zmienia.
  - Tradeoff: `assetsInlineLimit` dotyczy też małych zasobów (obrazy, czcionki), a nie tylko skryptów. Precache workera (`build-sw.mjs`, dziś 63 pliki) i lista zasobów kopii offline urosną. Trzeba powtórzyć pełne e2e, zwłaszcza offline.
  - Confidence: MED — skutek dla zasobów innych niż skrypty nie jest sprawdzony.
  - Blind spot: Wpływ na rozmiar precache i na regułę `build-sw.mjs`.
- **Decision**: Fix A, applied 2026-10-19: the gap is written into D15 (plan), the runbook (`island.uncaught` row) and the lesson, naming the five inlined scripts; no `assetsInlineLimit` change (it touches the precache). `scripts/build-sw.mjs` now fails the build unless the Layout's script is an `_astro/Layout.astro_astro_type_script_*` chunk that imports the chunk holding the reporter (red when the Layout stops importing it). Follow-up issue #230 (label roadmap, on the board) for Fix B with the precache trade-off.

### F2 — Kolejność „najpierw `aborted`, potem raport” w wyszukiwaniu miejsc nie jest przypięta; jeden krok e2e by wystarczył

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/location/LocationPicker.tsx (handler odrzucenia wyszukiwania); tests/e2e/client-errors.spec.ts
- **Detail**: Lider przyznaje to wprost w notatkach. Moja ocena: test jest potrzebny, ale nie pilny. Gdyby raport przesunąć nad `return`, każde przerwane wyszukiwanie (każdy kolejny znak) dawałoby odrzucenie. `geocode.ts` zawsze rzuca zwykły `Error`, więc deduplikacja ograniczy to do jednego fałszywego `island.geocode { name: "Error" }` na stronę. Szkoda polega jednak na czym innym: licznik `island.geocode` w runbooku zacząłby liczyć „ktoś pisał”, a nie „wyszukiwanie zawiodło”, czyli straciłby znaczenie bez żadnego czerwonego testu. Spec ma już wszystko, czego trzeba (`captureReports`, `settle()`, `page.route`), a decyzja F7 rundy 3 była świadoma, więc warto ją przypiąć.
- **Fix**: Dodać przypadek do `client-errors.spec.ts`: `page.route` na API geokodowania z opóźnioną odpowiedzią, szybkie wpisanie kilku znaków (każde wyszukiwanie przerywa poprzednie), potem `settle()` i oczekiwanie braku `island.geocode`. Następnie odpowiedź 500 na ostatnie, bieżące wyszukiwanie i oczekiwanie dokładnie jednego `{ step: "island.geocode", name: "Error" }`. Opóźnienie trzeba zrobić bez zegara (spec ma zablokowany zegar przeglądarki), np. przez ręcznie zwalniany `route.fulfill`.
- **Decision**: Taken: a `client-errors.spec.ts` case holds geocoding by hand, a second keystroke cancels the first search and `settle()` finds no `island.geocode`, then a 500 on the current one gives exactly one report; shown red with the report moved above the `aborted` check. Also taken from Fable: the throwing `message` getter (red first in `browser.test.ts`, then `messageOf` guarded, allowlist entry with its reason); the runbook says counts are a floor and to watch `client.island.unhandled-rejection` the first week.

### F3 — Smoke zapisany bez liczby kroków

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 9.6
- **Detail**: Lekcja „Run the whole e2e suite before a PR” wymaga liczb w PR. Unit i e2e mają liczby (867, 69, bez flaków i skipów), a smoke tylko „all steps passed”. Po Fazie 7 smoke ma 5 nowych kroków `client-error`, więc liczba kroków pokazuje, że objął nowe ścieżki.
- **Fix**: Dopisać liczbę kroków smoke (PASS/FAIL) w 9.6 i w opisie PR.
- **Decision**: Taken: smoke is recorded with its count in 9.6 (80 of 80 passed, 0 failed) and goes in the PR.

## Manual verification

- **9.7** (sprawdzenie na żywo po wdrożeniu, odrzucona obietnica bez `filename`): `[ ]`, należy do właściciela.
- Po Fazie 9 z ręcznych pozycji całego bloku 7–9 zostają u właściciela 7.8, 7.9, 8.7 i 9.7. Runbook (`context/deployment/error-visibility.md`) ma teraz tabelę kroków klienta z opisem przyjętego szumu, co zamyka też F4 z przeglądu Fazy 8.
