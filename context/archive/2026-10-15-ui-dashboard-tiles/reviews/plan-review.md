<!-- PLAN-REVIEW-REPORT -->
# Plan review: ui-dashboard-tiles

- **Plan**: `context/changes/ui-dashboard-tiles/plan.md` (commit e5e654e na main 42ce808, branch `feat/ui-dashboard-tiles`)
- **Data**: 2026-10-15
- **Recenzent**: herdr agent "reviewer" (Opus); dwa podagenty Opus (weryfikacja twierdzeń; wykonalność, kolejność i pokrycie)
- **Fazy**: 3, nic nie zaczęte (brak `- [x]` w Progress)
- **Wynik**: 0 krytycznych, 7 ostrzeżeń, 3 obserwacje
- **Decyzje D1-D7**: plan oceniony na domyślnych odpowiedziach agenta. Gdzie inna odpowiedź właściciela zmienia plan, mówi o tym sekcja „Wpływ odpowiedzi D1-D7”.
- **change.md**: nie zmieniony. Orkiestrator pozwolił zapisać tylko ten plik, więc status zostaje `planned`.

```
═══════════════════════════════════════════════════════════
  PLAN REVIEW: Dashboard tiles on the rhythm roles and shared facts
  Phases: 3  |  Date: 2026-10-15
  Findings: 0 critical, 7 warnings, 3 observations
═══════════════════════════════════════════════════════════

  Claim Accuracy        PASS    ✅   (drobne numery linii: F10)
  Substance             PASS    ✅
  Feasibility           WARNING ⚠️   (2 findings: F4, F7)
  Sequencing            PASS    ✅
  Architecture Fit      PASS    ✅   (1 observation: F9)
  Scope Discipline      PASS    ✅
  Verifiability         WARNING ⚠️   (3 findings: F2, F3, F6)
  Coverage              WARNING ⚠️   (4 findings: F1, F5, F8, F10)

  ► Overall: NEEDS ATTENTION
```

Plan jest rzetelny i wykonalny w kolejności, w jakiej go napisano. Twierdzenia o kodzie się potwierdzają (ok. 30 sprawdzonych, żadne nie jest WRONG w sposób blokujący fazę). Allowlisty strażnika rytmu pasują co do sztuki do plików po edycjach, co sprawdziłem symulacją regexów strażnika na `experiment.diff`. Każda faza zostawia repozytorium zielone.

Uwagi dotyczą głównie tego, **jak** sprawdzić wynik:
- metody pomiaru min-height (F3);
- deterministycznego testu D4/D7 (F2);
- wiersza kontrastu (F4);
- kadru obrazu na landingu (F5);
- nieuruchamialnych linii weryfikacji (F6).

Do tego dochodzi jedna luka pokrycia, która dotyczy pierwszego ekranu telefonu (F1). Nic z tego nie wymaga ponownego `/10x-plan`.

## Kontrole zlecone przez orkiestratora

