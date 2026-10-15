<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard tiles on the rhythm roles and shared facts (ui-dashboard-tiles)

- **Plan**: context/changes/ui-dashboard-tiles/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-15
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

Recenzent: herdr „reviewer” (Opus), z dwoma subagentami Opus: jeden sprawdzał rozjazd z planem, drugi bezpieczeństwo, jakość i wzorce. Gałąź `feat/ui-dashboard-tiles` @ 7b62af9, baza main 5d52a37. Kod nie był zmieniany; `change.md` nie był ruszany (orkiestrator: zapis tylko do tego pliku).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Bramki uruchomione przez recenzenta

Na drzewie 7b62af9, czyste drzewo robocze.

- `npx astro check`: 0 błędów, 0 ostrzeżeń, 0 podpowiedzi.
- `npm run lint`: czysto.
- `npm test`: 122 pliki, 2338 testów przeszło, 1 pominięty, 6 todo.
- Grep `-\[[0-9.]+(px|rem)\]` po plikach dashboardu: brak trafień.
- `npm run build`: OK, service worker precache'uje 58 plików.
- `npm run test:e2e` na świeżym buildzie (własny podgląd 4351, fikstura 4451, lokalny Supabase, klucze tylko inline): **76 passed, 4 skipped, 0 failed** (1,2 min). To samo co u implementera.
- `npm run smoke`: **wszystkie kroki przeszły**.
- Subagenci uruchomili `rhythm-roles`, `fact-icons`, `sky-events` i `fact-islands`: 164/164.

Pozycje Manual 1.7, 1.8, 2.5–2.7 i 3.5 mają dowody w `evidence/README.md` i `evidence/after/`. Pozycja 3.6 (akceptacja właściciela) jest słusznie niezaznaczona.

## Decyzje właściciela: weryfikacja

- **D1.** Spełnione:
  - wiersz kafla to `py-item`;
  - `TILE_CONTENT_CLASS` = `mt-line`; w plikach dashboardu nie został żaden `mt-3`, `mt-4` ani `mt-5` pod nagłówkiem;
  - legenda „not seen” jest na `mt-group`, a podpis ze stanem celów na `mt-line` po niej (inaczej `mt-group`, przez `cn()`);
  - podpis nocy jest na `cn(caption, "mt-group")`;
  - powód w Planetach to `Fact kind="why" tone="muted"` na `mt-line`.
- **D2.** Spełnione: lista „Zacznij od nich” to `space-y-line` (8 px), a `li` nie ma już `py-1.5`.
- **D3.** Spełnione: `TILES_GAP_CLASS` = `pt-line`.
- **D4.** Spełnione:
  - linia zdarzenia w werdykcie to wyciszony `Fact` z ikoną rodzaju zdarzenia, także `Eclipse` dla zaćmienia Słońca;
  - nie ma `TriangleAlert`;
  - słowa „tylko przez okulary do zaćmień” zostały;
  - `factIcon("solar-eclipse") === Eclipse` przypina test jednostkowy.
- **D5.** Spełnione:
  - linia kafla Zjawiska to `Fact size="body"` z ikoną rodzaju, gdy jest następne zdarzenie;
  - linie „brak” i „niedostępne” to zwykły tekst bez ikony;
  - nagłówki kafli nie mają ikon.
- **D6.** Spełnione:
  - linia prognozy jest na `mt-line`;
  - tylko porada „Next clear night” (`nextText`) jest na `mt-group`;
  - `returnText` i `causeText` są na `mt-line`;
  - `mt-1` powodu i wcięcie kropki zostały.
- **D7.** Spełnione:
  - `kind: FactSubject`;
  - jeden czysty resolver `factIcon` (`Object.hasOwn`, bez fallbacku na `why`);
  - `data-fact` niesie rodzaj zdarzenia;
  - `{ line, kind }` pochodzą z `eventsVerdict` / `eventsTile`, więc tekst i ikona zawsze są z tego samego zdarzenia (`tonight[0]`, gdzie zaćmienie jest pierwsze);
  - `size: "label" | "body"` z wcięciem ikony `mt-0.5` / `mt-1`.

## Ocena obszarów wskazanych przez orkiestratora

- **Tokeny i role rytmu.** W przekonwertowanych plikach nie ma kroków liczbowych, wartości arbitralnych ani literalnych kolorów.
  - Nadpisania idą przez `cn()`, a `mt-group` poprawnie wypiera `mt-line`.
  - `text-body` / `text-label` w `Fact` łączą się poprawnie z tuszem.
  - Żaden z 39 wywołań `<Fact>` nie podaje klasy, która by się kłóciła.
  - Strażnik ma dokładne liczniki (`inexactAllowances`, test na każdy plik) z przypisanymi komentarzami.
  - Break check w README pokazuje `file:line` i licznik.
