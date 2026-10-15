<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Galaxies in a Small Telescope (M-4 S-04)

- **Plan**: context/changes/small-scope-galaxies/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-15
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations
- **Branch**: feat/small-scope-galaxies @ 4c88a5a (równy origin, baza main 5d52a37). Reviewer: Opus, z dwoma subagentami Opus (dryf względem planu; bezpieczeństwo, jakość i siła testów).

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F1) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Co sprawdzono (dowody)

- **Bramki automatyczne, uruchomione ponownie przez reviewera:**
  - `npm test`: 123 pliki, 2372 testy zielone, 4 pominięte, 6 todo;
  - `npx astro check`: 0 błędów, 0 ostrzeżeń, 0 podpowiedzi;
  - `npm run lint`: czysto, `--max-warnings 0`;
  - `purity.test.ts`: 3/3. Test przechodzi po każdym pliku `.ts` w `src/lib/engine/`, więc `contrast.ts` jest objęty automatycznie.
  - e2e i smoke z 4.2 (45/45; 76 zielonych, 4 pominięte) nie były uruchamiane ponownie. Ich liczby mają trafić do opisu PR.
- **Czystość i determinizm silnika:**
  - `contrast.ts` importuje tylko `./moonlight`, `./parameters` i, wyłącznie dla typów, `@/lib/catalogue`.
  - Nie ma cyklu importów. `telescopeLimitingMag` ma jedną definicję i jest reeksportowany ze `score.ts` (test sprawdza, że to ten sam obiekt). Barrel eksportuje `contrastBand` raz.
- **Katalog:**
  - Reviewer pobrał `NGC.csv` i `addendum.csv` z przypiętego commita OpenNGC `da90466…` i porównał kolumnę `Hubble` ze wszystkimi 171 obiektami w `messier.json` i `caldwell.json`: **0 rozbieżności**.
  - Diff JSON-ów dodaje tylko `hubble` (pozostałe linie to przecinek po `surfaceBrightness`). Pliki meta są bez zmian.
  - Generator (`nullableText`, Double Cluster `null`) i `validateMeasurements` (istniejący `nullableString`) przenoszą pole. Nic nie było edytowane ręcznie.
- **Fixture referencyjne:**
  - 9 nowych SRC z URL-ami z planu i `accessed` jako 4. argumentem `source()`.
  - 7 nowych referencji `hard` z dokładnymi (id, mm, Bortle, klucz) z tabeli planu, z kontrdowodami w notach (M81: „at least 80mm … under dark skies”; M101: 100 mm „Averted vision essential”; M31 60/B8 opisane jako ekstrapolacja).
  - Trzecia rozbieżność to M33 80/B6. Limit w `expectation.test.ts` nadal wynosi `≤ 3` i nie został podniesiony. Razem 30 wpisów (27 + 3). Żaden niezmiennik D-3 nie został osłabiony.
- **Oracle kalibracyjne:** `calibration.test.ts`, `beginner-reference.ts` i `ranking-invariants.test.ts` są poza diffem i przechodzą (20/20). Pierwsza piątka nie zmieniła się na żadnej z czterech nocy. W pierwszej dziesiątce 2026-04-15 M101 wypada, a M63 wchodzi.
- **Wspólny `contrast.ts`:**
  - `expectation.ts` i `score.ts` czytają ten sam `contrastBand`.
  - Limit `scoreObject` to `telescopeLimitingMag(bortle, aperture)` bez członu Księżyca, tak jak w linii. Linia i limit mają więc identyczne wejścia.
  - Mapa band → limit to 1/1/0.1/0. Limit dotyczy tylko galaktyk.
  - Reguła washed-out czyta ograniczone składowe (`{...components, moon: 1}`). `effectiveSurfaceBrightness` i `moonlight.ts` są nietknięte.
- **Monotoniczność (sonda subagenta):** 68 galaktyk × Bortle 1–9 × 13 aperatur, czyli 14 416 par sąsiednich. Pasmo i `min(ramp, cap)` ani razu nie słabną przy większej aperturze i ani razu nie jaśnieją przy gorszym Bortle.
- **Strażnik linii powodu (G5):**
  - Pokrywa całą nieograniczoną listę oraz `leadComponent` **i** `secondComponent`, tą samą ścieżką co UI (`rankObjects` → `reasonComponents`, Targets z `limit: Infinity`). Deep-skyowa linia powodu jest renderowana tylko w `ObjectDetails` na Targets.
  - 57 kombinacji, 3 pominięte jawnie przez `it.skipIf` (brak okna ciemności), 228 asercji (galaktyka, kombinacja).
  - Szersza sonda: Bortle 1–9 × 11 aperatur × limit 5 i ∞ × 5 nocy daje 3039 par i 0 naruszeń.
