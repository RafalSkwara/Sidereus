<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: What to expect (M-3 S-04)

- **Plan**: `context/changes/what-to-expect/plan.md`
- **Zakres**: cały plan, commity 4b83028..f2e7f83 na main 172c0cf
- **Przejrzane fazy**: 1, 2, 3, 4
- **Data**: 2026-10-14
- **Werdykt**: NEEDS ATTENTION
- **Uwagi**: 0 krytycznych, 2 ostrzeżenia, 5 obserwacji
- **Recenzent**: agent herdr „reviewer” (Opus) z dwoma subagentami Opus: jeden sprawdzał zgodność z planem, drugi bezpieczeństwo, bramkę planu i wzorce.
- **`change.md`**: bez zmian (`status: implemented`). Orkiestrator pozwolił zapisać tylko ten plik, więc `status: impl_reviewed` ustawia autor razem z poprawkami.

## Podsumowanie

Implementacja jest wierna planowi. Najważniejsze punkty się potwierdzają.

**Bramka planu na Targets** (`TargetsPageContent.astro:60-98`):
- Linie z frazami powstają tylko wtedy, gdy `expectationView(await getAccountPlan(), (await accountPlanForCopy()).plan) === "lines"`, a to wymaga `getAccountPlan === "full"`. Ten odczyt przy błędzie daje `free`, więc bramka jest bezpieczna przy awarii.
- Trójwartościowy odczyt decyduje tylko między linią locked a niczym. Przy `unknown` nie pokazuje się żadna linia (D-13).
- Oba `await` korzystają z jednej zapamiętanej obietnicy `readOnce`, tej samej, którą zapisuje `OfflineCopy`. Nie ma więc wyścigu ani rozjazdu odczytów.
- `getAccountPlan` nie może zostać odrzucone (store łapie błędy), więc wcześnie uruchomiona obietnica nie da nieobsłużonego odrzucenia, nawet gdy `loadTonightFor` rzuci wyjątek.
- Po wylogowaniu `load` jest `null`, a wyspa nie renderuje nic.
- Stany bez rankingu, „empty”, „no gear” i washed-out nie korzystają z mapy linii. Wiersze w `details#more` czytają tę samą mapę, budowaną tylko dla planu full.

**Finder:**
- `requireFullPlan` (`load.ts:118`) działa przed czymkolwiek innym, a `expectation` istnieje tylko w wariancie `chart`.
- `FinderLocked` i `EXAMPLE_FINDER_CHART` nie zawierają żadnej frazy.
- Planety pokazują `entry.note` z kluczem planety.

**Smoke:**
- `'data-expect="'` nie pasuje do `data-expect-locked`, więc asercje z D-11 da się sfalsyfikować (uwaga F1 z przeglądu planu została naprawiona).
- `islandUrlFromShell(html, path)` jest uogólnione, a kroki findera nadal działają.

**Pozostałe sprawdzenia:**

| Obszar | Wynik |
|---|---|
| Pliki S-07 | `git diff --name-only main..HEAD` nie zawiera `src/lib/tonight/{build,load,island}.ts`, `src/lib/offline/**`, `src/sw.ts`, komponentów dashboardu (`TonightContent`, `TonightTiles`, `TonightSkeleton`, `VerdictCard`, `sky-band.ts`), `tonight-phone.spec.ts`, `tonight-dashboard.spec.ts`, `no-console-guard.test.ts` ani `fixtures/index.ts`. `EXPECT_*` stoi po `WASHED_OUT_TYPES` (`parameters.ts:395-523`), eksport tuż po `./moonlight` (`engine/index.ts:23-24`), a `tonight.expect` po `tonight.finder`. |
| Współrzędne i logi | Brak nowych `console.*`, `eslint-disable` i `try`/`catch`. Brak lat/long w URL-ach. Spec e2e używa zaślepionego wyszukiwania miejsca (Madryt). |
| Czystość silnika | `expectation.ts` importuje typ z katalogu oraz `./moonlight`, `./parameters` i `./score`. Nie ma cyklu ani importu i18n. `purity.test.ts` przechodzi. |
| Testy własnościowe | Monotoniczność porównuje rangi `contrastBand` po zastosowaniu progu bliskości limitu, nie klucze. Pętle obejmują cały `DEEP_SKY`. |
| Fikstura | Nie jest tautologiczna, bo klucze `expected` są literałami. Ręczne przeliczenie M42 przy B7, M56 przy 200 mm, NGC 7293, M51, M97 i M27 daje zgodne wyniki. 20 odniesień, 2 rozbieżności z uzasadnieniem, każda pozycja ma co najmniej 2 źródła. |
| Dane osobowe | Brak w fiksturze i źródłach. |
| Tokeny | Brak wartości arbitralnych, hexów i klas palety. `src/styles` przechodzi. Ikony mają `aria-hidden` i `mt-0.5 size-4 shrink-0`, jak w `ServerError` i `FormField`. Linie się zawijają (`flex items-start gap-2`, `min-w-0`, brak `truncate` i `nowrap`). |
| i18n | Parzystość EN/PL przechodzi. `en.ts` zostaje bez importów. |

