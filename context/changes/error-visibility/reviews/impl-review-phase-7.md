<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Production Error Visibility (M-4 S-07)

- **Plan**: context/changes/error-visibility/plan.md
- **Scope**: Phase 7 of 9 (endpoint `POST /api/client-error` i rdzeń reportera)
- **Reviewed phases**: 7
- **Date**: 2026-10-19
- **Verdict**: REJECTED
- **Findings**: 1 critical, 1 warning, 5 observations
- **Reviewed at**: `bbcd8d30` (feat/error-visibility-client), diff `8697639..bbcd8d3`, kod w `a182d6e`
- **Reviewer**: agent herdr `reviewer` (tylko do odczytu: ten plik to jedyny zapis; `change.md` nie jest stemplowany, zgodnie z regułami orkiestratora)

Werdykt REJECTED wynika z reguły „każdy krytyczny FAIL w Safety”, ale poprawka F1 jest wąska (jeden `try/catch` plus test), bez zmian w architekturze. Reszta fazy jest solidna: kontrakt planu (kolejność 403 → 413 → 415 → 429 → 400, 204 z `no-store`, `logNotice`, skrót w middleware, limiter z fallbackiem i linią `config.rate-limit`) zgadza się z kodem.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (drobne rozbieżności tekstu: F7) |
| Scope Discipline | PASS |
| Safety & Quality | FAIL (F1) |
| Architecture | PASS |
| Pattern Consistency | PASS (obserwacja F6) |
| Success Criteria | WARNING (F2, F3; 7.8 i 7.9 czekają na właściciela, co jest w porządku) |

## Evidence

**Bramki uruchomione przy HEAD `bbcd8d30`** (Node 24.21.0, worktree czysty przed i po):

- `npx vitest run src/lib/observability src/lib/routes/client-error.test.ts src/lib/auth/middleware.test.ts src/lib/wrangler-config.test.ts`: 13 plików, 60 testów zaliczonych.
- `npm test`: 128 plików, 833 zaliczone, 1 pominięty.
- `npm run lint`: czysto. `npx astro check`: 0 błędów, 0 ostrzeżeń (3 podpowiedzi).
- `npm run build`: OK. `npx wrangler deploy --dry-run`: OK, wypisuje `env.CLIENT_ERROR_LIMITER (30 requests/60s)  Rate Limit`; `dist/server/wrangler.json` zawiera `ratelimits`. `worker-configuration.d.ts` nietknięty.
- Smoke 7.7 nie był przeze mnie powtórzony (wymaga lokalnego Supabase i klucza). Zamiast tego zrobiłem sondę HTTP na podglądzie produkcyjnego builda (`astro preview --port 4337`, workerd), potem podgląd zatrzymany:

| Żądanie | Wynik | Wniosek |
|---|---|---|
| JSON, `Origin` własny, `{step, name}` | 204, linia `sidereus: client.sw.index noted { step, name: 'ProbeError' }` | ścieżka szczęśliwa jak w planie |
| `text/plain`, tylko `Sec-Fetch-Site: same-origin`, bez `Origin` | **403 od Astro** („Cross-site POST form submissions are forbidden”) | F4 |
| JSON, tylko `Sec-Fetch-Site: same-origin` | 204 | kontrola trasy działa dla JSON |
| `POST /api/client-error/` (ukośnik na końcu) | 204, a middleware przeszło pełną ścieżkę (pojawiła się linia `config.supabase failed`) | F5 |
| strumień 700 B bez `Content-Length` | 413 | ograniczenie przy chunked działa też w workerd |
| upload chunked przerwany przez klienta po 18 bajtach | **500 i `[ERROR] Error: Network connection lost.` ze stosem z `readBoundedBody`** | F1 |

