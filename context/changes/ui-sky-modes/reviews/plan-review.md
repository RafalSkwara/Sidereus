<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Tonight's live sky — drag to pan and Hidden / Default / Expanded modes

- **Plan**: `context/changes/ui-sky-modes/plan.md` (commit 8b183d6, branch feat/ui-sky-modes, local only)
- **Date**: 2026-10-17
- **Reviewer**: herdr agent `reviewer` (Opus, medium effort). Kod sprawdzony bezpośrednio, bez sub-agentów.
- **Phases**: 5 | **Findings**: 0 critical, 4 warnings, 6 observations
- **Verdict**: **NEEDS ATTENTION**. Założenie i kolejność faz są dobre: wzorzec motywu (cookie, `locals`, skrypt przed malowaniem, `useSyncExternalStore`) został przeniesiony poprawnie, a `skyField()` jest dobrym modelem. Dwie liczby w planie są jednak błędne: EXPANDED na laptopie przy 80 % nie jest wyższy od DEFAULT (F1), a w HIDDEN linia ciemnego okna dokłada 20 px, których szkielet nie rezerwuje (F2). Oba błędy złamałyby własny test e2e planu. Wszystko da się naprawić w triage, bez ponownego planowania.
- **change.md**: po triage `status: plan_reviewed`.

## Verdicts

| Dimension        | Verdict | Findings |
| ---------------- | ------- | -------- |
| Claim Accuracy   | WARNING | F6       |
| Substance        | WARNING | F4       |
| Feasibility      | WARNING | F1, F3   |
| Sequencing       | PASS    |          |
| Architecture Fit | PASS    |          |
| Scope Discipline | PASS    | (F10: roadmap nits) |
| Verifiability    | WARNING | F2, F9   |
| Coverage         | WARNING | F7, F8   |

### Co się zgadza (sprawdzone w kodzie)

- `project()` ma na sztywno 180° na viewport (`projection.ts:20-27`). Pole ma stałe `STRIP_HEIGHT_PX + STRIP_OVERLAP_PX` (`TonightSkyView.tsx:287`). Mierzona jest tylko szerokość (`:228-240`). Chevrony liczą `top` z tych samych stałych (`:601`). Charge C1 jest prawdziwy.
- Wzorzec motywu:
  - `preferences.ts:67` ma zamkniętą unię nazw.
  - `middleware.ts:13-17` rozwiązuje cookie dla każdego żądania, także dla `/_server-islands/*`. Dodanie `skyMode` kosztuje jeden odczyt cookie, a nagłówek `Vary: Cookie` już istnieje.
  - Inline script w `Layout.astro:36-47` przyjmuje parametry przez `define:vars`.
  - `TopbarControls` działa na natywnym `popover` (`:194, :208`).
  - Rozszerzenie o tryb nieba jest tanie, a middleware zostaje lekki.
- `@custom-variant` i `@utility` z `env(safe-area-inset-bottom)` istnieją (`global.css:8-21, 498-526`). Strażnik palet nie złapie `sky-hidden:` ani `sky-expanded-height`.
- `island-imports.test.ts:29-38, 70-89` ma `SKY_SOURCES`, a `@/lib/preferences` jest już na allowliście.
- Ikony lucide `FoldVertical`, `RectangleHorizontal` i `Maximize2` istnieją. React jest w wersji 19.3, więc `popoverTarget` działa. Tailwind jest w wersji 4.3, więc `h-68` jest dostępne bez wartości arbitralnej.
- Nazwa dostępna markera zawiera wysokość (`t.bodyLabel({ name, alt, ... })`, `TonightSkyView.tsx:542-549`), więc asercja e2e „`cy` zgadza się z wysokością z nazwy” da się wykonać.
- `VerdictCard.astro:89`: linia ciemnego okna jest `sr-only` przy suwaku, więc `sky-hidden:not-sr-only` jest dobrym mechanizmem (ale zob. F2).
- Kolejność faz: żadna faza nie zależy od późniejszej. Faza 2 ma zostawić DEFAULT bez zmian, co jest sprawdzalne.
- Komendy:
  - `test:reference`, `test:guards`, `test:e2e`, `smoke` i `lint` są w `package.json`, a projekty `reference` i `guards` w `vitest.config.ts`.
  - `npm run test:guards` dzisiaj przechodzi: 14 plików, 52 testy.
  - `npx playwright test --list` widzi `tonight-sky.spec.ts` i `tonight-phone.spec.ts`.
