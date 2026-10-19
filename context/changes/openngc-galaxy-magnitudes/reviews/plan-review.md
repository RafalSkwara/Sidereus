<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Correct implausible OpenNGC V magnitudes of 12 galaxies

- **Plan**: context/changes/openngc-galaxy-magnitudes/plan.md (z plan-brief.md i research.md)
- **Phases**: 4 (żadna nie została rozpoczęta: w Progress nie ma `[x]`)
- **Date**: 2026-10-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations
- **Reviewed at**: `7676d34` (fix/openngc-galaxy-magnitudes)
- **Reviewer**: agent herdr `reviewer` (tylko do odczytu: ten plik to jedyny zapis; `change.md` nie jest stemplowany, zgodnie z regułami orkiestratora)

Plan jest dobry u podstaw: przyczyna leży w generatorze, test jest red-first, a wartości z publikacji służą wyłącznie jako wyrocznia testowa. Wszystkie liczby, które sprawdziłem, zgadzają się z repo. Problem leży w kilku poleceniach i kryteriach weryfikacji oraz w braku ścieżki na wypadek czerwonej kalibracji. Wszystko da się poprawić w triage, bez ponownego planowania.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Claim Accuracy | PASS |
| Substance | WARNING (F4, F5) |
| Feasibility | PASS |
| Sequencing | WARNING (F3) |
| Architecture Fit | PASS |
| Scope Discipline | PASS |
| Verifiability | WARNING (F1, F6) |
| Coverage | WARNING (F2) |

## Evidence

Sprawdzone w worktree (`7676d34`, Node 24.21.0):

- **Lista 12.** Skrypt w Pythonie liczy z `messier.json` + `caldwell.json`: 68 galaktyk, każda ma `hubble` i `bMag`. Warunek B−V < 0.2 łapie dokładnie M58, M61, M88, M91, M98, M106, IC342, NGC4449, NGC5005, NGC4565, NGC6822 i NGC4039. Oba wiersze z fallbacku B (IC 342, NGC 4039) mają B−V = 0, więc łapie je ten sam warunek. `EXPECTED_COLOUR_CORRECTIONS = 12` jest spójne.
- **Mediany reguły C** w grupach planu (`colourGroupOf`), liczone z wiarygodnych galaktyk (B−V ≥ 0.2): early 0.88 (19 galaktyk), Sa–Sb 0.81 (18), Sbc–Sc 0.56 (16), late 0.47 (**3**). Razem 56, zgodnie z research.md. Poprawione V zgadzają się z research co do 0.01: M58 9.63, M61 9.60, M88 9.43, M91 10.13, M98 10.01, M106 8.56, IC342 9.12, NGC4449 9.03, NGC5005 9.73, NGC4565 9.24, NGC6822 8.89, NGC4039 10.57.
- **Test regresji naprawdę będzie czerwony.** Strażnik B−V ≥ 0.2 nazwie dziś dokładnie 12 id. Wyrocznia (tolerancja 0.3) jest dziś czerwona dla wszystkich sześciu galaktyk Messiera: |V_kat − V_pub| = 0.60, 0.55, 0.73, 0.76, 0.74 i 0.89. Po regule C wynosi najwyżej 0.17 (M88), więc będzie zielona. `DEEP_SKY` udostępnia `bMag` (`src/lib/catalogue/index.ts:55,152`), więc test w kształcie z planu da się napisać.
- **Generator.** `main()` buduje oba zbiory przed pierwszym zapisem (`scripts/build-catalogue.mjs:453-455`, zapisy w `:476-504`), więc medianę z 68 galaktyk można policzyć między budową a zapisem. Fallback B jest w `:388-395`, a lista `bMagFallbacks` w `normalisations` zawiera też obiekty, które nie są galaktykami (NGC 7000, IC 405 itd.). Plan słusznie je zostawia.
- **Piny proweniencji.** `messier.test.ts` sprawdza tylko commit i licencję. `caldwell.test.ts` wymaga ponadto, żeby **każdy** wpis `overrides` miał `source` zaczynające się od `https://`. Planowany `source` = URL przypiętego `NGC.csv` to spełnia. Patrz F2.
- **Wyrocznie dziś.** `npx vitest run --project reference src/lib/engine/calibration.test.ts src/lib/engine/small-scope.test.ts src/lib/engine/expectation.test.ts src/lib/engine/ranking-invariants.test.ts`: 36 zaliczonych, 1 pominięty. Polecenie 3.1 działa.
- **Polecenie 2.2 nie działa** (F1): `npx vitest run --project reference scripts/lib/<plik>.test.mjs` daje „No test files found”, kod wyjścia 1. Ten sam plik pod `--project guards` przechodzi (sprawdzone na `designations.test.mjs`).
- **Issue #178** (`gh issue view 178`): przykład z samego zgłoszenia to „M106 falls under the bar at Warsaw on 2026-10-10 with 150 mm / Bortle 6”. Patrz F4.
- **Nie sprawdzałem** (wymaga sieci): tego, że `be3cd6c` nie zmienia 12 wierszy, ani wartości SEDS i SIMBAD. Obie rzeczy są pozycjami ręcznymi 1.5 i 2.8.

