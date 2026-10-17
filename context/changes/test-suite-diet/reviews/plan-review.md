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

| Dimension        | Verdict | Findings   |
| ---------------- | ------- | ---------- |
| Claim Accuracy   | WARNING | F2, F5     |
| Substance        | PASS    |            |
| Feasibility      | PASS    |            |
| Sequencing       | WARNING | F1         |
| Architecture Fit | PASS    |            |
| Scope Discipline | WARNING | F6         |
| Verifiability    | WARNING | F1, F6     |
| Coverage         | WARNING | F3, F4, F7 |

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
- **Decision**: APPLIED. Phase 0: `reference` include = ["src/**/\*.test.ts", "scripts/**/*.test.mjs"]; criterion 0.1 compares with the count measured on main just before the change; agent-hooks "lets a clean change finish" asserts `vitest run --project reference` (projects renamed per F6/D1).

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

| Komenda z planu                                                                                                          | Stan                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `npm test`, `npm run lint`, `npx astro check`                                                                            | istnieją (`package.json:17`, CI `ci`)                                                               |
| `npm run test:unit`, `npm run test:guards`, `vitest run --project unit`                                                  | jeszcze nie istnieją, tworzy je Faza 0 (oczekiwane)                                                 |
| `npx vitest list --config vitest.db.config.ts`, `npx playwright test --list`, `npm run smoke`, `npm run catalogue:build` | istnieją; nieuruchamiane (smoke i db wymagają lokalnego Supabase, `catalogue:build` zapisuje pliki) |
| krok CI drift OpenNGC                                                                                                    | wykonalny: generator deterministyczny, sieć do `raw.githubusercontent.com`                          |

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

## Amendment review (Phase 6)

Reviewer: herdr `reviewer` (Opus), 2026-10-17. Scope: only the owner-approved amendment in `392f76e` (Phase 6 "Clock-pinned e2e" and the renumbering to 7 and 8). Read from `origin/test-diet/phase-1` with `git show` / `git grep`; nothing was run.

**Verdict: REVISE.** The design is right in its main idea. `page.clock` alone is not enough, a server seam is needed, and the "loopback `SUPABASE_URL`" guard is safe. As written, though, the phase will not reach green: the forecast fixture and the service worker stay on the real clock (A1, A2). The three-hour criterion contradicts the explicit pins (A3), and the guard is red on day one and also lets the existing skips through (A4). All of these can be fixed in the plan text before implementation starts.

### Odpowiedź na pytanie otwarte (szew)

**Akceptuję szew.** E2E testuje ten sam build produkcyjny, który idzie na produkcję, więc flaga z czasu builda niczego by nie odróżniła. Właściwym sygnałem jest `SUPABASE_URL` (`astro:env/server`, `src/lib/supabase.ts:4`), bo na produkcji to hostowany projekt, ustawiony przez operatora, a nie przez odwiedzającego. Warunki: porównywać `new URL(SUPABASE_URL).hostname` dokładnie z `127.0.0.1`, `localhost` i `::1` (bez `startsWith` i `includes`). Ciasteczko ma wpływać tylko na odczyty, które wyznaczają noc. Znaczniki metadanych zostają realne (`session-plans/store.ts:54` `updated_at`, `account-plan/index.ts:52-65`). Test jednostkowy z przypadkiem hostowanym i zniekształconym zostaje, jak w planie.

### A1 — Fixture prognozy nie pokryje przypiętych chwil (BLOKER, CONFIRMED)

- `tests/e2e/forecast-fixture.mjs:15` buduje godziny od `Date.now()`. `src/lib/forecast/service.ts:107-114,218-224` sprawdza kompletność i okno względem wstrzykniętego `now`, czyli po zmianie względem `serverNow`. Gdy noc jest przypięta do stałej daty, a `FIXTURE_NOW` ma domyślnie realną godzinę, każda prognoza będzie „incomplete” i Tonight nie da werdyktu „go”.
- Jedno `FIXTURE_NOW` na proces też nie wystarczy. Scenariusze per test na inne daty (`noDarkness` 21 czerwca, `fullMoonEvening`) leżą poza oknem −48/+216 h. Zmiana `E2E_CLOCK` wymagałaby restartu fixture, a CI go nie restartuje.
- **Fix**: scenariusze trzymać w jednym module `.mjs` (np. `tests/e2e/clock-scenarios.mjs`), który importują helper i fixture. Fixture serwuje posortowaną sumę okien −48/+216 h wokół każdego scenariusza i realnej godziny, bez zmiennej środowiskowej. Przed decyzją sprawdzić, że parser (`open-meteo.ts:~102`) i `isCompleteForecast` przyjmują nieciągłą serię. Jeśli nie, fixture serwuje ciągły zakres od najwcześniejszego do najpóźniejszego scenariusza (rok godzin to około 9 tys. punktów, co jest akceptowalne). To samo dotyczy smoke z ciasteczkiem `civilDawn` i `noDarkness`.