| Kontrola | Wynik |
|---|---|
| Reguła 2B (bez ikon w nagłówkach kafli) | **OK.** Żadna faza nie dodaje ikony do nagłówka. „Tile gains an icon prop” jest jawnie odrzucone. D5 (domyślnie bez ikony w linii kafla Events) trzyma pulpit tekstowym. |
| Role rytmu z #167 i ponowne użycie Fact/StatCard | **OK.** `py-item` / `line` / `group` są zgodne z ui-fact-rhythm. `cn()` zna role (`utils.ts:14`; `cn("mt-line","mt-group")` daje `mt-group`). Powód na kaflu Planets to ten sam `Fact kind="why" tone="muted"` co `PlanetCard.astro:78-80`. `StatCard`/`StatPair` nie występują na pulpicie, więc nie ma czego dostosować. |
| Werdykt: re-pomiar `VERDICT_MIN_HEIGHT_CLASS`, szkielet, brak skoku | **Arytmetyka OK.** Przy 640 px wychodzi 236 + 12 = 248 px, czyli `sm:min-h-62`. Przy 360 px linia prognozy fresh jest ukryta, więc `min-h-42` zostaje. Paski werdyktu w szkielecie dają 248 px od `sm`. Werdykt, szkielet i min-height zmieniają się razem w Fazie 2, więc nie ma przejściowego skoku. **Słabe punkty**: metoda pomiaru nie da się uruchomić skryptami z planu (F3), a noce z prognozą fallback/none i noce no-go rosną na telefonie (F1). |
| Phone-first `tonight-phone.spec.ts` (390×844) | **OK dla nocy go z prognozą fresh.** Wartości 149/701/746 przy TabBar 779 zostają, bo date→h2 to nadal 8 px, a kafle są pod zgięciem. `data-verdict-event` trafia na korzeń `Fact`, bo `Fact.astro:27,30,35` rozkłada atrybuty `data-*` na korzeń, więc `display:none` chowa ikonę razem z tekstem. Test pierwszego ekranu jest jednak tylko EN (F10), a noce fallback/no-go nie są przypięte (F1). |
| S-07: kafel Events i linia werdyktu, w tym linia bezpieczeństwa zaćmienia | **OK.** `eventsVerdictLine` opisuje `events.tonight[0]` (`sky-events.ts:340-358`), zaćmienia Słońca są sortowane na początek (`:307`), więc `eventsVerdictKind` = `tonight[0]?.kind` zawsze opisuje to samo zdarzenie co tekst, także przy „+1 more”. Regex `VERDICT_LINE_START` z `^` przeżywa opakowanie w `Fact`: skompilowany HTML nie ma białych znaków przed tekstem, a svg nie ma tekstu. Kafel Events dostaje tylko przesunięcie `mt-line`. **Brakuje deterministycznego testu D4/D7** (F2). |
| S-08: kafel Plan | **OK.** Logika edytowanego planu (`TonightTiles.astro:52-64`, D13) nie jest dotykana. Zmienia się tylko klasa przy `:149`. `session-plan-edit` i `session-plan-store` nie czytają kafla Plan na pulpicie. |
| Kontrast bursztynowej ikony w trzech motywach | **Przechodzi wszędzie, gdzie werdykt się renderuje.** Minima `--marginal` na zenith/horizon/dusk: dark ≥ 6,62, night (light theme w zakresie `night-sky`) ≥ 6,09, red ≥ 3,49. Wiersz z planu zawiera jednak zwykłe `light`, które werdyktu nie dotyczy i przechodzi o włos (3,0006), patrz F4. W red `--marginal` #d60000 to prawie `--muted-foreground` #c40000, więc znaczenie niesie kształt trójkąta, tak jak już dziś w `SkyEventList`. |
| Zrzut landingu | **Do poprawy.** Kadr 1280×1125 nie kończy się już na linii pierwszego kafla (F5). |
| Delegowanie per faza | **Zgodne z regułą właściciela.** UI idzie do Opus high (komponenty, szkielet, `/design`, strażnik, kontrast, e2e, re-pomiar). Helper `eventsVerdictKind` idzie do Sonnet high, dokumenty i zrzuty do Sonnet medium, a bramki i ocena zrzutów zostają w głównej sesji. Uwagi: brief Opus w Fazie 2 musi powiedzieć, że w środku fazy trzeba zbudować, uruchomić podgląd i zasiać dane do re-pomiaru. Treść reguł w CLAUDE.md (Sonnet medium) niesie osąd, więc główna sesja powinna ją przejrzeć. Break check robi się na czystym drzewie (F6). Porty: F7. |

## Wpływ odpowiedzi D1-D7