- Test-diet: jeden test inwariantów i cztery testy e2e na poziomie funkcji. Specy idą przez `./helpers` z `clock: "evening"`, bez `waitForTimeout`. Każdy test nazywa ryzyko, przed którym jako jedyny chroni (lekcja „Name the risk”).
- Roadmapa:
  - MS-06 ma wpisy S-09..S-12.
  - S-03 jest oznaczony jako `dropped` w tabeli, w szczegółach, w Streams i w Backlog Handoff.
  - Reszta S-03 trafiła do Parked.
  - Zdanie o cut order jest zaktualizowane.
  - Zob. drobiazgi w F10.

## Findings

### F1 — EXPANDED na desktopie przy 80 % nie jest wyższy od DEFAULT na typowych laptopach, a test e2e przy 1280×720 przeczy minimalnej wysokości

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; wide blast radius or unclear best path
- **Dimension**: Feasibility
- **Location**: plan.md, Faza 1 §3 (`sky-expanded-height`), Faza 4 §2 (`sky-expanded:min-h-68`), Faza 4 §4 (test 2: „at 1280×720 the band is 80 % … ± 2 px”), pytanie Q3
- **Detail**: Od `sm` DEFAULT ma 616 px wysokości:
  - werdykt `min-h-58` = 232 px,
  - pas `h-68` z `-mt-16`, który dokłada 208 px,
  - sylwetka `sm:h-12` = 48 px,
  - suwak `sm:h-32` = 128 px.

  80 % ekranu pod 88-pikselowym paskiem Topbara daje taką wysokość pasma:

  | Ekran     | 80 %   | 100 % | Pole przy 80 %                |
  | --------- | ------ | ----- | ----------------------------- |
  | 1280×720  | 506    | 632   | < 272, minimum podbija do DEFAULT |
  | 1366×768  | 544    | 680   | < 272                         |
  | 1536×864  | 621    | 776   | 277 (+5 px)                   |
  | 1440×900  | 650    | 812   | 306 (+34 px)                  |
  | 1920×1080 | 794    | 992   | 450                           |

  Skutki:
  - Na większości laptopów EXPANDED wygląda tak samo jak DEFAULT.
  - Plan ma `min-h-68` „never shorter than DEFAULT”. Jeśli `sky-expanded-height` ustawia `height`, suwak wyjeżdża poza ramę i nachodzi na karty. Jeśli ustawia `min-height`, rama ma 616 px, a nie 80 %.
  - W obu przypadkach test „80 % ± 2 px przy 1280×720” jest czerwony.
  - Nawet 100 % (Q3 A) daje laptopowi 1280×720 tylko 16 px więcej pola, bo werdykt z suwakiem zajmuje 408 px.
- **Fix**: zdefiniować wysokość desktopową tak, żeby nigdy nie spadła poniżej DEFAULT (`max(<DEFAULT>, (100svh − topbar) × share)`). Przenieść asercję e2e na 1440×900 (albo sprawdzać `max(80 %, DEFAULT)`). Pokazać właścicielowi prawdziwe liczby przy Q3: rekomenduję A, czyli cały ekran pod Topbarem. Jeśli właściciel chce realnego zysku na laptopie, w EXPANDED od `md` można zmniejszyć padding werdyktu (`pt-12 pb-14`), ale to zmienia pomiar `VERDICT_MIN_HEIGHT_CLASS` dla tego trybu.
  - Strength: liczby wynikają z `sky-band.ts:37, 52, 57, 61, 79` i `GearShell.astro:40` (`pt-2 sm:pt-6` + `h-16`), tej samej arytmetyki, której używa research.
  - Tradeoff: decyzja Q3 wraca do właściciela z inną rekomendacją. Ewentualna kompresja werdyktu to nowy pomiar.
  - Confidence: HIGH — arytmetyka z klas. Research sam liczy 306 px przy 1440×900.
  - Blind spot: rzeczywiste wysokości nie zostały zmierzone w przeglądarce. Faza 2 i 4 i tak mają je zmierzyć.
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