### A2 — Service worker zostaje na realnym zegarze (BLOKER, CONFIRMED w kodzie; zasięg `page.clock` PLAUSIBLE)

- `src/sw.ts:169,454,673,806` (`expire`, `needsNextCopy`, `chooseCopy`, `listCopies`) i `:160-165,329` czytają realny `Date`. Kopię offline renderuje serwer (`OfflineCopy.astro:35` `preparedAt`, `data-night-date` z przypiętego `view.date`). Kopia z przypiętej, przeszłej nocy wygaśnie w SW od razu albo nie zostanie wybrana. `page.clock` wstrzykuje się do ramek strony, a według mojej wiedzy nie do service workera; trzeba to potwierdzić jednorazową sondą. `OfflineCopy.astro` i `offline/page-state.ts` nie ma na liście wywołań w pozycji 1.
- Dotyczy to `finder-offline` (na liście konwersji), `offline.spec` i `service-worker-control`.
- **Fix**: specy SW i offline jawnie zostają na realnym zegarze, z oczekiwaniami czytanymi z danych strony (`data-night-date`, stan kopii). `finder-offline` zamiast pomijać w oknie bez ciemności używa obiektu, który ma wiersz w każdą noc, albo sprawdza „settles on a defined state” jak `what-to-expect`. Ma to zgadzać się z regułą Fazy 7 „every service-worker spec untouched”. W planie trzeba dopisać klasyfikację odczytów zegara: „wyznacza noc → `serverNow`”, „metadane lub SW → realne, z powodem”.

### A3 — Semantyka `E2E_CLOCK` kontra jawne piny; kryterium 6.1 jest niespójne (MAJOR)

- Kryterium „cały suite zielony przy `E2E_CLOCK=civilDawn`” stoi w sprzeczności z pozycją 3: testy wymagające edytowalnego planu albo widocznej planety mają asercje warunków wstępnych, więc przy `civilDawn` i `deepNight` muszą być czerwone. Pinują `evening` jawnie, czyli `E2E_CLOCK` ich nie dotyczy, ale plan tego nie mówi.
- **Fix**: zapisać, że `E2E_CLOCK` zmienia tylko domyślny scenariusz testów bez jawnego pinu, a jawne piny wygrywają. Kryterium 6.1 brzmi wtedy: „testy bez jawnego pinu zielone przy trzech godzinach; jawne `civilDawn` (`held`) i `deepNight` są w zwykłym przebiegu”. Dzięki temu klasa #198 jest pokryta w CI za darmo, bez macierzy. W notatce fazy wypisać, które specy są agnostyczne wobec godziny.

### A4 — Strażnik: fałszywe alarmy i przecieki (MAJOR, CONFIRMED)

- Fałszywe alarmy od pierwszego dnia: `forecast-fixture.mjs:15` (`Date.now()`, a skan obejmuje `*.mjs`) i `offline.spec.ts:121` (`waitForTimeout(1000)`). `offline.spec` nie ma na liście pozycji 3, a Faza 7 każe nie ruszać speców SW.
- Przecieki: obecne pomijania mają postać `if (…) test.skip(true, …)` (`moon-as-target:38`, `moon-card:36`, `planets-on-tonight:39,94`). Warunek nie jest w wywołaniu, więc reguła „condition mentions a date or locator” ich nie złapie. Nie łapie też `test.fixme`, `testInfo.skip` ani wcześniejszego `return` (`tonight-sky:159` `if (!marker) return;`). Wykrywanie „spec odwiedza `/tonight`” po literale nie widzi helperów (`openSky`, rejestracja kończąca się na `/tonight`).
- Odczyt zegara po stronie Node w specu (`tonight-sky:139`, przycisk „Now”) przy przypiętej przeglądarce porównuje dwa różne zegary.
- **Fix**: strażnik oparty na liście dozwolonych zamiast heurystyk. Zakazać każdego `test.skip`, `test.fixme` i `testInfo.skip` poza nazwaną listą pomijań środowiskowych (`requirePlanGrant`, `CAPTURE_LANDING`). Przypinanie zrobić jako automatyczną fixture w `helpers.ts` (`test.extend` z opcją `clock`, domyślnie `evening`, rezygnacja przez `test.use({ clock: "real" })` z komentarzem powodu). Strażnik sprawdza wtedy tylko, że spec importuje `test` z `./helpers`, a nie z `@playwright/test`. Jawnie wyłączyć `forecast-fixture.mjs` i `offline-proxy.ts`. `waitForTimeout` w `offline.spec` zamienić na `expect.poll` albo dopisać go do listy dozwolonych z powodem. Helper udostępnia `pinnedNow()` do asercji po stronie Node.

