<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Production Error Visibility (M-4 S-07)

- **Plan**: context/changes/error-visibility/plan.md
- **Scope**: Phase 8 of 9 (raportowanie z service workera)
- **Reviewed phases**: 8
- **Date**: 2026-10-19
- **Verdict**: APPROVED (pod warunkiem F1: pełne e2e w trybie CI przed PR)
- **Findings**: 0 critical, 1 warning, 3 observations
- **Reviewed at**: `8b1716e` (feat/error-visibility-sw), diff `04848f9..8b1716e`, kod w `3921f3f`
- **Reviewer**: agent herdr `reviewer` (tylko do odczytu: ten plik to jedyny zapis; `change.md` nie jest stemplowany, zgodnie z regułami orkiestratora)

Faza 8 jest zrobiona starannie. Każde przerobione miejsce w `sw.ts` zwraca dokładnie tę samą wartość co przedtem. Kroki sieciowe, limit 10 na wybudzenie i deduplikacja pochodzą z rdzenia z Fazy 7. `POST /api/client-error` przechodzi przez workera nietknięty, a kontrola buildu trzyma loggera poza paczką workera. Brakuje dowodu pełnego e2e (F1), a reszta to obserwacje o komentarzach i o świadomie przyjętym szumie.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (jedno miejsce ponad plan, opisane w planie: `purgeSignedOut`) |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS (obserwacja F3) |
| Pattern Consistency | PASS (obserwacja F2) |
| Success Criteria | WARNING (F1; 8.7 czeka na właściciela) |

## Evidence

**Bramki przy `8b1716e`** (Node 24.21.0, worktree czysty przed i po): `npm test` (oba projekty, w tym strażnik silent-catch) 843 zaliczone, 1 pominięty; `npm run lint` czysto; `npx astro check` 0 błędów, 0 ostrzeżeń; `npm run build` OK (`build-sw: … precaches 63 files`). W `dist/client/sw.js`: `over_request_rate_limit` występuje 0 razy (nie ma tam loggera ani mapy błędów auth), `client-error` raz, `keepalive:!0` jest obecne.

**Zachowanie każdego miejsca, przed i po** (przeczytane w diffie linia po linii). 20 miejsc z planu plus jedno nowe:

| Miejsce | Przed | Po | Zwracana wartość |
|---|---|---|---|
| `readIndex` (`.json()`) | `.catch(() => null)` | `reportAnd("sw.index", null)` | `null` jak przedtem |
| `keepAssets` (fetch) | `() => undefined` | `reportAnd("sw.precache", undefined)` | taka sama |
| `recordShell` | `() => undefined` | `reportAnd("sw.shell", undefined)` | taka sama |
| `afterCommit` → `storeOfflinePage` | `() => undefined` | `reportAnd("sw.offline-page", undefined)` | taka sama |
| `storeNextCopy`, `storePageRun` (gołe `catch {}`) | pusty blok | `report("sw.next-night"/"sw.store-page", error)` w bloku | bez `return` w `catch`, `finally` bez zmian, więc przepływ taki sam |
| `networkFirst`, timer: `stored().then(resolve, …)` | `resolve(undefined)` | `report("sw.shell")`, potem `resolve(undefined)` | taka sama |
| trasa `/_astro/`, `noteAsset` | `() => undefined` | `reportAnd("sw.asset-note", undefined)` | taka sama |
| nawigacja: `scope`, `settle`, `sweepSoon`, spóźniona sieć | `() => undefined` ×4 | `sw.index`, `sw.navigation`, `sw.sweep`, `sw.navigation` | takie same |
| `commitIsland` | `() => undefined` | `reportAnd("sw.island-commit", undefined)` | taka sama |
| auth `POST` → `storeOfflinePage` | `() => undefined` | `reportAnd("sw.offline-page", undefined)` | taka sama |
| `install`, `activate`, `sweepSoon` na starcie, `message` (sweep, purge, store-page) | `() => undefined` ×6 | `sw.offline-page`, `sw.sweep` ×3, `sw.purge`, `sw.store-page` | takie same |
| **nowe**: `purgeSignedOut` → `storeOfflinePage` | bez `catch` (odrzucenie szło do `.catch` handlera `message`) | `reportAnd("sw.offline-page", undefined)` | Jedynym wywołującym jest handler `message` (`sw.ts:809`), który i tak połykał odrzucenie, więc obserwowalnie nic się nie zmienia. Zmienia się tylko krok raportu (sieciowy zamiast `sw.purge`). Opisane w planie, 8 §2. |

