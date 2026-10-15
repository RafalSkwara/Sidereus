<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: galaktyki w małym teleskopie (M-4 S-04)

- **Plan**: `context/changes/small-scope-galaxies/plan.md` (commit 87957f1, gałąź `feat/small-scope-galaxies`, main 42ce808)
- **Data**: 2026-10-15
- **Recenzent**: agent herdr „reviewer” (Opus) z trzema subagentami Opus: weryfikacja twierdzeń, symulacja numeryczna planowanej reguły, weryfikacja źródeł
- **Fazy**: 4 | **Ustalenia**: 0 krytycznych, 6 ostrzeżeń, 4 obserwacje
- **Werdykt**: NEEDS ATTENTION
- **Decyzje właściciela (już udzielone, wszystkie ★)**:
  - OD-1 (a): o M101 decyduje linia;
  - OD-2 (a): M31 przy 60 mm / Bortle 5 to `galaxySmudge`, `EXPECT_BULGE_CORE_EXTRA_MAG` = 0,8;
  - OD-3 (a): każda spirala z wybrzuszeniem (28 galaktyk);
  - OD-4 (a): galaktyka `galaxyLimit` zostaje na liście bez punktów za jasność.
- **change.md**: nietknięty. Orkiestrator pozwolił zapisać tylko ten plik. Zmianę `status: planned → plan_reviewed` zostawiam orkiestratorowi.

## Metoda i dowody

- **Symulacja.** Planowaną regułę przeliczyłem w kopii repozytorium poza worktree: e = 0,8 dla 28 obiektów oraz limit jasności 0,25 dla pasma `faint` i 0 dla `limit`. Główna kopia to `scratchpad/sim`; druga, niezależna, to `scratchpad/claims/sim`. Obie dają te same liczby.
- **Worktree.** Nie został zmieniony (`git status` czysty).
- **Stan bazowy** na 87957f1 jest zielony albo kończy się kodem 0:
  - `npx vitest run src/lib/catalogue`: 44 testy zaliczone;
  - `npx vitest run src/lib/engine/expectation.test.ts src/lib/engine/contrast.test.ts`: 15 zaliczonych (`contrast.test.ts` jeszcze nie istnieje i vitest go pomija, zgodnie z oczekiwaniem);
  - `npx vitest run src/lib/engine/calibration.test.ts src/lib/engine/ranking-invariants.test.ts`: 31 zaliczonych, 1 pominięty;
  - `npm test`: 2289 zaliczonych, 1 pominięty, 6 todo;
  - `npx astro check`: 0 błędów;
  - `npm run lint`: 0 ostrzeżeń.
- **Celowo nieuruchomione:**
  - `npm run catalogue:build`, bo zapisuje pliki JSON (skrypt istnieje);
  - testy e2e i `npm run smoke`, bo potrzebują serwerów.
- **Komendy z planu.** Każda komenda z planu istnieje w `package.json`. Punkty 2.3 i 3.2 to zapisy wyników, nie komendy.

## Co sprawdziłem i co się trzyma (punkty od orkiestratora)

### Czystość i determinizm silnika: OK

- `purity.test.ts` skanuje każdy plik `.ts` w `src/lib/engine/`, więc nowy `contrast.ts` jest objęty automatycznie.
- Człon wybrzuszenia jest stałą dla obiektu w obrębie deficytu kontrastu.
- Przeszukałem cały katalog: Bortle 1-9, apertury 20-1000 mm co 5 mm, limity 0,25 / 0,1 / 0. Nie ma ani jednego przypadku, w którym punkty za jasność spadają przy większej aperturze albo rosną przy gorszym niebie.
- W symulacji D-3 i `ranking-invariants.test.ts` (łącznie z (g)) są zielone.

### Generator katalogu: OK

