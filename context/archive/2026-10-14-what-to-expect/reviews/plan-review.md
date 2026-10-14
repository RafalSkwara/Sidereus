<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: What to expect (M-3 S-04)

- **Plan**: `context/changes/what-to-expect/plan.md` (commit a443a15, gałąź `feat/what-to-expect`)
- **Data**: 2026-10-14
- **Recenzent**: agent herdr „reviewer” (Opus) z dwoma subagentami: jeden sprawdził twierdzenia o kodzie, drugi wykonalność, i przeliczył regułę D-2 na całym katalogu
- **Fazy**: 4 (żaden krok w Progress nie jest odhaczony)
- **Uwagi**: 0 krytycznych, 6 ostrzeżeń, 4 obserwacje
- **Werdykt**: NEEDS ATTENTION
- **Status w `change.md`**: bez zmian, bo orkiestrator pozwolił temu agentowi zapisać tylko ten plik. `status: plan_reviewed` ustawia autor razem z poprawkami.
- **Pytania do właściciela O-1 i O-2**: nierozstrzygane tutaj. Wiąże się z nimi F5 (co widzi użytkownik planu full po nieudanym odczycie planu).

## Podsumowanie

Fazy 1-4 nie zależą od faz późniejszych, a każda zostawia repo zielone. Architektura zgadza się z repo:

- czysta reguła siedzi w silniku;
- helper serwerowy jest w `src/lib/tonight`;
- bramka planu jest w wyspie, poza `TonightView`;
- loader findera ma już strażnika planu.

Prawie wszystkie twierdzenia o kodzie się potwierdzają (dowody `plik:linia` przy uwagach). Reguła D-2 została przeliczona dosłownie, dla 171 obiektów × Bortle 1-9 × {20…1000} mm:

- osiągalne są wszystkie 22 klucze;
- pasmo nigdy nie jaśnieje przy gorszym niebie ani nie słabnie przy większej aperturze, łącznie z progiem bliskim limitu teleskopu;
- gromady kuliste nie cofają się wraz z aperturą;
- liczności pasm zgadzają się z research §1 co do sztuki (B3: 143/19/4/0/3, B7: 39/60/38/19/13).

Problemy:

- asercje smoke dla bramki nie mogą się wywalić w zapisanej postaci;
- fikstura referencyjna próbkuje tylko „pokazowe” obiekty, więc nie złapie realnych błędów klasyfikacji;
- twierdzenie o czystym merge'u z S-07 jest fałszywe dla `parameters.ts` i `engine/index.ts`;
- typowanie fraz łamie zasadę „bez importów” w `en.ts`.

Wszystko da się naprawić w triage, bez ponownego planowania.

## Werdykty

| Wymiar | Werdykt | Uwagi |
|---|---|---|
| Claim Accuracy | WARNING ⚠️ | F8, F9 |
| Substance | PASS ✅ | |
| Feasibility | WARNING ⚠️ | F2 |
| Sequencing | PASS ✅ | |
| Architecture Fit | WARNING ⚠️ | F4 |
| Scope Discipline | WARNING ⚠️ | F3 |
| Verifiability | WARNING ⚠️ | F1, F6, F7 |
| Coverage | WARNING ⚠️ | F5, F10 |

**Ogólnie: NEEDS ATTENTION.**

## Uwagi

### F1 — Asercje smoke dla bramki planu nie mogą się wywalić w zapisanej postaci

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Verifiability
- **Miejsce**: plan.md D-11; Faza 4 › 1. Smoke; Progress 4.3 i 4.5
- **Szczegóły**:
  - Astro renderuje statyczne `<p data-expect>` jako goły atrybut `data-expect`, bez `=`. Tak samo działa istniejący znacznik: `scripts/smoke.mjs:245,273,286,314` porównuje goły napis `"data-finder-chart"`.
  - Dlatego wykluczenie „brak `data-expect=`” w kroku free nigdy nie trafi w linię z frazą. Wyspa free, która wysłałaby frazy razem z linią locked, przejdzie smoke, a to dokładnie ten wyciek, który krok ma łapać.
  - Krok full sprawdza „zawiera `data-expect`” przez `body.includes` (`smoke.mjs:347-348`). `data-expect-locked` zawiera ten napis, więc konto full, które widzi tylko linię locked, też przejdzie.
  - Celowe zepsucie z 4.5 i tak zaczerwieni test, ale tylko przez *include* `data-expect-locked` w kroku free, a nie przez wykluczenie frazy.
  - E2E nie ma tego problemu: selektor CSS `[data-expect]` dopasowuje nazwę atrybutu dokładnie.
