<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Production Error Visibility (M-4 S-07)

- **Plan**: context/changes/error-visibility/plan.md
- **Mode**: Deep (weryfikacja w kodzie wykonana bezpośrednio, bez sub-agenta)
- **Date**: 2026-10-15
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Ścieżki 12/12 ✓ (`middleware.ts`, `supabase.ts`, `wrangler.jsonc`, `no-console-guard.test.ts`, `forecast/service.ts`,
`open-meteo.ts`, `gear/store.ts`, `session-plans/store.ts`, `tonight/load.ts`, `api/tonight/plan.ts`, `scripts/smoke.mjs`,
audyt), symbole 6/6 ✓ (`CODE_SHAPE`, `ALLOWED_DISABLES`, `writeFailure`, `thrownKey`, `getClaims`, siedem linii
`console.error` w podanych miejscach), brief↔plan ✓. Progress↔fazy: 6/6 faz, 40/40 kryteriów zgodnych ✓.

Potwierdzone: `wrangler@4.134.0` istnieje (najnowszy 4.151.0); adapter przenosi blok `observability` do
`dist/server/wrangler.json`, więc kryterium 1.6 jest sprawdzalne; `getClaims()` przy braku sesji zwraca
`{ data: null, error: null }` (`GoTrueClient.js`, ścieżka `getSession`), a `catch` w `middleware.ts:18` łapie
głównie rzucone wyjątki — RC4 z audytu się zgadza.

## Decyzje właściciela D3-D5 — opinia recenzenta

- **D3 (302 + `errors.save.unavailable`)**: kształt dobry (zgodny z konwencją „no JSON errors”), ale tabela
  `isServerFault` i treść komunikatu wymagają poprawki — zob. F1.
- **D4 (żadnych identyfikatorów w liniach)**: słuszne. Workers Logs i tak grupuje linie jednego wywołania (request id
  zdarzenia), więc własny identyfikator nic nie wnosi. Uwaga tylko na metadane wywołania spoza helpera — F6.
- **D5 (bez service workera i błędów klienta)**: słuszne dla MS-03 (przepływy serwerowe), pod warunkiem że follow-up
  dostanie numer issue — F7.

## Findings

### F1 — `isServerFault` zalicza do „awarii serwera” odmowy RLS i wygasły JWT; komunikat obiecuje „brak połączenia”

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 2 §1 (`fault.ts`), Faza 4 §1 (`saveFailureKey`, `errors.save.unavailable`), decyzja D3
- **Detail**: Tabela oznacza jako serwerowe `42501` i wszystkie `PGRST*`. `42501` to odmowa polityki RLS (`WITH CHECK`)
  — wynik sfałszowanego lub nieaktualnego id cudzej encji, czyli żądania użytkownika, nie awarii. `PGRST301`/`PGRST303`
  to wygasły lub zły JWT w trakcie zapisu (sesja, nie baza), `PGRST116` to „0 lub >1 wiersz” przy `.single()`.
  Każdy z nich dostanie komunikat „We could not reach the database…” (nieprawdziwy) i linię błędu, która w Workers
  Issues stanie się alertem — próba podmiany id przez jednego użytkownika obudzi operatora. Ten sam tekst trafi też
  do tras usuwania („nothing was saved” przy nieudanym usunięciu) i do błędów 5xx/`XX*`, gdzie baza była osiągalna.
- **Fix A ⭐ Recommended**: Zawęzić tabelę i zneutralizować tekst
  - Strength: `42501` → bez `fault` „server” (klucz encji, linia bez alertu albo `kind: "refused"`), `PGRST301/303` →
    osobny `kind: "session"` z istniejącym przekierowaniem do logowania lub kluczem encji; `PGRST116` → `no-rows`.
    Tekst: „Something went wrong on our side, so nothing was changed. Try again in a moment.” pasuje do zapisu i usuwania.
  - Tradeoff: Jeden dodatkowy `kind` i kilka wierszy w tabeli testowej.
  - Confidence: HIGH — kody PostgREST/Postgres są udokumentowane, a RLS w tym repo jest per-user z `WITH CHECK`.
  - Blind spot: Nie sprawdzono, czy któraś trasa dziś realnie dostaje `42501` zamiast 0 wierszy (update/delete RLS filtruje po cichu).