- **D1** (podpis nie jako osobna grupa): kafle są niższe, a podpisy w szkielecie to `mt-line`. Fazy bez zmian.
- **D2** (`group` między wierszami celów): kafel Targets rośnie o ok. 32 px na każdej szerokości, a szkielet przechodzi na `space-y-group`. Nie koliduje z 2B, ale kadr landingu wtedy **przecina** pierwszy kafel (F5), więc wysokość trzeba przeliczyć tak czy inaczej.
- **D3** (zostawić `sm:pt-6`): pierwszy kafel na desktopie leży 16 px niżej, a przesunięcie kadru landingu jest mniejsze.
- **D4** (`Eclipse` dla każdego zaćmienia Słońca): odpada wiersz kontrastu (F4) i edycja „wyjątków” w CLAUDE.md, `data-fact` jest zawsze rodzajem zdarzenia, a test z F2 sprowadza się do `factIcon`.
- **D5** (ikona w linii kafla Events): `EventsTile` potrzebuje `next.kind`, `Fact` w `div` i powtórzenia reguły D4 dla zaćmienia. Rola `text-body` semibold linii kafla siedzi wtedy w korzeniu `Fact` o roli `text-label`. Dochodzi jedna asercja e2e i kontrola szkieletu, czyli więcej pracy w Fazie 1. Nie łamie 2B, bo 2B dotyczy nagłówków.
- **D6** (zostawić `mt-3` dla dolnych linii): nie ma re-pomiaru, werdykt na landingu zostaje na miejscu i F1 znika, ale porada dalej przylega do powodu.
- **D7** (osobny prop `eventKind` jak w eksperymencie): `kind` zachowuje typ, ale ikona w `Fact` ma wtedy dwa źródła. Faza 2 poza tym się nie zmienia.

## Wywołania z „Automated Verification” (sprawdzone 2026-10-15)

| Komenda | Rozwiązuje się? | Wynik |
|---|---|---|
| `npx vitest run src/lib/tonight/sky-events.test.ts src/styles/rhythm-roles.test.ts src/styles/contrast.test.ts src/styles/no-hardcoded-colors.test.ts` | tak | 4 pliki, 104 testy zielone |
| `npm test` / `npm run lint` / `npm run build` | tak | skrypty istnieją: `vitest run`, `eslint . --max-warnings 0`, `astro build` + postbuild. Nie uruchamiałem ich w całości, bo build zapisuje `dist` |
| `npx playwright test --list tests/e2e/tonight-phone.spec.ts tests/e2e/tonight-dashboard.spec.ts` | tak | 7 testów w 2 plikach. Wszystkie 10 specyfikacji z planu istnieje |
| `npm run test:e2e`, `npm run smoke` | tak, ale z zastrzeżeniem | `playwright.config.ts` nie ma `webServer`, a `baseURL` i `smoke.mjs` domyślnie celują w 4321. Komendy w 3.2/3.3 nie podają `BASE_URL` (F6) |
| „hardcoded-value scan” (1.5) | **nie** | w repo nie ma takiej komendy, to grep z SKILL.md /10x-ui (F6) |

## Findings

### F1 — D6 przesuwa pierwszy ekran telefonu w noce z prognozą fallback/none i w noce no-go

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — prawdziwy kompromis; warto się zatrzymać i przemyśleć
- **Dimension**: Coverage
- **Location**: plan.md „Desired End State” (The phone first screen is unchanged), D6, Phase 2 §3
- **Detail**: Linia prognozy jest `max-sm:hidden` tylko w stanie `fresh`. W stanach `fallback` i `none` jest pogrubiona i widoczna na telefonie (`VerdictCard.astro:64-68`). D6 przesuwa ją z `mt-3` na `mt-group` (+12 px), tak samo jak `nextText` w noc no-go.

  Szacunek arytmetyczny podagenta (nie pomiar): przy prognozie fallback werdykt przy 390 px ma ok. 201 px przy min-height 168, a tytuł karty Telescope wypada na ok. 778 px przy TabBar 779 px. Po zmianie byłoby to ok. 790 px, czyli pod TabBarem. Noce no-go już dziś przekraczały tę linię i urosną o kolejne 12 px.

  `tonight-phone.spec.ts` działa tylko na fixture all-clear z prognozą fresh, więc tego nie zobaczy. Teza planu „pierwszy ekran bez zmian” jest prawdziwa tylko dla nocy go z prognozą fresh.
