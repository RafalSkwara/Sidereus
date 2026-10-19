<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Correct implausible OpenNGC V magnitudes of 12 galaxies

- **Plan**: context/changes/openngc-galaxy-magnitudes/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations
- **Reviewed at**: `39a3509` (fix/openngc-galaxy-magnitudes), diff `7676d34..39a3509` (przegląd planu zastosowany w `a9d27bd`; fazy `c6c6964`, `82fc710`, `3e85240`, `c2cd94b`)
- **Reviewer**: agent herdr `reviewer` (tylko do odczytu: ten plik to jedyny zapis; `change.md` nie jest stemplowany, zgodnie z regułami orkiestratora)

Zmiana jest czysta. Przyczyna została poprawiona w generatorze, a wszystkie sześć ustaleń z przeglądu planu zastosowano tak, jak je zapisano. Każdą tezę, na którą orkiestrator kazał uważać, sprawdziłem niezależnie: wyniki są w sekcji Evidence. Trzy obserwacje dotyczą tylko tekstu (komentarze, notatki w meta, log limitu), nie zachowania.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (pozycje ręczne: patrz „Manual verification”) |

## Evidence

Sprawdzone przeze mnie przy `39a3509` (Node 24.21.0; worktree czysty przed i po):

- **Regeneracja jest idempotentna.** `npm run catalogue:build` (pobiera przypięty `da90466` z GitHub, bez żadnych danych osobowych w żądaniu) wypisał mediany `early 0.88 (19), Sa-Sb 0.81 (18), Sbc-Sc 0.56 (16), late 0.47 (3)`, a `git status --short` po nim był pusty. Pliki odtworzyły się bajt w bajt.
- **Zmiana danych to tylko `vMag` 12 obiektów.** Porównałem w Pythonie klucz po kluczu `7676d34` z `HEAD`. W `messier.json` zmieniło się pole `vMag` dla M58, M61, M88, M91, M98 i M106, w `caldwell.json` dla IC342, NGC4449, NGC5005, NGC4565, NGC6822 i NGC4039. Liczba obiektów, kolejność kluczy i wszystkie inne pola są bez zmian. Wartości są równe tym, które policzyłem w przeglądzie planu (np. M106 9.29 → 8.56, NGC4565 10.86 → 9.24).
- **Meta.** W obu plikach dotychczasowe `overrides` zostały nietknięte, a 6 + 6 wpisów `vMagColour` dopisano na końcu. W Caldwellu zniknęły tylko dwie linie fallbacku galaktyk (IC0342, NGC4039) i zmieniło się zdanie „vMag: …”; linie fallbacku dla obiektów, które nie są galaktykami (NGC 7000, IC 405 itd.), zostały, zgodnie z „What We're NOT Doing”. Każdy wpis ma `fromVMag` (`null` dla fallbacku), grupę, medianę, `groupCount`, powód i `source` https. Notę o wątpliwym B mają NGC 4449 i NGC 4565, a notę o medianie z 3 galaktyk trzy galaktyki z grupy late.
- **Piny proweniencji naprawdę wiążą meta z danymi (F2 z przeglądu planu).** `vmag-colour-pins.ts` to czysta funkcja, której używają `messier.test.ts` i `caldwell.test.ts` (projekt `guards`). Dla każdego wpisu sprawdza `vMag` i `bMag` równe danym, `source` https, dokładny zbiór id (brakujący, nadmiarowy lub zdublowany wpis to błąd) oraz frazy o wątpliwym B i cienkiej medianie. `messier.test.ts` ma test łamania na pamięciowych kopiach meta, który sprawdza dokładne komunikaty dla pięciu podłożonych usterek (inne V, brak M106, nadmiarowe M1, `http://`, brak not). Wygenerowany JSON nie jest przy tym ruszany. `npx vitest run --project guards scripts/lib/galaxy-colour.test.mjs src/lib/catalogue/messier.test.ts src/lib/catalogue/caldwell.test.ts`: 10 zaliczonych.
- **Red-first.** `evidence/phase1-red.txt` pochodzi z `c6c6964`, czyli commitu, który nie zmienia żadnego JSON (`git show --stat`: tylko test, fixture, plan i evidence). Strażnik nazywa dokładnie 12 galaktyk z ich V i B, wyrocznia nazywa sześć galaktyk Messiera z odchyleniem od 0.55 do 0.89 mag. Celowe łamania (jedna z 12 poprawiona daje listę 11; M106 z powrotem na 9.29 daje „M106”) są w trzecim teście na pamięciowej kopii w ustalonym stanie, więc działają przed korektą i po niej, bez edycji danych (F6 z przeglądu planu).
- **Wyrocznie bez edycji asercji.** `git diff --stat 7676d34..39a3509` nie pokazuje żadnej zmiany w `calibration.test.ts`, `small-scope.test.ts` ani `ranking-invariants.test.ts`. W `expectation.test.ts` zmieniły się tylko dwa wiersze `HARD` (M106 przy 150 mm / Bortle 5 i 6) i limit `toBeLessThanOrEqual(3)` → `4`. `npm test` (oba projekty): 124 pliki, 824 zaliczone, 1 pominięty. `npm run lint`: czysto.
- **Limit 3 → 4 jest uczciwy i zapisany.** Wpis M106 przy Bortle 6 jest w `KNOWN_DIVERGENCES`: `expected: galaxySmudge`, `computed: galaxyFaint`, deficyt 1.61 przy progu 1.5, a przy opublikowanym V 8.4 byłoby 1.45. Ma te same dwa źródła z cytatami co jego bliźniak przy Bortle 5 (ten przechodzi w `EXPECT_REFERENCES`). Ma też powód, dla którego reguła się nie zmienia (strony mówią „suburban”, nie rozróżniają Bortle 5 od 6, a przesunięcie progu o 0.11 byłoby dopasowaniem do szumu), i powołanie na zgodę właściciela (Q5). Ta sama treść jest w „Divergence cap log” planu i w `CLAUDE.md`. Fixture ma 28 referencji i 4 rozbieżności; `CLAUDE.md` mówi „28 references” i „cap of 4”. Brak drugiej galaktyki z 12 (M61) jest zapisany z powodem i zgłoszony właścicielowi, a Desired End State dopuszcza to („or the report says … why none was added”).
- **`evidence/before-after.md`.** Tabela 12 galaktyk × 6 ustawień z pasmem, deficytem i kluczem frazy przed i po, plus M106 w rankingu z nazwanego wywołania (`rankObjects`, katalog tylko Messiera, Warszawa, 150 mm f/5, `EYEPIECES` z testu small-scope). Wynik jest podany uczciwie: w ustawieniu z issue (2026-10-10, 150 mm, Bortle 6) M106 zostaje na #58 z wynikiem 0.519 i kredytem 0.100, nic się nie zmienia. Przy Bortle 5 wynik rośnie (#60 → #42 w październiku, #44 → #10 w kwietniu). Widać też efekt uboczny: w kwietniu przy Bortle 6 M106 spada z #33 na #36, bo inne poprawione galaktyki go wyprzedzają. Zgadza się to z F4 przeglądu planu i z `CLAUDE.md`.
- **`LICENSE-DATA.md`.** Akapit mówi, że V 12 galaktyk to „derived value”, wymienia je imiennie, opisuje regułę i podaje, że objęta jest tą samą licencją CC BY-SA 4.0 i wypisana per obiekt w `overrides` (`vMagColour`). Wtrącenie „a missing V magnitude is taken from the B magnitude, except for galaxies” jest prawdziwe. Uwaga o NED w F2.
- **Gałąź a `main`.** `origin/main` przesunął się do `04848f9` (#226). `git merge-tree --write-tree origin/main HEAD` daje scalenie bez konfliktów (zmiany w `CLAUDE.md` po obu stronach są w różnych akapitach). PR jeszcze nie istnieje (`gh pr list --head …`: `[]`).

## Findings

### F1 — Bramki uruchamiano na `3e85240`, a gałąź jest za `main`; PR jeszcze nie istnieje

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/openngc-galaxy-magnitudes/evidence/gates.md; plan.md Faza 4
- **Detail**: `gates.md` zapisuje bramki przy `3e85240`. Późniejsze commity (`c2cd94b`, `39a3509`) zmieniają tylko dokumenty, więc ten zapis nadal obowiązuje. `main` dostał jednak w międzyczasie #226 (error-visibility, Faza 7). Scalenie jest czyste, ale e2e i smoke nie biegły na stanie po scaleniu. Faza 4 mówi też „open one PR”, a w Progress nie ma pozycji na PR.
- **Fix**: Scalić `main` do gałęzi (bez rebase; konfliktów nie ma), powtórzyć `npm test` i lint, a e2e i smoke zostawić CI. Potem otworzyć PR do `main` z treścią z Fazy 4, czyli 12 korektami, decyzjami Q1–Q5, F4 (M106 przy Bortle 6) i brakiem M61.
- **Decision**: APPLIED (2026-10-19, see the commit that carries this file)

### F2 — Wartości NED są wpisane ręcznie w generatorze, a nota dla NGC 4449 jest wewnętrznie niespójna

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/build-catalogue.mjs (`B_MAG_DOUBT`, `colourCaveats`); src/lib/catalogue/caldwell.meta.json (NGC4449); src/lib/catalogue/LICENSE-DATA.md
- **Detail**:
  - `B_MAG_DOUBT = { NGC4449: 9.99, NGC4565: 10.42 }` to wartości NED wpisane ręcznie. Trafiają do `reason` w meta, która jest dystrybuowana, bez URL-a NED w polu `source` (to wskazuje `NGC.csv`). Tymczasem `LICENSE-DATA.md` mówi „no other source is used”. Dla samej wartości V to prawda, bo NED niczego nie liczy, ale meta cytuje liczbę z NED. Podziękowanie dla NED już jest w `LICENSE-DATA.md:34` (wymóg OpenNGC), więc to sprawa jasności zapisu, nie licencji.
  - Druga część noty jest zapisana na sztywno: dla NGC 4449 powód brzmi „NED's … (9.99) is about 0.5 mag fainter, so this V may be about 0.4 mag too bright”. Różnica wynosi 0.49, więc V może być za jasne o około 0.5, nie 0.4. Dla NGC 4565 (0.37 → „about 0.4”) wszystko się zgadza.
- **Fix**: W `colourCaveats` liczyć „too bright” z tej samej różnicy co „fainter” i zregenerować. Do noty dopisać źródło („NED object page, read 2026-10-19”). W `LICENSE-DATA.md` zmienić na „no other source is used for the value; the doubt notes of NGC 4449 and NGC 4565 quote NED's magnitude”.
- **Decision**: APPLIED (2026-10-19, see the commit that carries this file)

### F3 — Drobne nieścisłości w komentarzach i w logu limitu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/engine/fixtures/galaxy-v-reference.ts (komentarz `PUBLISHED_V_TOLERANCE_MAG`); plan.md „Divergence cap log”
- **Detail**:
  - Komentarz tolerancji przypisuje liczby niewłaściwym galaktykom. Największa luka reguły, 0.17, dotyczy M88 (9.43 wobec 9.6), a nie M106 (ta ma 0.16). Najmniejszy dzisiejszy błąd, 0.55, dotyczy M61 (10.25 wobec 9.7), a nie M58 (ta ma 0.60). Sama tolerancja 0.3 jest dobrze uzasadniona.
  - „Divergence cap log” zaczyna się od „Empty until a new reference diverges”, a kończy szablonowym zdaniem „If Phase 3 raises the cap … the implementer appends here”, choć wpis już jest.
- **Fix**: Poprawić dwie nazwy w komentarzu, a w logu zostawić tylko wpis z 2026-10-19 i jedno zdanie zasady.
- **Decision**: APPLIED (2026-10-19, see the commit that carries this file)

## Manual verification

- **1.5** (sześć wartości i URL-i SEDS i SIMBAD sprawdzonych na stronach): nie zrobione przeze mnie, bo wymaga sieci. Zostaje u właściciela lub lidera.
- **2.8** (12 wpisów i mediany): na papierze potwierdzam. Mediany i V przeliczyłem niezależnie (zgodne co do 0.01), powody są poprawne poza niespójnością z F2.
- **2.9** (akapit `LICENSE-DATA.md`): przeczytany, poprawny, z uwagą z F2.
- **3.6** (źródła i noty referencji, evidence, log limitu): na papierze potwierdzam, że żadna rozbieżność nie jest ukryta. Jedyna nowa rozbieżność (M106/B6) jest w fixture, w teście, w logu i w `CLAUDE.md`. Samych stron Skyhound i Astronomy Now nie otwierałem.
- **3.7** (linia M106 w `/tonight/targets` lokalnie, Bortle 5 i 6): nie zrobione. Wynik da się przewidzieć z `before-after.md` (Bortle 5 `galaxySmudge`, Bortle 6 `galaxyFaint`).
- **4.6** (PR i scalenie): należy do właściciela, PR jeszcze nie istnieje (F1).
