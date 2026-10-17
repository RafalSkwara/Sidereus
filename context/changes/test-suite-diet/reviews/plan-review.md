<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Test-Suite Diet

- **Plan**: `context/changes/test-suite-diet/plan.md` (commit b22c460, oparty o 82e35cf)
- **Data**: 2026-10-17
- **Recenzent**: herdr agent `reviewer` (Opus), plus jeden read-only subagent Opus, który próbkował werdykty i piny na `origin/main` 85aa123
- **Tryb**: recenzja papierowa w trybie herdr. Ten plik jest jedynym zapisem. `change.md` is `plan_reviewed` after the triage recorded at the end of this file.
- **Faz**: 8 (0-7). **Findings**: 0 krytycznych, 6 ostrzeżeń, 3 obserwacje.

```
═══════════════════════════════════════════════════════════
  PLAN REVIEW: Test-Suite Diet
  Phases: 8  |  Date: 2026-10-17
  Findings: 0 critical  6 warnings  3 observations
═══════════════════════════════════════════════════════════

  Claim Accuracy        WARNING ⚠️   (F2, F5)
  Substance             PASS    ✅
  Feasibility           PASS    ✅
  Sequencing            WARNING ⚠️   (F1)
  Architecture Fit      PASS    ✅
  Scope Discipline      WARNING ⚠️   (F6)
  Verifiability         WARNING ⚠️   (F1, F6)
  Coverage              WARNING ⚠️   (F3, F4, F7)

  ► Overall: NEEDS ATTENTION
═══════════════════════════════════════════════════════════
```

**Werdykt w jednym zdaniu:** rubryka i podział na małe PR-y są dobre, a werdykty w próbce w większości się bronią. Przed Fazą 0 plan trzeba jednak oprzeć na nowo o `main`. S-07 i S-08 są już zmergowane, więc baza liczb, kotwice linii i cała logika Fazy 5 są nieaktualne. Kontrakt `vitest.config.ts` w Fazie 0 po cichu wyrzuciłby 71 testów S-08. Do tego kilkanaście pinów naprawionych błędów jest przycinanych bez nazwania. Ponownego `/10x-plan` nie trzeba. Wystarczy łata w triage, a obok niej decyzja właściciela o głębokości cięcia (F6).

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | WARNING | F2, F5 |
| Substance | PASS | |
| Feasibility | PASS | |
| Sequencing | WARNING | F1 |
| Architecture Fit | PASS | |
| Scope Discipline | WARNING | F6 |
| Verifiability | WARNING | F1, F6 |
| Coverage | WARNING | F3, F4, F7 |

Zweryfikowane i poprawne, bez osobnych findings:

- `end-of-turn.sh:128` to `node_modules/.bin/vitest run`. `SUMMARY` jest w `:129`.
- Stub w `agent-hooks.test.ts:62` już loguje argumenty (`echo "vitest $*"`). Asercja `:223` (`toContain("vitest run")`) przejdzie bez zmian także z `--project unit`.
- Vitest 5.0.1: `projects[].extends` ma domyślnie wartość `true`, więc alias i pool `forks` się dziedziczą.
- Liczniki `no-console-guard.test.ts:36-53`, `:174`, `:197` zgadzają się z planem.
- Generator OpenNGC jest deterministyczny: `retrievedAt` = `PINNED_COMMIT_DATE` (`build-catalogue.mjs:461, :483`), więc krok drift w CI jest wykonalny. Potrzebuje tylko `raw.githubusercontent.com`.

## Findings

