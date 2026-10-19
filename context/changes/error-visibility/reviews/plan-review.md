<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Production Error Visibility (M-4 S-07) — runda 2

- **Plan**: context/changes/error-visibility/plan.md (commit 4d9962e)
- **Mode**: Deep (weryfikacja w kodzie wykonana bezpośrednio, bez sub-agenta)
- **Date**: 2026-10-15
- **Verdict**: REVISE (tylko fazy 7-9; fazy 1-6 są gotowe do wdrożenia)
- **Findings**: 0 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Ścieżki 10/10 ✓ (`src/sw.ts`, `offline/register.ts`, `gear/catalogue/load.ts`, `location/map-panel.tsx`,
`LocationPicker.tsx`, `geocode.ts`, `middleware.ts`, `wrangler.jsonc`, `Layout.astro`, `scripts/smoke.mjs`),
symbole 5/6 (`registerRoute` w `sw.ts` rejestruje też `POST`, nie tylko `GET` — zob. F7), brief↔plan ✓.
Progress↔fazy: 9/9 faz, 66/66 kryteriów zgodnych, brak checkboxów poza Progress ✓.

Potwierdzone: `@astrojs/react` 6.0.5 woła `hydrateRoot(element, componentEl, { identifierPrefix, formState })`
bez `onUncaughtError` / `onRecoverableError` (`dist/client.js:77-80,105`), więc w React 19.3 domyślne handlery
kierują błędy (także odzyskiwalne błędy hydratacji) do `reportError` → zdarzenie `error` na `window` (podstawa F3).
Komentarze w `sw.ts:507-508` i `:585-586` („Offline or timed out”) opisują te `catch` jako zwykłe zdarzenia (podstawa F2).

## Weryfikacja poprawek z rundy 1

| Uwaga | Status | Gdzie w planie |
| --- | --- | --- |
| F1 klasyfikacja i treść | ✅ Zastosowana: `classifyFault` z domyślnym `server`, wyłączone `42501`, `PGRST301-303`, `PGRST116`; neutralny `errors.serverFault`; `logNotice` (warn) dla wyłączeń | D3, D12, Faza 2 §1, Faza 4 §1 |
| F2 strażnik catch | ✅ Każdy `catch` i `.catch`, pięć próbek kształtów | D8, Faza 1 §3 (zob. F4 dla raportera z faz 8-9) |
| F3 `getClaims` | ✅ Lista rutynowa i lista awarii, test tabelaryczny, `sessionUser` wydzielony | Faza 5 §1 |
| F4 moduły wirtualne | ✅ Fabryki mocków, testy tras w `src/lib/routes` | Faza 1 §4 |
| F5 grupowanie w Issues | ✅ Faza 1 osobnym PR z linią próbną, Faza 3 czeka na sprawdzenie | D11, Faza 1 §6, 1.9-1.10 |
| F6 metadane wywołania | ✅ Runbook i 6.6 obejmują zdarzenie wywołania (zob. F6 niżej: kolejność) | Faza 6 §1 |
| F7 nieścisłości | ✅ Pięć plików / siedem linii, `store.ts:36` nazwany problemem, follow-upy w 6.8 | Current State, Faza 1 §2, Faza 6 |
| D4 (odwrócona przez właściciela) | ✅ Spójnie w D4, „What We're NOT Doing” i Desired End State | D4 |

## Findings

### F1 — Publiczny endpoint może wywoływać Issues i alerty z podrobionych zgłoszeń

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 7 §2-3, decyzja D9
- **Detail**: D9 mówi, że limity „bound log volume and forgery”. Ograniczają one jednak tylko wolumen. `Sec-Fetch-Site`
  i `Origin` to nagłówki, które `curl` ustawi dowolnie; sprawdzenie zatrzymuje tylko cudzą stronę w przeglądarce.
  Każde przyjęte zgłoszenie idzie przez `logFailure` → `console.error` → Workers Issues → automatyzacja, więc ktokolwiek
  może wysyłać do operatora fałszywe alerty o wybranym kroku i nazwie (`name` to dowolny krótki identyfikator).
  Do tego jeden stały klucz limitera oznacza, że 30 podrobionych zgłoszeń na minutę z jednej lokalizacji zagłusza
  prawdziwe zgłoszenia wszystkich użytkowników tej lokalizacji — atak wyłącza sygnał, nie aplikację.
- **Fix A ⭐ Recommended**: Zgłoszenia klienta jako niezaufane: `logNotice` (warn) dla `client.*`, alert z progu
  - Strength: Podrobione zgłoszenie nie budzi operatora; prawdziwy wysyp błędów nadal jest widoczny przez zapisane
  zapytanie Workers Logs na `step` z progiem (np. > N/godz.), opisane w runbooku. Zgodne z D12 („warn dla tego, co
  nie powinno budzić”).
  - Tradeoff: Błąd wyspy nie daje natychmiastowego Issue; kryterium 9.7 („…and an Issue”) trzeba zmienić.
  - Confidence: MEDIUM — zależy od tego, czy Workers Logs pozwala ustawić alert na zapytanie (runbook ma już fallback z zapisanym zapytaniem).
  - Blind spot: Możliwości alertów progowych w Workers Logs nie sprawdzono.