- **Siła testów (mutacje na kopii w scratchpadzie):**

  | Mutacja | Czerwone testy |
  |---|---|
  | usunięty limit | 48 |
  | limit `faint` = 1 | 41 |
  | odwrócony znak członu bulge | 9 |
  | człon bulge = 0 | 6 |
  | puste `BULGE_HUBBLE_TYPES` | 9 |
  | `hubble` usunięty z `validateMeasurements` | 14 |
  | limit na wszystkich typach | 1 |
  | limit `limit` = limit `faint` | 1 |

  Mutacja „limit z klucza zamiast z pasma” jest równoważna, bo `galaxyKey` mapuje pasma 1:1. Nie jest to luka.
- **Decyzje właściciela, wszystkie dotrzymane:**
  - OD-1: G4 sprawdza tylko klucz `galaxySmudge` M101 w Bieszczadach, bez asercji rangi.
  - OD-2: `EXPECT_BULGE_CORE_EXTRA_MAG` = 0.8, z marginesami 0.062 i 0.038 w komentarzu.
  - OD-3: dokładnie 12 typów S0–Sb.
  - OD-4: `GALAXY_LIMIT_BRIGHTNESS_CAP` = 0, galaktyka zostaje na liście.
  - F1: `GALAXY_FAINT_BRIGHTNESS_CAP` = 0.1, z dolną krawędzią okna potwierdzoną celowym zepsuciem (czerwono przy 0.06, zielono przy 0.07).
  - F6: G6 oraz kontrola 4. M31 przy 60 mm / B8 to `galaxyFaint`, #13, a linia powodu nie mówi już „bright”.