## Findings

### F1 — Polecenie 2.2 uruchamia test pomocnika w złym projekcie Vitest

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md, Faza 2 › Automated Verification (2.2), oraz punkt 5 z 2.5
- **Detail**: `vitest.config.ts` umieszcza `scripts/lib/*.test.mjs` w `GUARD_FILES`, czyli wyłącza te pliki z projektu `reference` i włącza do `guards` (testy uruchamiane tylko w CI). `npx vitest run --project reference scripts/lib/galaxy-colour.test.mjs` kończy się więc „No test files found” i kodem 1, niezależnie od kodu. Z tego samego powodu hook końca tury nigdy nie uruchomi testu pomocnika, więc łamanie znaku z 2.5 zaczerwieni test pomocnika tylko przy ręcznym uruchomieniu `guards`. Sformułowanie „unit-tested like `scripts/lib/*`” jest prawdziwe, ale oznacza „tylko w CI”.
- **Fix**: W 2.2 użyć `npx vitest run --project guards scripts/lib/galaxy-colour.test.mjs` (albo `npm run test:guards`) i dopisać w 2.5, że czerwień testu pomocnika sprawdza się tym poleceniem, a nie przez hook.
- **Decision**: APPLIED (2026-10-19, see the review table in plan.md)

### F2 — Piny proweniencji tylko się „przechodzi”, nikt ich nie rozszerza

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md, Faza 2 §2 i 2.6; `src/lib/catalogue/messier.test.ts:7-10`, `caldwell.test.ts:8-16`
- **Detail**: Kryterium 2.6 to „`npm run test:guards` przechodzi”. Dla nowych danych to sprawdzenie jest puste. `messier.test.ts` nie patrzy na `overrides` w ogóle, więc sześć wpisów `vMagColour` po stronie Messiera nie ma żadnego pinu. `caldwell.test.ts` sprawdzi tylko, że `source` zaczyna się od https. Nic nie wiąże wpisu w meta z danymi: można wygenerować 12 wpisów `vMagColour`, a w JSON zostawić stare V (albo odwrotnie), i guards dalej będą zielone. Kontrola liczności 12 działa tylko w czasie budowania. Strażnik z Fazy 1 sprawdza same dane, a wyrocznia tylko 6 galaktyk Messiera. Przy decyzji, że reguła jest „modelem, nie pomiarem”, to meta jest zapisem odstępstwa od źródła, więc powinna być przypięta tak samo jak commit.
- **Fix**: Dodać do Fazy 2 rozszerzenie obu pinów (to plik w `guards`, zmiana razem z danymi, zgodnie z D7). Każdy wpis `action: "vMagColour"` ma `source` https, a jego `vMag` równa się `vMag` obiektu w JSON. Zbiór id z `vMagColour` to dokładnie 6 galaktyk Messiera i 6 Caldwella z listy. Wpisy NGC 4449 i NGC 4565 niosą notę o wątpliwym B. Do tego jeden wiersz w 2.5: zerwanie spójności meta i danych daje czerwień w `test:guards`. Plik `galaxy-colour.test.ts` zostaje w `reference`.
- **Decision**: APPLIED (2026-10-19, see the review table in plan.md)