- **Poprawka**: Nadać znacznikowi wartość, `data-expect={key}`. Wtedy renderuje się `data-expect="globularGlow"`. Asercje sprawdzają `data-expect="`: include w kroku full, exclude w kroku free i po wylogowaniu. To samo sprawdzenie dodać do `finder 3`. Linia locked nie wymaga zmiany nazwy, bo `data-expect-locked` nie zawiera `data-expect="`.
- **Decision**: APPLIED (author, 2026-10-14)

### F2 — Reguła źle klasyfikuje znane przypadki, a fikstura referencyjna tego nie złapie

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM (realny kompromis; warto się zatrzymać)
- **Wymiar**: Feasibility
- **Miejsce**: plan.md D-2 (tabela typów) i D-6 (kandydaci do fikstury)
- **Szczegóły**:
  - Wszystkie 13 kandydatów z D-6 dostaje przy 150 mm i Bortle 4 dokładnie „oczywisty” klucz:
    - M13 i M3: `globularResolved`;
    - M57 i M27: `planetaryDisc`;
    - NGC 7662: `planetaryStarLike`;
    - M31, M51 i M81: `galaxyBright`;
    - M33 i M101: `galaxySmudge`, a przy B7 `galaxyLimit`;
    - M42: `clusterNebulaBright`;
    - M45: `openClusterWide`;
    - M11: `openClusterCompact`.
  - Należy się więc spodziewać 0 rozbieżności, czyli wyrocznia jest słaba. Nie są próbkowane przypadki naprawdę ryzykowne. Przeliczona reguła daje dla nich:
    - **Słabe gromady kuliste nie poprawiają się z aperturą.** Progi `EXPECT_RESOLVE_MAX_VMAG` 7.0 i `EXPECT_GRAINY_MAX_VMAG` 8.0 nie zależą od apertury. M56 (V 8,4), M9 (8,42), M69, M70, M72, M75, M79 i M107 zostają `globularGlow` („like an out-of-focus star”) nawet przy 300 i 1000 mm. M30, M53 i M80 nigdy nie osiągają `globularResolved`.
    - **Duże, słabe mgławice planetarne.** NGC 7293 (Helix, 16,3′, jasność powierzchniowa jądra 20,5) i M97 (Sowa, 3,6′) dostają `planetaryDisc`, czyli „A small, crisp … disc … that takes high power well”. Dla Helixa przewodniki mówią odwrotnie: małe powiększenie, filtr.
    - **M42 przy Bortle 7** dostaje `clusterNebulaFaint` („a group of stars inside a faint haze”) przy każdej aperturze poniżej 1000 mm, a to łatwy obiekt nawet z miasta.
    - **NGC 7000** przy B4 i 150 mm dostaje `nebulaBright` („a bright cloud … with a clear shape”). To ryzyko wymienia sam plan-brief w „Open Risks”.
    - **Małe galaktyki około 11 mag** wychodzą jako „easy to see straight on”. Na przykład NGC 4889 (V 11,45, 2,6′ × 1,7′, jasność powierzchniowa jądra 20,17, d = −0,63) przy B4 i 150 mm dostaje `galaxyBright`. W tym ustawieniu tak samo wychodzi 47 galaktyk.