### A5 — Interakcja z Fazą 7: konwersje do kosza (MEDIUM)

- Faza 6 konwertuje testy, które Faza 7 kasuje: `what-to-expect` t1/t2/t4 (3 z 4 pomijań `inNoDarknessWindow`), `finder-chart` t1/t4, `tonight-sky` t4-t7 (w tym pomijania markerów `:158,:170`), `tonight-targets` t2/t3, `planets-on-tonight` t2, `session-plan-edit` t2/t5/t7, a `moon-as-target` jest scalany.
- **Fix**: Faza 6 zaczyna od samych usunięć z pozycji 2 Fazy 7 (bez scaleń), z wierszami ledgera, i konwertuje tylko testy, które przeżyją. Ewentualnie przenieść te usunięcia do Fazy 6 jawnie. Kolejność „pin przed trimami” zostaje dla scaleń.

### A6 — #198 nie jest zmergowany (MEDIUM, CONFIRMED: `gh pr view 198` OPEN)

- Na gałęzi `tonight-sky.spec.ts:132-150` nadal liczy „Now” z realnego `new Date()`. Faza 6 musi wyjść z main po #198 albo go wchłonąć, a asercja „Now” ma liczyć od `pinnedNow()`.

### A7 — Drobne (MINOR)

- `page.clock.install` musi być wywołane przed `goto`. Zegar jest wspólny dla kontekstu i po instalacji płynie, więc `resume()` jest najpewniej zbędne (do sprawdzenia, nieszkodliwe).
- Stała data scenariuszy musi leżeć w zakresie danych (katalog zdarzeń `sky-events`, efemerydy). Zapisać rok i dodać test helpera, który tego pilnuje, inaczej problem wróci jako wygasające dane.
- Baza: `record_sky_verdict` aktualizuje tylko przy `pg_catalog.now() < existing.dark_start` (`20261003120000_sky_checks.sql:104-105`), co plan poprawnie zostawia realne. Przy przeszłej stałej dacie pierwszy zapis wchodzi, kolejne widoki go nie nadpisują. Warto zapisać to w notatce, bo nie jest to błąd. Auth Supabase działa tylko po stronie serwera (bez `createBrowserClient` w przeglądarce), więc przypięta przeglądarka go nie dotyka.
- Kryterium 6.2: `grep -rn 'test.skip' tests/e2e` pokaże też `helpers.ts:188` i komentarz `helpers.ts:206`. Trzeba wpisać dokładnie oczekiwane wyjście.
- Przeglądarka nie ma `timezoneId` (CI to UTC, lokalnie Warszawa). Chwile ISO są absolutne, więc nie ma to wpływu na stan, ale warto ustawić `timezoneId: "Europe/Madrid"` dla spójnych etykiet.

### Koszt CI

- Pomijalny przy domyślnym scenariuszu w CI: jedna instalacja zegara na test, a strażnik to milisekundy w `guards`. Konwersja pomijań na zawsze wykonywane testy dodaje około 15 faktycznie uruchamianych testów w dni, w które wcześniej je pomijano (rzędu kilkunastu sekund). Nie ma macierzy CI. Pokrycie `civilDawn`/`deepNight` daje A3, a przebieg trzygodzinny zostaje lokalnym, zapisanym w notatce (3 × `--repeat-each 2` to około 6× czas e2e lokalnie).

### Weryfikowalność kryteriów

| Kryterium                                             | Stan                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 6.1 trzy godziny                                      | niespójne, dopóki nie wejdzie A3; po A3 sprawdzalne                                               |
| 6.2 zero pomijań warunkowych                          | sprawdzalne po doprecyzowaniu oczekiwanego wyjścia grep (A7)                                      |
| 6.3 strażnik + 3 break checki                         | sprawdzalne; dodać break check `if (x) test.skip(true)` i import `test` z `@playwright/test` (A4) |
| 6.4 `serverNow` + smoke przy `civilDawn`/`noDarkness` | sprawdzalne po A1 (fixture)                                                                       |
| 6.6 decyzja właściciela                               | sprawdzalna; rekomendacja: zaakceptować szew i domyślny scenariusz w CI                           |

### Amendment triage (2026-10-17)

Applied by the implementer in plan.md Phase 6: A1 (one scenario module, the fixture serves the union of windows; parser and `isCompleteForecast` checked: gaps accepted), A2 (service worker and offline specs stay on the real clock, every clock read classified), A3 (`E2E_CLOCK` changes only the default, explicit pins win, 6.1 rewritten), A4 (allowlist guard, automatic fixture through `test.extend`, `./helpers` import), A5 (Phase 7's pure deletions first), A6 (base on main after #198), A7 (fixed date range plus helper test, exact grep output, `timezoneId`). Owner decision 6.6: the seam is accepted (exact loopback hostname) and CI runs the default scenario.