- **Kontrole właściciela wykonane przez agenta:**
  - Wszystkie cztery są w `manual-checks.md`, ze zrzutami w `evidence/`. Reviewer obejrzał zrzuty 1 i 4. M31 60/B6 ma „A faint grey smudge with a slightly brighter middle.” obok „bright for your 60 mm” (#159 rozwiązane), a 60/B8 ma „A very faint grey smudge; use averted vision.” bez „bright”.
  - Kontrola 2 (kwiecień) była na poziomie silnika, bo strona czyta zegar serwera. Jest to jawnie opisane.
  - Skrypt `owner-checks.spec.ts.txt` nie zawiera kluczy ani e-maili.
- **Dokumentacja:**
  - `CLAUDE.md`: zmienione tylko 3 akapity (What to expect, Catalogue, Engine z notą F6).
  - `prd.md`: tylko OQ 5 i 17.
  - `roadmap.md`: tylko S-04 `ready` → `in-progress`. Warunek planu „nie edytuj, dopóki #176 jest otwarty” już nie obowiązuje, bo #176 jest w main.
- **Granice zakresu:** brak zmian w `src/i18n`, `src/components`, `moonlight.ts`, `SCORE_WEIGHTS`, `MIN_OBJECT_SCORE`, `bortlePenaltyForBortle` i `BRIGHTNESS_RAMP_MAG`.

## Ocena efektu M106 (150 mm / Bortle 6, Warszawa 2026-10-10, tylko Messier)

- **Liczby potwierdzone:**
  - Bez limitu suma wynosi 0.490: duration 0.113, moon 1, rampa brightness 0.308, sky 0.733.
  - Z limitem `faint` 0.1 jest to 0.490 − 0.25 × 0.208 = **0.438**, czyli poniżej `MIN_OBJECT_SCORE` 0.45. Liczba obiektów, które przeszły próg, spada z 66 do 65.
  - Żaden test nie przypinał 66. Nie zmieniono żadnej oczekiwanej wartości.
- **Ocena:** efekt jest **zgodny z regułą i do przyjęcia**.
  - M106 ma pasmo `faint`, a jego linia brzmiała „very faint; use averted vision” już przed tą zmianą (Sbc, bez członu bulge).
  - Próg przekraczał tylko dzięki moon = 1. To wiosenna galaktyka, nisko w październikowy wieczór (duration 0.113), więc dla użytkownika strata jest znikoma.
  - Logika OD-4 a (bez kredytu jasności, a obiekt zostaje tylko wtedy, gdy reszta składowych przechodzi próg) obejmuje w ten sam sposób pasmo `faint` z limitem 0.1.
- **Zastrzeżenie:** pasmo `faint` M106 przy 150/B6 jest prawdopodobnie zbyt pesymistyczne z powodu danych OpenNGC (zob. F1). Ta zmiana tego nie wprowadziła, ale limit zamienia ten błąd pasma w zmianę rankingu.
- **Inne obiekty, które przy 150 mm / B5–6 wypadają spod progu na nocach kalibracyjnych:**
  - Messier: M74 (07-15, B6).
  - Caldwell: IC1613, NGC247, NGC185, NGC147, NGC4244, NGC6822.
  - We wszystkich przypadkach są to pasma `faint` lub `limit`, a pierwsza piątka zostaje bez zmian.

## Findings

### F1 — Anomalia V/B w OpenNGC dla 12 galaktyk: limit przenosi zawyżone pasmo do rankingu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — prawdziwy kompromis, warto się zatrzymać i to przemyśleć
- **Dimension**: Safety & Quality (jakość danych)
- **Location**: src/lib/catalogue/messier.json, caldwell.json (dane generowane, przypięty OpenNGC); efekt w src/lib/engine/score.ts:205-210
- **Detail**:
  - W 12 galaktykach katalogu V > B − 0.2, czyli B−V jest bliskie zera albo ujemne. To nierealne dla spiral.
  - Lista: M58, M61, M88, M91, M98, **M106** (V 9.29 przy B 9.12; zwykle podawane V ≈ 8.4), IC342, NGC4449, NGC5005, NGC4565, NGC6822, NGC4039.
  - Zawyżone V przyciemnia jądro, więc pasmo wychodzi `faint` albo `limit`. Do tej pory wpływało to tylko na linię, a teraz przez limit 0.1 lub 0 także na ranking: M106 wypada spod progu 2026-10-10 przy 150/B6.
  - Fixture nie ma referencji galaktycznych przy 150 mm dla Bortle 5–6 (są tylko B4 i B7), więc te pasma są nieskalibrowane.
  - To nie jest regresja tej zmiany i nie blokuje PR. Zakaz nowych źródeł danych w tym slajsie (plan, „No new data source”) był świadomy.
- **Fix**: osobny follow-up dotyczący jakości danych: zbadać V tych 12 galaktyk (np. z B i typowego B−V albo ze źródła, które plan odrzucił dla S-04, czyli HyperLEDA) oraz dodać referencje galaktyczne przy 150 mm / B5–6 do fixture.
  - Strength: usuwa przyczynę, a nie objaw. Reguła i limit są poprawne, tylko dane wejściowe są złe.
  - Tradeoff: nowe źródło danych, licencja i generator. `KNOWN_DIVERGENCES` ma już 3/3, więc nowa rozbieżna referencja wymusi decyzję.
  - Confidence: MED — B−V ≈ 0 dla spirali Sbc to mocny sygnał błędu, ale prawdziwe V nie zostało tu zweryfikowane źródłem.
  - Blind spot: nie sprawdzono, czy OpenNGC poprawił te wartości w nowszych commitach.
- **Decision**: ACCEPTED (właściciel, 2026-10-15): obecny efekt zostaje (M106 spod progu przy 150 mm / Bortle 6 jest zgodny z F1 i OD-4); przyczyna, czyli V z OpenNGC dla 12 galaktyk, trafia do follow-upu #178 (M-4, tablica #1, Stream B), podlinkowanego z #172 i PR.

### F2 — Komentarz `BULGE_HUBBLE_TYPES` mówi o dwunastu typach obecnych w katalogu, a jest ich osiem

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Pattern Consistency (dokumentacja w kodzie)
- **Location**: src/lib/engine/parameters.ts:527-536
- **Detail**:
  - Komentarz brzmi „the pinned commit has these twelve among the catalogue's galaxies”.
  - W katalogu jest 8 z nich: S0, S0-a, E-S0, Sa, SABa, Sab, Sb, SABb. SBa, SABab, SBab i SBb są na liście na zapas, na wypadek przyszłego podbicia przypiętego commita. To słuszne, ale komentarz mówi co innego.
- **Fix**: zmienić zdanie na „eight of these occur among the catalogue's galaxies at the pinned commit; SBa, SABab, SBab and SBb complete the class for a future pin bump”.
- **Decision**: ACCEPTED: komentarz `BULGE_HUBBLE_TYPES` mówi teraz, że 8 typów występuje w katalogu, a 4 są na zapas na przyszłe podbicie przypiętego commita.

### F3 — Nieaktualne zdanie o kontrolach właściciela i niespójna liczba kontroli

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Success Criteria
- **Location**: context/changes/small-scope-galaxies/implementation-notes.md:94; plan.md:407 i :492
- **Detail**:
  - `implementation-notes.md` nadal mówi „4.3: the owner's manual checks … are pending”, choć Progress 4.3 jest `[x]` (08e5eec), a `manual-checks.md` ma wyniki ze zrzutami.
  - Plan mówi o „three checks”, a lista i `manual-checks.md` mają cztery (doszła kontrola F6).
  - Dowody są realne, więc to nie jest odhaczenie na ślepo. Zgodnie ze stałą zasadą właściciela agent wykonał kontrole sam. Właściciel może nadal chcieć je powtórzyć.
- **Fix**: zaktualizować zdanie w `implementation-notes.md` (kontrole wykonane przez agenta 2026-10-15, z dowodami w `evidence/`) i w planie „three” → „four”.
- **Decision**: ACCEPTED: `implementation-notes.md` i blok fazy 4 w planie mówią o czterech kontrolach, wykonanych przez agenta 2026-10-15 z dowodami; żadna nie czeka (tytuł wiersza 4.3 w Progress zostaje, zgodnie z formatem).

### F4 — `KNOWN_DIVERGENCES` jest pełne (3/3)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Success Criteria
- **Location**: src/lib/engine/fixtures/expect-reference.ts:576-587; src/lib/engine/expectation.test.ts (`toBeLessThanOrEqual(3)`)
- **Detail**:
  - M33 80/B6 jest uzasadnioną rozbieżnością (deficyt 2.47 przy progu 2.5; dopasowanie o 0.03 mag byłoby dopasowywaniem szumu).
  - Limit nie został podniesiony, co jest poprawne. Każda następna rozbieżna referencja (np. z F1) wymusi jednak naprawę reguły albo świadomą decyzję właściciela o limicie.
- **Fix**: nic teraz. Odnotować w opisie PR, że bufor rozbieżności jest wyczerpany.
- **Decision**: ACCEPTED: pełny bufor rozbieżności (3/3) odnotowany w planie („What We're NOT Doing”), w CLAUDE.md i w opisie PR.

### F5 — Drobne luki w sile testów

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja; poprawka oczywista i wąska
- **Dimension**: Success Criteria (siła testów)
- **Location**: src/lib/engine/small-scope.test.ts (G4 ok. :114, G5 :119-139); src/lib/engine/score.test.ts (ok. :315)
- **Detail**:
  - (a) G4 nie zabija żadnego mutanta: powtarza wpis fixture M101 80/B3, a sprawdzenie „na liście” bez limitu staje się łatwiejsze. Jako pin OD-1 jest nieszkodliwy.
  - (b) G5 jest pusty, z 0 asercjami, dla wszystkich pięciu kombinacji 60 mm / B8. Ten przypadek pokrywa jednak G6.
  - (c) Test monotoniczności w `score.test.ts` sprawdza tylko kierunek apertury, a nie Bortle. Sonda pokazuje, że oba kierunki są spełnione.
  - (d) G5 nie sprawdza średniej powodów przy `limit: 5`. Sonda: 0 naruszeń. Dashboard i tak nie pokazuje deep-skyowej linii powodu.
- **Fix**: opcjonalnie dodać pętlę Bortle do testu monotoniczności w `score.test.ts`. Reszta bez zmian.
- **Decision**: ACCEPTED: G4 sprawdza teraz także, że kredyt jasności M101 (pasmo smudge) nie jest ograniczony, więc łapie limit sięgający pasma smudge (sprawdzone celowym zepsuciem); `score.test.ts` dostał test monotoniczności w kierunku Bortle (celowe zepsucie z odwróconym Bortle robi go czerwonym).

## Uwagi poza findings

- `change.md` **nie** został ostemplowany na `impl_reviewed`: zgodnie z poleceniem orkiestratora reviewer zapisuje tylko ten plik. Stempel (`status: impl_reviewed`, `updated: 2026-10-15`) zostaje dla agenta implementującego albo orkiestratora.
- Dodatki EXTRA (nieszkodliwe): zrzuty i skrypt w `evidence/`, sprawdzenie obecności M101 w G4 oraz `contrastDeficit` i `coreSurfaceBrightness` eksportowane z `contrast.ts`, ale nie z barrela (plan wymagał w barrelu tylko `contrastBand`).
- Worktree czysty (`git status --porcelain` pusty). Sondy działały tylko w scratchpadzie reviewera.

QUESTION FOR OWNER: Czy otworzyć osobny follow-up dotyczący jakości danych (F1): zawyżone V w OpenNGC dla 12 galaktyk, m.in. M106 (V 9.29 przy typowym ≈ 8.4), które teraz przez limit jasności wypadają niżej w rankingu? Wymagałoby to nowego źródła V albo poprawki w generatorze oraz referencji galaktycznych przy 150 mm / Bortle 5–6. Czy przyjmujesz obecny efekt (M106 spod progu 2026-10-10 przy 150/B6) jako zgodny z decyzjami F1/OD-4 do czasu tego follow-upu?