- **Fix**: Zmierzyć werdykt w stanie fallback przy 390 px (np. z `FORECAST_BASE_URL` wskazującym na wyłączony fixture), zapisać wynik w `evidence/README.md` i doprecyzować w planie oraz w CLAUDE.md „Phone first”, że niezmiennik dotyczy nocy go z prognozą fresh, a fallback i no-go to znane ograniczenie. Albo, jeśli właściciel tak zdecyduje, zostawić linię prognozy w grupie odpowiedzi (`mt-line`).
  - Strength: role zostają stałe na każdej szerokości, a ograniczenie jest jawne i zmierzone.
  - Tradeoff: na telefonie w noc fallback tytuł Telescope może zejść pod TabBar.
  - Confidence: MED — stany linii prognozy sprawdzone w kodzie, liczby pikseli policzone, nie zmierzone.
  - Blind spot: rzeczywista wysokość werdyktu w stanie fallback w EN i PL.
- **Decision**: APPLIED (owner D6, 2026-10-15): the forecast line stays in the answer group (`mt-line`); only the weather no-go "Next clear night" advice moves to `mt-group`. Phase 2 measures the `none` night at 390 px before and after (2.6).

### F2 — D4 i D7 nigdy nie są testowane deterministycznie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja, poprawka oczywista i wąska
- **Dimension**: Verifiability
- **Location**: plan.md Phase 2 §1-§3, §8; plan-brief „Open Risks”
- **Detail**: E2E chodzi na prawdziwym zegarze, a „fixture night 2026-10-15” to po prostu dzisiejsza data. Nowa asercja (`data-fact` i jedno `svg`) wykona się więc tylko przypadkiem, np. w okolicach maksimum Orionidów (ok. 21-22 października). `/design` zwraca 404 poza `astro dev`, więc żaden e2e nie przypnie specymenów. Mapowanie solar-eclipse → `safety` + `text-marginal` siedzi wyłącznie w szablonie Astro.
- **Fix**: Wydzielić czystą funkcję `verdictEventFact(kind) → { kind, iconClass? }` (w `fact-icons.ts` lub `sky-events.ts`) i przetestować ją jednostkowo: `solar-eclipse` daje `safety` z `text-marginal`, każdy inny `SkyEventKind` daje sam siebie bez `iconClass`. Dodać test `factIcon`: każdy `FactKind` mapuje się na wpis w `FACT_ICONS`, a każdy `SkyEventKind` na wpis w `EVENT_KIND_ICONS`. Opcjonalnie gałąź e2e może sprawdzać, że `data-fact` to `"safety"` dokładnie wtedy, gdy linia zaczyna się od „Today/Tomorrow, HH:mm”.
- **Decision**: APPLIED: pure `factIcon` with `fact-icons.test.ts`, and `eventsVerdict` / `eventsTile` returning `{ line, kind }` with unit tests (Phase 1 §1-§2). Under D4 there is no solar-eclipse mapping: `Eclipse` for every solar eclipse.

### F3 — Re-pomiaru min-height nie da się wykonać tak, jak go opisano

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja, poprawka oczywista i wąska
- **Dimension**: Verifiability
- **Location**: plan.md „Critical Implementation Details”, Phase 2 §5, Progress 2.7
- **Detail**:
  - `evidence/scripts/dashboard.mjs` ma tylko viewporty 320, 390 i 1280, a reguła z `sky-band.ts:35-45` wymaga pomiaru przy 360 i 640 px.
  - Wartość `verdict=` to sam `section`, bez paddingu kontenera.
  - Pomiar kontenera, na którym działa `min-h-*`, zwraca bieżącą wartość min-height. Przy 360 px werdykt go wypełnia ją dokładnie, więc zmiana byłaby niewidoczna.
  - Zegar jest prawdziwy, więc w dniu pomiaru może się pojawić linia zdarzenia.
  - Skrypt nie mierzy werdyktu w szkielecie, a krok 2.7 wymaga zgodności szkieletu z prawdziwym werdyktem ±2 px.
- **Fix**: W briefie Fazy 2 dodać do `dashboard.mjs` viewporty 360 i 640, wypisywać wysokość sekcji plus `pt`/`pb` (albo kontener z wstrzykniętym `min-height:0`) dla strony i szkieletu, i wymagać `eventLine=0` (albo schowanej linii) przed przyjęciem liczby.
- **Decision**: APPLIED: `dashboard.mjs` gains 360/640 px viewports and prints the verdict container with `min-height: 0` on the page and the skeleton, with `eventLine` (Phase 2 §3, 2.5).