Bez zmian zostały: cztery `catch` z warunkowym ponownym rzuceniem (`networkFirst`, trasa nawigacji, `networkOrOffline`) i dwa miejsca `serial()`. Allowlist `sw.ts` spadł z 26 na 6 z nowym powodem, zgodnie z F2 rundy 3.

**Błędy sieciowe nie są raportowane, błędy zapisu tak.** Rutynowe nazwy błędów to te same trzy z Fazy 7 (`TypeError`, `AbortError`, `TimeoutError`). Wszystkie timeouty w workerze to `AbortSignal.timeout(...)` (`sw.ts:194, 477, 547, 669`), czyli rzucają `TimeoutError`, który jest rutynowy na krokach sieciowych. Własny `Error` na timeout dawałby szum przy każdej słabej sieci, a takiego nie ma. `NETWORK_STEPS` są bez zmian (precache, offline-page, next-night, store-page, navigation), a w `steps.ts` jest uzasadnienie dla każdego kroku. `report.test.ts` sprawdza cztery rzeczy: `TypeError` przy `sw.navigation` i `TimeoutError` przy `sw.next-night` niczego nie wysyłają, a fallback wraca; `QuotaExceededError` przy `sw.store-page` jest raportowany; `TypeError` przy kroku zapisu (`sw.island-commit`) też.

**Limit i deduplikacja.** `MAX_PER_WAKE_UP = 10` siedzi w stanie modułu, czyli w globalnym zakresie workera (D14: na jedno wybudzenie). Test daje 12 różnych par krok i nazwa, wysłanych zostaje 10. Ten sam krok z tą samą nazwą to jeden raport. Każdy przypadek ładuje świeży moduł (`vi.resetModules`).

**Wysyłka.** `fetch(CLIENT_ERROR_PATH, { POST, JSON, keepalive: true })` bez `credentials`, a test przypina `keepalive`. Własne fetche workera nie przechodzą przez jego handler `fetch`. Krok e2e w `offline.spec.ts` dowodzi, że `fetch` ze strony kontrolowanej przez workera dostaje 204, `sendBeacon` zwraca `true` i `controller !== null` (8.5). Ten krok ma dwa uboczne skutki: wydaje 2 z 30 tokenów limitera i zostawia dwie linie `client.sw.sweep noted` w logach lokalnego podglądu.

**Red-first i celowe łamania** (`implementation-notes.md`, „Phase 8”). Testy pisane najpierw na pustym stubie: 6 z 7 czerwonych, a przypadek offline chroni test rdzenia z Fazy 7. Allowlist obniżony do 6 przed konwersją dawał „26 silent site(s), allowed 6”. Pięć par łamanie–czerwień: fallback w `reportAnd`, limit 10 → 11, `keepalive` false, jedno miejsce cofnięte w `sw.ts` (strażnik) oraz `report.ts` importujący `log-failure` (build). Ostatnią parę potwierdza mój build (0 wystąpień znacznika).

## Findings

### F1 — Brak zapisu pełnego e2e w trybie CI; Progress 8.4 obejmuje tylko specyfikacje offline

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 8.4 i 8.7; `context/foundation/lessons.md:47-52`
- **Detail**: Kryterium 8.4 to „Offline e2e specs stay green”. Notatka przy 8.7 mówi wprawdzie, że „the full e2e and smoke left only the deliberate reports”, ale nie ma liczb, stanu ani zapisu w evidence. Lekcja „Run the whole e2e suite before a PR, the way CI runs it” wymienia service worker wprost: świeży build, fixture prognozy, lokalny stack z kluczami podanymi inline, `dist/server/.dev.vars` wskazujące lokalny stack, a liczby w PR. Faza 8 zmienia 21 miejsc w workerze, z którego korzysta każdy spec Tonight, a nie tylko `offline.spec.ts`. Sam nie mogłem uruchomić pełnego e2e: odmówiono mi dostępu do plików env potrzebnych do skierowania podglądu na lokalny stack. Gałąź nie jest wypchnięta i PR nie istnieje, więc CI też jeszcze nie biegło.
- **Fix**: Przed PR uruchomić pełne `npm run test:e2e` i `npm run smoke` w trybie CI, zapisać liczby (wynik, brak flaków, brak skipów) w evidence lub w Progress 8.4 i podać je w PR.
- **Decision**: Taken (2026-10-19): the full `npm run test:e2e` with `CI=1` and `npm run smoke` ran on the current state against a fresh build, the forecast fixture and the local stack: e2e 64 passed, no flaky, no skips; smoke all 80 steps passed. Recorded in Progress 8.4 and in the PR.