**Siła testów (7.1/7.2, red-first nieobserwowany).** Bez prawa do edycji kodu przeszedłem mutanty myślowo, linia po linii. Testy łapią: usunięcie kontroli origin, `>` → `>=` w obu limitach bajtów, usunięcie wczesnej kontroli `Content-Length` (19-bajtowe ciało z nagłówkiem 513), czytanie całego ciała naraz (nieskończony strumień by zawisł), akceptację dowolnego content-type, nieścisły schemat, `logFailure` zamiast `logNotice`, `name: "Error"` w raporcie bez nazwy, fallback „przepuść wszystko”, drugą linię `config.rate-limit`, przesunięcie skrótu w middleware za ustawienia (`locals` musi być `{}`), dedupe po samym kroku, `>` zamiast `>=` przy limicie, wysyłkę przy `onLine === false`, klasyfikację ignorującą krok i każdy wyciek z `message`, `stack` lub `fileName` (canary). **Przeżywają** tylko: przestawienie limitera przed tanie odmowy (F2) i usunięcie `reader.cancel()` (drobne). Jak na testy pisane razem z kodem to mocny zestaw, ale same łamania nie są nigdzie zapisane (F3).

## Findings

### F1 — Przerwany upload daje nieograniczone linie błędu i 500, z pominięciem limitera

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/observability/client-report.ts:33 (`await reader.read()`), src/pages/api/client-error.ts:37
- **Detail**: `readBoundedBody` nie obsługuje odrzucenia `reader.read()`. Kiedy klient zrywa połączenie w trakcie wysyłania ciała, workerd odrzuca odczyt błędem `Network connection lost.`, wyjątek wychodzi z `POST`, a Astro odpowiada 500 i loguje `[ERROR]` (poziom error, pełny stos) przez `console.error`. Sprawdziłem to sondą na podglądzie (tabela wyżej). Odczyt ciała jest przed limiterem, więc każdy `curl`, który zerwie upload, zostawia jedną linię poziomu error. Nie ma na to limitu, nie trzeba znać kroku ani nazwy, a tożsamy origin da się podrobić nagłówkiem. To uderza w oba cele planu: D9 („bounds log volume”) i D13 („a forged report must never be able to create an Issue”). Linie `console.error` są tym, co według D2/D11 grupuje się w Workers Issues i budzi operatora. W linii nie ma danych osobowych (sam stos), więc problemem jest szum i alarmy, a nie prywatność. Odrzucenie przez sam binding limitera też dałoby 500, ale to prawdziwa usterka serwera, której nie da się podrobić, więc może zostać jako error. Żaden test nie obejmuje strumienia, który kończy się błędem.
- **Fix A ⭐ Recommended**: Złapać błąd odczytu w `readBoundedBody` i zwrócić go jako osobny wynik (np. `"broken"`). Trasa odpowiada wtedy 400 bez żadnej linii, tak jak na JSON, który się nie parsuje. Do tego wpis allowlisty strażnika silent-catch z powodem `INPUT` („the client broke its own upload; a forged request must not leave a line, D13”) oraz test w `client-error.test.ts`: strumień z `controller.error(...)` daje 400, `logs.errors` i `logs.warns` nie są wołane i nie zużywa się token limitera.
  - Strength: To ten sam wzorzec co `JSON.parse` w tym samym pliku (`client-report.ts` ma już wpis `INPUT` w strażniku). Wejście klienta jest odmową, nie usterką, więc nie zostawia linii i nie da się nim zalać logów.
  - Tradeoff: Masowo zrywane uploady nie zostawią śladu w naszych liniach (ślad zostaje w metrykach statusów Workers).
  - Confidence: HIGH — błąd odtworzony w workerd; poprawka dotyczy jednej funkcji.
  - Blind spot: Nie sprawdziłem na produkcji, czy Cloudflare przy zerwaniu połączenia czasem anuluje wywołanie, zanim odczyt się odrzuci. Podgląd (workerd) pokazuje, że odczyt się odrzuca.