- **Resolver ikon i jego test.** Test sprawdza:
  - każdy `FACT_KINDS`;
  - wszystkie sześć rodzajów zdarzeń (długość przypięta);
  - `Eclipse` dla zaćmienia Słońca;
  - rozłączność zbiorów w obie strony.

  Fallback na `why` wywróciłby pętlę po rodzajach zdarzeń. Test jest mocny.
- **`VERDICT_MIN_HEIGHT_CLASS`.** `min-h-42 sm:min-h-58` zgadza się z pomiarem (168 / 232 px) i z arytmetyką w komentarzu.
  - Szkielet: przy 640 px mierzy 232 = 232. Przy 360 px mierzy naturalnie 144, a `min-height` trzyma go na 168, wobec 168,9 dla prawdziwego werdyktu.
  - Wiersze kafli w szkielecie są równe prawdziwym przy 390 i 1280 px (EN).
  - Różnica szkielet/prawdziwa strona jest bez zmian (−35 / −36 px).
- **Pierwszy ekran telefonu.** Przy 390×844 w EN i PL wartości to 149 / 701 / 746 wobec TabBara na 779, czyli bez zmian. Spec jest zielony u mnie.
  - Przypadek PL w nocy bez prognozy: patrz F1.
  - Noc ze zdarzeniem: też patrz F1.
- **Kadr zrzutu strony głównej.** `public/landing/tonight.png` ma 1280×1117. Obejrzałem dół obrazu: kończy się dokładnie na linii pod pierwszym kaflem („Each at the time it stands highest. 123 targets tonight.”, a pod nim linia).
  - Wysokość jest ustawiona w obu miejscach: w specu i w `Welcome.astro`.
  - Plan zakładał około 1105, ale stary kadr 1125 był już nieaktualny: kafle zaczynały się niżej, więc linia wypadała około 1149. Pomiar rozstrzyga, zgodnie z planem.
- **/design.** Specymeny werdyktu przechodzą przez `eventsVerdict`, panorama też. Każdy specymen ma jedną ikonę rodzaju, łącznie z `Eclipse`.
  - Drobiazg w dowodach: w `after/c-verdict-event-390-pl-red.jpg` pasek narzędzi Astro dev zasłania fragment specymenu z panoramą. Nie wymaga poprawki.
- **i18n.** Nie ma nowych kluczy ani literałów widocznych dla użytkownika. Angielskie etykiety są tylko w `/design`, czyli w istniejącym wzorcu.
- **Siła e2e.** Kafel Zjawiska ma asercje w obu gałęziach:
  - linia „brak” nie ma svg;
  - w przeciwnym razie `data-fact` należy do sześciu rodzajów i jest dokładnie jeden svg.

  Selektor `:has(> [data-verdict-event])` w specu telefonu trafia tylko w wrapper `mt-line`, a gdyby chybił, spec rzuca „a box to measure is missing”. Słabsze miejsca: patrz F2.

## Odchylenia od planu (udokumentowane, akceptowalne, bez findingu)

- `tonight-phone.spec.ts:71`: plan mówił „asercje bez zmian” i tak jest, ale zmienił się styl ukrywający, który teraz chowa też wrapper. Bez tego margines 8 px wrappera zostawałby w nocy ze zdarzeniem. Zmiana jest konieczna i opisana w README i CLAUDE.md.
- Wysokość strony głównej to 1117, a nie około 1105. Zmierzone i zapisane (wyżej).
- CLAUDE.md, „Tonight's sky”, dostał też opis rytmu werdyktu (D6), którego Faza 3 §2 nie wymieniała. Opis jest zgodny z kodem.

## Findings