- **Fix B**: Zostawić poziom error, ale wyłączyć `client.*` z automatyzacji Issues i dać osobne klucze limitera per rodzina (`sw`, `island`)
  - Strength: Issues dalej grupuje błędy klienta do przeglądania; zalew jednej rodziny nie zagłusza drugiej.
  - Tradeoff: Lista Issues nadal może zostać zaśmiecona podróbkami; filtr automatyzacji to ręczny krok w panelu.
  - Confidence: MEDIUM — filtrowanie automatyzacji po treści komunikatu nie zostało potwierdzone w dokumentacji.
  - Blind spot: Jak wyżej.
- **Decision**: Fix A taken (plan D13): client reports are `logNotice` (warn, `noted`), never error level; a real burst is found by a saved Workers Logs query with a count threshold, and the runbook verifies whether such a query can alert. Fix B's per-family limiter keys not taken: a forger can flood either family, and the key would be chosen before the body is validated; the residual (a flood uses one location's 30 per minute) is accepted and written down. Criteria 7.2, 7.8, 8.7, 9.7 reworded. D9 limits (30/min, 512 B) confirmed by the owner 2026-10-15 evening.

### F2 — Service worker zgłosi oczekiwane błędy sieci, a limity „na czas życia workera” zerują się co chwilę

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 8 §1-2, Faza 7 §1 (limity), decyzja D10
- **Detail**: Tryb offline jest dla teleskopu w terenie, więc błędy sieci w SW są normalne: `sw.ts:507` i `:585` same
  piszą „Offline or timed out”, a pobieranie z precache (`:254`), kopia na następną noc i odświeżanie kopii zawodzą przy
  każdej słabej sieci. D10 odrzuca zgłoszenie tylko wtedy, gdy urządzenie jest offline; przy `onLine === true` i
  zerwanym zasięgu (`TimeoutError`, `TypeError: Failed to fetch`) zgłoszenia pójdą przy każdej wizycie. Limit „10 per
  worker lifetime” i deduplikacja żyją w globalnym zakresie SW, który przeglądarka kończy po krótkiej bezczynności
  i uruchamia na nowo przy następnym zdarzeniu — to limit na wybudzenie, nie na urządzenie. Szum z SW zużyje wspólny
  koszyk 30/min i zasłoni rzadkie, prawdziwe awarie (pełny storage, uszkodzony indeks).
- **Fix**: Klasyfikacja w `reportAnd` / reporterze SW: błędy sieci (`TypeError` z `fetch`, `AbortError`,
  `TimeoutError`) w miejscach zależnych od sieci są rutynowe i nie są zgłaszane; zgłaszane są błędy cache i storage
  (`QuotaExceededError`, `InvalidStateError`, `UnknownError`), parsowania (`SyntaxError`) i nieznane. W kontrakcie
  zapisać wprost, że limit dotyczy jednego wybudzenia SW, i dodać do testów 8.1 przypadek „timeout przy `onLine`”.
  - Strength: Sygnał z SW pokazuje to, czego operator nie zobaczy inaczej (storage, indeks), bez szumu z terenu.
  - Tradeoff: Lista nazw do utrzymania; przeglądarki różnie nazywają błędy storage.
  - Confidence: HIGH — komentarze w `sw.ts` same rozróżniają te przypadki.
  - Blind spot: Nazwy błędów Cache API w Safari nie zostały sprawdzone.
- **Decision**: Taken as recommended (D14): pure `isRoutineNetworkFault` in `client/classify.ts`, `NETWORK_STEPS` assigned site by site in Phase 8 §2; cap is per wake-up in D9/D10 and Phases 7-8; test 7.1 and 8.1 gain the timeout-while-online case. Unknown names are reported (Safari variance errs toward a notice).

### F3 — Globalny handler wysp zgłosi błędy rozszerzeń i niedopasowania hydratacji jako `island.uncaught`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 9 §1, kryterium 9.7
- **Detail**: Handler `error` na `window` dostaje także wyjątki ze skryptów rozszerzeń (które często mają obiekt
  `error`), a React 19 (Astro nie ustawia handlerów w `hydrateRoot`) kieruje przez `reportError` także odzyskiwalne
  błędy hydratacji — typowy skutek rozszerzeń zmieniających DOM (tłumacz, tryb ciemny). Zgłoszenie niesie tylko
  `name` (np. `TypeError`, `Error`), więc operator nie odróżni błędu Sidereus od cudzego.
- **Fix**: Filtr lokalny, którego wynik nie jest wysyłany: zgłaszać `error` tylko gdy `event.filename` zaczyna się od
  `location.origin + "/_astro/"` (sprawdzane w przeglądarce, nic z tego nie trafia do ciała zgłoszenia); błędy
  hydratacji dostają osobny krok `island.hydration` albo nie są zgłaszane. Kryterium 9.7 (wyjątek wpisany w konsoli
  DevTools, którego plik to „VM”) zastąpić wyjątkiem z kodu strony, np. ze strony `/design` w podglądzie.
  - Strength: `island.uncaught` znaczy wtedy „nasz kod”.
  - Tradeoff: Odrzucenia `unhandledrejection` nie mają `filename` — dla nich filtr nie działa i trzeba to zaakceptować.
  - Confidence: MEDIUM — zachowanie `filename` dla skryptów rozszerzeń różni się między przeglądarkami.
  - Blind spot: Nie sprawdzono, czy Astro serwuje wszystkie skrypty wysp spod `/_astro/`.