### F1 — Kolejność i liczby oparte na stanie sprzed merge'u S-07/S-08

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH (szeroki zasięg: zmienia kształt faz, cele i kryteria)
- **Dimension**: Sequencing / Verifiability
- **Location**: plan.md "Current State Analysis", D8, Phase 0 (kryterium 0.1), Phase 5, Progress 0.1/5.1
- **Detail**:
  - #194 (S-07 fazy 2-6) i #193 (S-08) są na `main` od 2026-10-17 05:01/04:58. Na `main` jest 156 plików testów, 1 747 statycznych `it/test(` i 121 bloków `.each`. Przy 82e35cf było 133 pliki, 1 479 i 91.
  - Runner na `main` nie był uruchamiany, ale szacunkowo daje ok. 2 900-3 000 testów, nie 2 605.
  - Kryterium 0.1 („te same 2 605 testów”) jest więc fałszywe od startu. Cel „≤ 750” liczono od starej bazy.
  - Faza 5 („dopiero po merge'u”) przestała być fazą czekającą. Jej pliki S-07 (`tonight/build`, `load`, `forecast/service`, `open-meteo`, `finder/load`, `account-plan` ×2, `celebrate`, `redirect`, `observations/store`, `sky-checks/record`, ok. 25 nowych suit tras, store'ów i observability) można ciąć razem z ich slice'ami w Fazach 2-4.
  - Nadal otwarty jest **#195** (`fix/star-source-review`). Dotyka `stars.test.ts`, `finder-stars.test.ts`, `scripts/lib/{designations,hipparcos}.test.mjs` i `tests/e2e/landing-screenshot.spec.ts`. Tylko to musi czekać.
  - `feat/auth-loose-ends` (S-06) ma na razie tylko research. Faza 3 kasuje `session-cookie`, `protected-routes`, przycina `auth-redirect` i dodaje kroki smoke dla auth, więc S-06 to przyszły konflikt.
