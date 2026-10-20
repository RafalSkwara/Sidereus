<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Sky-check record failure keeps its cause

- **Plan**: context/changes/sky-check-record-cause/plan.md (z frame.md, research.md, plan-brief.md)
- **Phases**: 3 (żadna nie została rozpoczęta)
- **Date**: 2026-10-20
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 4 observations
- **Reviewed at**: `bd4bade` (fix/sky-check-record-cause)
- **Reviewer**: agent herdr `reviewer` (tylko do odczytu: ten plik to jedyny zapis; `change.md` nie jest stemplowany, zgodnie z regułami orkiestratora)

Plan jest uczciwy i trzyma się zasad debugowania z `CLAUDE.md`. Dwa pytania są rozdzielone. Przyczyna 6 s nie jest zgadywana: zamiast poprawki „na wszelki wypadek” plan zbiera dowody. Testy mają być czerwone przed poprawką, a do loga nie trafia żaden komunikat. Wszystkie tezy o kodzie się potwierdziły. Jedna rzecz zmienia jednak kontrakt poprawki (F1): pusta linia ma czwarte źródło, którego reguła „status 0” nie łapie. Reszta to obserwacje.

## Verdicts

| Dimension        | Verdict                                                               |
| ---------------- | --------------------------------------------------------------------- |
| Claim Accuracy   | WARNING (F1: frame zawyża pewność, że linia z produkcji to transport) |
| Substance        | PASS                                                                  |
| Feasibility      | PASS                                                                  |
| Sequencing       | PASS                                                                  |
| Architecture Fit | PASS (obserwacja F4)                                                  |
| Scope Discipline | PASS (decyzja o zakresie: F3)                                         |
| Verifiability    | PASS (obserwacja F2)                                                  |
| Coverage         | WARNING (F1)                                                          |

## Evidence

Sprawdzone przy `bd4bade` (Node 24.21.0, supabase-js i postgrest-js 2.116.0; worktree czysty przed i po):

- **Kod.**
  - `record.ts:39-52` ma trzy gałęzie dokładnie jak w frame.
  - `store.ts:59-70`: `record` destrukturyzuje tylko `{ error }` (`:63`) i zwraca `...withFault(error)` (`:69`).
  - `fault.ts`: `codeOf` odrzuca `""` (`:75-78`), `classifyFault` daje `server` dla braku kodu (`:122-124`), `withFault` zwraca `{}` dla klasy 22/23 (`:150-155`, `INPUT_CODE` `:99`).
  - `StoreFault` przyjmuje tylko `status` 100–599 (`:57-59`).
  - `supabase.ts:19` to `SUPABASE_TIMEOUT_MS = 5000`, a `fetch-timeout.ts` to `AbortSignal.timeout` złączony przez `AbortSignal.any`.
  - Słowo `request` jest dozwolonym kodem przez `FORECAST_STEPS`, a runbook §1 (`error-visibility.md:30`) definiuje je jako „network or timeout”.
- **postgrest-js** (`dist/index.cjs:418-458`): każde odrzucenie wewnątrz `executeWithRetry` daje `{ error: { message, details, hint, code: "" }, status: 0 }`. Dotyczy to fetcha, odczytu ciała w `processResponse` i fetcha opakowanego przez auth. Tylko `AbortError` i `ABORT_ERR` dostają `hint`, a `TimeoutError` z `AbortSignal.timeout` przechodzi ścieżkę domyślną, więc kod też jest `""`. `POST` nie jest ponawiany (`:211-220`).
- **Moja sonda** (skrypt w scratchpadzie, prawdziwy `createClient` z supabase-js, uruchomiony z worktree):

  | fetch                               | czas  | `status` | `error.code` | klucze `error`               |
  | ----------------------------------- | ----- | -------- | ------------ | ---------------------------- |
  | zawieszony pod `withTimeout(…, 50)` | 61 ms | 0        | `""`         | message, details, hint, code |
  | odrzuca `TypeError("fetch failed")` | 1 ms  | 0        | `""`         | message, details, hint, code |
  | **502 z ciałem HTML (bramka)**      | 1 ms  | **502**  | **brak**     | **message**                  |

  Ostrzeżeń GoTrue nie było, a klient z domyślnymi opcjami auth kończy się czysto. Uwaga: timer `AbortSignal.timeout` jest w Node `unref`. Gołym skryptem proces wychodzi przed jego odpaleniem, ale pod Vitestem (żywy worker) to bez znaczenia.