**Drobne dodatki spoza planu, bez znaczenia:**
- dodatkowy eksport typu `ExpectationObject` z barrela;
- ikona Eye ma kolor `text-primary-strong` (istniejący token);
- planeta na finderze rozpoznawana jest przez `resolved.planetNote !== null`, nie przez `isPlanetKey`, z tym samym zachowaniem;
- roadmap i `change.md` zaktualizowane już w p1.

Powodów do odrzucenia nie ma. Dwa ostrzeżenia dotyczą tekstu, który właściciel i tak czyta w kroku 2.8, a obserwacje to wzmocnienia testów i dokumentacji.

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Plan Adherence | WARNING (F1, F2) |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING (F7) |
| Success Criteria | WARNING (F3, F4, F5, F6) |

## Kryteria sukcesu (krok 3)

| Komenda | Wynik |
|---|---|
| `npm test` | 104 pliki; 1805 passed, 1 skipped, 6 todo (1812) |
| `npx astro check` | 426 plików, 0 błędów, 0 ostrzeżeń, 0 podpowiedzi |
| `npx eslint --max-warnings 0` na 20 zmienionych plikach | exit 0 |
| `npx vitest run` dla no-console-guard, `src/i18n`, `src/styles`, purity, obu `expectation.test.ts` i `finder/load.test.ts` | 9 plików, 58 testów, wszystkie przechodzą |
| `npx prettier --check` na zmienionych plikach | czysto |
| `npm run build`, `npm run smoke`, Playwright | **nieuruchamiane**: build zapisuje `dist`, a porty 4331/4333/4400/4401 należą do innych agentów (polecenie orkiestratora). Dowodem jest p4 („whole e2e suite (58 passed) and smoke green on a local preview”), zob. F5. |

Kroki ręczne 1.5, 2.8-2.11, 3.5-3.6 i 4.6 są nieodhaczone, czyli czekają na właściciela. Żaden krok ręczny nie jest odhaczony bez dowodu.

## Uwagi

### F1 — Fraza `planetaryFaint` („duża… najmniejsze powiększenie”) trafia też do małych mgławic planetarnych

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM (realny kompromis; warto się zastanowić)
- **Wymiar**: Plan Adherence
- **Miejsce**: `src/i18n/messages/en.ts:975`, `src/i18n/messages/pl.ts:858`, `src/lib/engine/expectation.ts:154`
- **Szczegóły**:
  - Zgodnie z D-6 („Phase 2 rewords `planetaryFaint` toward low power (Helix, Owl)”) fraza brzmi dziś: „A faint, large round glow; use your lowest power and averted vision.” (PL: „Słaba, duża okrągła poświata; użyj najmniejszego powiększenia…”).
  - Klucz ma jednak dwie drogi wejścia: gałąź dużych mgławic planetarnych (b), dla Helixa i Sowy, oraz zwykłą ścieżkę pasma, gdy dowolna mgławica planetarna jest w paśmie `faint` lub `limit` (`expectation.ts:154`).
  - Przy Bortle 1-9 i aperturach 60-300 mm tę drugą drogą przechodzą małe obiekty:

    | Obiekt | Rozmiar | Liczba ustawień z tą frazą |
    |---|---|---|
    | NGC 40 | 0,8′ | 46 |
    | M76 | 1,1′ | 20 |
    | NGC 2392 | 0,86′ | 13 |
    | NGC 6543 | 0,9′ | 8 |
    | M57 | 1,27′ | 7 |
    | NGC 7009 | 0,7′ | 2 |

  - Dla nich zarówno „duża”, jak i „najmniejsze powiększenie” to zła rada: małe mgławice planetarne wymagają większego powiększenia.
  - Testy tego nie łapią, bo porównują frazy z katalogiem, nie ich sens.
- **Poprawka A ⭐ Zalecana**: Zmienić frazę na neutralną wobec rozmiaru i powiększenia, np. „A faint round glow; use averted vision.” / „Słaba okrągła poświata; patrz kątem oka.”
  - Zaleta: bez nowego klucza i bez decyzji właściciela (D-2: 23. klucz wymaga właściciela). Fraza jest prawdziwa dla obu dróg wejścia.
  - Koszt: Helix i Sowa tracą wskazówkę „małe powiększenie”, którą D-6 chciał im dać.
  - Pewność: HIGH. Liczności przeliczone, ścieżka w kodzie potwierdzona.
  - Martwe pole: nie wiadomo, czy właściciel woli bardziej szczegółową radę.