- **Fix B**: Zostawić tabelę, zmienić tylko treść komunikatu na neutralną
  - Strength: Minimalna zmiana planu.
  - Tradeoff: Odmowy RLS i wygasłe sesje dalej generują alerty w Issues.
  - Confidence: MEDIUM — szum alertów zależy od ruchu, którego nie zmierzono.
  - Blind spot: Zmęczenie alertami przy pierwszym realnym incydencie.
- **Decision**: PENDING

### F2 — Reguła strażnika `silent-catch` nie łapie wzorców, które wskazał audyt

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Faza 1 §3 (`silent-catch-guard.test.ts`), decyzja D8
- **Detail**: Kontrakt flaguje tylko `catch` / `.catch` „zwracające stałą”. W kodzie przemilczenia mają inne kształty:
  pusty `catch` z komentarzem (`forecast/service.ts:169`, `Layout.astro:41`), zwrot wyrażenia awaryjnego
  (`forecast/service.ts:216` `return usable ? fromStored(…) : null`), ponowne rzucenie bez `cause`
  (`open-meteo.ts:92-94`, `geocode.ts:98-100`), zamiana na przekierowanie (`api/tonight/plan.ts:59-61`
  `return fail(thrownKey(…))`). Strażnik byłby zielony dla następnego takiego `catch`, więc D8 („jedyna rzecz, która
  zatrzyma następny cichy catch”) nie jest spełnione.
- **Fix**: Flagować każdą klauzulę `catch` i każdy handler `.catch`, chyba że ciało wywołuje `logFailure`, rzuca dalej
  z `cause` albo plik ma wpis w allowliście z dokładną liczbą i powodem (inwentarz dnia pierwszego ~80 miejsc, w tym
  `sw.ts`). Test strażnika ma też próbki dla czterech kształtów powyżej.
  - Strength: Ratchet obejmuje klasę błędów z audytu (RC1/RC2), a nie tylko jej najprostszą postać.
  - Tradeoff: Większa allowlista na start; więcej wpisów do usunięcia w fazach 3-5.
  - Confidence: HIGH — kształty potwierdzone grepem w `src`.
  - Blind spot: Liczba uzasadnionych wyjątków w wyspach klienta niepoliczona.
- **Decision**: PENDING

### F3 — Które błędy `getClaims` są rutynowe, a które są awarią: nierozstrzygnięte

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 5 §1 (`sessionUser`, krok `auth.claims`), kryterium 5.1
- **Detail**: Plan wycisza tylko błąd „no session”, ale brak sesji zwraca `error: null`, więc ten warunek nic nie
  rozstrzyga. Prawdziwy podział to: rutynowe (`refresh_token_not_found`, `refresh_token_already_used`,
  `session_expired`, `AuthInvalidJwtError` dla starego lub zmienionego cookie — użytkownik wylogowany gdzie indziej)
  kontra awaria (`AuthRetryableFetchError`, status ≥ 500, timeout z `withTimeout`). Bez tej listy każda nieważna sesja
  da linię `console.error`, a więc Issue i alert.
- **Fix**: Zapisać w kontrakcie listę cichych kodów/nazw (z testem tabelarycznym) i logować tylko resztę; kryterium 5.1
  rozszerzyć o „stary refresh token → null user, brak linii”.
- **Decision**: PENDING