- **Fix**: zmierzyć bazę na nowo (`npx vitest run --reporter=json` na `main`, po projektach i plikach), wpisać ją do planu i przestawić kolejność.
  - Faza 0 od razu.
  - Fazy 1-4 obejmują też pliki S-07 swojego slice'a, z jawnymi celami (patrz F6).
  - Mała Faza 5 tylko na proweniencję gwiazd i `scripts/lib`, po merge'u #195.
  - Fazy 6-7 na końcu.
  - W notatce Fazy 3 dodać uwagę o koordynacji z S-06 (kto pierwszy, ten rebase'uje drugiego).
  - Strength: usuwa martwe czekanie i błędne kryteria. Pliki S-07 są na `main`, więc nie ma już konfliktu.
  - Tradeoff: Fazy 2-3 rosną o ok. 180 testów statycznych do oceny.
  - Confidence: HIGH (merge'e i pliki #195 sprawdzone przez `gh pr view`, liczniki policzone z `git show origin/main`).
  - Blind spot: dokładna liczba z runnera na `main` nie była mierzona.
- **Decision**: APPLIED (orchestrator, owner D8). Baseline re-measured on origin/main 85aa123: 156 files / 3,054 tests, 27.9 s cold (research "Baseline refresh"; plan "Current State Analysis"). Order: Phase 0 now; Phases 1-4 cut the S-07 files with their slices (fixed targets in the plan); Phase 5 only for the star provenance, scripts/lib and landing-screenshot after #195; Phases 6-7 last. S-06 coordination note in Phase 3 (whoever lands second rebases).

### F2 — Kontrakt Fazy 0 wypuszcza `scripts/**/*.test.mjs` z `npm test`

- **Severity**: ⚠️ WARNING (cicha utrata 71 testów, w tym pinów licencyjnych Hipparcos)
- **Impact**: 🏃 LOW (szybka decyzja, poprawka oczywista)
- **Dimension**: Claim Accuracy
- **Location**: plan.md Phase 0 › Changes Required › 1 (projekt `unit` z include `src/**/*.test.ts`)
- **Detail**:
  - Na `main` `vitest.config.ts` ma `include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"]` (S-08).
  - Projekt `unit` z planu bierze tylko `src/**`, a `guards` ma listę pięciu plików, więc `build-stars.test.mjs` (33), `designations.test.mjs` (21) i `hipparcos.test.mjs` (17) przestają się uruchamiać.
  - Faza 5 dopisuje do `guards` tylko „catalogue provenance files”.
- **Fix**: `unit.include` = `["src/**/*.test.ts", "scripts/**/*.test.mjs"]` (albo `scripts/**` w `guards`). Kryterium 0.1 ma porównywać `numTotalTests` z liczbą zmierzoną na `main` tuż przed zmianą. Do 0.4 dopisać mocniejszą asercję: `toContain("vitest run --project unit")` w `agent-hooks.test.ts:223`.
- **Decision**: APPLIED. Phase 0: `reference` include = ["src/**/*.test.ts", "scripts/**/*.test.mjs"]; criterion 0.1 compares with the count measured on main just before the change; agent-hooks "lets a clean change finish" asserts `vitest run --project reference` (projects renamed per F6/D1).

### F3 — Piny naprawionych błędów przycinane bez nazwania (D9 jest tylko ogólny)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM (dużo drobnych decyzji, każda wymaga sprawdzenia)
- **Dimension**: Coverage
- **Location**: plan.md Phases 1-5, linie per plik; „Implementation Approach” pkt 3
- **Detail**: plan mówi, że lista pinów z research jest checklistą. Kontrakty faz przycinają jednak pliki z pinami do liczby, która ich nie mieści, albo pinów nie wymieniają. Na `main`:
  - **Prawdopodobnie gubione:**
    - `tonight/format → 6` („DST labels and the headline table”) pomija `format.test.ts:53` (obcięcie głębokości Słońca) i `:72` (sformułowanie „low”).
    - `orderHints` (D2 b): `plan-order.test.ts` jest DELETE, a jedyny inny przypadek prawdziwy, `build.test.ts:1910-1923`, nie jest na liście „keep” bloku L. E2E `session-plan-edit.spec.ts:52-56` nie asertuje podpowiedzi. Po Fazach 2 i 5 reguła zostaje bez żadnego testu.
    - `agent-hooks → 7` (`:209, :218, :249, :296, :326, :451, :458`) kasuje „turn fingerprint” i „per-agent state” (`:343-426`). Są tam ewidentne piny regresji: ścieżka > 255 bajtów (`:369`), symlink do `/dev/zero` (`:379`), subagent oceniany za rodzica (`:388`). Research ich nie oznaczył.
  - **Nienazwane, ale z kandydatem na zamiennik:**
    - `toasts` DELETE: milestones F1 `:29` jest pokryte w `observing-milestones.spec.ts:174-215`.
    - `engine/sun → 9`: pin `tonightDateFor` (fb48a0f2). Która strona trzyma duplikat z night-boundaries?
    - `meteors → 14`: Phase 5 peak, F10.
    - `night-boundaries` (5 stref → 2): morning prefill, noon rollover F1.
    - `window-reference → 10` (#21 item 4), `small-scope` (G4/F5 `:114`, G6), `night-in-progress → 1`, `log-night → 12`, `milestones → 15` (plan F11).
    - Faza 5: `account-plan → 4` (F11/F4, impl F1; kotwice przesunięte o +51 w `:133`), `celebrate → 9` (F1-F4, F11), `redirect` („6 privacy cases”, a research podaje 8 kotwic z F3 `:201`), `tonight/load → 6` (D14, dawn night), `forecast/service` (10 przypadków keep-copy).
  - **Warunek do zapisania:** fold `tonight/visibility-invariants` 100 → 8 musi zachować własny test dla describe edytowanego planu (`:589-623`). To on zastępuje `plan-edits.test.ts`.
  - **Bez ukrytych pinów:** w 30 plikach DELETE/CONVERT nie ma innych pinów niż `toasts:29` i `fact-icons:25` („owner decision D4”, prezentacyjny).
- **Fix**: dodać do planu tabelę „Pin ledger” przed Fazą 1: plik → pin (tytuł describe/it, nie numer linii) → `kept` | `replaced by <test/spec/smoke>` | `dropped (owner)`. Każda linia fazy odwołuje się do tej tabeli. Zachować jeden przypadek `orderHints` i testy `agent-hooks` `:369`, `:379`, `:388` (agent-hooks → ok. 10).
  - Strength: realizuje D9 dosłownie, a implementer nie musi zgadywać.
  - Tradeoff: ok. 1-2 godz. pracy nad planem i kilka testów więcej.
  - Confidence: HIGH (każdy pin otwarty na `origin/main`).
  - Blind spot: pliki z werdyktem TRIM bez pinów w research były próbkowane, nie czytane w całości.
- **Decision**: APPLIED. Plan section "Pin ledger (F3, D9)": file -> pin title -> kept | replaced by | dropped (owner). orderHints keeps one case in plan-editor.test.ts; tonight/visibility-invariants keeps the edited-plan describe as its own test; agent-hooks keeps the three regression pins (path > 255 bytes, /dev/zero symlink, subagent vs parent) -> 10 tests; format keeps the sun-depth truncation and low-wording pins.

### F4 — Faza 6 kasuje `landing.spec.ts`, który od S-08 pinuje „Credit: ESA”

- **Severity**: ⚠️ WARNING (przypinka licencyjna przy otwartej decyzji ESA)
- **Impact**: 🏃 LOW (szybka decyzja, poprawka oczywista)
- **Dimension**: Coverage
- **Location**: plan.md Phase 6 › 2 („delete `landing.spec.ts`, `landing-screenshot.spec.ts`…”)
- **Detail**:
  - Na `main` `landing.spec.ts` (+48 linii z S-08) sprawdza, że stopka ma „Credit: ESA” i cytowanie Hipparcos.
  - Sprawdza też, że stopka zawija się bez przewijania w bok przy 320/360 px po EN i PL. To jedyna przeglądarkowa ochrona kredytu, którego ESA zażądało.
  - Research (82e35cf) widział tylko CTA i 302, więc werdykt „TRIM → smoke” jest nieaktualny.
  - `landing-screenshot.spec.ts` zmienia też #195.
- **Fix**: zostawić testy ESA/stopki z `landing.spec.ts`. Do smoke przenieść tylko CTA hrefs i 302 signed-in. Przeniesienie `landing-screenshot` do skryptu zrobić po merge'u #195 i poprawić komendę w CLAUDE.md (sekcja Landing).
- **Decision**: APPLIED (owner D5). landing.spec.ts keeps the ESA credit and the 320/360 px footer test; only the CTA and signed-in 302 tests move to smoke (steps 7, 8 in Phase 3). landing-screenshot moves to a script in Phase 5, after #195, with the CLAUDE.md Landing command updated.

### F5 — Kotwice linii w research są błędne lub przesunięte

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (szybka decyzja, poprawka oczywista)
- **Dimension**: Claim Accuracy
- **Location**: plan.md Phase 1 › 3 (`finder → 30 (keep the brute force :428, :546, :652…)`); research §2.2 (bloki `build.test`), §2.4
- **Detail**:
  - `finder.test.ts` nie zmienił się od 82e35cf, a mimo to `:428`, `:546` i `:652` to test planety, test „facing” i fallback zenitu. Brute force to jeden test w `:791` (describe `:780`, „agrees with a brute-force enumeration of every simple route on 150 skies”). Opublikowane hopy są w `:914`, piny zenith-edge w `:619-691`.
  - S-07 przesunął wszystkie kotwice `build.test.ts` o +26 (np. `:1927` → `:1953`), `load.test.ts` o +5, `finder/load:105` → `:110`, `observations/store:73` → `:76`.
- **Fix**: w planie i notatkach faz wskazywać testy tytułem describe/it, nie numerem linii. Poprawić kotwicę finder na „random skies against an exhaustive search”.
- **Decision**: APPLIED. The plan references every test by describe/it title (ledger and phase contracts); the finder anchor reads "agrees with a brute-force enumeration of every simple route on 150 skies" and "published hops (D-11)". Research line anchors stay as of 82e35cf and are labelled so in the Baseline refresh.

### F6 — Plan mógłby ciąć głębiej, a cele S-07 i `scripts/lib` są nieustalone

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH (strategia: zgodność z intencją właściciela)
- **Dimension**: Scope Discipline / Verifiability
- **Location**: plan.md Overview, Desired End State, D1, Phase 1-5 cele per plik; Phase 5 › 3 („exact counts are set in this phase's note”)
- **Detail**:
  - Właściciel napisał: „w ogóle nie potrzebujemy testów jednostkowych”. Plan zostawia ok. 27 % suity, a wiele plików „KEEP z lekkim trimem” zostaje blisko pełnego rozmiaru: `verdict` 29, `finder` 30, `events` 25, `build` 37, `offline/copies` 58, `milestones` 15, `degraded-forecast` 18, `tonight/night-boundaries` 30.
  - Według tej samej rubryki „cecha/niezmiennik/pin, nie implementacja” i bez utraty jakiegokolwiek oracle'a referencyjnego, pinu prywatności lub licencji, niezmienników Risk #1/#2/#3 i nazwanych pinów, realny poziom to **ok. 380-450**. Przykłady:
    - `verdict` ok. 12 (missing-hour i fallback są już relacjami w `degraded-forecast` i `forecast-honesty`).
    - `finder` ok. 14 (tie-breaki kosztu `:207-275` i mechanika hopów są zawarte w oracle brute force).
    - `offline/copies` ok. 28 (tabele rozpoznawania `:83-306` składają się w pętle).
    - `milestones` 6, `log-night` 4, `build` ok. 20, `forecast/service` z logami S-07 ok. 12, `night-boundaries` 8, `window-reference` 3.
    - Suity tras, store'ów i observability z S-07 (ok. 180 statycznych + `.each`) ok. 25. `scripts/lib` (71) ok. 10.
  - Faza 5 nie ma liczb, więc kryterium 5.1 („≤ 750”) nie da się sprawdzić per plik.
  - Do tego nazwa projektu `unit` utrwala to, czego właściciel nie chce.
- **Fix A ⭐ Recommended**: cel ≤ 450 i stałe cele per plik w planie, także dla plików S-07 i `scripts/lib`. Projekty nazwać `reference` (oracle'e, niezmienniki PRD, piny prywatności, licencji i błędów, uruchamiane przez hook i CI) oraz `guards` (tylko CI). Wtedy „testów jednostkowych implementacji” nie ma, a to, co zostaje, ma nazwany powód.
  - Strength: najbliżej słów właściciela, a ochrona z research §4 zostaje cała.
  - Tradeoff: więcej pracy przy foldowaniu w Fazach 1-3 i większe ryzyko przeoczenia pinu, dlatego najpierw ledger z F3.
  - Confidence: MED (szacunki per plik z próbki, nie z pełnego odczytu).
  - Blind spot: niezmierzone czasy po głębszym cięciu (zysk dla hooka jest już głównie w przeniesieniu guards).
- **Fix B**: zostawić 650-750 jak w planie, ale dopisać cele dla S-07 i `scripts/lib` i zmienić nazwę `unit` → `reference`.
- **Decision**: DECLINED by the owner (D1): the author's plan stands, about 700-820 tests on the new base (the same cut ratio as 650-750 on the old one). Taken from Fix B: fixed per-file targets for the S-07 suites (about 450 -> about 110) and scripts/lib (71 -> about 12, exact after #195), and the projects renamed `reference` / `guards` at no cost.

### F7 — Funkcje, które zostaną bez żadnego testu, nie są nazwane jako akceptowane

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW (szybka decyzja, poprawka oczywista)
- **Dimension**: Coverage
- **Location**: Phase 3 › 2 (`compass`, `preferences`, `gear/schemas`), Phase 6 › 2 (`tonight-sky` t4-t7)
- **Detail**:
  - Mapowanie 16 kierunków (`compass`) ma jedyne e2e w `tonight-sky.spec.ts:258` (t6), a Faza 6 tnie t4-t7.
  - Negocjacji `Accept-Language` i rocznego cookie (`preferences.test.ts:28-72`) nie testuje nic innego.
  - Brak echa długości geograficznej (`gear/schemas.test.ts:65`) trzyma tylko konstrukcja „komunikaty to klucze”, a smoke ma tylko `latitude 95`.
  - To zgodne z intencją właściciela, ale nie są to duplikaty, tylko świadome odsłonięcie.
- **Fix**: wpisać te trzy jako „dropped (owner)” w ledgerze z F3 i w test-plan §7, albo zostawić `tonight-sky` t6.
- **Decision**: APPLIED (owner D5, D9). Recorded as dropped (owner) in the ledger and for test-plan §7 in Phase 7: the compass mapping (unit test and tonight-sky "the compass row marks..." removed), Accept-Language negotiation and the one-year cookie (preferences), the longitude echo in schema messages (error-key construction prevents it; smoke pins latitude 95 and the Phase 3 coordinate steps), plus the committed catalogue JSON shape (D7).

### F8 — Redukcja stref w night-boundaries: UTC + Warszawa to dwie strefy po tej samej stronie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW (szybka decyzja, poprawka oczywista)
- **Dimension**: Coverage
- **Location**: Phase 1 › 2 (`night-boundaries` 130 → 26, „UTC and Europe/Warsaw”); Phase 3 › 3 (`log-night`, usunięcie `describe.each(RUNNER_ZONES)`)
- **Detail**:
  - `runner-zone-guard.test.ts:19-22` sam wymienia luki, których statycznie nie łapie: `toLocaleString()`, niejawne `${date}`, `new Date(d + "T20:00")` i spread.
  - Tabele stref procesu w runtime są jedyną ochroną tych klas błędów.
  - UTC i Warszawa (+1/+2) nie trafią w błędy strefy procesu za UTC ani przy +13/+14.
- **Fix**: zostawić dwie strefy o przeciwnych znakach z `RUNNER_ZONES` (np. ujemną amerykańską i +13/+14), a nie UTC + Warszawa. `log-night` może zostać w jednej strefie, bo `night-boundaries` trzyma regułę.
- **Decision**: APPLIED. Engine and tonight night-boundaries run under America/Los_Angeles (-7/-8) and Pacific/Kiritimati (+14); log-night runs in one zone (America/Los_Angeles).

### F9 — Dokumenty i tripwire'y: brakuje kilku pozycji w listach „Docs” faz

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW (szybka decyzja, poprawka oczywista)
- **Dimension**: Coverage
- **Location**: Phase 2/4/5/6 › Docs
- **Detail**: CLAUDE.md na `main` wskazuje jako egzekucję m.in.:
  - `finder-stars.test.ts` („the same test scans for it”). Faza 5 kasuje ten skan, więc tripwire musi wskazać `build-sw.mjs:89-121`.
  - `messier`/`caldwell.test.ts` („assert their shape and provenance”). Faza 4 musi zmienić tekst na „provenance + CI drift check”.
  - `tests/e2e/landing.spec.ts` (F4), `TonightSkyView.test.ts`, `fact-islands.test.ts` i `nav-type-roles.test.ts` (Faza 2 to ma).
  - `rhythm-roles` („counts are exact”, Faza 4 zachowuje), `small-scope.test.ts (G1-G6)` (fold zachowuje G-nazwy?), `navigation.test.ts` (zostaje 1).
  - test-plan §5 wiersz end-of-turn („whole unit suite”, Faza 0 ma) i §6 listy `runner-zone-guard`, `log-night`, `load.test`.
  - Przeniesienie colour, rhythm i runner-zone guards do `guards` (tylko CI) oznacza, że agent dowie się o kolorze hex dopiero w CI. Akceptowalne, ale warto to zapisać w §5.
- **Fix**: w każdej fazie „Docs” zastąpić prozę wynikiem `grep -rn '<usuwany plik>' CLAUDE.md context/foundation/` dołączanym do notatki fazy.
- **Decision**: APPLIED. Every phase has a Docs item listing the files the grep found (CLAUDE.md tripwires for messier/caldwell -> "provenance; the shape is the generator's", stars/finder-stars -> build-sw.mjs; UI section guard names; test-plan §5/§6 rows; error-visibility.md; the ESA assessment and roadmap mentions get a dated note). Phase notes paste the grep output. The CI-only reporting of the colour, rhythm and runner-zone guards is recorded in §5 (Phase 0 docs).

## Komendy weryfikacyjne

| Komenda z planu | Stan |
| --- | --- |
| `npm test`, `npm run lint`, `npx astro check` | istnieją (`package.json:17`, CI `ci`) |
| `npm run test:unit`, `npm run test:guards`, `vitest run --project unit` | jeszcze nie istnieją, tworzy je Faza 0 (oczekiwane) |
| `npx vitest list --config vitest.db.config.ts`, `npx playwright test --list`, `npm run smoke`, `npm run catalogue:build` | istnieją; nieuruchamiane (smoke i db wymagają lokalnego Supabase, `catalogue:build` zapisuje pliki) |
| krok CI drift OpenNGC | wykonalny: generator deterministyczny, sieć do `raw.githubusercontent.com` |

## Rekomendacje do dziewięciu pytań właściciela (plan-brief)

1. **D1, strażnicy i suity referencyjne:** zostawić obie grupy. Suity referencyjne silnika (Skyfield/Stellarium/USNO, kalibracja, niezmienniki PRD) i strażników prywatności i licencji (no-console, wrangler, log-failure, silent-catch, red-theme, contrast, no-hardcoded-colors, proweniencja) wymaga sam PRD i nic innego ich nie zastępuje. Ciąć je jednak głębiej (F6, łącznie ≤ 450) i nazwać projekt `reference`, nie `unit`. Wtedy „testów jednostkowych” w sensie właściciela nie ma.
2. **D2, hook:** cały projekt `reference`/`unit`, bez `guards`. Po diecie to kilka sekund, a `vitest related` przepuszcza regresje między plikami, czyli to, przed czym chronią niezmienniki.
3. **D3, testy S-07:** ta sama rubryka i **od razu**, bo S-07 jest zmergowany. Zostaje po jednym przypadku `errors.serverFault`, jednym RLS-notice i jednym kształcie linii logu na rodzinę tras, plus tabela `fault` i „never printed” z `log-failure`. Choreografia mocków znika (ok. 25 z ok. 180). Cele wpisać do planu (F6).
4. **D4, smoke (10 + 2 kroki):** tak. Każdy krok odmowy musi mieć odczyt zwrotny „nic nie zapisano” (np. `bodyExcludes` na `/log`), a kroki auth trzeba uzgodnić z S-06 (F1).
5. **D5, e2e:** tak, z dwoma wyjątkami: zostawić testy „Credit: ESA” i stopki z `landing.spec.ts` (F4) i świadomie zdecydować o `tonight-sky` t6, czyli kompasie (F7). `landing-screenshot` dopiero po #195.
6. **D6, baza:** tak. `account-plan-command` 21 → ok. 6 i tabele gramatyki do kilku wierszy. `isolation`, `structure` i RPC bez zmian.
7. **D7, proweniencja:** tak. Krok drift OpenNGC w CI jest wykonalny (deterministyczny `retrievedAt`). Piny licencyjne gwiazd („Credit: ESA”, `PINNED_SHA256` `hip_main.dat`, `HIPPARCOS_FIELDS_USED`, budżet gzip) zostają jako testy, ale dopiero po merge'u #195, który zmienia te pliki.
8. **D8, kolejność:** nieaktualna. Nowa: Faza 0 od razu. Fazy 1-4 razem z plikami S-07 swoich slice'ów. Mała faza na proweniencję gwiazd i `scripts/lib` po #195. Na końcu e2e/db, potem dokumenty. Każda faza to osobny PR z ledgerem pinów (F3).
9. **Zaokrąglenie do 0,01°:** reguła produktu, bez osobnego pinu (e2e `site-location` i `site-map` sprawdzają zaokrąglony zapis). W ledgerze trzeba jednak zapisać, że po usunięciu `gear/schemas` brak echa długości geograficznej trzyma tylko konstrukcja kluczy (F7).

## Triage summary

Triaged 2026-10-17 by the owner (D1-D9, relayed by the orchestrator) and applied by the author in plan.md (commit after this file). F1-F5, F7-F9 applied; F6 declined (the author's cut depth stands; Fix B's targets and project names taken). The plan was rebased onto origin/main 85aa123 and the baseline re-measured. `change.md` is `plan_reviewed`.