- **Decision**: Taken with one deviation (D15): own-script filter on `filename` under `location.origin + "/_astro/"`, `island.hydration` step, rejections unfiltered. Deviation: the reviewer's replacement for 9.7 (an exception on `/design` in a preview) cannot work, because `src/pages/design.astro:91` returns 404 unless `import.meta.env.DEV`. The e2e (9.3) serves a script from `/_astro/` via `page.route` for the positive case and throws from `page.evaluate` for the negative; the live check (9.7) uses a rejected promise typed in the console (positive) and a thrown error typed in the console (no line, negative).

### F4 — Strażnik z Fazy 1 nie uzna `reportAnd` ani `report` za zgłoszenie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 §3 (kontrakt strażnika), Faza 8 kryterium 8.2, Faza 9 §2-3
- **Detail**: Strażnik przepuszcza miejsce tylko wtedy, gdy ciało `catch` wywołuje `logFailure` / `logNotice` albo
  rzuca dalej. W Fazie 8 miejsca wyglądają jak `.catch(reportAnd("sw.index", undefined))`: argument nie jest literałem
  funkcji, więc reguła „body calls…” nie ma czego sprawdzić. W Fazie 9 wyspy wołają `reporter.report(...)`. Bez
  zmiany kontraktu kryterium 8.2 („allowlist entries for `src/sw.ts` removed”) się nie spełni albo implementer
  dopisze wyjątek w locie.
- **Fix**: W Fazie 1 §3 (albo jako zmiana strażnika w Fazie 7) dopisać: wywołania `report` / `reportAnd` z
  `@/lib/observability/client` są zgłoszeniem, a `.catch(<wywołanie reportAnd(...)>)` przechodzi; dodać szóstą próbkę.
- **Decision**: Taken as recommended in Phase 1 §3: `report` / `reportAnd` / `<reporter>.report` count as a report when imported from `@/lib/observability/client` or `@/lib/offline/report`; `.catch(reportAnd(...))` passes; sixth sample shape (with and without the import); 1.3 and Progress updated. Phase 7 adds the `client/index.ts` barrel and Phase 8 exports both names from `offline/report.ts`.

### F5 — Limit 512 bajtów bez sposobu odczytu ciała

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 7 §2, kryterium 7.2
- **Detail**: Kontrakt mówi „body of at most 512 bytes (413)”, ale nie mówi, jak to sprawdzić. Naturalne
  `await request.text()` najpierw wczyta całe ciało (Workers przyjmują duże ciała), więc każde podrobione żądanie
  z wielomegabajtowym ciałem zużyje pamięć i CPU, zanim padnie 413. Sprawdzenia przed limiterem (403, 413, 415)
  nie są limitowane, więc to one są tanią powierzchnią ataku.
- **Fix**: Najpierw odrzucać po `Content-Length` > 512, potem czytać strumień licznikiem przerywanym na 513. bajcie
  (ciało bez `Content-Length`, chunked, też ograniczone); w 7.2 dodać przypadek bez `Content-Length`.
- **Decision**: Taken as recommended: `Content-Length` over 512 refused first, then a streamed read stopping at the 513th byte; 7.2 adds a chunked body without `Content-Length` proved with a counting stream.

### F6 — Sprawdzenie pól zdarzenia wywołania (pola `cf`) dopiero w Fazie 6, choć Faza 1 wdraża się wcześniej

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: D4 (odwrócona), Faza 6 §1 i 6.6, Faza 1 kryterium 1.9
- **Detail**: Właściwości `request.cf` w Cloudflare zawierają przybliżone `latitude`, `longitude`, `city` i
  `postalCode` odwiedzającego. Jeśli Workers Logs zapisuje je w zdarzeniu wywołania, zasada „no coordinates in any
  report” jest łamana przez konfigurację, która działa już dziś, niezależnie od naszych linii. Po odwróceniu D4 cała
  korelacja opiera się właśnie na tych metadanych. Plan sprawdza to w 6.6, a Faza 1 trafia na produkcję jako pierwsza
  i już wtedy pozwala to zobaczyć.
- **Fix**: Przenieść sprawdzenie pól zdarzenia wywołania do 1.9 (pierwszy deploy) i zapisać z góry, co zrobić, jeśli
  pola geo tam są (np. wyłączenie logów wywołań w `observability.logs` i oparcie korelacji na identyfikatorze żądania
  w metadanych linii `console`, jeśli Workers Logs go dołącza — do sprawdzenia).
- **Decision**: Taken as recommended: the invocation-event geo check moves to 1.9 (first deploy) with the fallback written down (`observability.logs.invocation_logs: false`, flag name and the surviving correlation identifier both marked "to be confirmed in the docs" because neither is verified); Phase 6 §1 and 6.6 keep the runbook record, URL path and headers.