### F4 — Wiersz kontrastu przypina „light”, w którym werdykt nigdy się nie renderuje

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja, poprawka oczywista i wąska
- **Dimension**: Feasibility
- **Location**: plan.md Phase 2 §6 (`src/styles/contrast.test.ts`)
- **Detail**: Werdykt zawsze leży w zakresie `night-sky`. W light theme ten zakres definiuje `--marginal` na nowo (#f1cf6b) i to pokrywa scope `"night"`. Zwykłe `"light"` przypina parę `--marginal` #8f6100 na dziennym zenicie #a9c3e6, której werdykt nigdy nie pokazuje. Ta para przechodzi o 0,0006 (3,0006), więc każda późniejsza korekta tokenu light wywróci test z powodu nieistotnej pary.

  Minima w motywach, które mają znaczenie: dark 6,62, night 6,09, red 3,49. Mieszanie `color-mix` w sRGB daje najgorszy przypadek na końcach skali, więc przypięcie stopów wystarcza.
- **Fix**: `{ themes: ["dark", "red", "night"], fg: ["marginal"], bg: ["zenith", "horizon", ...DUSK], floor: 3 }` z komentarzem, że werdykt leży zawsze w `night-sky`. Ścieżka „stop and report” staje się wtedy zbędna, bo nic nie pada.
- **Decision**: MOOT (owner D4): no amber icon, so no contrast row.

### F5 — Kadr zrzutu landingu 1280×1125 nie kończy się już na linii pierwszego kafla

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja, poprawka oczywista i wąska
- **Dimension**: Coverage
- **Location**: plan.md Key Discoveries (landing image), Phase 3 §3
- **Detail**: Przy 1280 px werdykt rośnie o 12 px, `TILES_GAP` od `sm` traci 16 px, a kafel Targets 16 px (257 → 241, pomiar z research). Linia pod pierwszym kaflem przesuwa się więc o ok. 20 px w górę. Przy stałym 1125 kadr pokaże ok. 20 px górnego paddingu kafla Events, a komentarz specyfikacji mówi, że kadr kończy się „on that tile's rule”. Przy D2 = `group` (+32 px) kadr przetnie kafel. Linia zdarzenia w dniu zrzutu dodaje kolejne ok. 28 px.
- **Fix**: W Fazie 3 zmierzyć y linii pierwszego kafla w chwili zrzutu i ustawić wysokość w obu miejscach: `landing-screenshot.spec.ts:22` (`VIEWPORT`) i `Welcome.astro:34` (`SCREENSHOT`). Prawdopodobnie wyjdzie ok. 1105. Zrzut robić w noc bez linii zdarzenia albo najpierw sprawdzić `[data-verdict-event]`.
- **Decision**: APPLIED: Phase 3 §3 measures the first tile's rule at 1280 px on a night without the event line and sets the height in `landing-screenshot.spec.ts` and `Welcome.astro`.

### F6 — Kilka linii „Automated Verification” to proza albo komendy bez portu i kluczy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja, poprawka oczywista i wąska
- **Dimension**: Verifiability
- **Location**: plan.md Progress 1.2, 1.5, 2.3, 2.4, 3.1, 3.2, 3.3
- **Detail**:
  - **1.2 / 2.4**: brak komendy. Dodatkowo strażnik nie egzekwuje „exact counts”: niewykorzystany limit nie psuje testu, więc zapomniane zmniejszenie allowlisty szkieletu w Fazie 2 przejdzie niezauważone.
  - **1.5**: „hardcoded-value scan” nie istnieje w repo. To grep z SKILL.md /10x-ui po 11 plikach z research.
  - **2.3**: brak komendy.
  - **3.1**: „Restore with `git checkout --`” bez ścieżek przywróciłoby całe drzewo.
  - **3.2 / 3.3**: brak `webServer`, a `baseURL` i `smoke.mjs` domyślnie celują w 4321, nie 4331.
- **Fix**:
  - 1.2/2.4: `npx vitest run src/styles/rhythm-roles.test.ts` plus grep wpisów w `GUARDED`. Albo dopisać do strażnika sprawdzenie, że limit pliku jest w pełni wykorzystany, albo usunąć słowo „exact”.
  - 1.5: `npx vitest run src/styles/no-hardcoded-colors.test.ts` plus nazwany grep `-\[` po 11 plikach z research, który ma nic nie zwrócić.
  - 2.3: `npx vitest run src/styles/contrast.test.ts`.
  - 3.1: break check na czystym, zacommitowanym drzewie, a przywrócenie przez `git checkout -- <trzy pliki>`.
  - 3.2: `BASE_URL=http://localhost:<port> SUPABASE_URL=… SUPABASE_KEY=… SUPABASE_SECRET_KEY=… npm run test:e2e`.
  - 3.3: `BASE_URL=… SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run smoke`.
- **Decision**: APPLIED: runnable commands with ports and keys inline in every Progress row; the guard gains an exact-count test (an unused allowance fails); the break check restores exactly the three named files on a clean tree.

### F7 — Porty 4331/4401 i zatrzymywanie podglądu po pid mogą trafić w serwer innego agenta

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja, poprawka oczywista i wąska
- **Dimension**: Feasibility
- **Location**: plan.md „Implementation Approach” (Running the e2e lists; Stop the preview by the pid listening on 4331)
- **Detail**: Plan na sztywno używa podglądu na 4331 i fixture na 4401, a podgląd zatrzymuje przez `lsof -t -iTCP:4331` i kill. Pod herdr porty 4331, 4333, 4343, 4400 i 4401 są zarezerwowane dla innych agentów. Jeśli 4331 nie należy do implementującego agenta, kill zabije cudzy serwer, a `astro dev` dla `/design` też się na nim zderzy.
- **Fix**: Orkiestrator przydziela implementującemu agentowi własną parę portów. Briefy przyjmują `PREVIEW_PORT` i `FIXTURE_PORT` (`dashboard.mjs` już czyta `PREVIEW_PORT`), a zatrzymuje się tylko pid, który ten agent sam uruchomił.
- **Decision**: APPLIED (orchestrator): this agent's ports stay 4331/4401; servers are stopped only through the pid listening on those ports.

### F8 — Lista e2e Fazy 2 pomija specyfikacje, które czytają `data-fact`

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja, poprawka oczywista i wąska
- **Dimension**: Coverage
- **Location**: plan.md Phase 2 „Automated Verification” (e2e list), Progress 2.6
- **Detail**: D7 zmienia `Fact.astro`, który renderuje się na każdej stronie fokusowej. Wartości `data-fact` czytają `planets-on-tonight` i `what-to-expect`. Faza 3 złapie regresję w pełnym przebiegu, ale później.
- **Fix**: Dopisać `planets-on-tonight` i `what-to-expect` do listy e2e Fazy 2.
- **Decision**: APPLIED: `planets-on-tonight` and `what-to-expect` are in Phase 1's and Phase 2's e2e lists (`Fact` changes in Phase 1 now).

### F9 — Fallback `kind="why"` jest nieosiągalny i łamie zasadę „jedno pojęcie, jedna ikona”

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja, poprawka oczywista i wąska
- **Dimension**: Architecture Fit
- **Location**: plan.md Phase 2 §3 („With no kind it falls back to `kind="why"`”)
- **Detail**: `eventsVerdictKind` zwraca wartość dokładnie wtedy, gdy `eventsVerdictLine` zwraca linię, więc na pulpicie fallback nigdy nie zadziała. Trafiłby w niego tylko `/design` albo przyszły wywołujący, który dostałby ikonę Info przy zdarzeniu.
- **Fix**: Jeden prop `event?: { line: string; kind: SkyEventKind } | null` (z jednego helpera, który zwraca obie wartości), bez fallbacku, żeby linii bez rodzaju nie dało się wyrazić.
- **Decision**: APPLIED: one `event?: WordedEvent | null` prop on `VerdictCard`, no `why` fallback.

### F10 — Drobne braki: komentarze i reguły do aktualizacji, skrypty dowodowe, numery linii, teza „EN i PL”

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — szybka decyzja, poprawka oczywista i wąska
- **Dimension**: Coverage
- **Location**: plan.md Phase 2 §2-§3, Phase 3 §2, „Evidence scripts”, „Current State Analysis”, „Desired End State”
- **Detail**:
  - **Komentarze i reguły do aktualizacji**:
    - Nagłówek `VerdictCard` mówi, że kolor werdyktu to tylko kropka, a w noc zaćmienia dochodzi bursztynowy trójkąt.
    - Nagłówek `fact-icons.ts` i komentarz `FACT_ICONS.safety` mówią tylko o linii bezpieczeństwa wiersza zdarzenia.
    - CLAUDE.md Components mówi „the event kind icon beside an event's name keeps heading ink”, a ikona w werdykcie jest wyciszona, więc trzeba doprecyzować, że reguła dotyczy tytułu wiersza zdarzenia.
    - Akapit S-07 w CLAUDE.md mówi „`VERDICT_MIN_HEIGHT_CLASS` and the skeleton keep today's height”.
    - Nagłówek `tonight-dashboard.spec.ts`.
  - **Skrypty dowodowe**:
    - `seed.mjs` domyślnie używa prefiksu `ui-refine`, a `dashboard.mjs` oczekuje `STATE_PREFIX` `ui-dash`.
    - `seed.mjs` zapisuje `state-*.json` (ciasteczka sesji) i `email-*.txt` do `evidence/`, czego nie obejmuje gitignore.
    - Plan nie nazywa narzędzia do konwersji PNG → JPEG.
  - **Numery linii**: `GUARDED` jest w `rhythm-roles.test.ts:51-93`, nie 55-100. Specymeny Tile w `/design` nie mają drugiej linii, więc instrukcja „`mt-line` for a second line” nie ma zastosowania.
  - **Teza „EN i PL”**: test pierwszego ekranu w `tonight-phone.spec.ts` jest tylko EN. PL sprawdza tam tylko przewijanie w bok, a pierwszy ekran po polsku tylko ręczne `dashboard.mjs --measure`.
- **Fix**:
  - Dopisać te komentarze i zdania do Phase 2 §3 i Phase 3 §2.
  - W briefie przekazywać `ui-dash` jawnie, siać do scratchpada i nazwać `sips -s format jpeg -Z <px>`.
  - Przeformułować tezę o PL na „PL ręcznie przez `--measure`”.
- **Decision**: APPLIED: the comments and CLAUDE.md sentences are named in Phase 2 §1 and Phase 3 §2; seed with `ui-dash` into the scratchpad; `sips` named; `GUARDED` line numbers corrected; the PL first screen is a manual `--measure` check.

## QUESTION FOR OWNER

QUESTION FOR OWNER: D6 przenosi linię prognozy i poradę („Next clear night: …”) o grupę niżej (`mt-group`, +12 px). Na telefonie przy prognozie świeżej nic się nie zmienia, ale przy prognozie zapisanej (fallback) lub jej braku linia prognozy jest widoczna, więc werdykt rośnie o 12 px i tytuł karty Telescope może zejść pod TabBar (szacunek ok. 790 px przy TabBar 779; dziś ok. 778). Noce no-go już dziś przekraczają tę linię i urosną o kolejne 12 px. Czy akceptujesz to jako znane ograniczenie (niezmiennik pierwszego ekranu dotyczy nocy go z prognozą świeżą), czy linia prognozy ma zostać w grupie odpowiedzi (`mt-line`), a o grupę niżej schodzi tylko porada?

## Owner answers (2026-10-15, relayed by the orchestrator)

- D2: 8 px (`space-y-line`).
- D4: keep the `Eclipse` kind icon for a solar eclipse too; no amber `TriangleAlert`, no contrast row; "eclipse glasses only" stays in the words.
- D5: the Events tile's line leads with the event kind icon (a deliberate exception to text-led tiles; tile headings still have no icons).
- D6 (the question above): the forecast line stays in the answer group (`mt-line`); only the "Next clear night" advice moves a group down (`mt-group`), so the phone first screen does not get worse.
- D1, D3, D7 as planned. All findings applied by the planning agent on 2026-10-15 (see each Decision line).