### F2 — HIDDEN: widoczna linia ciemnego okna dokłada 20 px ponad `min-h` werdyktu, więc pasmo skacze i test „±1 px” nie przejdzie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Verifiability / Coverage
- **Location**: plan.md, Faza 4 §3 (`sr-only sky-hidden:not-sr-only`), Faza 4 §4 (test 1 dla `hidden`)
- **Detail**: Linia ciemnego okna to osobny `<p class="text-label">` między datą a `h2` (`VerdictCard.astro:89`), więc ma 20 px wysokości. `VERDICT_MIN_HEIGHT_CLASS` jest zmierzone dokładnie na treść werdyktu bez tej linii: 168 px przy 360 i 232 px przy 640 (`sky-band.ts:37-52`). Spec `tonight-phone.spec.ts` potwierdza, że przy 390 px min-height „has no slack”. W HIDDEN wyspa jest więc o 20 px wyższa niż szkielet, który rezerwuje tylko `min-h` i nie ma paska dla tej linii. Na telefonie i na desktopie pasmo przeskoczy o 20 px, a test 1 („band's bottom within 1 px of the skeleton's”) dla `hidden` będzie czerwony.
- **Fix**: dodać do `VERDICT_MIN_HEIGHT_CLASS` wariant HIDDEN (+20 px, np. `sky-hidden:min-h-47 sm:sky-hidden:min-h-63`, zmierzone ponownie przy 360 i 640 px). W `TonightSkeleton` dodać pasek `hidden sky-hidden:block` w miejscu tej linii. Nie zmienia to żadnego kroku pionowego, więc dokładne liczniki w `rhythm-roles.test.ts` zostają.
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

### F3 — Wysokość pasma zależy od `100dvh`, a plan centruje widok na `facing` po każdym resize, więc przewijanie strony na telefonie gubi przesunięcie panoramy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Feasibility
- **Location**: plan.md, Faza 1 §3 (`100dvh`), Critical Implementation Details („Recentring on `facing` stays the rule … for a window resize”), Faza 2 §2
- **Detail**: Dzisiaj centrowanie reaguje tylko na zmianę szerokości (`useLayoutEffect([viewport])`, `TonightSkyView.tsx:242-246`). W EXPANDED z Q4 B pole widzenia i `stripWidthPx` zależą od wysokości. Na mobilnym Safari i Chrome `100dvh` rośnie, kiedy pasek adresu chowa się przy przewijaniu. Użytkownik przewija w dół do kart, pasmo zmienia wysokość, projekcja się przelicza i panorama wraca na `facing`. Gwiazdy skaczą w trakcie przewijania. Dodatkowo z HIDDEN (scroller ma `display:none`) nie ma azymutu do zachowania, a `viewport` zostaje na domyślnym 390 aż do pierwszego pomiaru.
- **Fix**: w utility użyć `100svh` (stabilna mała wysokość viewportu) zamiast `100dvh`. Zapisać regułę: na `facing` centrujemy tylko przy pierwszym układzie i przy zmianie szerokości. Przy zmianie samej wysokości i przy zmianie trybu zachowujemy azymut ze środka widoku. Wyjście z HIDDEN centruje na `facing`. Dodać ręczny krok: przewinięcie na prawdziwym telefonie w EXPANDED.
  - Strength: usuwa pętlę resize → recentre bez nowego kodu, bo to ta sama ścieżka co `chooseMode`.
  - Tradeoff: przy `svh` pasmo na telefonie z ukrytym paskiem adresu nie sięga do TabBara (zostaje szczelina wysokości paska, ok. 50-80 px).
  - Confidence: MED — zachowanie `dvh` jest znane, ale w tym układzie nie zostało sprawdzone na urządzeniu.
  - Blind spot: PWA w trybie standalone nie ma paska adresu, więc tam problem nie występuje.
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

