<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sky-check record failure keeps its cause

- **Plan**: context/changes/sky-check-record-cause/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-20
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations
- **Reviewed at**: `6781c3a` (fix/sky-check-record-cause), diff `origin/main..HEAD`: p1 `5d4ac8c`, p2 `fa85ada`, p3 `51ed3df` (decyzje z przeglądu planu w `37f11cc`)
- **Reviewer**: agent herdr `reviewer` (tylko do odczytu: ten plik to jedyny zapis; `change.md` nie jest stemplowany, zgodnie z regułami orkiestratora)

Zmiana jest wzorcowo zrobiona według zasad debugowania z `CLAUDE.md`. Testy były czerwone przed poprawką, a ich czerwień odtworzyłem niezależnie. Poprawka jest najmniejsza możliwa i nie czyta żadnego tekstu. Po Fazie 1 nie zmieniono żadnej asercji. Wszystkie pięć ustaleń z przeglądu planu zastosowano. Trzy obserwacje dotyczą drobnej luki dla 2xx, brzmienia tytułu testu i pominiętego e2e.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS (pozostałe 36 wywołań to zgłoszenie #233) |
| Safety & Quality | PASS (obserwacja F1) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (obserwacje F2, F3; 3.3–3.6 należą do właściciela) |

## Evidence

**Faza 1 naprawdę była czerwona na starym kodzie.** Odtworzyłem to w tymczasowym, odłączonym worktree na `5d4ac8c` w scratchpadzie (z dowiązanym `node_modules`; potem `git worktree remove` i `prune`, a worktree lidera pozostał nietknięty). `npx vitest run --project reference src/lib/sky-checks src/lib/observability/fault.test.ts` dał 10 czerwonych i 23 zielone, dokładnie jak w `implementation-notes.md`:
- trzy przypadki `record.test.ts` (status 0, 502 z HTML, `23514`/`22P02`), w których „expected error to be called with …” pokazuje pustą linię;
- `store.test.ts` „keeps a fault for every failed record”, który już przy `22P02` nie dostaje `fault`;
- trzy przypadki `fault.test.ts` (stałe nie istnieją, brak argumentu odpowiedzi);
- trzy przypadki `record-transport.test.ts`, w których asercje kontraktu biblioteki przechodzą (status 0 i 502, kod pusty), a czerwony jest dopiero wynik `skyCheckStore.record`.

Commit `5d4ac8c` nie zawiera kodu produkcyjnego (tylko testy, fake, plan i notatki), a `git diff 5d4ac8c..fa85ada` nie dotyka żadnego pliku `*.test.ts`. Po czerwieni nie zmieniono więc żadnej asercji.

**Po Fazie 2 linia niesie przyczynę, nigdy treść.**
- `fault.ts`: `codeFromResponse` daje `request` dla `status === 0` i `http` ze statusem dla 100–599 spoza 2xx. Sięga po nie tylko wtedy, gdy błąd nie ma dozwolonego kodu, więc błąd z kodem PostgREST nie zyskuje statusu (decyzja F6 z error-visibility jest zachowana, a test „keeps a code the error already has” to przypina).
- `store.ts`: `recordFault` zwraca błąd z klasy 22/23 jako `server` z kodem, a `record` czyta `{ error, status }`.
- `grep` po diffie trzech plików produkcyjnych i `log-failure.ts` nie znajduje żadnego odczytu `message`, `details`, `hint` ani `stack` (pozycja 2.6 potwierdzona).
- Testy mają kanarka (`COORDS`, `EMAIL`) w `transportError()`, `gatewayError()` i ciele HTML odpowiedzi 502, a każdy nowy przypadek sprawdza `not.toMatch(LEAK)`.

**F4 z przeglądu planu.** `TRANSPORT_CODE = "request"` i `HTTP_CODE = "http"` są wyeksportowane z `log-failure.ts`, a `FORECAST_STEPS` jest z nich budowany. `fault.test.ts` przypina oba słowa i `isLoggableCode` dla obu. Łamanie z nazwą `"req"` daje według notatek dwa czerwone testy.

**F2 z przeglądu planu.** Zawężenie (`continue` dla `record` w pętli 22/23) i przeciwny przypadek „keeps a fault for every failed record” są w tym samym commicie `5d4ac8c`, a tytuł zmieniono na „…in answer and skip” (patrz F2 niżej).

**F5 z przeglądu planu.** `record-transport.test.ts` używa prawdziwego `createClient` z `auth: { persistSession: false, autoRefreshToken: false }`, ma prawdziwy strażnik 50 ms, nie ma fake timers (komentarz mówi dlaczego) i zawiera przypadek 502 z HTML. W przebiegu na p1 trwał 121 ms dla zawieszonego fetcha.

**F3 z przeglądu planu.** Zgłoszenie #233 jest otwarte i wymienia 36 wywołań w 9 plikach, reguły `request`/`http`, testy per rodzina store'ów i warunek „evidence first” (liczenie przez właściciela). Runbook i tripwire w `CLAUDE.md` do niego odsyłają.

**Runbook i tripwire.** Wiersz `tonight.sky-check-record` w `error-visibility.md` czyta `failed` po kodzie:
- `request` z odróżnieniem strażnika (około 5 s) od zerwania (milisekundy) i wskazaniem logu API Gateway;
- `http` ze statusem;
- klasę 22/23 jako nasz błąd, z wyścigiem `23503` nazwanym jako łagodny i przyjęty;
- każdy inny kod jak dotąd.

§2 dostał akapit o tym, co `request` i `http` mówią, a czego nie. Tripwire w `CLAUDE.md` ma jedno zdanie. Prettier wyrównał całą tabelę w runbooku; diff bez białych znaków (`-w --word-diff`) pokazuje, że treść zmieniła się tylko w tym wierszu i nowym akapicie.

**`plan-review.md`.** Prettier przeformatował mój raport (pusta linia po znaczniku, wyrównane tabele), bez zmiany treści. Wpisy `Decision` są uzupełnione przez lidera. W porządku.

**Bramki przy `6781c3a`** (Node 24.21.0, worktree czysty przed i po): `npm test` (oba projekty) 881 zaliczonych, 1 pominięty; `npm run lint` czysto; `npx astro check` 0 błędów, 0 ostrzeżeń.

## Findings

### F1 — Odpowiedź 2xx z ciałem nie-JSON dalej daje pustą linię, a runbook mówi, że to niemożliwe

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/observability/fault.ts (`codeFromResponse`, warunek `status < 200 || status > 299`); context/deployment/error-visibility.md (wiersz `tonight.sky-check-record`: „A `failed` line with no `code` is a rejection … or a build from before this change”)
- **Detail**: postgrest-js w gałęzi `res.ok` ustawia `error = { message: body }`, gdy ciało nie jest JSON-em (`dist/index.cjs:482`), a `status` zostaje 2xx. Na przykład pośrednik odda 200 ze stroną HTML. `codeFromResponse` celowo pomija 2xx, więc linia to znów `{ step }`. Dla RPC `void` to bardzo mało prawdopodobne (pusta odpowiedź 204 nie daje błędu), ale zdanie w runbooku, że linia bez kodu to wyłącznie odrzucenie albo stary build, nie jest ściśle prawdziwe.
- **Fix**: Albo w `codeFromResponse` traktować każdy poprawny status przy istniejącym błędzie bez kodu jako `http` ze statusem (`faultFrom` z odpowiedzią jest wołany tylko przy błędzie), plus jeden przypadek testowy 200 z HTML. Albo dopisać w runbooku „…or a 2xx answer whose body was not JSON (rare)”. Pierwsza opcja jest prostsza i zamyka klasę.
- **Decision**: PENDING

### F2 — Tytuł zawężonego testu jest uczciwy w kierunku, ale niedokładny

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/sky-checks/store.test.ts:27
- **Detail**: Tytuł brzmi „keeps only its code for a server fault, is `refused` or `session` by code, and has no fault for user input, in answer and skip”. Pierwsze trzy części nadal biegną dla wszystkich trzech zapisów, łącznie z `record`, a tylko reguła o danych użytkownika jest zawężona do `answer` i `skip`. Czytany wprost, tytuł sugeruje, że cały test dotyczy tylko tych dwóch zapisów. Zmiana jest uprawniona (zmieniło się wymaganie, a przeciwny przypadek jest w tym samym commicie); chodzi wyłącznie o dokładność opisu.
- **Fix**: Np. „keeps only its code for a server fault and is `refused` or `session` by code in every write; has no fault for user input in answer and skip”.
- **Decision**: PENDING

### F3 — Pominięcie e2e i smoke jest akceptowalne, ale warto napisać to w PR

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: implementation-notes.md („Phase 2”); context/foundation/lessons.md („Run the whole e2e suite before a PR”)
- **Detail**: Moja ocena: tak, akceptowalne. Zmiana dotyka tylko ścieżki błędu i logu. `faultFrom` i `withFault` bez drugiego argumentu działają jak dotąd, co przypinają testy i wszystkie 35 pozostałych wywołań. Słownik kodów ma tę samą treść, a żadna strona, trasa, znacznik ani worker się nie zmienia. Żaden spec e2e ani krok smoke nie może zobaczyć różnicy, bo dotyczy ona wyłącznie linii w logu przy awarii Supabase, której te testy nie wywołują. CI i tak puści smoke i e2e na PR przed scaleniem. Lekcja jest jednak sformułowana bez wyjątków („before opening a PR”), więc odstępstwo powinno być jawne, a nie ciche.
- **Fix**: W opisie PR napisać, że e2e i smoke zostały świadomie zostawione CI, z powodem (zmiana tylko w logu, brak zmian w stronach, trasach i workerze). Ewentualnie dopisać do lekcji wyjątek dla zmian dotyczących wyłącznie logu.
- **Decision**: PENDING

## Manual verification

- **1.3** (recenzent): potwierdzam. Przypadki (a) i (b) `record.test.ts` to linia z produkcji (`{ step }` przy transporcie) i jej ukryty bliźniak (klasa 22/23). Czerwień odtworzyłem i żadna asercja nie była pisana pod planowaną implementację.
- **2.6** (recenzent): potwierdzam. Trzy pliki produkcyjne nie czytają `message`, `details`, `hint` ani `stack`, a `git diff 5d4ac8c..fa85ada` nie zmienia żadnego testu. Jedyne zawężenie to to w Fazie 1, nazwane i uzasadnione.
- **3.3–3.6** należą do właściciela: przeczytanie wiersza runbooka, log API Gateway Supabase z 2026-10-20 08:45:01–08:45:07 UTC, liczenie linii w Workers Logs i potwierdzenie po wdrożeniu.
