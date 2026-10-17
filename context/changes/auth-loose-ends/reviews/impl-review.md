<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Loose Ends (M-4 S-06)

- **Plan**: `context/changes/auth-loose-ends/plan.md`
- **Scope**: Full plan (PR #211, branch `feat/auth-loose-ends` against `origin/main`, HEAD 61c9b5d)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-17
- **Reviewer**: herdr agent `reviewer` (Opus, medium). Kod sprawdzony bezpośrednio, bez sub-agentów.
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations
- **change.md**: nietknięty. Orkiestrator pozwala zapisać tylko ten plik, więc `status` zostaje `implemented`, a przejście na `impl_reviewed` należy do orkiestratora.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS (automaty zielone; ręczne wiersze otwarte, F2) |

## Co sprawdzono

**Open redirect.** Każde nowe miejsce, które czyta `next`, przechodzi przez `safeNextPath`:

- middleware (D1): `safeNextPath(url.searchParams.get("next")) ?? "/tonight"`;
- `api/auth/signup.ts`: `safeNextPath(form?.get("next"))`. Funkcja przyjmuje `unknown`, więc wartość typu `File` daje `null`;
- `api/onboarding.ts`: `safeNextPath(context.url.searchParams.get("next"))`;
- strony `signup.astro`, `confirm-email.astro` i `onboarding.astro`;
- `withNext` sam też woła `safeNextPath`.

Surowe `next` nigdy nie trafia do `Location`. `safeNextPath` odrzuca `//`, `/\`, znaki sterujące, zmianę originu oraz prefiksy `/auth*` i `/api*`. Dlatego cel D1 nigdy nie jest stroną auth i nie powstaje pętla. `next=/onboarding` też nie zapętla: kończy się na `/tonight`. Przy błędach `?error=` dalej niesie stałe klucze. Nic nie jest logowane i nie ma nowego kroku w logach.

**D1.** Gałąź stoi zaraz po `locals.user`, przed bramką chronionych ścieżek, i działa tylko dla `GET`. `isAuthEntryPath` toleruje jeden końcowy `/`, a `/auth/confirm-email` jest wyłączone. Nieaktualne cookie daje `user = null`, więc strona się renderuje.

**D2.** Łańcuch: link „Sign up” (`withNext`) → ukryte pole `next` w `SignUpForm` (tylko gdy jest) → `/onboarding?next=…` albo `/auth/confirm-email?next=…` → `action` wizarda `withNext("/api/onboarding", next)` → `next ?? "/tonight"`. Przekierowanie „ma już sprzęt” na stronie i w trasie też kończy na `next`. Błędy budują URL przez `URLSearchParams`, jak w `signin.ts`. Bez `next` każdy URL jest bajt w bajt taki jak dawniej, a `signInUrl` zwraca ten sam wynik.

**Service worker.** `src/sw.ts` jest nietknięty. Czyszczenie (purge) zależy od ścieżek `AUTH_POSTS` (`/api/auth/signin|signup|signout`, `sw.ts:64, 743`). `action` formularza sign-up się nie zmienił, bo `next` jedzie w ciele żądania, więc purge działa. Przekierowanie D1 zaczyna się od `GET /auth/*` i nie jest nawigacją Tonight, więc nie wywołuje purge.

**Testy (rubryka test-diet).**
- `scripts/smoke.mjs` ma +10 kroków z dokładnym `Location`. Każdy nazywa ryzyko, przed którym jedynie on chroni. Kroki D1 sprawdzają przekierowanie na Tonight, na `next` i odrzucenie adresu spoza originu. Kroki D2 sprawdzają każde ogniwo łańcucha i odrzucenie `//evil.example`.
- e2e: `auth-continue.spec.ts` to jeden test na poziomie funkcji. Importuje `test` z `./helpers`, więc zegar jest przypięty. Nie używa `waitForTimeout` i czeka na workera przez `waitForServiceWorker`.
- Helpery wydzielono bez zmiany zachowania: `signUp` dalej oczekuje gołego `/onboarding`, a `ONBOARDING_FORM` dokładnego `action`.
- Brak testów jednostkowych szczegółów implementacji, zgodnie z planem. Do `route-context.ts` doszło tylko `url`, który ma prawdziwy kontekst Astro.

**Dokumentacja.** Zdanie w CLAUDE.md w „Request flow” zgadza się z kodem. W `test-plan.md` liczba e2e wynosi teraz 30 specs / 57 testów.

**Automaty uruchomione tutaj:**
- `npm test`: 122 pliki, 812 testów zaliczonych, 1 pominięty.
- `eslint --max-warnings 0` na zmienionych plikach: czysto.
- Smoke i e2e nie były uruchamiane w tym przeglądzie, bo wymagają lokalnego stacku. Autor raportuje w PR 57/57 e2e, pełny smoke i break-checki per faza.
- CI (`ci`, `smoke`) w chwili przeglądu było `pending`.

## Findings

### F1 — Luka w smoke: zapis onboardingu bez `next` nie jest już przypięty po HTTP

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `scripts/smoke.mjs`, krok „onboarding saves and continues to the requested page”
- **Detail**: Dawny krok „onboarding saves and opens tonight” (POST bez `next` → `/tonight`) zamieniono na wariant z `next` (→ `/gear`). Zachowanie bez `next` po stronie trasy (`next ?? "/tonight"`) pilnuje teraz tylko e2e: `onboardInMadrid` oczekuje `/tonight$` w prawie każdym specu, więc ryzyko jest pokryte w przeglądarce. Po HTTP nie sprawdza go żaden krok. Gałąź trasy „ma już sprzęt” bez `next` nie jest sprawdzona nigdzie. Krok `onboarding redirects once set up` → `/tonight` pilnuje tylko strony, nie trasy. Obietnica planu, że bez `next` URL jest bajt w bajt dawny, ma więc po HTTP jedną dziurę.
- **Fix**: po kroku „onboarding redirects once set up” dodać jeden krok smoke: `POST /api/onboarding` z `form: onboarding`, bez `next` → `302 /tonight`, `exact: true`. Konto już ma sprzęt, więc to gałąź „already has gear”. Pokrywa ona `next ?? "/tonight"` trasy po HTTP bez drugiego konta.
- **Decision**: PENDING

### F2 — Wiersze ręczne 1.4–3.6 otwarte; purge workera ma dowód tylko ręczny

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` § Progress (1.4, 1.5, 2.4–2.7, 3.5, 3.6)
- **Detail**: Wszystkie wiersze automatyczne mają SHA i niczego nie zaznaczono bez dowodu. Wiersze ręczne zostały uczciwie otwarte dla właściciela. Spec e2e prowadzi POST sign-up przez trasę workera, ale nie sprawdza samego purge. Że purge nadal działa (3.5), potwierdzają tylko nietknięty `sw.ts` i niezmieniona ścieżka POST. To mocny argument, ale nie obserwacja. CI było jeszcze `pending`.
- **Fix**: przed merge'em poczekać na zielone `ci` i `smoke` i wykonać 3.5. Reszta wierszy ręcznych może iść po merge'u, zgodnie ze zwyczajem właściciela.
- **Decision**: PENDING