- CSV z przypiętego commitu `da90466…` ma kolumnę dokładnie `Hubble`, a generator czyta kolumny po nazwie.
- Wszystkie 68 galaktyk ma w OpenNGC typ `G` i każda ma niepuste `Hubble`:
  - M31 `Sb`, M33 `Sc`, M101 `SABc`, M81 `Sab`, M51 `SABb`;
  - M102 = NGC5866, `S0-a`.
- `BULGE_HUBBLE_TYPES` wybiera dokładnie 28 obiektów z research §5. Typy SBa, SABab, SBab i SBb dziś nie pasują do niczego, co nie szkodzi.
- Żaden obiekt poza galaktykami nie ma `Hubble`. Podwójna Gromada potrzebuje jawnego `null` (plan to przewiduje).
- Pliki meta nie zawierają hashy ani listy kolumn, więc się nie zmienią.
- Testy katalogu nie sprawdzają dokładnego zbioru kluczy, więc po fazie 1 repozytorium zostaje zielone.
- „Bajt w bajt przy drugim uruchomieniu” da się sprawdzić tylko jako `git diff --exit-code` po drugim przebiegu (F3).

### Wspólny `contrast.ts`: OK, bez cyklu importów

- `moonlight.ts` importuje tylko `type DeepSkyObject` i `./parameters`.
- `parameters.ts` importuje tylko typy.
- Silnik importuje `DeepSkyObject` przez `import type` z `@/lib/catalogue`.
- Barrel eksportuje nazwami (`export *` tylko dla `./parameters`), więc `contrastBand` trzeba wyeksportować dokładnie raz (F4).

### Fixture referencji i limit 3 rozbieżności: merytorycznie OK, liczebności błędne (F3)

- Przy e = 0,8 wszystkie nowe referencje przechodzą i żadna istniejąca nie zmienia klucza. M31, M51 i M81 przy 150 mm / B4 zostają bez zmian.
- M33 przy 80 mm / B6 wylicza `galaxyFaint` (deficyt 2,467), więc to poprawna rozbieżność.
- NGC7000 i NGC4889 nadal się rozchodzą.
- Limit 3 rozbieżności jest wyczerpany: na kolejne slice'y nie zostaje zapas.

### Wyrocznia kalibracyjna (3 z 5 każdej nocy, bez zapasu): OK

- Z regułą `calibration.test.ts` przechodzi bez zmian.
- Top 5 jest identyczne na wszystkich czterech nocach, a część wspólna to nadal dokładnie 3:
  - styczeń: NGC869, M35, M37;
  - kwiecień: M3, M13, M81;
  - lipiec: M39, M13, NGC7000;
  - październik: M31, NGC869, M39.