### F2 — Komentarz w `steps.ts` o `sw.purge` jest nieaktualny

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/observability/client/steps.ts (komentarz nad `NETWORK_STEPS`, ostatnie zdanie)
- **Detail**: Komentarz mówi, że „`purgeSignedOut` ends with a `storeOfflinePage`, so a weak signal can add one `sw.purge` `TypeError` per wake-up”. W tym samym commicie `purgeSignedOut` dostał jednak własny `.catch(reportAnd("sw.offline-page", undefined))` (`sw.ts:157`), więc błąd sieciowy z tego fetcha jest rutynowy i odrzucany, a do `sw.purge` nigdy nie dociera. Plan i notatki opisują to dobrze, sprzeczny jest tylko komentarz.
- **Fix**: Usunąć zdanie o `sw.purge` z komentarza albo zamienić je na „its trailing `storeOfflinePage` reports as `sw.offline-page`”.
- **Decision**: Taken: the comment above `NETWORK_STEPS` now says the purge path's one fetch reports as `sw.offline-page`.

### F3 — Kontrola paczki wykrywa loggera, ale nie „kod strony” ani import z barrela

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: scripts/build-sw.mjs (`LOGGER_MARKER`), src/lib/offline/report.ts
- **Detail**: Znacznik `over_request_rate_limit` niezawodnie łapie `log-failure.ts` i mapę błędów auth (łamanie potwierdzone). Komunikat obiecuje jednak „page or logger code”, a plan zasadę „never from the barrel”. Dziś barrel `@/lib/observability/client` eksportuje tylko trzy liście, więc import z barrela nie zmieniłby paczki. W Fazie 9 barrel dostanie `browser.ts` (instalacja handlerów okna), który nie zawiera tego znacznika. Jeśli `report.ts` lub `sw.ts` zaimportuje wtedy barrel, kod strony trafi do workera i build tego nie zauważy.
- **Fix**: W Fazie 9, razem z planowanym `client-imports.test.ts`, dodać warunek importu: `src/sw.ts` i `src/lib/offline/report.ts` nie importują `@/lib/observability/client` (barrela) ani `log-failure`. Albo dodać do `build-sw.mjs` drugi znacznik z `browser.ts`. Do tego czasu poprawić komunikat na „logger code”.
- **Decision**: Taken: the build message says "logger code" (the marker only sees the logger); the barrel rule becomes an import test in Phase 9's `client-imports.test.ts` (`src/sw.ts` and `src/lib/offline/report.ts` import neither the barrel nor `log-failure`), written into plan 9 §1.

### F4 — Przyjęty szum jest opisany w notatkach, ale nie w runbooku

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: implementation-notes.md („Known trade-offs”); context/deployment/error-visibility.md
- **Detail**: Dwa świadome kompromisy są słusznie opisane w notatkach, ale operator czyta liczby z Workers Logs, a nie notatki. Pierwszy: `recordShell` czyta ciało odpowiedzi sieciowej pod krokiem `sw.shell`, który nie jest sieciowy, więc ciało urwane w połowie na słabej sieci daje jeden raport `sw.shell` `TypeError` na wybudzenie. Drugi: awaria `currentScope()` może zostać zgłoszona dwa razy, jako `sw.index` (`sw.ts:714`) i jako `sw.shell`. Obu nie da się podrobić ani nie zalewają logów (deduplikacja, limit 10, limiter), ale bez opisu w runbooku pojedyncze `client.sw.shell noted { name: 'TypeError' }` wygląda jak usterka.
- **Fix**: Dopisać do wiersza `client.*` w runbooku (albo w §8 przy zapytaniu z 7.9) jedno zdanie: pojedyncze `sw.shell` `TypeError` to zwykle urwana odpowiedź sieciowa, a para `sw.index` + `sw.shell` to jedna awaria `currentScope`.
- **Decision**: Taken: runbook §8 states both noise sources (a lone `sw.shell` `TypeError`; `sw.index` plus `sw.shell` as one `currentScope` failure) and that network faults at network steps stay silent on purpose; §8's "planned" wording now says Phases 7 and 8 are built.

## Manual verification

- **8.7** jest `[ ]` i należy do właściciela. W notatce jest próba lidera na lokalnym podglądzie: `TypeError` przy zapisie strony planu nie zostawił linii, a `QuotaExceededError` zostawił dokładnie jedną `sidereus: client.sw.store-page noted { name: 'QuotaExceededError' }`. To dobry dowód, że raporty z workera dochodzą (`keepalive` w workerze działa w Chromium podglądu). WebKit i Firefox nie były sprawdzane.