### F3 — Wyrocznia kalibracji rusza dopiero w Fazie 3, a na czerwień nie ma ścieżki

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Sequencing
- **Location**: plan.md, Faza 2 (Implementation Note: pauza na recenzenta), Faza 3 › 3.1; Desired End State
- **Detail**: `calibration.test.ts` liczy dokładnie przy ustawieniach, które reguła C przesuwa: Warszawa, Bortle 5, 150/750, cztery noce (`:13,27,43`). Przy Bortle 5 i 150 mm M88, M91 i M98 przechodzą ze `smudge` do `bright`, a M106 z `faint` do `smudge` (research §5). Według research M106 w kwietniu (przy Bortle 6) skacze z #39 na #12, a top 5 „nie był uruchomiony na żadnym wariancie”. Asercje, które mogą to odczuć: co najmniej 3 obiekty Messiera w top 5, co najmniej 3 wspólne z `BEGINNER_REFERENCE`, NGC869 w październikowym top 10, M13 w top 5 w krótkie noce i październikowe wybory w górnej połowie listy (`:98-160`). Plan zakłada tylko „stays green without being edited” i w ogóle nie mówi, co zrobić przy czerwieni. Edycja asercji jest zakazana, zmiana reguły też, więc implementator utknie w Fazie 3. Do tego recenzent potwierdza korekty (pauza po Fazie 2), zanim ktokolwiek zobaczy ich wpływ na ranking.
- **Fix**: Przenieść 3.1 (cztery wyrocznie) do kryteriów automatycznych Fazy 2, zaraz po regeneracji i przed pauzą na recenzenta. Dopisać regułę stopu: jeśli którakolwiek wyrocznia jest czerwona, implementator zatrzymuje się, zapisuje noc, top 5 i wynik do `evidence/` i pyta właściciela. Bez edycji asercji, bez zmiany reguły i bez `CALIBRATION_SNAPSHOT` jako wyroczni.
  - Strength: Ryzyko wyjdzie w Fazie 2, a nie w połowie Fazy 3. Recenzent zatwierdza korekty, widząc ich skutek. Plan dostaje ścieżkę na czerwień zgodną z lessons („a failing reference is an engine finding”).
  - Tradeoff: Faza 2 wydłuża się o jedno uruchomienie, ok. 1 s (zmierzone).
  - Confidence: MED — że kalibracja się zaczerwieni, tylko podejrzewam (nie mogłem jej uruchomić na poprawionym katalogu bez edycji JSON w worktree). Pewne jest, że ruch zachodzi dokładnie przy jej ustawieniach.
  - Blind spot: Nie wiem, czy któraś z 12 galaktyk faktycznie wchodzi do top 5 przy Bortle 5.
- **Decision**: APPLIED (2026-10-19, see the review table in plan.md)

### F4 — M106 w przykładzie z issue (150 mm / Bortle 6) zostaje `faint`: plan to wie, ale tego nie wyciąga

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Substance
- **Location**: plan.md, Current State (6. punkt), Desired End State, Faza 3 §2 i 3.7; plan-brief.md, Desired End State
- **Detail**: Plan jest uczciwy co do faktu: Current State mówi, że przy 150 mm i Bortle 6 M106 zostaje `faint` (1.61 przy progu 1.5), a brief wpisuje to do ryzyk. Sprawdziłem arytmetykę: deficyt zmienia się jeden do jednego z V, 2.34 − (9.29 − 8.56) = 1.61. Brakuje jednak konsekwencji:
  - (a) W pasmie `faint` limit `GALAXY_FAINT_BRIGHTNESS_CAP` = 0.1 nadal obcina kredyt jasności (`score.ts:204-210`). Przy ustawieniu z issue (Warszawa, 2026-10-10, 150 mm, Bortle 6) wynik i miejsce M106 praktycznie się nie zmienią, chyba że V przestawi ścieżkę „washed-out” (`score.ts:146`). Przykład z samego zgłoszenia nie zostaje więc naprawiony, a plan tego nie mówi.
  - (b) W Fazie 3 powstaje referencja M106 przy 150 mm / Bortle 6, a oczekiwany klucz wynika ze źródeł. Opublikowane V 8.4 dałoby `smudge` (deficyt 1.45), więc rozbieżność jest przewidywalna z góry, a limit pójdzie z 3 na 4. „Divergence cap log” traktuje to jak niespodziankę.
  - (c) Desired End State w briefie („M106 reads smudge … at Bortle 5”) i ręczne sprawdzenie 3.7 (Bortle 5, kwiecień) pokazują tylko przypadek, który się udaje.