- **Poprawka**: Dodać do D-6 od 4 do 6 przypadków granicznych, po zasadach samego D-6 (najpierw źródła, potem porównanie). Kandydaci: M42 przy B7, M56 przy 200 mm, NGC 7293 albo M97, NGC 7000 i jedna słaba galaktyka z `galaxyBright`. Wynik rozstrzyga D-6: zmiana reguły poparta źródłem albo wpis w `KNOWN_DIVERGENCES`, a powyżej 3 rozbieżności decyzja idzie do właściciela.
  - **Zaleta**: Fikstura staje się wyrocznią, która może się wywalić. Przypadki pochodzą z przeliczenia reguły w dosłownym brzmieniu, nie ze zgadywania.
  - **Koszt**: Warunek stopu (> 3 rozbieżności) dość prawdopodobnie zadziała i wciągnie właściciela. Prawdopodobne zmiany reguły powiększą Fazę 1:
    - progi jasności zależne od apertury, np. `vMag ≤ telescopeLimitingMag − k`;
    - podział mgławic planetarnych po rozmiarze, czyli 23. klucz `planetaryLarge` albo gałąź dla dużych rozmiarów prowadząca do `planetaryFaint`.
  - **Pewność**: HIGH, że reguła daje takie wyniki (przeliczone, a Helix i NGC 4889 sprawdzone ręcznie). MED, że źródła zaprzeczą każdemu z nich.
  - **Martwe pole**: Źródeł nie czytano. Część przypadków może okazać się akceptowalnym uproszczeniem.
- **Decision**: APPLIED (author, 2026-10-14)

### F3 — Konflikt merge'a z S-07 w `parameters.ts` i `engine/index.ts` jest pewny

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Scope Discipline (deklarowana granica z S-07)
- **Miejsce**: plan.md Current State (lista wspólnych plików, `:38`); D-10 („merge textually”); Faza 1 › 1 („appended at the end of the file”) i 2 („exported from `src/lib/engine/index.ts`”)
- **Szczegóły**:
  - Gałąź S-07 ma już commit `e57dadf`, który dopisuje:
    - na końcu `parameters.ts` blok `EVENT_*` (41 linii, po `FINDER_OVERHEAD_ALT_DEG`, `:475`);
    - na końcu `src/lib/engine/index.ts` blok eksportów `events` (16 linii, po `:77`).
  - Ten plan dopisuje w tych samych dwóch miejscach na końcu plików, a dwa wstawienia w tym samym miejscu git zawsze zgłasza jako konflikt. Oba konflikty są trywialne, ale plan twierdzi, że ich nie będzie.
  - `engine/index.ts` w ogóle nie trafił na listę wspólnych plików.
  - Pozostałe wspólne pliki sprawdzone:
    - `en.ts` / `pl.ts`, `design.astro`, `CLAUDE.md` i `roadmap.md` zmergują się czysto, jeśli bloki tej zmiany staną z dala od bloków S-07 (`tonight.events`, `tonight.summary.events`, `tonight.pages.events`; akapit o finder charcie w CLAUDE.md).
    - S-07 nie dotyka `smoke.mjs`, `tests/e2e/helpers.ts`, `purity.test.ts`, komponentów Targets ani `src/lib/finder/**`.
    - `targets.meteorShower.*` to przestrzeń etykiet logu (`en.ts:1060`, obok `targets.planet`), nie strona Targets.
    - S-07 edytuje `tonight-phone.spec.ts` i `fixtures/index.ts`. Ten plan powinien trzymać się od obu z daleka.
- **Poprawka**: Blok `EXPECT_*` wstawić po sekcji moonlight (po `WASHED_OUT_TYPES`, okolice `parameters.ts:393`), a eksport barrela obok `moonlight` (`index.ts:21`). Wskazać miejsce `tonight.expect` w `en.ts` / `pl.ts` (np. zaraz po `tonight.finder`). Dopisać `engine/index.ts` do listy wspólnych plików.
- **Decision**: APPLIED (author, 2026-10-14)

### F4 — `Record<ExpectationKey, string>` w `en.ts` łamie zasadę „Island-safe: no imports”

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Architecture Fit
- **Miejsce**: plan.md D-3 (ostatni niezmiennik), D-10, Faza 2 › 1. Copy › Contract
- **Szczegóły**:
  - Nagłówek `en.ts` mówi „Island-safe: no imports” (`src/i18n/messages/en.ts:10`). Żaden plik katalogu nie importuje dziś typu z silnika: `tonight.planets.note` i `tonight.moon.note` to zwykłe literały, a komplet kluczy wymusza miejsce użycia.
  - Otypowanie `phrase` jako `Record<ExpectationKey, string>` wymaga `import type` z silnika i `satisfies` wewnątrz literału `as const`. Właściwości wewnątrz literału nie da się po prostu zaadnotować.
  - W runtime to bezpieczne, ale tworzy zależność i18n → silnik, która nie ma precedensu.