- Top 10 zmienia się tylko w kwietniu: wypada M101 (#6), wchodzi M63 na #10.
- Liczba zakwalifikowanych obiektów Caldwella spada o 1 na trzech nocach; warunek „≥ 1” nadal jest spełniony.
- Pozostałe reguły kalibracji trzymają.

### Linia powodu nie mówi „jasna” przy linii faint/limit: trzyma w top 5, ale strażnik jest za wąski (F2)

### Źródła: cytaty sprawdzone 2026-10-15 na żywych stronach

17 z 19 cytatów jest dosłownych. Słabe punkty opisuje F5.

### Delegowanie

- Fazy 1-3 to Sonnet na wysokim wysiłku przy kodzie nie-UI, zgodnie z regułą właściciela.
- Faza 4 oddaje uruchomienie e2e i smoke subagentowi od dokumentacji (F9).

## Werdykty

| Wymiar | Werdykt | Ustalenia |
|---|---|---|
| Claim Accuracy | WARNING ⚠️ | F3, F4, F7 |
| Substance | PASS ✅ | |
| Feasibility | WARNING ⚠️ | F1 |
| Sequencing | PASS ✅ | |
| Architecture Fit | PASS ✅ | |
| Scope Discipline | PASS ✅ | |
| Verifiability | WARNING ⚠️ | F2, F3 |
| Coverage | WARNING ⚠️ | F2, F6, F8 |

**Ogółem: NEEDS ATTENTION.** Założenie planu jest poprawne i symulacja je potwierdza. Luki da się poprawić w triage, bez ponownego planowania.

## Ustalenia

### F1 — G1 jest czerwony przy planowanym limicie 0,25, a procedura „najmniejszej zmiany” daje liczbę zieloną o włos

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — realny kompromis; warto się zatrzymać i przemyśleć
- **Dimension**: Feasibility
- **Location**: plan.md „Phase 3 › Brightness cap for galaxies” (`GALAXY_FAINT_BRIGHTNESS_CAP` start 0,25; „settles each at the smallest change that turns the guard green”)

**Szczegóły**

- **G1 nie przechodzi przy 0,25.** Warszawa, 2026-04-15, Bortle 5, 60 mm: M101 jest nadal na #7 (total 0,792, jasność 0,25, `galaxyFaint`). Jego rampa zapasu jasności przy 60 mm wynosi tylko 0,30, więc limit zabiera z totalu zaledwie 0,0125. Obie kopie symulacji to potwierdzają.
- **Pozycja M101 w zależności od limitu:**

  | Limit dla `faint` | B5 / 60 mm | B5 / 80 mm | B6 / 60 mm | B6 / 80 mm |
  |---|---|---|---|---|
  | 0,25 | #7 | #13 | #18 | #29 |
  | 0,15 | #13 | #17 | #18 | #28 |
  | 0 | #22 | #28 | #16 | #23 |

- **Procedura planu daje kruchą liczbę.** „Najmniejsza zmiana, która zazieleni strażnika” to dosłownie 0,21. Przy niej G1 przechodzi z marginesem 0,0009 w rank score. Taka liczba jest dostrojona do własnego strażnika, przed czym ostrzega lekcja „Judge advice that no observer can check against source-cited references”.
- **Limit ma też dolną granicę.** Test `score.test.ts:217-228` („only counts an object a moonless night would list”) używa `coreGalaxy(24)` przy 200 mm / Bortle 2. Deficyt wynosi tam 2,09, czyli pasmo `faint`, więc limit działa. Poniżej około 0,06 `washedOut` przestaje być `true` i test robi się czerwony. Plan w uwadze o istniejących testach wymienia tylko test totali.
- **Okno robocze to mniej więcej 0,06-0,2.** Przy 0,1 przechodzą G1-G5 (M101 na #17 przy B5 / 60 mm, margines 0,028), kalibracja, `score.test.ts`, `ranking.test.ts` i niezmienniki.

**Poprawka**

- W planie ustalić od razu `GALAXY_FAINT_BRIGHTNESS_CAP` = 0,1.
- Zamiast „najmniejszej zmiany” wpisać: „0,1; zapisać marginesy (G1: 0,028; dolna granica z `score.test.ts:217-228` ≈ 0,06)”.
- Wymienić ten test w Phase 3 § 3 jako dotknięty przez limit.

**Ocena poprawki**

- **Zaleta**: dwie niezależne symulacje się zgadzają, a 0,1 leży w środku okna, daleko od obu krawędzi.
- **Koszt**: galaktyki w paśmie `faint` (np. M31 w mieście) spadają niżej niż przy 0,25 (F6).
- **Pewność**: HIGH. Liczby pochodzą z prawdziwego katalogu i prawdziwego kodu rankingu z dołożoną tylko regułą.
- **Ślepa plamka**: dokładną dolną granicę (≈ 0,06) policzył jeden agent; implementer powinien ją potwierdzić testem.

**Decision**: ACCEPTED (właściciel, 2026-10-15): `GALAXY_FAINT_BRIGHTNESS_CAP` = 0,1; marginesy i test `score.test.ts:217-228` wpisane do planu.

### F2 — Strażnik zgodności powodu z linią obejmuje tylko top 5, a każdy wpis listy pokazuje dwa powody

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Coverage / Verifiability
- **Location**: plan.md „Phase 3 › Small-aperture ranking guard › G5”; `src/lib/tonight/format.ts:327-332`; `src/lib/engine/ranking.ts:150-195`

**Szczegóły**

- `reasonLine` zawsze renderuje lead i follow.
- `reasonComponents` daje każdemu wpisowi na liście `leadComponent` i `secondComponent` (drugi składnik istnieje zawsze).
- `/tonight/targets` pokazuje całą listę.
- Stan docelowy z briefu („no listed galaxy says 'bright for your N mm' with a faint … line”) jest więc szerszy niż G5.
- Ta sama siatka, sprawdzona na **wszystkich** wpisach listy:

  | Reguła | Naruszenia |
  |---|---|
  | Dziś | 92, z czego 40 jako lead |
  | Limit 0,25 | 1: Warszawa 2026-10-15, 150 mm / B8, M51 #96, `galaxyFaint`, „moon / brightness” |
  | Limit 0,1 | 0 z 2199 |
  | Limit 0 | 0 |

- Siatka G5 zawiera przypadek bez okna ciemności: Warszawa 2026-07-15 przy Bortle 3 (−18° nie jest osiągane). Ranking rzuca tam wyjątek, więc G5 musi ten przypadek jawnie pominąć.

**Poprawka**

- G5 sprawdza każdą galaktykę na liście, nie tylko top 5.
- Noce bez okna ciemności pomija jawnie, z komentarzem.
- Przy limicie 0,1 (F1) G5 jest zielony.

**Decision**: ACCEPTED: G5 obejmuje każdą galaktykę na liście i oba powody; noc bez okna ciemności pomijana jawnie.

### F3 — Błędne liczebności i błędne twierdzenia „czerwone przed” w kryteriach sukcesu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Verifiability / Claim Accuracy
- **Location**: plan.md „Current State Analysis” (References), „Phase 2 › Reference test counts”, 2.1, 2.2, 3.1, „Testing Strategy”, „Phase 1” 1.1

**Szczegóły**

1. **Liczebności.** Dziś `ALL` liczy 22 wpisy: 20 referencji i 2 rozbieżności. `expectation.test.ts:195` porównuje `ALL` z `SHOWCASE.length + HARD.length`.
   - Po zmianie będzie **27 referencji + 3 rozbieżności = 30 wpisów**, a nie „29 references, plus 3 divergences”.
   - Rozbieżność M33 ma `kind: "hard"`, więc do `HARD` trzeba dodać **8** krotek, nie 7.
2. **Punkt 2.1.** M31 przy 60 mm / B5 przechodzi już dziś (deficyt 1,362 mieści się w `smudge`).
   - Przed członem wybrzuszenia zawodzą tylko M31 60/B6 (wylicza `galaxyFaint`) i 60/B8 (wylicza `galaxyLimit`); pozostałe **pięć** przechodzi.
   - Zdanie z Current State Analysis „today's rule already matches every one of these except M31 (all three)” jest błędne w ten sam sposób.
   - Test referencji sprawdza wszystkie wpisy w jednym `it` zwykłym `expect`, więc zatrzymuje się na pierwszym błędzie. Faza czerwona pokaże jeden wpis, nie całą listę.
3. **Punkt 3.1.** G2 przechodzi już na kodzie fazy 2: M31 jest #2 w lipcu i #1 w październiku, w obu przypadkach `galaxySmudge`.
   - Z czerwonego na zielony przechodzą tylko G1, G3 i G5.
   - G2 i G4 to przypinki chroniące przed regresją.
4. **Klauzula G1** „no galaxy in the top 5 has key `galaxyFaint` or `galaxyLimit`” przechodzi już dziś we wszystkich czterech przebiegach, więc niczego nie sprawdza.
5. **Punkt 1.1** („bajt w bajt przy drugim uruchomieniu”) warto zapisać jako komendę.

**Poprawka**

- Liczebności: 27 + 3 = 30, plus 8 nowych krotek `HARD`.
- 2.1: „M31 60/B6 i 60/B8 zawodzą, pozostałe pięć przechodzi (sprawdzone przez `expect.soft` lub `it.each` w przebiegu roboczym)”.
- 3.1: „G1, G3 i G5 zawodzą na kodzie fazy 2; G2 i G4 to przypinki”.
- Klauzulę top 5 z G1 usunąć albo zastąpić taką, która dziś zawodzi.
- 1.1: „`npm run catalogue:build && git diff --exit-code src/lib/catalogue/*.json` po commicie”.

**Decision**: ACCEPTED: 27 referencji + 3 rozbieżności = 30, 8 krotek HARD; 2.1 i 3.1 poprawione; klauzula top 5 usunięta z G1; 1.1 jako `git diff --exit-code`.

### F4 — Niepełna albo niejednoznaczna powierzchnia typów i API

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Claim Accuracy
- **Location**: plan.md „Phase 1 › Type and tests”, „Phase 2 › Shared contrast module”, „Phase 3 › Contract”, „Critical Implementation Details”

**Szczegóły**

- **`RankableObject`** (`ranking.ts:34-45`) to `Pick` bez `hubble`, a to on trafia z `rankObjects` do `scoreObject` (`ranking.ts:232`). Plan go nie wymienia.
- **Ręcznie budowane obiekty testowe**, które muszą dostać nowe pole:
  - `ranking.test.ts:26`: `synthetic()`;
  - `score.test.ts:41`: `CLUSTER`;
  - `score.test.ts:174`: `coreGalaxy` (galaktyka, a nie tylko `CLUSTER`, jak pisze plan);
  - `expectation.test.ts:26-28`: `object()`.
- **`validateMeasurements`** (`src/lib/catalogue/index.ts:94-116`) przepisuje obiekt pole po polu, więc trzeba tam dodać `hubble`. `tsc` wyłapie brak, ale plan wymienia tylko typ. Poza testami nikt nie buduje tych obiektów ręcznie.
- **`telescopeLimitingMag`** jest opisane niespójnie. „Critical Implementation Details” mówi „stays in `score.ts`”, a kontrakt fazy 2 dopuszcza przeniesienie do `contrast.ts`. Próg „blisko limitu” w `contrastBand` tej funkcji potrzebuje.
- **`source()`** (`expect-reference.ts:59`) przyjmuje (title, publisher, url) i ma na sztywno `ACCESSED = "2026-10-14"`. Plan zostawia „or a second helper” otwarte.
- **Barrel.** Jeśli `contrastBand` trafi do barrela zarówno z `./contrast`, jak i z `./expectation`, będzie błąd zduplikowanego identyfikatora.

**Poprawka**

- W kontraktach faz 1 i 3 wymienić `RankableObject`, `validateMeasurements` i cztery helpery testowe.
- Rozstrzygnąć: `telescopeLimitingMag` przenosi się do `contrast.ts`, a `score.ts` ją reeksportuje (jedna definicja).
- `source()` dostaje opcjonalny argument `accessed` (domyślnie `ACCESSED`).
- Barrel eksportuje `contrastBand` raz, z `./contrast`.

**Decision**: ACCEPTED: `RankableObject`, `validateMeasurements`, cztery helpery testowe; `telescopeLimitingMag` w `contrast.ts` z reeksportem w `score.ts`; `source()` z opcjonalnym `accessed`; `contrastBand` w barrelu raz.

### F5 — Źródła: wpis M31 60 mm / Bortle 8 nie ma źródła dla małej apertury, a jeden cytat jest parafrazą

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — realny kompromis; warto się zatrzymać i przemyśleć
- **Dimension**: Substance (jakość fixture)
- **Location**: plan.md „Phase 2 › Reference fixture” (wiersz M31 60/8 i rozbieżność M33); research §4 „Gaps”

**Szczegóły**

- **Sprawdzenie cytatów (2026-10-15).** Wszystkie 13 stron było dostępnych. 17 z 19 cytatów jest dosłownych. Dwa nie są:
  - Astronomy Now o M33: „hard under 'an urban or even a suburban sky'” to parafraza. Strona mówi: „Under an urban or even a suburban sky on an inferior night, M33 can appear lacking in contrast”, czyli łagodniej.
  - Telescope Advisor o M101 przy 100 mm (tylko w research): na stronie jest „Large diffuse oval glow with a brighter centre. Very low contrast. Averted vision essential.”
- **M31 60 mm / B8 → `galaxyFaint`: SŁABE.** Żadne źródło nie mówi o aperturze ≤ 70 mm przy Bortle 7-8:
  - tabela Telescope Advisor „Andromeda from a city”, wiersz Bortle 8 („Compact oval core, limited halo”), dotyczy „binoculars or a low-power 4 to 8 inch scope”;
  - Skyhound nie podaje ani apertury, ani klasy Bortle;
  - tabela light-pollution nie podaje apertury wcale.

  To ten wpis wyznacza dolną krawędź okna dla e (0,762). Strona Find Andromeda ma lepsze trzecie źródło, którego plan nie używa: „From heavily light-polluted city centres (Bortle 7+), it becomes very difficult”.
- **Jeden wydawca niesie kilka wpisów.** Cztery strony Telescope Advisor powstały w maju-lipcu 2026, trzy zaktualizowano tego samego dnia (2026-08-30), większość podpisana „Editorial Team”. Zachowują się jak jedno źródło, a niosą oba wpisy M31 przy 60 mm oraz M101 80/B6. Każdy z tych wpisów ma jednak jedno źródło od innego wydawcy (Astronomy, Skyhound, FreeStarCharts), więc reguła „≥ 2 źródła” (różne URL-e) jest formalnie spełniona.
- **Kontrdowody, które warto zapisać w notatkach wpisów:**
  - M101 80/B3: linia Telescope Advisor dla 100 mm mówi „Averted vision essential”, co odpowiada pasmu `faint`;
  - M81 80/B5: własne źródło fixture TELESCOPE_ADVISOR_M81 mówi „at least 80mm … under dark skies”.
- **Rozjazd planu z research.** Research §4 „Gaps” wymaga ponownego przeczytania stron przy pisaniu fixture, a plan zakazuje sięgania do sieci. Ten przegląd zamyka tę lukę: cytaty sprawdzono 2026-10-15.

**Poprawka**

- W planie zapisać, że cytaty zweryfikowano przy przeglądzie planu 2026-10-15: `accessed: 2026-10-15`, bez sięgania do sieci w implementacji.
- Cytat Astronomy Now w rozbieżności M33 poprawić na brzmienie ze strony.
- Do wpisu M31 60/B8 dodać cytat „Bortle 7+ … very difficult”, a w notatce zapisać, że 60 mm to ekstrapolacja z wiersza 4-8 cali. Wpis zostawić: to trudny przypadek wyznaczający dolną krawędź e.
- Kontrdowody dopisać do notatek M101 80/B3 i M81 80/B5.

**Ocena poprawki**

- **Zaleta**: fixture uczciwie mówi, na czym stoi, a weryfikację wymaganą przez research przegląd już wykonał.
- **Koszt**: wpis M31 B8 pozostaje ekstrapolacją. Bez niego okno rozszerza się do (0,662; 0,862], a 0,8 nadal w nim leży.
- **Pewność**: MED. WebFetch cytuje po 125 znaków, więc długie zdania potwierdzano kawałkami.
- **Ślepa plamka**: strony Telescope Advisor są świeże, a ich proces redakcyjny jest nieznany.

**Decision**: ACCEPTED: dosłowny cytat Astronomy Now dla M33; M31 60/B8 z cytatem „Bortle 7+ … very difficult” i notatką o ekstrapolacji apertury; kontrdowody w notatkach M101 80/B3 i M81 80/B5.

### F6 — W mieście M31 spada daleko w liście dla 60-80 mm, a plan nie nazywa tego skutku

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — duża stawka, szeroki zasięg albo niejasna najlepsza droga (decyzja produktowa)
- **Dimension**: Coverage
- **Location**: plan.md „Desired End State”, „Owner Decisions” (OD-2, OD-4)

**Szczegóły**

- Przy e = 0,8 M31 dla 60-80 mm pod Bortle 7-8 jest w paśmie `faint`, więc działa limit. W symulacji spada:
  - w październiku z #3 na #10-13;
  - w lipcu z #5/#8 na #24-30.
- Przy Bortle 9 M31 jest w paśmie `limit` i nie dostaje punktów za jasność.
- Preset „city” w onboardingu to Bortle 8 (`presets.ts`), więc to nie jest przypadek brzegowy.
- Źródła się rozjeżdżają:
  - Telescope Advisor: „Very difficult” przy Bortle 7-8;
  - Astronomy: „M31's bright central core will pierce all but the worst sky glow”.
- Plan opisuje stan docelowy tylko dla Bortle 5-6 („M31 stays in the top 5”) i nie wspomina o mieście.
- Linia i ranking są tu spójne (linia mówi faint, pozycja spada), czyli dokładnie to, czego chce ten slice. To jednak widoczna zmiana produktu dla najpopularniejszej galaktyki.

**Poprawka**

- Po akceptacji właściciela opisać przypadek miejski w „Desired End State”.
- Dodać w `manual-checks.md` jedno sprawdzenie przy 60 mm / Bortle 8.
- Pytanie do właściciela jest na końcu raportu.

**Ocena poprawki**

- **Zaleta**: właściciel widzi skutek OD-2 (a) i OD-4 (a) przed fazą 3, a nie po wdrożeniu.
- **Koszt**: jedno pytanie więcej do właściciela.
- **Pewność**: HIGH. Symulacja przy limicie 0,25; przy 0,1 M31 spada nieco niżej.
- **Ślepa plamka**: sprawdziłem tylko noce lipcowe i październikowe w Warszawie, żadnej innej szerokości geograficznej.

**Decision**: ACCEPTED (właściciel, 2026-10-15): M31 przy 60-80 mm / Bortle 7-8 dostaje „very faint” i wypada z top 5; opisane w Desired End State, w nowym strażniku G6, w CLAUDE.md i `manual-checks.md`.

### F7 — Wysokość stanowiska w Bieszczadach nie zgadza się z checkpointem S-02

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Claim Accuracy
- **Location**: plan.md „Phase 3 › Small-aperture ranking guard” („49.10 N, 22.65 E, 600 m”)
- **Detail**: `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:185` zapisuje „elevation 0 m”. Plan podaje 600 m, czyli nie tę noc, którą strażnik ma odtworzyć.
- **Fix**: użyć 0 m, jak w checkpoincie, żeby G4 dokładnie odtwarzał sondę z research.
- **Decision**: ACCEPTED: Bieszczady na wysokości 0 m, jak w checkpoincie.

### F8 — Limit jasności zmienia też regułę „zgaszony przez Księżyc”, a nic tego nie przypina

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Coverage
- **Location**: plan.md „Phase 3 › Brightness cap” („The washed-out rule's … total reads the capped components, which is consistent”)

**Szczegóły**

- Total „czy przeszedłby bez Księżyca” czyta teraz jasność po limicie. Część galaktyk z pasma `faint` przechodzi więc z „washed out” do „poniżej progu”.
- Noce kalibracyjne są bezksiężycowe, więc tego nie pokażą.
- `ranking.test.ts` (2026-10-26) przy limicie 0,25 nadal gasi te same 4 obiekty (M33, M74, M43, M101). Przy 0,1 trzeba to potwierdzić. Dolną granicę limitu opisuje F1.

**Poprawka**

- W fazie 3 zapisać listy obiektów zgaszonych przez Księżyc dla 2026-10-10 i 2026-10-26, przed i po limicie 0,1.
- Jeśli `ranking.test.ts` się zmieni, zbadać przyczynę, a nie edytować asercję (plan już to mówi).

**Decision**: ACCEPTED: faza 3 zapisuje listy „washed out” dla 2026-10-10 i 2026-10-26 przed limitem i po nim.

### F9 — Uruchomienie e2e i smoke w fazie 4 oddane subagentowi od dokumentacji

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Feasibility (delegowanie)
- **Location**: plan.md „Phase 4” (Sonnet, medium, „docs only”), punkt 4.2

**Szczegóły**

- Pełne e2e i `npm run smoke` na świeżym buildzie produkcyjnym, z lokalnym Supabase i kluczem podanym inline, to nie jest praca nad dokumentacją.
- Porty nie mogą kolidować z innymi agentami herdr: 4331, 4333, 4343, 4400 i 4401 są zajęte.
- Reguła właściciela przewiduje Sonnet na średnim wysiłku tylko do dokumentacji, copy i zrzutów ekranu.

**Poprawka**

- Punkt 4.2 robi agent prowadzący albo Sonnet na wysokim wysiłku, z jawnie wskazanymi wolnymi portami.
- Dokumentacja (4.1-4.4) zostaje przy Sonnet na średnim wysiłku.

**Decision**: ACCEPTED: e2e i smoke uruchamia agent prowadzący na portach 4333 / 4400; subagent dokumentacji robi tylko dokumentację.

### F10 — Wąskie okno dla e, a cytowanej lekcji nie ma na tej gałęzi

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Substance
- **Location**: plan.md „Phase 2 › Parameters”; „Overview” (lessons.md)

**Szczegóły**

- Skan daje okno dokładnie (0,762; 0,862]. e = 0,8 leży:
  - 0,062 od krawędzi B5 (M31 60/B5, deficyt 0,562);
  - 0,038 od krawędzi B8 (deficyt 2,462).
- Każda zmiana tabeli Bortle albo danych katalogowych M31 przełączy którąś referencję. To będzie głośne, więc akceptowalne, ale warto to zapisać.
- Lekcja „Judge advice that no observer can check against source-cited references” jest tylko na `docs/roadmap-m4` (PR #176, `lessons.md:79`). `lessons.md` na tej gałęzi ma 66 linii i jej nie zawiera.

**Poprawka**

- Oba marginesy wpisać w komentarz `EXPECT_BULGE_CORE_EXTRA_MAG`.
- W References zaznaczyć, że lekcja pochodzi z PR #176.

**Decision**: ACCEPTED: oba marginesy w komentarzu `EXPECT_BULGE_CORE_EXTRA_MAG`; lekcja oznaczona jako pochodząca z PR #176.

## Pytania do właściciela

- **QUESTION FOR OWNER:** Czy akceptujesz, że z teleskopem 60-80 mm pod miejskim niebem (Bortle 7-8, preset „city” w onboardingu) M31 dostanie linię „bardzo słaba, widzenie zerkające” i wypadnie z top 5? W symulacji jest #10-13 w październiku i #24-30 w lipcu. To zgadza się z linią i z Telescope Advisor („Very difficult” przy Bortle 7-8), ale Astronomy pisze, że rdzeń „przebija wszystko poza najgorszą łuną” (F6).
- **QUESTION FOR OWNER:** Czy akceptujesz limit jasności dla pasma `faint` (`GALAXY_FAINT_BRIGHTNESS_CAP`) równy 0,1 zamiast planowanych 0,25?
  - Przy 0,25 strażnik G1 jest czerwony: M101 jest #7 przy 60 mm / Bortle 5 w kwietniu.
  - Procedura „najmniejszej zmiany” z planu daje 0,21, zielone z marginesem 0,0009.
  - Przy 0,1 wszyscy strażnicy, wyrocznia kalibracyjna i istniejące testy są zielone z zapasem (F1).
  - To techniczny kandydat w `parameters.ts`; pytanie dotyczy tylko tego, czy chcesz go zobaczyć przed fazą 3.