- **Polecenia z planu działają.** `npm run test:reference -- src/lib/sky-checks src/lib/observability/fault.test.ts`: 20 zaliczonych dziś. Polecenie `eslint` z 1.2 przechodzi, polecenie `prettier --check` z 3.1 też.
- **RPC i klasa 22/23** (`20261003120000_sky_checks.sql`): `site_id` przychodzi z bazy (rozwiązany własny site), `night` i `dark_start` liczy serwer, `headline` pochodzi z silnika i ma ograniczenie `check`. `site_name` to nazwa z `sites`, z tym samym ograniczeniem 1–60 (`20260924120000_sites_and_gear.sql:13`). Konflikt rozwiązuje `on conflict`, więc 23505 nie wystąpi. Klasa 22/23 przy `record` to rzeczywiście nasz błąd. Jedyny wyjątek to wyścig 23503: site usunięty między `select` a `insert` w tej samej funkcji, okno rzędu milisekund.

## Findings

### F1 — Odpowiedź HTTP bez kodu (bramka 5xx, ciało nie-JSON) też daje pustą linię, a reguła „status 0” jej nie łapie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Coverage (i Claim Accuracy)
- **Location**: plan.md Faza 2 §1 (kontrakt `faultFrom`/`withFault`), Faza 1 §1 (fake) i §5 (test kontraktu); frame.md Q1.3 i „Narrowing Signals”; `postgrest-js/dist/index.cjs:515-526`
- **Detail**: Gdy Supabase albo Cloudflare przed nim odpowie statusem nie-2xx z ciałem, które nie jest JSON-em (502, 503, 520–524, 544), postgrest-js zwraca `error = { message: body }` bez `code`, a `status` to kod HTTP (sonda: 502). Dziś `faultFrom` nie znajduje kodu ani statusu, `classifyFault` daje `server`, więc linia to `{ step }`, identyczna jak na produkcji. Plan przewleka `status` odpowiedzi, ale używa go tylko dla `status === 0`. Po poprawce taki przypadek nadal da pustą linię, czyli obietnica z Desired End State („any later occurrence of the production line is self-describing”) nie jest spełniona. Dotyczy to też frame: Q1.3 jest oceniony jako „STRONG: the observed line”, a lista źródeł pustej linii pomija tę gałąź. Czas (+6.3 s) lepiej pasuje do strażnika 5 s, ale bramka odpowiadająca 5xx po kilku sekundach nie jest wykluczona. Tylko log API Gateway Supabase (3.4) rozstrzygnie, którą gałąź trafiła produkcja.
- **Fix**: Rozszerzyć regułę nośnika o drugi przypadek, nie zmieniając już kodowanych błędów. Gdy błąd nie ma dozwolonego kodu, a `status` odpowiedzi to 100–599 i nie jest 2xx, nośnik dostaje `code: "http"` i ten `status`. To słownictwo istnieje już w runbooku §1 (`http` ze `status`, „429 and 5xx are the provider”), a `classifyFault` da `server` dla ≥ 500. Błędy z kodem PostgREST (400, 403, 409…) zostają bez `status`, zgodnie z decyzją F6 z error-visibility, więc istniejące asercje się nie zmieniają. Do zrobienia przy tym:
  - Fake w Fazie 1 §1 nie może domyślnie dawać `status: 400` dla błędu. Domyślnie ma nie dawać żadnego statusu, inaczej po tej regule każdy istniejący test z fake'iem zmieniłby oczekiwany kształt.
  - Fazy 1 §2, §4 i §5 dostają przypadek 502 z ciałem HTML zawierającym `LEAK`. Oczekiwana linia to `{ step, code: "http", status: 502 }`, bez śladu treści.
  - Runbook (Faza 3 §1) dostaje trzecie odczytanie: `code: http` ze statusem to odpowiedź bramki lub PostgREST bez treści JSON.
  - Strength: Domyka całą klasę „żądanie nie dało kodu PostgREST” jedną regułą w tym samym miejscu, bez nowego pola i bez czytania treści.
  - Tradeoff: Rośnie liczba przypadków w testach Fazy 1 o jeden na plik, a reguła w `fault.ts` dostaje drugą gałąź.
  - Confidence: HIGH — kształt odpowiedzi potwierdziła sonda na prawdziwym supabase-js 2.116.0.
  - Blind spot: Nie wiem, jakie statusy i ciała Supabase faktycznie zwraca przy przeciążeniu (544, 520, 503); reguła obejmuje wszystkie nie-2xx bez kodu.