- **Poprawka**: Zostawić `phrase` jako zwykły literał. Komplet kluczy zapewnią trzy rzeczy:
  - `expectationText` indeksuje `messages.tonight.expect.phrase[key]` z `key: ExpectationKey`, więc brak klucza w EN wywala `astro check`;
  - `pl satisfies Messages` pilnuje polskiego;
  - test jednostkowy sprawdza, że każdy wpis `EXPECTATION_KEYS` ma niepustą frazę w obu językach.

  Odpowiednio poprawić D-3 i kontrakt Fazy 2.
- **Decision**: APPLIED (author, 2026-10-14)

### F5 — Nieudany odczyt planu pokazuje użytkownikowi full linię „Full plan: …” i ta kopia zastępuje jego kopię offline

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🔎 MEDIUM (realny kompromis; warto się zatrzymać)
- **Wymiar**: Coverage
- **Miejsce**: plan.md D-7 („On anything else it passes nothing and renders the locked line”), O-1, O-2
- **Szczegóły**:
  - `getAccountPlan` zamienia nieudany odczyt na `free` (`src/lib/account-plan/index.ts:67-69`).
  - Użytkownik planu full, któremu odczyt się nie powiódł, dostaje więc linię, że funkcja wymaga planu full, choć ten plan ma.
  - Ta odpowiedź niesie `data-plan="unknown"` (`accountPlanForCopy`, `:78-80`). Worker commituje ją pod tym samym kluczem, więc zastępuje zapisaną kopię z liniami.
  - Sama bramka jest poprawna: bez potwierdzonego `full` żadna linia się nie pokaże. Problemem jest myląca informacja i to, że przypadek nie jest opisany.
  - Przypadek sąsiaduje z O-1 (co widzi konto free) i O-2 (utrata planu a kopie offline), które czekają na właściciela.
- **Poprawka**: Bramkę zostawić na `getAccountPlan === "full"`. Linię locked pokazywać tylko wtedy, gdy `accountPlanForCopy` zwraca `free`. Przy `unknown` nie pokazywać żadnej z linii: to tylko wyświetlanie, nigdy dostęp, zgodnie z dokumentacją `accountPlanForCopy`. Opisać przypadek w D-7.
  - **Zaleta**: Płacący użytkownik nigdy nie usłyszy, że nie ma planu, z powodu chwilowego błędu. To ten sam zapamiętany odczyt, więc bez dodatkowego kosztu.
  - **Koszt**: Druga gałąź w wyspie i jeden przypadek więcej w smoke albo w teście jednostkowym. Jeśli właściciel woli prostotę, alternatywą jest wpisanie tego jako zaakceptowane w D-7, obok O-2.
  - **Pewność**: MED. Ścieżka w kodzie jest sprawdzona, ale nie wiadomo, jak często odczyty zawodzą w produkcji.
  - **Martwe pole**: Nie sprawdzono, czy harness e2e potrafi zasymulować nieudany odczyt planu, więc test może musieć być jednostkowy.
- **Decision**: APPLIED (author, 2026-10-14)

### F6 — Kroki weryfikacji wymagają warunków, których plan nie nazywa

- **Waga**: ⚠️ WARNING
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Verifiability
- **Miejsce**: plan.md Faza 1 › Automated (1.4); Faza 4 › Automated (4.3, 4.4); D-11
- **Szczegóły**:
  - **Pogoda.** Przy pogodowym no-go ranking jest `null` (`build.ts:445`): nie ma wierszy ani linii locked. Nowe kroki smoke dla Targets wtedy się *wywalą*, bo pominięcie obejmuje tylko okno bez ciemności. CI zawsze używa fikstury prognozy all-clear (`ci.yml:51-61`). Lokalnie 4.3 i 4.4 też jej potrzebują: `FORECAST_BASE_URL` w `.dev.vars` przed `npm run build`, tak jak opisuje lekcja „whole suite”.
  - **4.4 może przejść, pomijając testy.** Bez `SUPABASE_SECRET_KEY` podanego w linii `requirePlanGrant` lokalnie pomija testy planu full (`tests/e2e/helpers.ts:180`).
  - **Filtr `what-to-expect` w tym worktree łapie wszystkie specy.** Playwright dopasowuje regex do pełnej ścieżki, a ta zawiera `.claude/worktrees/what-to-expect/`. `npx playwright test what-to-expect --list` wypisuje 58 testów w 26 plikach, czyli cały pakiet. W głównym checkoucie złapałby tylko nowy plik.
  - **1.4 jest niejednoznaczne.** Zmiana `<` na `<=` w `contrastBand` nie zmienia żadnego wyniku, bo żaden obiekt nie leży dokładnie na progu. Plan nie mówi też, czy `contrastBand` uwzględnia próg bliskości limitu. Jeśli nie, test monotoniczności tego progu nie obejmuje.