- **Fix**: W Desired End State dopisać zdanie: „przy 150 mm / Bortle 6 M106 zostaje `faint` z kredytem 0.1, więc przykład z #178 w tym ustawieniu się nie zmienia (reguła C, decyzja Q1)”. W Fazie 3 zapowiedzieć referencję M106/B6 jako spodziewaną rozbieżność. 3.7 rozszerzyć o odczyt przy Bortle 6 i 2026-10-10. W opisie PR i przy zamykaniu #178 napisać to wprost.
- **Decision**: APPLIED (2026-10-19, see the review table in plan.md)

### F5 — Kontrakt `colourGroupOf` jest wewnętrznie sprzeczny, a grupa late stoi dokładnie na minimum 3

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Substance
- **Location**: plan.md, Faza 2 §1 (Contract) i Critical Implementation Details (3. punkt)
- **Detail**: „late everything else that is a galaxy type” oraz „unknown or empty Hubble throws” wzajemnie się wykluczają: skoro „late” obejmuje wszystko inne, nieznany typ nigdy nie rzuci, a obiecana kontrola „unknown Hubble string fails the build” jest pusta. W katalogu występują typy late: `I`, `IB`, `SBd`, `SBm`. Grupa late ma dokładnie 3 wiarygodne galaktyki (B−V 0.29, 0.47, 0.65), czyli tyle, ile wynosi minimum, a ta mediana (0.47 przy rozrzucie 0.36) wyznacza V dla 3 z 12 galaktyk (NGC 4449, NGC 6822, NGC 4039). Utrata jednej galaktyki late, np. przy przyszłym podbiciu pinu, zatrzyma build.
- **Fix**: Wypisać grupę late jawnie (`I IB SBd SBm`, ewentualnie `Sd Sm Im`), a każdy inny ciąg niech rzuca. W `reason` wpisów late zapisać, że mediana pochodzi z 3 galaktyk.
- **Decision**: APPLIED (2026-10-19, see the review table in plan.md)

### F6 — Sprawdzenia przez celowe łamanie „w kopii katalogu” wymagają edycji generowanego JSON

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md, 1.2 i 3.4; Faza 3 › Automated Verification (2. punkt) a Progress 3.2
- **Detail**: Strażnik czyta prawdziwy JSON przez `DEEP_SKY`, więc „scratch copy of the catalogue” w praktyce oznacza ręczną edycję `messier.json` w worktree, czego zakazuje tripwire, nawet jeśli edycja jest chwilowa. Druga sprawa: kryterium w bloku Fazy 3 mówi „the added lines are ids and settings”, a Progress 3.2 dopuszcza też podniesienie limitu. Przy przewidywalnej rozbieżności z F4 bullet w bloku fazy będzie fałszywie czerwony.
- **Fix**: Zbudować strażnika jako czystą funkcję (`implausibleGalaxies(objects)`) uruchamianą na `DEEP_SKY` i na spreparowanej liście w tym samym teście, a łamania z 1.2 i 3.4 robić przez `vi.mock("@/lib/catalogue")` albo przez tę listę. Bullet Fazy 3 wyrównać do Progress 3.2.
- **Decision**: APPLIED (2026-10-19, see the review table in plan.md)