- **Decision**: PENDING

### F2 — Zawężenie `store.test.ts` to uprawniona zmiana wymagania, ale wymaga trzech uzupełnień

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md Faza 1 §3, Faza 2 manual 2.6; `src/lib/sky-checks/store.test.ts:27,47-52`
- **Detail**: Moja ocena: to nie jest edycja testu pod nowy kod. Pętla „no fault for user input, in every write” przyjmuje założenie, które dla `record` jest fałszywe: argumenty RPC buduje serwer (Evidence, punkt „RPC”), więc klasa 22/23 to nasz błąd, a nie dane użytkownika. Zmienia się wymaganie, a nie wynik testu, i reguła z `CLAUDE.md` („unless the requirement itself changed”) to dopuszcza. Plan nazywa zmianę wprost i daje `record` przeciwną asercję. Brakuje trzech rzeczy:
  - Tytuł testu (`:27`) brzmi „…has no fault for user input, in every write”. Po zawężeniu kłamie, trzeba go zmienić na „in answer and skip”.
  - Odwołanie `:45-51` w planie to faktycznie pętla `:47-52`.
  - Zawężenie i nowa przeciwna asercja dla `record` muszą wejść w tym samym commicie Fazy 1, a czerwony przebieg musi pokazać nową asercję czerwoną. Inaczej przez chwilę `record` nie miałby żadnej asercji dla 22/23.

  Do tego wyścig 23503 (Evidence) po poprawce stanie się linią poziomu error z kodem. Akceptowalne, ale warto o tym wspomnieć w wierszu runbooka.

- **Fix**: Zmienić tytuł testu, poprawić numery linii w planie, w Fazie 1 §3 dopisać „w tym samym commicie co przeciwna asercja”, a w Fazie 3 §1 dopisać zdanie o 23503.
- **Decision**: PENDING

### F3 — Zakres: dziura jest w 36 wywołaniach w 9 plikach, a plan naprawia jedno

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: plan.md „What We're NOT Doing” (3. punkt), Faza 3 §1–§2
- **Detail**: `grep` daje 36 wywołań `withFault(`/`faultFrom(` w 9 plikach: `gear/store.ts` 11, `observations/store.ts` 9, `sky-checks/store.ts` 6, `session-plans/store.ts` 3, `milestone-store.ts` 2, `onboarding/store.ts` 2, `read-failure.ts` 1 i dwie trasy planu sesji. Każde z nich po timeoucie albo zerwanym połączeniu loguje linię bez przyczyny: zapis daje `{ step }`, odczyt `{ step, name: "StoreFault" }`. Ten sam request Tonight robi kilka takich odczytów przed zapisem. Plan uczciwie to przyznaje, robi regułę w nośniku ogólną (opcjonalny argument) i pisze to w runbooku i tripwire. Zawężenie zgadza się z zasadą „dowody przed hipotezą”, bo wystąpienie mamy tylko dla `record`. Mechaniczne rozszerzenie na 36 miejsc wymagałoby jednak testów per store z fake'iem niosącym status.
- **Fix A ⭐ Recommended**: Zostawić zakres, ale już w tej zmianie założyć zgłoszenie follow-up na tablicy („thread the response status through every store”, lista 9 plików, reguła z F1). W runbooku i tripwire odesłać do tego zgłoszenia zamiast „a one-line follow-up”.
  - Strength: PR zostaje mały i oparty na dowodzie. Reguła w nośniku jest gotowa, więc kolejne store'y idą tym samym kontraktem.
  - Tradeoff: Do czasu follow-upu timeout w odczytach Tonight dalej daje linię bez przyczyny.
  - Confidence: MED — zależy od tego, jak często takie linie się pojawiają (3.5, liczenie przez właściciela).
  - Blind spot: Nie znamy dziś częstości innych pustych linii `read.*` i `save.*` w produkcji.