- **Poprawka B**: Rozdzielić klucz na `planetaryLarge` (gałąź b, „małe powiększenie”) i `planetaryFaint` (neutralny).
  - Zaleta: każdy obiekt dostaje trafną radę.
  - Koszt: 23. klucz to nowy tekst dla użytkownika, więc według D-2 wymaga zgody właściciela. Do tego zmiana `EXPECTATION_KEYS`, testów, fikstury i `/design`.
  - Pewność: MED. Zależy od decyzji właściciela.
  - Martwe pole: nie sprawdzono, czy reguła osiągalności kluczy zostanie spełniona przy ustawieniach z testu.
- **Decision**: APPLIED (author, 2026-10-14: fix A, neutral phrase, no 23rd key)

### F2 — Kilka polskich fraz jest niezręcznych albo błędnych

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Plan Adherence („Polish is written to the same register as `tonight.planets.note`”)
- **Miejsce**: `src/i18n/messages/pl.ts:845-874`
- **Szczegóły**:
  - **`galaxyBright`**: „łatwa do zobaczenia patrząc wprost” to imiesłów z innym podmiotem niż zdanie (patrzy obserwator, nie poświata), czyli błąd normatywny. Propozycja: „…, dobrze widoczna, gdy patrzysz wprost.”
  - **`planetaryFaint`**: „użyj … patrzenia kątem oka” jest niezgrabne i niespójne z `galaxyFaint` / `nebulaFaint` („patrz kątem oka”). To samo miejsce co F1.
  - **`planetaryDisc`**:
    - „szaro-zielona” → „szarozielona”, spójnie z „niebieskozielona” w `tonight.planets.note`;
    - kształt to „muszka”, nie „kokardka”;
    - „który dobrze znosi powiększenie” odnosi się tylko do „kształtu”.

    Propozycja: „Jasna szarozielona tarcza, pierścień albo kształt muszki; dobrze znosi duże powiększenie.”
  - **`asterism`**: „łata Drogi Mlecznej” kojarzy się z łatą na ubraniu. Propozycja: „płat” albo „fragment”.
  - **`openClusterWide`**: „szeroka garść gwiazd” (garść = handful) nie oddaje „wide spray”. Propozycja: „Rozległe rozsypisko gwiazd…”.
  - **`galaxyLimit`**: „widmowa plamka” w kontekście astronomii czyta się jako „spektralna”. Propozycja: „ledwo uchwytna plamka”.
  - **`locked`**: „każdy cel mówi też” to kalka. Propozycja: „przy każdym celu zobaczysz też, jak będzie wyglądał…”.
  - **Drobne**:
    - `globularGrainy`: „tuż przed rozpadem na gwiazdy” brzmi jak opis momentu w czasie. Propozycja: „jakby miały się zaraz rozpaść na gwiazdy”.
    - `openClusterHazy`: powtórzenie „słabej… słabszych”.
  - **Bez zastrzeżeń**: forma „Twoje/Twoim” (zgodna z resztą pliku), `lockedFinderLine` (zgodne z sąsiednimi punktami), cudzysłowy „…”.
- **Poprawka**: Wprowadzić powyższe zmiany w `pl.ts` przed krokiem 2.8, który właściciel i tak czyta na `/design`. Testy się nie zmieniają, bo porównują z katalogiem.
- **Decision**: APPLIED (author, 2026-10-14)

### F3 — Krok smoke `expect 3` (wyciek URL-a wyspy) dowodzi mniej, niż mógłby, i niepotrzebnie wymaga nadania planu

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Success Criteria
- **Miejsce**: `scripts/smoke.mjs:356-364`
- **Szczegóły**:
  - Krok ma tylko dwa wykluczenia (`data-expect="`, `data-expect-locked`), więc wyspa, która nie wyrenderowałaby nic z dowolnego innego powodu, też przejdzie. Dla porównania `finder 6` sprawdza pozytywny znacznik `data-finder-state="locked"`.
  - Krok zależy tylko od URL-a złapanego w `expect 1`, a tamten krok nie potrzebuje nadania planu. Mimo to `expect 3` ma `needsPlanGrant: true`, więc lokalnie bez klucza dowód po wylogowaniu jest pomijany.
  - Samo odtworzenie jest prawdziwe: ciasteczka sesji usunięte przy wylogowaniu (`max-age=0`) znikają ze słoja.
- **Poprawka**: Usunąć `needsPlanGrant` z `expect 3` i dodać `"data-offline-copy"` do `bodyExcludes`. To dowodzi, że nie nastąpiło żadne ładowanie Tonight, a nie tylko że brakuje znaczników.
- **Decision**: APPLIED (author, 2026-10-14)