- **Fix B**: Złapać jak wyżej, ale zostawić jedną linię `logNotice` (warn) na izolat w nowym kroku serwerowym (np. `client-error.body`), wzorem `config.rate-limit`.
  - Strength: Literalnie spełnia twardą regułę „catch loguje”, a operator widzi, że coś takiego zaszło.
  - Tradeoff: Nowy krok w `FAILURE_STEPS`, stan modułu i wiersz w runbooku dla zdarzenia, którego wywołanie jest w całości w rękach klienta.
  - Confidence: MED — wymaga decyzji, czy taka linia w ogóle ma wartość.
  - Blind spot: None significant.
- **Decision**: Fix A, applied 2026-10-19: `readBoundedBody` returns `{ refused: "broken" }` for an erroring stream, the route answers 400 with no line and spends no token, `client-report.ts` allowlist is 2 with the INPUT reason; test with an erroring stream (red first, re-broken after). Check added to 7.8 (a `curl` upload cut off by Ctrl-C leaves no error line).

### F2 — Nic nie przypina reguły, że tanie odmowy nie zużywają tokenu limitera

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/routes/client-error.test.ts:129 („…before anything else”)
- **Detail**: Plan zakłada kolejność origin → rozmiar → typ → limiter → schemat, żeby odmowy 403/413/415 nic nie kosztowały i nie zjadały budżetu 30 na minutę prawdziwym raportom. Test o nazwie „before anything else” sprawdza tylko kody statusu, każdy osobno. Przestawienie `allowClientError()` na początek `POST` przechodzi cały zestaw: limit w testach wynosi 100, a test 429 wysyła wyłącznie poprawne raporty. Przy red-first nieobserwowanym (F3) to dokładnie ten rodzaj refaktoru, który przejdzie po cichu.
- **Fix**: Dodać przypadek z `createMemoryLimiter({ limit: 1 })`: najpierw po jednym żądaniu 403, 413 i 415, potem poprawny raport musi dać 204. Opcjonalnie dopisać, że 400 (zły schemat) zużywa token, tak jak mówi plan.
- **Decision**: Taken, with Fable's recommendation: the schema now runs before the limiter, so garbage never burns the shared budget; a `limit: 1` test pins that 403, 413, 415 and two 400s spend no token and only a well-formed report does. Plan 7 §2 order and the round table updated. Also taken from Fable: `limiter.limit()` is guarded, fail closed (refuse), one `config.rate-limit` line per isolate, tested.

### F3 — Zapis „red shown by deliberate breaks” w 7.1/7.2 nie mówi, co zostało złamane

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/error-visibility/plan.md:816-817
- **Detail**: Progress uczciwie przyznaje, że testy powstały razem z kodem. Nigdzie (plan, commit, notatki) nie ma jednak listy łamań, więc nie da się ich powtórzyć. Moja analiza mutantów (Evidence) pokazuje, że zestaw jest mocny, z dwoma lukami: F2 i `reader.cancel()`.
- **Fix**: Dopisać do Progress 7.1/7.2 (lub do notatek zmiany) jedną linię z listą łamań, które dały czerwień, a w Fazach 8 i 9 wrócić do red-first.
- **Decision**: Taken: `implementation-notes.md` lists the first-pass breaks and the post-review break per fix; Phases 8 and 9 go back to red first.

### F4 — Test „beacon text/plain z samym Sec-Fetch-Site → 204” opisuje żądanie, które produkcja odrzuca

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/routes/client-error.test.ts:73-80, src/pages/api/client-error.ts:28-31
- **Detail**: `security.checkOrigin` w Astro 7.3.2 (`node_modules/astro/dist/core/app/origin-check.js`) odrzuca 403 każde `POST` z `text/plain`, którego `Origin` nie jest równy originowi strony, i robi to przed middleware i trasą. Sonda to potwierdza. Gałąź „sam `Sec-Fetch-Site` wystarczy” działa więc tylko dla `application/json`. Przeglądarki wysyłają `Origin` przy każdym POST, w tym przy `sendBeacon`, więc Faza 9 zadziała. Test jednak utwierdza w fałszywym przekonaniu, a komentarz trasy tego nie mówi.
- **Fix**: W teście beacona dodać `origin` (realny kształt) albo zmienić jego komentarz na „tylko JSON”, a w komentarzu trasy dopisać, że dla `text/plain` pierwszą bramką jest `checkOrigin` Astro.
- **Decision**: Taken: the beacon test carries the page's `Origin`; a separate JSON case covers `Sec-Fetch-Site` alone; the route comment and plan 7 §2 name `checkOrigin` as the first gate for `text/plain`.