### F1 — Pierwszy ekran telefonu: znane ograniczenie, którego właściciel nie zaakceptował, i węższy margines w noc ze zdarzeniem

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: CLAUDE.md:112 („Phone first”); tests/e2e/tonight-phone.spec.ts:20-21, 92-93
- **Detail**:
  - **(a) Noc bez prognozy po polsku.** Implementer dopisał do reguły w CLAUDE.md: „weather no-go nights **and Polish no-forecast nights** are a known limit”.
    - Plan uznaje za znane ograniczenie tylko noce weather no-go.
    - Sam przypadek jest wcześniejszy niż ta zmiana: tytuł Teleskopu był na 794 px, teraz jest na 790 px, wobec TabBara na 779 px. Zmiana go poprawia o 4 px i go nie powoduje.
    - Moja ocena: zakwalifikowano go poprawnie, jako ograniczenie spoza zakresu. Ale wpis do trwałej reguły projektu poszerza niezmiennik, który ustalił właściciel (2026-10-08). Zgodnie z regułą „ask only for UI decisions” to decyzja właściciela.
  - **(b) Noc ze zdarzeniem (z arytmetyki, nie z pomiaru).** Linia zdarzenia kosztuje teraz 8 + 20 = 28 px, a wcześniej `mt-1` 4 + 20 = 24 px.
    - Przy 390 px naturalna wysokość werdyktu (168,9) równa się `min-h-42` (168), więc nie ma luzu, który by ją połknął. Komentarz w specu („the verdict's min-height can swallow”) przy 390 px jest nieprawdziwy; to wcześniejsza nieścisłość.
    - Dla jednolinijkowej linii zdarzenia tytuł Teleskopu wypada około 774 px wobec 779. Margines spada z 9 do 5 px.
    - Linia dwuwierszowa (polskie zaćmienie Słońca przy 390 px) była poza ekranem już wcześniej (790), teraz byłaby około 794.
    - Spec ukrywa linię, więc tego nie mierzy. Najbliższa noc ze zdarzeniem to Orionidy, 21/22 października.
- **Fix**: właściciel potwierdza (a) jako znane ograniczenie albo przenosi je do follow-upu (np. do ui-tonight-nav, który i tak dotyka pierwszego ekranu). Implementer dopisuje (b) do `evidence/README.md` jako znany koszt i poprawia zdanie w komentarzu speca na prawdziwe („the cards move by the line; the spec measures without it”). Opcjonalnie: pomiar `dashboard.mjs --measure` w noc Orionidów.
- **Decision**: APPLIED (owner, 2026-10-15): the Polish no-forecast night stays in CLAUDE.md as a permanent known limit; the spec's comments now say the event line moves the cards by 28 px at 390 px (no min-height slack) and leave about 5 px above the TabBar for a one-line event, also in CLAUDE.md and `evidence/README.md`.

### F2 — Ikona linii zdarzenia w werdykcie jest przypięta tylko w noce ze zdarzeniem

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/tonight-dashboard.spec.ts:24-31, 123-131; src/components/tonight/sky-band.ts:15
- **Detail**:
  - Asercje dla `[data-verdict-event]` (`data-fact` z sześciu rodzajów, jeden svg) działają tylko wtedy, gdy zegar trafi w noc ze zdarzeniem. Dziś się nie wykonały. Repo nie ma testów komponentów Astro, a `/design` sprawdza się ręcznie, więc np. regresja przekazywania `data-*` przez `Fact` przeszłaby w większość dni.
  - `EVENT_KINDS` w specu to ręcznie przepisana lista. `satisfies` nie wymusza kompletności.
  - `TILES_GAP_CLASS` (D3) nie jest objęty strażnikiem rytmu, bo `sky-band.ts` świadomie jest poza `GUARDED`.

  Każdy z tych punktów jest drobny i zgodny z decyzją „prawdziwy zegar w e2e”.
- **Fix**: zbudować `EVENT_KINDS` z wyczerpującego `Record<SkyEventKind, true>`. Opcjonalnie dodać mały spec na specymenach `/design` (stałe dane) albo przyjąć ryzyko.
- **Decision**: APPLIED: `EVENT_KINDS` in `tonight-dashboard.spec.ts` is read from the catalogue's `tonight.events.kind` record with `satisfies Record<SkyEventKind, string>` (no hand copy); `rhythm-roles.test.ts` holds `TILES_GAP_CLASS` to the roles (break check: `pt-3` went red, restored).

### F3 — Doprecyzowania w regułach i komentarzach

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md:108, CLAUDE.md:112; src/components/tonight/TonightTiles.astro:20-21
- **Detail**:
  - CLAUDE.md i nagłówek `TonightTiles` nazywają linię Zjawisk „the one exception to text-led tiles”. Tymczasem kafel Planet też pokazuje ikonę (Info przy powodzie, muted `why` Fact), zgodnie z planem. To nie jest sprzeczność, bo kafel dalej zaczyna się od nazw planet, ale następny agent może uznać tę ikonę za naruszenie reguły i ją usunąć.
  - „Phone first” w CLAUDE.md odsyła do `context/changes/ui-dashboard-tiles/evidence/scripts/dashboard.mjs`. Po `/10x-archive` ta ścieżka przestanie istnieć.
- **Fix**: dopisać „the Planets reason is the muted `why` Fact”. Ścieżkę zamienić na opis metody (EN go, 360/640 px, `min-height: 0`) albo na ścieżkę archiwum w commicie archiwizującym.
- **Decision**: APPLIED: CLAUDE.md, `TonightTiles` and `EventsTile` name the Planets reason's Info icon as the second icon-led line; CLAUDE.md and `sky-band.ts` describe the min-height method instead of pointing into `context/changes/`.

QUESTION FOR OWNER: Czy akceptujesz polską noc bez prognozy jako trwałe znane ograniczenie pierwszego ekranu, zapisane w CLAUDE.md? Ten przypadek był już przed zmianą, a zmiana go poprawiła o 4 px. Alternatywa: zostawić regułę tylko z nocami weather no-go, a ten przypadek przenieść do follow-upu (np. do ui-tonight-nav).

## Owner answers (2026-10-15, relayed by the orchestrator)

- Progress 3.6 accepted.
- F1: the Polish no-forecast night under the TabBar is a permanent known limitation, kept in CLAUDE.md; fix the spec comment and note the 28 px event-night shift and the 5 px margin.
- F2, F3: apply.