### F4 — Testy middleware, tras auth i KV importują moduły wirtualne, których Vitest nie zna

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 4 §2 (testy tras), Faza 5 kryteria 5.1-5.2, Faza 3 §1 (`kv-cache.ts`)
- **Detail**: `middleware.ts` importuje `astro:middleware`, `lib/supabase.ts` (a przez niego `api/auth/*`)
  `astro:env/server`, `forecast/kv-cache.ts` `cloudflare:workers`. `vitest.config.ts` celowo nie ładuje pipeline’u
  Astro, a żaden istniejący test nie mockuje tych modułów. Twierdzenie „a fake context is enough” jest niepełne —
  implementer odkryje to dopiero przy pierwszym czerwonym imporcie.
- **Fix**: Wydzielić `sessionUser(client)` do `src/lib/auth/session-user.ts` (testowalne bez mocków), a dla tras auth
  i `kv-cache` zapisać `vi.mock("astro:env/server" | "cloudflare:workers", factory)` jako przyjęty wzorzec.
- **Decision**: PENDING

### F5 — Dowód grupowania w Workers Issues dopiero w Fazie 6

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Decyzja D2, Faza 6 kryteria 6.5-6.6, brief „Open Risks”
- **Detail**: Cały kształt linii (stały komunikat na krok) zakłada, że Issues grupuje `console.error` po komunikacie.
  Jeśli grupuje po miejscu wywołania lub stosie, wszystkie kroki z jedynego `logFailure` zleją się w jedno Issue.
  Plan ma fallback (zapisane zapytanie), ale dowiaduje się o tym po pięciu fazach.
- **Fix A ⭐ Recommended**: Wydać Fazę 1 osobnym PR (merge przez właściciela, deploy) i przed Fazą 3 zrobić test 6.5/6.6
  na jednej celowej linii (np. martwy `FORECAST_BASE_URL` na podglądzie albo pojedynczy krok testowy).
  - Strength: Ryzyko projektowe sprawdzone, zanim powstanie ~30 kroków.
  - Tradeoff: Dodatkowy merge i deploy w środku zmiany.
  - Confidence: MEDIUM — zależy od dostępności okna na deploy.
  - Blind spot: Grupowanie może zależeć od wolumenu.
- **Fix B**: Zostawić kolejność i przyjąć ryzyko z fallbackiem.
  - Strength: Bez zmian w przepływie.
  - Tradeoff: Ewentualna przeróbka D2 na końcu.
  - Confidence: MEDIUM.
  - Blind spot: Jak wyżej.
- **Decision**: PENDING

### F6 — Prywatność poza helperem: metadane wywołania w Workers Logs

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Decyzja D4, Faza 6 §1 (runbook) i kryterium 6.7
- **Detail**: D4 zabezpiecza treść linii, ale zdarzenie wywołania w Workers Logs ma własne pola (ścieżka URL z id encji,
  np. `/gear/sites/<uuid>`; query jest redagowane przez `redact_query_string`; ewentualnie dane `cf` żądania).
  Kryterium 6.7 sprawdza tylko „jedną linię na przepływ”.
- **Fix**: W 6.7 i w runbooku sprawdzić też pola zdarzenia wywołania (nie tylko argumenty `console.error`) i zapisać,
  co tam jest i dlaczego jest akceptowalne.
- **Decision**: PENDING

### F7 — Drobne nieścisłości w planie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State, Faza 1 §2, decyzja D5
- **Detail**: (a) `ALLOWED_DISABLES` ma 5 wpisów plikowych (7 linii), a nie „six entries”. (b) `session-plans/store.ts:36`
  jest opisany jako bezpieczny wzorzec, a przekazuje surowy `PostgrestError` (z `message`) jako `cause`; Faza 2 go
  „wyrównuje”, ale Current State powinien to nazwać problemem, nie wzorcem. (c) D5/D6/D7 mówią o follow-upach bez
  numerów issue.
- **Fix**: Poprawić liczbę, opis `store.ts:36` i założyć issue dla follow-upów D5 (SW/klient), D6 (release) i D7 (UI).
- **Decision**: PENDING