### F4 — Łańcuch układu EXPANDED jest niedookreślony: pasmo nie jest flex-column, SVG ustala wysokość scrollera, a zachowanie statycznego pasma jest sprzeczne

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Substance
- **Location**: plan.md, Faza 2 §2, Faza 4 §2-3, Critical Implementation Details („Failed sky view”)
- **Detail**:
  - (a) Dzisiaj wysokość scrollera wyznacza atrybut `height` SVG (`TonightSkyView.tsx:483-489`), a wrapper nie ma żadnej wysokości. Plan daje `flex-1` ramie, pasmu i wrapperowi pasa, ale nie robi pasma (`dusk-band … relative overflow-hidden`, `:451`) ani korzenia `TonightSky.astro:57` kontenerem `flex flex-col` w EXPANDED. Bez tego `flex-1` na pasie nic nie robi.
  - (b) `ResizeObserver` musi obserwować wrapper o wysokości z CSS, a nie scroller ani SVG, bo inaczej zawartość ustala własny pomiar.
  - (c) SSR i prehydratacja: wyspa renderuje SVG 390×272. W EXPANDED gwiazdy przez chwilę leżą w górnych 272 px wyższego pola i przeskakują po hydratacji. To nie jest skok układu, ale widać go.
  - (d) Critical Details mówi, że po błędzie widoku nieba statyczne pasmo pokazuje się „in every mode” i „jumps once”. Tymczasem Faza 4 §3 daje paskowi `TonightSky` warianty trybu, więc statyczne pasmo podąża za trybem. Bez ramy `SKY_FRAME_CLASS` jego `sky-expanded:flex-1` nie działa. To samo dotyczy statycznego pasma bez Supabase w `tonight.astro:49-56`.
- **Fix**: w `sky-band.ts` wypisać pełny łańcuch klas (rama `sky-expanded:flex flex-col`, pasmo `sky-expanded:flex sky-expanded:flex-col sky-expanded:flex-1`, wrapper pasa `flex-1 min-h-68`) i zaznaczyć, że RO obserwuje wrapper. Ukryć pole (`invisible`, tak jak dziś `compassTop === null`), dopóki pierwszy pomiar nie zgadza się z trybem innym niż DEFAULT. W jednym zdaniu ustalić, czy statyczne pasmo podąża za trybem (wtedy dostaje ramę i nie skacze), czy zawsze jest DEFAULT (wtedy szkielet i tak zarezerwował tryb). Rekomenduję pierwszą opcję, bo i tak współdzieli klasy.
  - Strength: każdy punkt wynika z dzisiejszego markupu (`:451, :483-489`, `TonightSky.astro:57-68`).
  - Tradeoff: kilka klas więcej w `sky-band.ts`.
  - Confidence: HIGH dla (a), (b) i (d), MED dla (c), bo zależy od odstępu między wstawieniem HTML wyspy a hydratacją.
  - Blind spot: brak.
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

### F5 — Q6: polskie nazwy trybów nie zgadzają się rodzajem z nagłówkiem „Widok nieba”

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage (i18n)
- **Location**: plan.md, Faza 1 §5, pytanie Q6
- **Detail**: „Widok” jest rodzaju męskiego, więc „Widok nieba: Domyślne” (`mode.trigger`) jest niegramatyczne. Formy nijakie („Ukryte / Domyślne / Rozwinięte”) pasowałyby do „Niebo”.
- **Fix**: zostawić nagłówek „Widok nieba” i dać formy męskie: „Ukryty / Domyślny / Rozwinięty” („Widok nieba: Domyślny”). Druga możliwość to formy nijakie z nagłówkiem „Niebo”.
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