### F4 — Spec e2e: 320 px i bramka sprawdzone węziej, niż mówi plan

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Success Criteria
- **Miejsce**: `tests/e2e/what-to-expect.spec.ts:44-46, 67-100` (asercja liczby linii w `:86`)
- **Szczegóły**:
  - Test 320 px w EN i PL sprawdza tylko, że linii jest więcej niż 0 (`:86`). Nie sprawdza, że każda z pięciu najlepszych kart ma linię. Sprawdza za to, że każda linia jest widoczna i jest frazą z katalogu.
  - Test nie otwiera `#more` ani żadnego wiersza. Wiersze tam są węższe (`pl-10` w obramowanym `px-3`), a przelewanie w regionie `overflow-y-auto` nie byłoby widoczne w `scrollWidth` dokumentu. Znaczniki zawijają się poprawnie, więc ryzyko jest niskie.
  - Test free i smoke szukają tylko znacznika `data-expect="`. Fraza wyrenderowana bez znacznika przeszłaby oba.
  - Wszystkie testy są pomijane w oknie bez ciemności (8 czerwca – 2 lipca). `finder-chart.spec.ts` ma w tym oknie własny test stanu.
- **Poprawka**:
  - Sprawdzić `toHaveCount(5)` na liniach pięciu najlepszych kart.
  - Otworzyć `#more` i jeden wiersz, potem sprawdzić `scrollWidth ≤ clientWidth` linii.
  - W teście free sprawdzić, że w treści nie ma żadnej frazy z katalogu poza `galaxySmudge`, którą `locked` cytuje z założenia (O-1).
  - Opcjonalnie dodać test okna bez ciemności.
- **Decision**: APPLIED (author, 2026-10-14; the optional no-darkness-window test not added)

### F5 — Dowody kroków automatycznych to głównie SHA przy checkboxach

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Success Criteria
- **Miejsce**: Progress 1.4, 2.4, 2.5, 2.7, 3.3, 3.4, 4.3, 4.4, 4.5; `git log --format=%B main..HEAD`
- **Szczegóły**:
  - Komunikaty commitów p1-p3 wymieniają tylko zmienione pliki. Żaden nie wspomina lint, astro check, buildu, smoke z „0 skipped” ani trzech celowych zepsuć (1.4 znak członu apertury, 2.7 linie przy `locked`, 4.4 brak sprawdzenia planu).
  - Liczby podaje dopiero p4: „whole e2e suite (58 passed) and smoke green on a local preview”.
  - W tym przeglądzie ponownie przeszły testy jednostkowe, astro check i lint. Smoke, e2e i build nie były uruchamiane (porty innych agentów).
- **Poprawka**: W opisie PR podać liczby (unit, e2e, kroki smoke, 0 skipped) i wynik każdego celowego zepsucia (który krok zrobił się czerwony), zgodnie z lekcją „Run the whole e2e suite before a PR… Report the counts in the PR”.
- **Decision**: APPLIED (author, 2026-10-14: in the PR description)

### F6 — Nazwa testu „https sources” nie zgadza się z asercją

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Success Criteria
- **Miejsce**: `src/lib/engine/expectation.test.ts:198, 206`; `src/lib/engine/fixtures/expect-reference.ts:227`
- **Szczegóły**: Nazwa testu mówi „https sources”, ale regex dopuszcza `http`, a fikstura cytuje `http://www.deepskywatch.com/…`.
- **Poprawka**: Użyć adresu https (jeśli strona go obsługuje) i zaostrzyć regex albo zmienić nazwę testu.
- **Decision**: APPLIED (author, 2026-10-14: https URL, regex tightened)

### F7 — Drobne niezgodności w dokumentacji i komentarzach

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Pattern Consistency
- **Miejsce**: `CLAUDE.md` (akapit What to expect), `src/lib/engine/parameters.ts` (`EXPECT_BRIGHT_NEBULA_MAX_VMAG` i linie doc „reference calibration”, około `:453`), `scripts/smoke.mjs` (doc `islandUrlFromShell`), `src/lib/engine/expectation.ts:62`
- **Szczegóły**:
  - Akapit w CLAUDE.md o O-2 pomija warunek „its next-night copy refreshes”.
  - Komentarz `EXPECT_BRIGHT_NEBULA_MAX_VMAG` mówi „brighter than this”, a kod używa `<=`.
  - Kilka linii komentarzy ma 123-142 znaki przy `printWidth` 120. Prettier nie zawija komentarzy, więc lint przechodzi.
- **Poprawka**: Dopisać warunek next-night w CLAUDE.md, zmienić komentarz na „this bright or brighter” i zawinąć długie linie.
- **Decision**: APPLIED (author, 2026-10-14)