### F7 — Drobne nieścisłości w nowych fragmentach

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries, Faza 7 §4, Faza 1 kryterium 1.10
- **Detail**: (a) Key Discoveries: „`src/sw.ts` routes only `GET` (line 766)” — `sw.ts:767` rejestruje też `POST` dla
  nawigacji. Wniosek („beacon passes through”) dalej jest prawdziwy, bo `sendBeacon` i `fetch` nie mają `mode:
  "navigate"`, ale powód trzeba poprawić, bo 8.5 na nim stoi. (b) Astro domyślnie ma `security.checkOrigin`, który
  odrzuca cross-site `POST` z `text/plain` własnym 403 jeszcze przed trasą; krok smoke „foreign Origin → 403” zobaczy
  odpowiedź Astro, nie trasy (dla JSON — trasy). Trzeba zapisać, co test sprawdza. (c) Key Discoveries nadal mówi
  „a fake context is enough”, choć F4 z rundy 1 dodał mocki modułów wirtualnych. (d) 1.10 dopuszcza „briefly pointing
  the production variable at a dead host” — to psuje prognozę prawdziwym użytkownikom; tymczasowy Worker jest
  bezpieczniejszy i powinien być jedyną opcją.
- **Fix**: Poprawić cztery zdania jak wyżej.
- **Decision**: Taken: (a) Key Discoveries now cites `sw.ts:766-767` (`GET` and `POST`) and the `mode: "navigate"` reason; (b) the smoke foreign-`Origin` step uses JSON so it proves the route, and the text says Astro's `checkOrigin` answers the `text/plain` variant (covered by the route test); (c) "a fake context" now names the virtual-module mocks; (d) §7 states the probe never changes the production variable, even briefly (the current 1.10 text only offers Version URL, Preview and a separate Worker, so no production-variable option remained to delete).

---

<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Production Error Visibility (M-4 S-07) — runda 3 (fazy 7-9)

- **Plan**: context/changes/error-visibility/plan.md (commit 653df06, gałąź `feat/error-visibility-client`)
- **Mode**: Focused (tylko fazy 7-9; fazy 1-6 scalone i wdrożone), weryfikacja w kodzie worktree bezpośrednio
- **Date**: 2026-10-19
- **Reviewer**: herdr agent `reviewer` (tylko ten plik; `plan.md` i `change.md` bez zmian, nic nie commitowane)
- **Verdict**: REVISE (lekko: cztery poprawki kontraktu i kryteriów, bez zmiany architektury; po nich faza 7 może ruszać)
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING (F2, F3, F4) |
| Plan Completeness | WARNING (F1) |

## Grounding

Sprawdzone w worktree (HEAD 653df06, `node_modules` obecne):

- `src/sw.ts`: dokładnie 26 miejsc, jak podaje tabela dryfu: 17 × `.catch(() => undefined)` (79, 254, 340, 402, 685, 703, 711, 715, 716, 737, 748, 774, 778, 782, 789, 792, 798), `.catch(() => null)` w 85, `.then(task, task)` w 78, `.then(resolve, () => …)` w 617, gołe `catch {}` w 507 i 585, cztery warunkowe rethrow w 607, 627, 719, 759; `isNavigation` i rejestracja `GET`/`POST` w 765-767 ✓. Wpis allowlisty `src/sw.ts` ma `count: 26` ✓.
- Strażnik: `REPORTER_MODULES` = `@/lib/observability/client`, `@/lib/offline/report`, dopasowanie po dokładnym specyfikatorze (test z `./elsewhere` jest czerwony) ✓; stała `CLIENT` z powodem „reported by Phases 7-9” ✓.
- `log-failure.ts`: `CODE_SHAPE` nie istnieje, jest `isLoggableCode` (SQLSTATE, PGRST, cztery kroki prognozy, 88 kodów auth-js); `nameOf` czyta nazwę tylko z instancji `Error`; `NAME_SHAPE` jest lokalny (nieeksportowany) — plan każe zdefiniować własny w `client/steps.ts` ✓; komentarz nad `FAILURE_STEPS` zapowiada `client.<ClientStep>` jako typ szablonowy ✓.
- `middleware.ts`: cienki wrapper (preferencje, zegar testowy, `createClient`, `sessionUser`) ✓; `middleware.test.ts` ma harness `run(path, method)` ✓.
- `test-support/route-context.ts`: tylko stały `http://localhost/api/test`, bez nagłówków i strumienia ✓ (tabela dryfu ma rację). `virtual-modules.ts` eksportuje `cloudflareWorkers(env)` ✓.
- `scripts/smoke.mjs` `request()`: stały `Origin: BASE_URL`, tylko formularz ✓.
- Astro 7.3.2 `origin-check.js`: 403 dla nie-same-origin `POST` z `text/plain`, formularzem albo bez `content-type`; JSON przechodzi do trasy ✓ (podstawa §4 smoke).
- Wrangler 4.145.0, `@cloudflare/vite-plugin` 1.62.3 (override), miniflare 5.20260930.0-alpha. `RateLimit` / `RateLimitOptions` są już w `worker-configuration.d.ts` (linie 13525-13537).
- Wyspy: `map-panel.tsx:52` i `:162` (z `reportError`, pomija `LEAFLET_CSS_FAILED`), `LocationPicker.tsx:64, 74, 128, 168, 198`, `gear/catalogue/load.ts:15, 23`, `offline/register.ts:8`, `EyepieceForm.tsx:64`, `TelescopeForm.tsx:63`, `OnboardingWizard.tsx:200, 210`, `geocode.ts:98`, `install.ts:82`, `locate.ts:60` ✓. `Layout.astro`: skrypt `is:inline` w head (52) i moduł na dole (111, importuje `install`, `page-state`, `register`) ✓.
- Brief↔plan: `plan-brief.md:64` nadal mówi „`namespace_id` must be an int…” (zob. F5).
- Progress↔fazy 7-9: 8 + 7 + 7 kryteriów zgodnych z sekcjami Success Criteria; brak checkboxów poza Progress ✓.