### F6 — Arytmetyka wysokości w research liczy nakładkę dwa razy

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Claim Accuracy
- **Location**: research.md § Heights („Phone band (DEFAULT) = 168 + 208 − 64 + 32 + 76 = 420”), plan.md Q2 A („Karty sprzętu idą w górę o ok. 220 px”)
- **Detail**: Dzisiaj wrapper pasa ma 272 px (SVG) z `-mt-16`, więc dokłada 208 px. Odejmowanie 64 px drugi raz jest błędem. Pasmo z suwakiem w DEFAULT na telefonie ma 168 + 208 + 32 + 76 = 484 px, a HIDDEN podnosi karty o ok. 284 px, nie 220. Obliczenie EXPANDED (pole 495 px przy 390×844) jest poprawne, bo tam research liczy już dobrze. Decyzje się nie zmieniają, ale ta sama pomyłka stoi za optymizmem przy Q3 (F1).
- **Fix**: poprawić liczby w Q2 A i w research przy okazji triage F1.
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

### F7 — Przeciąganie piórem walczy z natywnym przewijaniem, a zaznaczanie tekstu zaczyna się przed progiem

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md, Faza 3 §1
- **Detail**: Na ekranach dotykowych `pointerType: "pen"` podlega `touch-action`, więc przeglądarka sama przewija i wysyła `pointercancel`. Przeciąganie z JS i natywne przewijanie nałożą się na siebie albo drag urwie się w pół ruchu. Do tego `select-none` włącza się dopiero po 6 px, więc pierwsze piksele ruchu myszą mogą zacząć zaznaczanie podpisów SVG.
- **Fix**: obsługiwać tylko `mouse`. Pióro zostaje natywne, tak jak dotyk. `select-none` dawać na scroller na stałe dla precyzyjnych wskaźników (`pointer-fine:select-none` albo przy `pointerdown`). Zaktualizować regułę w CLAUDE.md (Faza 5).
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