- **Poprawka**:
  - W 4.3 i 4.4 wpisać fiksturę prognozy i klucz lokalnego stosu podawany w linii, i wymagać „0 skipped”.
  - 4.4 zmienić na `npx playwright test tests/e2e/what-to-expect.spec.ts`.
  - W 1.4 nazwać konkretne zepsucie, np. odwrócenie znaku członu `EXPECT_APERTURE_GAIN_MAG`, które zaczerwieni monotoniczność względem apertury.
  - Dopisać, że test monotoniczności sprawdza pasmo po zastosowaniu progu (albo wyeksportować funkcję, która je zwraca).
- **Decision**: APPLIED (author, 2026-10-14)

### F7 — Bramka planu na Targets działa od Fazy 2, a dowód przychodzi dopiero w Fazie 4

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Verifiability
- **Miejsce**: plan.md Faza 2 › Success Criteria; Faza 4 › 1-2
- **Szczegóły**:
  - Po Fazie 2 każdy widok Targets już zależy od bramki. Każdy użytkownik e2e jest domyślnie free, więc każdy widzi linię locked.
  - Mimo to dowód przez HTTP (smoke) i test e2e przychodzą dopiero w Fazie 4, dwie fazy później.
  - Faza 2 sprawdza tylko testy jednostkowe, lint, check i build. Nie uruchamia żadnego z istniejących speców e2e dla Targets (`tonight-targets`, `tonight-phone`, `offline`).
- **Poprawka**: Przenieść oba kroki smoke dla Targets oraz testy e2e free i full do Fazy 2. Na koniec Fazy 2 uruchomić `tonight-targets`, `tonight-phone` i `offline`. W Fazie 4 zostaje asercja findera, krok po wylogowaniu, dokumentacja i cały pakiet.
- **Decision**: APPLIED (author, 2026-10-14)

### F8 — „Pasmo limit leży wewnątrz tego, co ranking zostawia” i „ten sam deficyt” są nieścisłe

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Claim Accuracy
- **Miejsce**: plan.md Key Discoveries, drugi punkt; D-2 „Why this shape”; Key Discoveries, ostatni punkt (`ranking.ts:99-117`)
- **Szczegóły**:
  - Reguła „washed out” w rankingu:
    - odrzuca obiekt tylko wtedy, gdy jest „widoczny bez Księżyca” i winny jest Księżyc (`score.ts:164-168`);
    - liczy się względem nieba *na wysokości obiektu* (masa powietrza i ekstynkcja), nie w zenicie;
    - dotyczy tylko `WASHED_OUT_TYPES`.
  - Obiekty z deficytem bez Księżyca d ≥ 3,5 nadal są więc rankowane: 12 przy B7 i 150 mm (M20, M43, IC 342 i inne) oraz 26 przy B9 (m.in. M16 i M33). Dostają `galaxyLimit` albo `nebulaFaint` bez górnej granicy d.
  - Cytat `ranking.ts:99-117` wskazuje na dokumentację interfejsu. Faktyczne wykluczenie jest w `ranking.ts:220-222`.
  - Nic się przez to nie psuje, bo obiekt washed out nigdy nie trafia do rankingu, ale uzasadnienie w planie przecenia tę zgodność.
- **Poprawka**: Poprawić punkt: to ta sama rodzina wzorów, ale z niebem w zenicie i bez Księżyca; obiekty z d ≥ 3,5 mogą być rankowane i dostają pasmo `limit`. Opcjonalnie dodać jeden taki obiekt do fikstury D-6 (np. M33 przy B9).
- **Decision**: APPLIED (author, 2026-10-14)