## Weryfikacja poprawek z rundy 2 (F1-F7, nigdy wcześniej nie sprawdzonych)

| Uwaga | Status | Gdzie w planie |
| --- | --- | --- |
| F1 podrobione zgłoszenia → Issues | ✅ D13: `logNotice`, linie `noted`; 7.2, 7.8, 8.7, 9.7 mówią „noted” i „no Issue”; rezydualne ryzyko zapisane w D9/D13. ⚠️ Jedna część nie trafiła do żadnego kryterium: „the runbook verifies whether such a query can alert” (zob. F4) | D9, D13, 7 §2 |
| F2 rutynowe błędy sieci w SW | ✅ D14, `isRoutineNetworkFault` w `classify.ts`, `NETWORK_STEPS` przypisywane w 8 §2, „per wake-up” w D9/D14/7 §1/8 §1, przypadek „timeout przy `onLine`” w 8.1. Pozostałość: „per lifetime” w Performance Considerations (F5) | D14, 7 §1, 8 §1-2 |
| F3 rozszerzenia i hydratacja | ✅ D15 z filtrem `/_astro/`, `island.hydration`, odrzucenia bez filtra; świadome odstępstwo od `/design` uzasadnione (404 poza dev); dowód z sondy Chromium/WebKit dopisany w 9 §1 | D15, 9 §1, 9.3, 9.7 |
| F4 strażnik nie zna `report`/`reportAnd` | ✅ Zrobione już w fazie 1 i potwierdzone w kodzie (`REPORTER_MODULES`, `REPORTER_NAMES`, szósta próbka) | Faza 1 §3, 8 §1, 9 §1 |
| F5 limit 512 B bez metody odczytu | ✅ Najpierw `Content-Length`, potem strumień z licznikiem do 513. bajtu; przypadek chunked w 7.2 | 7 §2, 7.2 |
| F6 pola `cf` za późno | ✅ Przeniesione do 1.9 i wykonane (1.9 FAILED → hotfix #187) | 1.9 |
| F7 drobiazgi (a-d) | ✅ (a) `sw.ts:766-767` i powód `mode: "navigate"`; (b) smoke wysyła JSON, `text/plain` pokrywa test trasy — potwierdzone w `origin-check.js`; (c) Key Discoveries nazywa mocki; (d) sonda nigdy nie zmienia zmiennej produkcyjnej | Key Discoveries, 7 §4, 1 §7 |

## Edycje prowadzącego po dryfie (tabela z 2026-10-19)

Wszystkie wiersze zweryfikowane w kodzie i trafne, z dwoma wyjątkami: wiersz „Held without change … `npm run cf:types`” jest sprzeczny z ustaleniem fazy 1 (F1), a wiersz o `sw.ts` liczy 22 miejsca do zgłaszania, choć dwa z nich nie połykają błędu (F2).

## Trzy otwarte punkty prowadzącego

1. **Usunięcie `code` ze zgłoszeń klienta — POTWIERDZAM.** D9 w obecnym brzmieniu w ogóle nie wymienia `code` (mówi o zamkniętej liście kroków, 512 B, limiterze); „name and code” było tylko w starym 7 §2. Uzasadnienie trzyma się kodu: `isLoggableCode` przepuszcza wyłącznie słownictwo Postgresa, PostgREST, prognozy i auth-js, którego żaden błąd przeglądarki nie niesie (`DOMException.code` to liczba), a import do bundla workera wciągnąłby logger i 88 kodów. Endpoint jest nowy, więc nie ma starych klientów do zepsucia. Jedna uwaga na przyszłość: schemat jest ścisły (nieznany klucz → 400), a strony i worker żyją w przeglądarkach dłużej niż jedno wdrożenie, więc każde przyszłe rozszerzenie kontraktu musi najpierw wdrożyć serwer akceptujący nowe pole, a dopiero potem klienta (warto jedno zdanie w runbooku, Faza 9 §3).
2. **Cichy fallback przy braku `CLIENT_ERROR_LIMITER` w produkcji — dodać linię raz na izolat.** Zob. F3: lokalnie wiązanie istnieje (miniflare je symuluje), więc fallback działa tylko w Vitest i przy zepsutym wdrożeniu — a to jest dokładnie przypadek `forecast.cache-missing` / `config.supabase`.
3. **Czy lokalny `npm run preview` (workerd) honoruje `ratelimits` — tak, prawie na pewno.** miniflare 5.20260930 ma wtyczkę `ratelimit` (`node_modules/miniflare/dist/src/workers/ratelimit/`: Durable Object z kubełkami w SQLite, okna wyrównane do zegara, okresy 10/60 s), wrangler 4.145 mapuje `ratelimits` z konfiguracji na opcje miniflare (`cli.js:178966`), a `@cloudflare/vite-plugin` 1.62.3 buduje opcje miniflare z tej samej konfiguracji. Nie uruchamiałem podglądu, więc to wniosek z kodu, nie obserwacja. Skutki: (a) lokalny smoke i e2e trafiają w prawdziwy (symulowany) limit 30/min na jeden stały klucz — suma zgłoszeń z 7 §4, 8.5 i 9.3 to około 10, więc mieści się, ale implementer nie powinien dziwić się 429 przy powtarzanych lokalnych przebiegach w tej samej minucie; (b) gałąź „brak wiązania” nie jest w ogóle ćwiczona lokalnie, co wzmacnia F3.

## Findings

### F1 — `npm run cf:types` „bez diffu” jest sprzeczne z ustaleniem fazy 1

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 7 §3 („`npm run cf:types` regenerates `worker-configuration.d.ts`, committed”), kryterium 7.4 i Automated „`npm run cf:types` leave no diff”, tabela dryfu („Held without change … `npm run cf:types`”)
- **Detail**: Faza 1 §5 zapisała: „`worker-configuration.d.ts` is left as is: `wrangler types --check` reports it stale, but regenerating needs the repo's `.dev.vars` and is not CI-neutral”. Plik w worktree nadal ma nagłówek `workerd@1.20260911.1` (sprzed podbicia do 4.145), a jego `Env` zawiera `SUPABASE_URL` / `SUPABASE_KEY` z `.dev.vars` maszyny, która go generowała. Regeneracja Wranglerem 4.145 przepisze więc tysiące linii typów runtime i wciągnie zmienne z lokalnego `.dev.vars` implementera (u właściciela bywa tam np. `FORECAST_BASE_URL` do symulowania awarii) — kryterium „no diff” nie da się spełnić powtarzalnie, a commit takiego pliku to szum w PR. Tymczasem typ `RateLimit` już jest w pliku (linie 13525-13537).
- **Fix**: Nie regenerować. `rate-limit.ts` czyta wiązanie wzorem `kv-cache.ts`: `(env as Partial<Cloudflare.Env> & { CLIENT_ERROR_LIMITER?: RateLimit }).CLIENT_ERROR_LIMITER` — i tak potrzebny jest test `undefined` dla fallbacku. Z 7 §3 usunąć `worker-configuration.d.ts` i `cf:types`; 7.4 i Automated: tylko `npx wrangler deploy --dry-run` plus pin w `wrangler-config.test.ts`; poprawić wiersz tabeli dryfu. (Regeneracja pliku to osobny, mechaniczny chore, jeśli w ogóle.)
  - Strength: brak zależności od lokalnego `.dev.vars`, kryterium powtarzalne, zero szumu w diffie.
  - Tradeoff: jeden lokalny typ zamiast wygenerowanego.
  - Confidence: HIGH — zapis fazy 1 i nagłówek pliku mówią to samo; pliku `.dev.vars` celowo nie czytałem.
  - Blind spot: nie uruchamiałem `wrangler types --check` (czyta `.dev.vars`).

### F2 — `serial()` w `sw.ts:78-79` to nie połykanie błędu; zgłaszanie tam podwaja raporty, a przebudowa `.then(task, task)` dodaje martwy kod

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 8 §1 (ostatnie zdania o `indexQueue.then(task, task)`), 8 §2 (lista 26 miejsc), kryterium 8.2 i Automated „drops from 26 sites to the four”
- **Detail**: `serial(task)` robi `run = indexQueue.then(task, task); indexQueue = run.catch(() => undefined); return run;`. (1) `.catch` w 79 nie gubi błędu: ten sam `run` jest zwracany i każdy z dziewięciu wywołujących (`sw.ts:105, 136, 144, 166, 194, 271, 353, 379, 554`) go `await`uje, więc odrzucenie dociera do łańcucha, który kończy się w jednym ze zgłaszanych miejsc (np. `commitIsland(...).catch(...)` w 737). Zgłoszenie w 79 jako `sw.index` daje drugi raport tej samej awarii pod innym krokiem — deduplikacja „ten sam krok i nazwa” go nie złapie, a limit to 10 na wybudzenie. (2) Handler odrzucenia w 78 jest nieosiągalny: `indexQueue` to zawsze `Promise.resolve()` albo `run.catch(() => undefined)`, więc nigdy nie jest odrzucony. Plan każe go „przebudować na inline handler, który zgłasza” — to kod, który nigdy się nie wykona.
- **Fix**: Zostawić 78 i 79 na allowliście z powodem „kolejka indeksu: odrzucenie dociera do wywołującego przez `return run`, który je zgłasza; `indexQueue` nigdy nie jest odrzucony”. 8 §1: usunąć zdanie o przebudowie; 8 §2: z 22 miejsc do zgłoszenia zostaje 20; 8.2 i Automated: wpis `src/sw.ts` spada z 26 do 6 (4 rethrow pod D14 + 2 kolejki), z dwoma powodami w jednym `reason`. Zaktualizować wiersz tabeli dryfu i opis wpisu w strażniku.
  - Strength: jeden raport na awarię, żadnego martwego kodu, kryterium zgodne z kodem.
  - Tradeoff: dwa wpisy więcej na allowliście, oba z prawdziwym powodem.
  - Confidence: HIGH — wynika wprost z `sw.ts:76-81` i listy wywołań.
  - Blind spot: brak.

### F3 — Brak wiązania limitera w produkcji jest cichy; lokalnie wiązanie istnieje, więc ta gałąź to tylko zepsute wdrożenie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 7 §3 („A missing binding (local dev, tests) falls back to the in-memory bucket”), `log-failure.ts` `FAILURE_STEPS`
- **Detail**: Kontrakt zakłada, że wiązania brak „lokalnie i w testach”. Lokalnie (miniflare, punkt 3 wyżej) ono jest, więc w praktyce fallback działa tylko w Vitest i wtedy, gdy wdrożenie zgubiło `ratelimits` (np. wygenerowana konfiguracja go nie przeniosła, albo ktoś użyje `env` w Wranglerze, gdzie `ratelimits` jest „notInheritable”). Wtedy limit po cichu staje się 30/min **na izolat** zamiast na lokalizację — wciąż ograniczony, ale słabszy i niewidoczny. To ta sama klasa awarii co `forecast.cache-missing` i `config.supabase`, które faza 1 i 3 logują raz na izolat (`kv-cache.ts:7-23`, `supabase.ts:30-37`). Linia nie jest podrabialna (wyzwala ją brak konfiguracji, nie treść żądania) i jest ograniczona do jednej na izolat, więc może być na poziomie error (Issue).
- **Fix**: W `rate-limit.ts` przy pierwszym braku wiązania w izolacie `logFailure("config.rate-limit")` (krok dopisany do `FAILURE_STEPS`, wiersz w tabeli runbooka), potem fallback jak w planie; test w `client-error`/`rate-limit` z mockiem `cloudflare:workers` bez wiązania: jedna linia na dwa wywołania. 7.8 dodatkowo: „no `sidereus: config.rate-limit failed` line after the deploy”. Komentarz w `kv-cache.ts` („the only module that imports `cloudflare:workers`”) i zdanie w CLAUDE.md o tym samym poprawić (zob. F5).
  - Strength: domyka jedyny cichy fallback, wzorem już przyjętym w projekcie.
  - Tradeoff: jeden krok więcej w słowniku.
  - Confidence: HIGH dla wzorca; MEDIUM co do tego, jak często to wystąpi (raczej nigdy — i o to chodzi).
  - Blind spot: nie zweryfikowałem, że `dist/server/wrangler.json` przenosi `ratelimits` (7.4 `--dry-run` i 7.8 to pokażą).

### F4 — Weryfikacja „czy zapytanie Workers Logs może alarmować” (decyzja z rundy 2, F1) nie ma kryterium; strona klienta może zostać bez ścieżki alarmu bez niczyjej decyzji

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: D13, Faza 9 §3 (runbook: „client step table and the endpoint's limits”), kryteria 7.8 i 9.7; runbook `error-visibility.md:129` („Whether a query can alert is unverified”)
- **Detail**: Decyzja rundy 2 brzmiała: „the runbook verifies whether such a query can alert”. Żadne kryterium faz 7-9 tego nie zleca: 7.8 sprawdza tylko, że linia `noted` się pojawia i nie tworzy Issue, 9 §3 dopisuje tabelę kroków i limity. Jeśli Workers Logs nie umie alarmować na zapisane zapytanie, wszystkie zgłoszenia przeglądarki (D5: cel całych faz 7-9) są widoczne tylko wtedy, gdy operator sam zajrzy — a to jest dokładnie stan „cicho”, z którym walczy S-07. To może być akceptowalne, ale powinno być decyzją właściciela, nie skutkiem pominięcia.
- **Fix**: Dodać do 7.8 (pierwsze wdrożenie z endpointem): właściciel sprawdza w panelu, czy zapisane zapytanie Workers Logs (`sidereus: client.`) może mieć alert z progiem; wynik do runbooka §client. Jeśli nie może: D13 dostaje dopisek „brak alarmu dla strony klienta; przegląd ręczny raz w tygodniu (albo follow-up)”, a 6.8-podobny follow-up trafia na tablicę.
  - Strength: zamyka otwarty punkt rundy 2 i zmusza do jawnej decyzji.
  - Tradeoff: jeden krok więcej dla właściciela przy 7.8.
  - Confidence: MEDIUM — nie znam aktualnych możliwości alertów Workers Observability; dlatego to kryterium, nie założenie.
  - Blind spot: możliwości alertów w panelu Cloudflare (nie sprawdzane w tej rundzie).

### F5 — Resztki starego brzmienia poza fazami 7-9

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Performance Considerations (plan.md:683), Migration Notes (:687), `plan-brief.md:64`, `src/lib/forecast/kv-cache.ts:11-12` i CLAUDE.md („only `kv-cache.ts` imports `cloudflare:workers`”)
- **Detail**: Performance mówi „the worker at most 10 per lifetime” (runda 2 F2 zmieniła to na „per wake-up”); Migration Notes i brief mówią, że `namespace_id` „must be an integer” (tabela dryfu: string cyfr). Po fazie 7 `rate-limit.ts` będzie drugim importerem `cloudflare:workers`, a komentarz w `kv-cache.ts` i opis projektu w CLAUDE.md twierdzą, że jedynym jest `kv-cache.ts`.
- **Fix**: Poprawić dwa zdania w planie i jedno w briefie; do 9 §3 (albo 7 §3) dopisać aktualizację komentarza `kv-cache.ts` i zdania w CLAUDE.md.

### F6 — Kontrakt trasy: `source` niezdefiniowany i nielogowany; zgłoszenie bez nazwy zaloguje `name: "Error"`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 7 §1 (`{ source, step, name? }`), 7 §2 (`logNotice("client.<step>", namedError(name))`), 9.3
- **Detail**: (a) Plan nigdzie nie podaje wartości `source` ani reguły jego zgodności z rodziną kroku, a linia logu niesie tylko `step` i `name` — `source` jest więc nadmiarowe (rodzina `sw.*` / `island.*` już to mówi) i otwiera przypadek „`source: "page"` z krokiem `sw.index`”. (b) `nameOf` zwraca `"Error"` dla świeżego `new Error()`; jeśli trasa zbuduje błąd także dla zgłoszenia bez `name`, linia pokaże `name: "Error"`, czyli informację, której klient nie wysłał.
- **Fix**: Usunąć `source` z kontraktu (schemat `{ step, name? }`, 9.3 „only `step` and `name`”), albo zdefiniować `"sw" | "page"` i wymagać zgodności z prefiksem kroku (400 inaczej). Trasa przekazuje błąd tylko wtedy, gdy `name` jest obecne; bez niego `logNotice(step)`. Przypadek „bez nazwy → linia bez `name`” do 7.2.

### F7 — Wyspy: `island.geocode` zgłaszać dopiero po sprawdzeniu `aborted`; nazwa zawsze `Error`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 9 §2 (`LocationPicker.tsx:198`, `geocode.ts:98`), 9 §2 o `catalogue/load.ts:15,23` i `LocationPicker.tsx:64`
- **Detail**: (a) Handler odrzucenia wyszukiwania (`LocationPicker.tsx:204-209`) najpierw wychodzi, gdy `controller.signal.aborted` — każde kolejne naciśnięcie klawisza anuluje poprzednie zapytanie. Zgłoszenie postawione przed tym `return` wysyłałoby raport przy zwykłym pisaniu. (b) `geocode.ts:98` celowo rzuca `new Error(GEOCODING_FAILED)` bez `cause`, więc każdy `island.geocode` ma `name: "Error"` (timeout, sieć, HTTP i schemat wyglądają tak samo), a po deduplikacji to jeden raport na stronę bez diagnozy; do tego D14 (rutynowe błędy sieci) dotyczy tylko kroków `sw.*`, więc słaba sieć w terenie trafi tu jako szum. (c) Memo-resety w `catalogue/load.ts:15,23` i `LocationPicker.tsx:64` widzą to samo odrzucenie co konsumenci (`EyepieceForm`, `TelescopeForm`, `OnboardingWizard`, `LocationPicker:128`); wspólny reporter i deduplikacja to scalą, ale wzorzec projektu (`finder-stars.ts`: „resets the memo only; the same rejection still reaches every awaiting caller”) to raczej zostawić memo-resety na allowliście i zgłaszać u konsumenta. Wyjątek: `map-panel.tsx:52`, bo `:162` celowo pomija `LEAFLET_CSS_FAILED` — tam zgłoszenie musi zostać.
- **Fix**: 9 §2: „report after the `aborted` check”; rozważyć nazwane etapy w `geocode.ts` (np. `name` = `GeocodeHttp` / `GeocodeNetwork` / `GeocodeSchema`, zgodne z `NAME_SHAPE`, bez treści), albo zapisać, że `island.geocode` to tylko licznik. Memo-resety: decyzja implementera, z powodem jak w `finder-stars.ts`.

## Daty odcięcia

Trzymają się. Warunek „faza 6 scalona do 2026-10-28” spełniony (#194, 2026-10-17). Do „faza 7 wdrożona do 2026-10-30” zostaje 11 dni na jedną sesję implementacji plus przegląd, merge i deploy — realne. Jedyny element na ścieżce krytycznej poza agentem to `namespace_id`: właściciel powinien potwierdzić wolny numer (albo podać go) **przed** otwarciem PR fazy 7, nie przy deployu, bo bez niego 7.4 i 7.8 stoją. 8 i 9 do 2026-11-02 są niezależne i każda to jedna sesja; F2 i F7 ich nie wydłużają.

## Podsumowanie

Poprawki z rundy 2 są zastosowane poprawnie (F1 z jedną niedokończoną częścią, zob. F4), a edycje po dryfie zgadzają się z kodem poza F1 i F2. Usunięcie `code` potwierdzone. Po F1-F4 (tekst planu i kryteriów, bez zmiany architektury) faza 7 może ruszać.
