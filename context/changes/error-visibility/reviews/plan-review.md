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