### F8 — Przycisk trybu przy 320 px po polsku: brak asercji, że nie nachodzi na datę ani nagłówek

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md, Faza 4 §2 (umieszczenie przycisku), Faza 4 §4
- **Detail**: Przycisk ma 44 px i stoi od y=0 poniżej `sm`. Nagłówek zaczyna się na ok. 40 px (`pt-3` 12 + data 20 + `mt-line` 8), więc prawe 4 px pierwszej linii nagłówka leżą pod przyciskiem. Długi nagłówek w `text-display` przy 320 px (kolumna 288 px) może sięgnąć prawej krawędzi. Żaden test tego nie sprawdza. Spec `tonight-phone.spec.ts` łapie tylko przewijanie w bok.
- **Fix**: dodać do testu HIDDEN albo do specu modes asercję przy 320 px w PL (najdłuższy nagłówek z fixture'a), że prostokąt przycisku nie przecina się z prostokątami tekstu daty i nagłówka. Ewentualnie wyrównać przycisk do linii daty (`-mt-3`, środek na dacie).
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

### F9 — Weryfikacja: komendy e2e wymagają przygotowanego środowiska, a `segmented.tsx` jest tylko na allowliście

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md, wiersze 2.3, 3.2, 4.2 i 4.3; Faza 1 §4
- **Detail**: `playwright.config.ts` nie ma `webServer`. Gołe `npx playwright test …` z faz 2-4 nie przejdzie bez świeżego `npm run build` + `preview`, lokalnego Supabase, forecast fixture, `BASE_URL` i kluczy lokalnego stacku podanych inline (tak, jak opisuje to Faza 5 / 5.1). Osobno: plan dodaje `@/components/ui/segmented` do dozwolonych importów, ale nie dodaje samego `ui/segmented.tsx` do `SKY_SOURCES`, więc importy tego pliku nie są sprawdzane.
- **Fix**: w 2.3, 3.2, 4.2 i 4.3 dopisać ten sam prefiks środowiska co w 5.1. Dodać `here("./ui/segmented.tsx")` do `SKY_SOURCES` razem z `sky-mode-control.tsx`.
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

### F10 — Roadmapa: drobne niespójności

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `context/foundation/roadmap.md`
- **Detail**:
  - S-09 ma `planning` w tabeli i w szczegółach, `planned` w Backlog Handoff, a `change.md` ma `planned`.
  - MS-06 stoi przed MS-05 w Scope anchors.
  - S-11 „badges” sąsiaduje z wpisem w Parked „Social and sharing features, badges and leaderboards”. Linia Risk w S-11 to rozróżnia, ale tytuł w Parked czytany osobno sugeruje sprzeczność.
- **Fix**: ujednolicić status (`planned`), przenieść MS-06 za MS-05 i doprecyzować wpis w Parked: „badges to share”, jak w PRD:665.
- **Decision**: ACCEPTED (fix applied in plan.md § Plan review triage)

## Opinia o pytaniach do właściciela (Q1-Q6)

- **Q1 (przełącznik)**: zgoda z ⭐ A. Nie dodaje wysokości, więc przypięcie pierwszego ekranu w DEFAULT zostaje, i mieści się przy 320 px. B rzeczywiście zagraża przypięciu `tonight-phone.spec`, w którym zostaje ok. 33 px luzu (5 px w noc ze zdarzeniem). Warunek: asercja z F8.
- **Q2 (UKRYTY)**: zgoda z ⭐ A. Karty idą w górę o ok. 284 px, a nie 220 (F6). Warunek: wysokość z F2, czyli szkielet rezerwuje linię ciemnego okna.
- **Q3 (wysokość ROZWINIĘTEGO na desktopie)**: **nie B w obecnej postaci.** Przy 80 % EXPANDED na laptopach 1280×720 i 1366×768 jest niższy niż DEFAULT (616 px), a przy 1536×864 wyższy o 5 px (F1). Rekomenduję **A** (cały ekran pod Topbarem) z dolną granicą równą DEFAULT. Trzeba też uczciwie powiedzieć właścicielowi, że na laptopie zysk i tak jest mały (+16 px przy 1280×720, +196 px przy 1440×900), bo werdykt z suwakiem zajmuje 408 px. Jeśli zależy mu na laptopach, trzeba zwinąć padding werdyktu w tym trybie (osobna decyzja).
- **Q4 (pole widzenia)**: zgoda z ⭐ B. To stała skala, a nie zoom ani gest, więc nie łamie odrzuconego w interactive-sky „zoom / pinch”, a decyzję „180° na widok” zmienia tylko dla telefonu w EXPANDED. Na desktopie przy Q3 A pole ma 306-450 px, więc zakres 180° osiąga się przy wysokości pola 712 px. Desktop zawsze dochodzi do limitu 180° i w praktyce dostaje wariant A. Warto to napisać w pytaniu, żeby właściciel nie oczekiwał „prawdziwych proporcji” na laptopie. Warunek: reguła centrowania z F3.
- **Q5 (telefon w ROZWINIĘTYM)**: zgoda z ⭐ A. Bez drugiego `VerdictCard`, bez ponownego pomiaru i bez ryzyka „uwięzienia”. Pole 495 px to 1,8× dzisiejszego.
- **Q6 (nazwy)**: A, z poprawką gramatyczną z F5: „Widok nieba: Ukryty / Domyślny / Rozwinięty” (EN bez zmian).

## Triage summary

Triage 2026-10-17 (polecenie właściciela przez orkiestratora): F1-F10 przyjęte z poprawkami recenzenta. Zmiany opisuje `plan.md` § Plan review triage; `change.md` ma status `plan_reviewed`.