### F5 — `/api/client-error/` (z ukośnikiem) omija skrót w middleware

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:22
- **Detail**: `trailingSlash` ma domyślne `ignore`, więc trasa odpowiada też pod `/api/client-error/`. Porównanie `=== CLIENT_ERROR_PATH` wtedy nie pasuje i middleware rozwiązuje ustawienia, tworzy klienta i czyta sesję (sonda: 204 i linia `config.supabase failed` z pełnej ścieżki). Nie ma wycieku, a fałszerz i tak może uderzać w dowolną stronę. Chodzi tylko o to, że gwarancja „ta ścieżka nie kosztuje odczytu sesji” ma szczelinę.
- **Fix**: Porównywać ścieżkę bez końcowego ukośnika (`pathname.replace(/\/$/, "")`) i dodać ten wariant do testu middleware.
- **Decision**: Taken: `isClientErrorPath` ignores trailing slashes; the middleware test covers `/api/client-error/` and `//` (red first).

### F6 — `NAME_SHAPE` istnieje w dwóch kopiach

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/observability/log-failure.ts:149, src/lib/observability/client/steps.ts:52
- **Detail**: Plan mówi, że `NAME_SHAPE` jest eksportowany ze `steps.ts`, „so the two cannot drift”. Reporter i schemat trasy rzeczywiście dzielą jedną kopię, ale `nameOf` w loggerze ma własną, prywatną, identyczną regułę. Gdyby się rozjechały, zaakceptowana nazwa zniknęłaby z linii po cichu (bez wycieku, ale z utratą informacji).
- **Fix**: Niech `log-failure.ts` importuje `NAME_SHAPE` ze `steps.ts` (już importuje stamtąd typ; moduł jest bezpieczny dla przeglądarki i nie ma importów serwerowych).
- **Decision**: Taken: `log-failure.ts` imports `NAME_SHAPE` from `client/steps.ts`.

### F7 — Drobne rozbieżności z tekstem planu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/observability/client/reporter.ts:17, src/pages/api/client-error.ts:24-26
- **Detail**: (a) Plan opisuje `createReporter({ send, maxTotal, now? })`, a kod nie ma `now` (nic w nim nie zależy od czasu, więc zmiana jest nieszkodliwa). (b) `Cache-Control: no-store` mają tylko 204 i 429, a 400/403/405/413/415 nie (odpowiedzi na POST i tak nie trafiają do cache, więc to kosmetyka). (c) Testy dla 405 sprawdzają tylko `GET`. Żadna z tych rzeczy nie zmienia zachowania.
- **Fix**: Usunąć `now?` z kontraktu w planie przy następnej edycji (a) i zostawić (b)/(c) bez zmian albo dodać `no-store` do `refuse` dla spójności.
- **Decision**: Taken: `now?` removed from the plan contract; every answer carries `no-store`; the 405 test covers GET, PUT and DELETE.

## Manual verification

- 7.8 i 7.9 są `[ ]` i należą do właściciela po pierwszym wdrożeniu, tak jak przewiduje plan. Nic nie jest odhaczone bez dowodu.
- Po poprawce F1 warto dopisać do 7.8 jedno sprawdzenie: zerwany upload (`curl` z ciałem chunked przerwanym Ctrl-C) nie zostawia w Workers Logs linii poziomu error.