- **Fix B**: Rozszerzyć teraz na wszystkie 36 wywołań, z jednym testem tablicowym na nośniku i jednym przypadkiem transportu na rodzinę store'ów.
  - Strength: Każda przyszła linia z dowolnego store'a sama się tłumaczy.
  - Tradeoff: Faza 2 rośnie do 9 plików i kilkunastu nowych przypadków testowych; ryzyko poza miejscem z dowodem.
  - Confidence: HIGH, że technicznie działa; MED, że warto teraz.
  - Blind spot: None significant.
- **Decision**: PENDING

### F4 — `request` to dobre słowo, ale kod store'a opiera się na słowniku prognozy

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture Fit
- **Location**: plan.md Faza 2 §1; `log-failure.ts` (`FORECAST_STEPS`, `isLoggableCode`)
- **Detail**: Zgadzam się z wyborem. `request` jest już dozwolone, runbook definiuje je ogólnie jako „network or timeout”, nie trzeba nowego pola ani zmiany przypiętego kształtu linii, a grupowanie Issues idzie po kroku, nie po kodzie. Słowo żyje jednak w `FORECAST_STEPS`. Zmiana nazw kroków prognozy po cichu wyłączyłaby kod transportu store'ów (`isLoggableCode` by go odrzucił, linia znów byłaby pusta). To samo dotyczy `http` z F1.
- **Fix**: Wyeksportować z `log-failure.ts` nazwane stałe (np. `TRANSPORT_CODE = "request"`, `HTTP_CODE = "http"`) używane przez `fault.ts`. W `fault.test.ts` dodać asercję `isLoggableCode(TRANSPORT_CODE)` (i `HTTP_CODE`), żeby rozjazd zaczerwienił test.
- **Decision**: PENDING

### F5 — Test z prawdziwym klientem supabase-js jest szybki i stabilny; dwie drobne uwagi

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md Faza 1 §5 (`record-transport.test.ts`)
- **Detail**: Sonda potwierdza założenie: zawieszony fetch pod strażnikiem 50 ms daje `status 0` i `code ""` w 61 ms, odrzucony daje to samo w 1 ms, bez ostrzeżeń GoTrue i bez sieci. W CI będzie szybki i deterministyczny. Dwie uwagi:
  - Timer `AbortSignal.timeout` jest prawdziwy i `unref`. Ten plik nie może używać `vi.useFakeTimers()`, inaczej test zawiśnie do timeoutu Vitesta.
  - Warto ustawić `auth: { persistSession: false, autoRefreshToken: false }`, żeby klient nie startował stanu GoTrue (w sondzie domyślne opcje też działały, ale bez nich test zależy od szczegółów inicjalizacji auth).

  Przypadek 502 z F1 dopisuje się tutaj naturalnie (`fetch` zwracający `new Response("<html>…", { status: 502 })`).

- **Fix**: Dopisać w Fazie 1 §5 „bez fake timers; `persistSession`/`autoRefreshToken` wyłączone” oraz przypadek 502.
- **Decision**: PENDING