### F9 — Drobne nieścisłości, na które implementujący trafi w pierwszych minutach

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Claim Accuracy
- **Miejsce**: plan.md Desired End State; D-5; Faza 2 › 3-4; Faza 3 › 1; Faza 4 › 1
- **Szczegóły**:
  - **Miejsce linii.** Sformułowanie „at the top of each ranked row's details” jest nieścisłe. `ObjectDetails` nie ma własnego slotu, tylko renderuje `TargetDetails`, którego `dl` z oknem i najlepszą godziną stoi *przed* `<slot/>` (`TargetDetails.astro:44-61`). Linia będzie pierwsza w slocie, nad okularami, ale pod oknem i godziną. D-5 jest poprawne, Desired End State nie.
  - **Helper smoke.** `islandUrlFromShell` ma na sztywno `FINDER_ISLAND_PATH` (`smoke.mjs:127`), więc trzeba go uogólnić. „If needed” jest nieścisłe.
  - **Notka planety na finderze.** Loader ma tylko `locale`, bez `messages`. Planetę rozpoznaje przez `isPlanetKey(target)`. Wpis planety w widoku niesie już przetłumaczone `note` (`build.ts:855`, `TonightPlanetEntry.note`), więc najprościej użyć `entry.note`.
  - **Zawężenie typów.** `load.site` i `load.telescope` są typu `| undefined` (`load.ts:65-85`), choć widok istnieje tylko, gdy oba są ustawione. Wyspa potrzebuje strażnika.
  - **Specimen na `/design`.** `design.astro` nie ma dziś specimenu `ObjectDetails` ani `ObjectCard`. Specimen wymaga ręcznie zbudowanego `TonightEntry`.
  - **Numery linii.** `darkSkyZenithMagForBortle` jest w `parameters.ts:316-319`, nie `:316-328`.
- **Poprawka**: Poprawić te miejsca w planie: Desired End State, „if needed” → „uogólnić”, `entry.note` w Fazie 3, strażnik w Fazie 2.
- **Decision**: APPLIED (author, 2026-10-14)

### F10 — Polskie frazy przy 320 px z planem full nie są nigdzie sprawdzane

- **Waga**: 💡 OBSERVATION
- **Wpływ**: 🏃 LOW (szybka decyzja: poprawka jest oczywista i wąska)
- **Wymiar**: Coverage
- **Miejsce**: plan.md Faza 2 › Manual (2.7, 360 px); Faza 4 › 2 (test 320 px)
- **Szczegóły**:
  - `tonight-phone.spec.ts` sprawdza Targets przy 320 i 375 px w EN i PL, ale nigdy nie wywołuje `setPlan`, więc obejmuje tylko plan free i linię locked.
  - Nowy test 320 px jest tylko po angielsku, a sprawdzenie ręczne jest przy 360 px.
  - Najdłuższe frazy (np. `galaxyLimit`, `globularResolved`) po polsku, przy 320 px i z planem full, nie są sprawdzane nigdzie.
- **Poprawka**: Test 320 px w `what-to-expect.spec.ts` puścić dla obu języków, pętlą po `en` / `pl` jak w `tonight-phone`. Nie ruszać `tonight-phone.spec.ts`, który edytuje S-07.
- **Decision**: APPLIED (author, 2026-10-14)

## Komendy weryfikacyjne (krok 3)

| Komenda | Rozwiązuje się? | Wynik |
|---|---|---|
| `npx vitest run src/lib/engine/expectation.test.ts` | tak | „No test files found”: pliku jeszcze nie ma, tego należało się spodziewać |
| `npm test` / `npm run lint` / `npm run build` | tak | skrypty są w `package.json` (`vitest run`, `eslint . --max-warnings 0`, `astro build` + postbuild); nieuruchamiane, bo build zapisuje `dist` |
| `npx astro check` | tak | astro v7.3.2; nieuruchamiane |
| `npm run smoke` | tak | `node scripts/smoke.mjs`; nieuruchamiane, bo wymaga lokalnego Supabase, preview i kluczy |
| `npx playwright test what-to-expect` | tak, ale za szeroko | w tym worktree wypisuje **58 testów w 26 plikach**, bo ścieżka zawiera `what-to-expect`; zob. F6 |
| `npm run test:e2e` | tak | `playwright test`, 58 testów w 26 plikach; nieuruchamiane |
