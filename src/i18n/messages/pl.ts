import type { Messages } from "@/i18n";

/**
 * The Polish catalogue. It must match `en` key for key (`satisfies Messages`) and overrides every
 * leaf: `i18n.test.ts` fails on any string equal to its English counterpart outside a short list of
 * true invariants. Plurals add the `few` and `many` forms Polish needs ("2 obiekty", "5 obiektów").
 *
 * Informal second person ("ty"), capitalised "Twój" in direct address. Dates arrive in the
 * nominative ("sobota, 10 października 2026"), so they follow a colon rather than a preposition.
 *
 * Island-safe: no runtime imports.
 */
export const pl = {
  common: {
    appName: "Sidereus",
    pageTitle: (p) => `${p.title} · Sidereus`,
    saving: "Zapisywanie...",
    name: "Nazwa",
    focalLengthMm: "Ogniskowa (mm)",
  },

  nav: {
    tonight: "Dziś w nocy",
    log: "Dziennik",
    myGear: "Mój sprzęt",
    signIn: "Zaloguj się",
    signOut: "Wyloguj się",
    settings: "Ustawienia",
    primary: "Główna nawigacja",
    signedInAs: "Zalogowano jako",
  },

  preferences: {
    theme: "Motyw",
    dark: "Ciemny motyw",
    light: "Jasny motyw",
    red: "Czerwony tryb nocny",
    darkShort: "Ciemny",
    lightShort: "Jasny",
    redShort: "Czerwony",
    cycle: (p: { current: string; next: string }) =>
      `Motyw: ${p.current.toLocaleLowerCase("pl")}. Przełącz na ${p.next.toLocaleLowerCase("pl")}.`,
    language: "Język",
    english: "English",
    polish: "Polski",
  },

  config: {
    warning: "Uwaga:",
    docs: "Dokumentacja",
    supabase: {
      message: "Supabase nie jest skonfigurowany — logowanie jest wyłączone.",
      docsLabel: "Zobacz instrukcję konfiguracji",
    },
  },

  verdict: {
    level: { go: "Pogodnie", marginal: "Częściowo pogodnie", "no-go": "Pochmurno" },
    sky: {
      humidityCap: "Pogodnie, ale wilgotno",
      fallbackCap: "Pogodnie (stara prognoza)",
      noForecast: "Brak prognozy",
    },
    inline: {
      go: "pogodnie",
      marginal: "częściowo pogodnie",
      "no-go": "pochmurno",
      humidityCap: "pogodnie, ale wilgotno",
      fallbackCap: "pogodnie według starej prognozy",
      noForecast: "brak prognozy",
      noDarkness: "brak ciemnej nocy",
    },
  },

  landing: {
    kicker: "Messier 1 – 110 · Twoje niebo, Twój sprzęt",
    tagline: "Czy dziś warto rozstawiać teleskop?",
    lead: "Jasna ocena nocy i krótka, uzasadniona lista obiektów, na które warto skierować teleskop — z okularami, które już masz.",
    verdictsLabel: "Prognozy nieba",
    howItWorks: "Jak to działa",
    steps: {
      where: "Powiedz nam, skąd obserwujesz",
      kit: "Wybierz teleskop i okulary",
      tonight: "Zobacz ocenę nocy i do pięciu celów na dziś",
    },
    getStarted: "Zacznij",
    signIn: "Zaloguj się",
    openTonight: "Przejdź do „Dziś w nocy”",
    screenshotAlt:
      "Widok „Dziś w nocy” w Sidereusie: pogodne niebo z oknem ciemności, a pod nim uszeregowane obiekty Messiera, każdy z kierunkiem na niebie i podpowiedzią okularu.",
    footerPrefix: "Nazwa pochodzi od dzieła Galileusza",
    footerWork: "Sidereus Nuncius",
    footerSuffix: " z 1610 roku.",
  },

  auth: {
    email: "E-mail",
    emailPlaceholder: "twoj.adres@example.com",
    password: "Hasło",
    showPassword: "Pokaż hasło",
    hidePassword: "Ukryj hasło",
    signIn: {
      title: "Logowanie",
      passwordPlaceholder: "Twoje hasło",
      submit: "Zaloguj się",
      pending: "Logowanie...",
      noAccount: "Nie masz konta?",
      signUpLink: "Załóż konto",
      continueNote: "Zaloguj się, aby kontynuować.",
    },
    signUp: {
      title: "Rejestracja",
      passwordPlaceholder: "Min. 6 znaków",
      confirmPassword: "Powtórz hasło",
      confirmPlaceholder: "Wpisz hasło jeszcze raz",
      submit: "Załóż konto",
      pending: "Zakładanie konta...",
      haveAccount: "Masz już konto?",
      signInLink: "Zaloguj się",
      moreCharacters: {
        one: (p) => `Wpisz jeszcze ${p.count} znak`,
        few: (p) => `Wpisz jeszcze ${p.count} znaki`,
        many: (p) => `Wpisz jeszcze ${p.count} znaków`,
        other: (p) => `Wpisz jeszcze ${p.count} znaku`,
      },
    },
    validation: {
      emailRequired: "Podaj adres e-mail",
      emailInvalid: "Podaj poprawny adres e-mail",
      passwordRequired: "Podaj hasło",
      passwordTooShort: (p) => `Hasło musi mieć co najmniej ${p.min} znaków`,
      confirmRequired: "Potwierdź hasło",
      passwordsDiffer: "Hasła się różnią",
    },
    confirmEmail: {
      registered: {
        heading: "Konto założone",
        description: "Twoje konto jest gotowe. Możesz się teraz zalogować.",
        link: "Przejdź do logowania",
      },
      checkEmail: {
        heading: "Sprawdź skrzynkę",
        description: "Wysłaliśmy link potwierdzający na Twój adres e-mail. Kliknij go, żeby aktywować konto.",
        link: "Wróć do logowania",
      },
    },
  },

  databaseMissing: {
    title: "Baza danych nie jest skonfigurowana",
    bodyPrefix:
      "Sidereus nie może połączyć się z bazą danych, więc nie da się wyświetlić ani zapisać Twoich stanowisk i sprzętu. Ustaw",
    and: "i",
    bodySuffix: "i uruchom serwer ponownie.",
  },

  gear: {
    title: "Mój sprzęt",
    kicker: "Twoje niebo, Twój sprzęt",
    back: "← Mój sprzęt",
    backToGear: "Wróć do sprzętu",
    notFound: "Nie znaleziono",
    sites: {
      heading: "Stanowiska",
      add: "Dodaj stanowisko",
      empty:
        "Nie masz jeszcze żadnego stanowiska. Dodaj miejsce, z którego obserwujesz, żeby ocena nocy uwzględniała Twoje niebo.",
      bortle: (p) => `${p.bortle} w skali Bortle'a`,
      minAltitude: (p) => `min. wysokość ${p.degrees}°`,
      zonePinned: "ustawiona ręcznie",
      zoneAuto: "automatyczna",
      newTitle: "Dodaj stanowisko",
      editTitle: "Edytuj stanowisko",
      fallbackTitle: "Stanowisko",
      notFoundText: "To stanowisko nie istnieje albo nie należy do Ciebie.",
      delete: "Usuń stanowisko",
      confirmDelete: "Usunąć to stanowisko? Tego nie da się cofnąć.",
    },
    telescopes: {
      heading: "Teleskopy",
      add: "Dodaj teleskop",
      empty:
        "Nie masz jeszcze żadnego teleskopu. Dodaj swój, żeby proponowane powiększenia pasowały do Twojego sprzętu.",
      aperture: (p) => `apertura ${p.mm} mm`,
      focalLength: (p) => `ogniskowa ${p.mm} mm`,
      newTitle: "Dodaj teleskop",
      editTitle: "Edytuj teleskop",
      fallbackTitle: "Teleskop",
      notFoundText: "Ten teleskop nie istnieje albo nie należy do Ciebie.",
      delete: "Usuń teleskop",
      confirmDelete: "Usunąć ten teleskop? Tego nie da się cofnąć.",
    },
    eyepieces: {
      heading: "Okulary",
      add: "Dodaj okular",
      empty:
        "Nie masz jeszcze żadnego okularu. Dodaj te ze swojej walizki, żeby do każdego obiektu dobrać okulary, które naprawdę masz.",
      focalLength: (p) => `${p.mm} mm`,
      afov: (p) => `pole widzenia ${p.degrees}° · ${p.type}`,
      otherType: "Inny",
      newTitle: "Dodaj okular",
      editTitle: "Edytuj okular",
      fallbackTitle: "Okular",
      notFoundText: "Ten okular nie istnieje albo nie należy do Ciebie.",
      delete: "Usuń okular",
      confirmDelete: "Usunąć ten okular? Tego nie da się cofnąć.",
    },
  },

  eyepiecePresets: {
    plossl: { short: "Plössl", long: "Plössl (ok. 50°)" },
    wide: { short: "Szerokokątny", long: "Szerokokątny (ok. 68°)" },
    ultrawide: { short: "Ultraszerokokątny", long: "Ultraszerokokątny (ok. 82°)" },
    other: "Inny (wpisz pole widzenia)",
  },

  siteForm: {
    namePlaceholder: "Ogród za domem",
    latitude: "Szerokość geograficzna (°)",
    longitude: "Długość geograficzna (°)",
    coordinatesHint:
      "Przy zapisie współrzędne są zaokrąglane do 2 miejsc po przecinku (ok. 1 km). Północ i wschód mają wartości dodatnie.",
    bortle: "Ciemność nieba (skala Bortle'a)",
    chooseBortle: "Wybierz klasę",
    bortleOption: (p) => `${p.value} · ${p.label}`,
    bortleLabels: {
      1: "Wyjątkowo ciemne niebo",
      2: "Naprawdę ciemne niebo",
      3: "Niebo wiejskie",
      4: "Między wsią a przedmieściem",
      5: "Niebo podmiejskie",
      6: "Jasne niebo podmiejskie",
      7: "Między przedmieściem a miastem",
      8: "Niebo miejskie",
      9: "Centrum dużego miasta",
    },
    minAltitude: "Minimalna wysokość (°)",
    minAltitudeHint: "Obiekty położone niżej, np. za drzewami albo dachami, są pomijane.",
    timeZone: "Strefa czasowa",
    autoCurrent: (p) => `Automatycznie, obecnie ${p.zone}`,
    autoFromCoordinates: "Automatycznie (ze współrzędnych)",
    submit: "Zapisz stanowisko",
  },

  telescopeForm: {
    namePlaceholder: "Newton 130 mm",
    aperture: "Apertura (mm)",
    focalRatio: "Światłosiła",
    focalRatioHint: "Ogniskowa ÷ apertura — szybki sposób, żeby sprawdzić obie liczby. Nie jest zapisywana.",
    submit: "Zapisz teleskop",
  },

  eyepieceForm: {
    namePlaceholder: "Plössl 25 mm",
    type: "Typ okularu",
    chooseType: "Wybierz typ",
    typeHint: "Typ określa pozorne pole widzenia. Jeśli nie masz pewności, sprawdź tulejkę okularu albo pudełko.",
    afov: "Pozorne pole widzenia (°)",
    submit: "Zapisz okular",
  },

  onboarding: {
    title: "Skonfiguruj Sidereus",
    intro:
      "Trzy szybkie wybory i ocena dzisiejszej nocy jest gotowa. Każdy z nich zmienisz później w zakładce Mój sprzęt.",
    submit: "Pokaż mi dzisiejszą noc",
    locationRequired: "Najpierw ustaw lokalizację powyżej.",
    where: {
      kicker: "1 · Miejsce",
      heading: "Skąd obserwujesz?",
      hint: "Twój dom albo miejsce, w którym zwykle rozstawiasz sprzęt. Zapisujemy je z dokładnością do ok. 1 km, nigdy dokładniej.",
      useLocation: "Użyj mojej lokalizacji",
      locating: "Szukam Twojej lokalizacji...",
      locationDenied:
        "Dostęp do lokalizacji jest zablokowany, więc wyszukaj miejsce. Możesz go później włączyć w ustawieniach przeglądarki.",
      locationUnavailable: "Nie udało się ustalić Twojej lokalizacji. Wyszukaj miejsce.",
      or: "albo",
      searchLabel: "Wyszukaj miejscowość",
      searchPlaceholder: "np. Toruń",
      searching: "Szukam...",
      noResults: "Nie znaleziono takiego miejsca. Sprawdź pisownię albo wpisz pobliską miejscowość.",
      resultsLabel: "Pasujące miejsca",
      resultsCount: {
        one: (p) => `Znaleziono ${p.count} miejsce`,
        few: (p) => `Znaleziono ${p.count} miejsca`,
        many: (p) => `Znaleziono ${p.count} miejsc`,
        other: (p) => `Znaleziono ${p.count} miejsca`,
      },
      searchFallback: "Zamiast tego możesz wpisać współrzędne poniżej.",
      manualToggle: "Wpisz współrzędne ręcznie",
      usingDevice: "Używam Twojej bieżącej lokalizacji (z dokładnością do ok. 1 km)",
      usingPlace: (p) => `Używam lokalizacji: ${p.place} (z dokładnością do ok. 1 km)`,
      usingCoordinates: "Używam wpisanych współrzędnych, zaokrąglonych do ok. 1 km",
    },
    sky: {
      kicker: "2 · Niebo",
      heading: "Jak ciemne jest Twoje niebo?",
      hint: "Wybierz opis najbliższy pogodnej, bezksiężycowej nocy tam, gdzie obserwujesz.",
    },
    kit: {
      kicker: "3 · Sprzęt",
      heading: "Jaki masz sprzęt?",
      telescope: "Teleskop",
      telescopeHint:
        "Wybierz najbliższy model, a potem popraw liczby, jeśli Twój się różni. Znajdziesz je na tubusie albo w instrukcji.",
      eyepieces: "Okulary",
      eyepiecesHint: "Zacznij od zestawu, a potem popraw, usuń albo dodaj okulary, żeby pasowały do tego, co masz.",
      emptyKit: "Dodasz je później w zakładce Mój sprzęt",
      noEyepieces: "Na razie bez okularów. Lista na dziś i tak zadziała, a okulary dodasz później.",
      eyepieceLegend: (p) => `Okular ${p.number}`,
      removeEyepiece: (p) => `Usuń okular ${p.number}`,
      eyepieceLimit: "To już 10 okularów, więcej tutaj nie dodasz. Kolejne dodasz później w zakładce Mój sprzęt.",
    },
    credit: {
      placeSearch: "Wyszukiwanie miejsc:",
      locationData: "Dane o miejscach na podstawie",
    },
    homeSiteName: "Dom",
    telescopes: {
      r102: "Refraktor 102 mm",
      n130: "Reflektor 130 mm",
      n150: "Reflektor 150 mm",
      d200: "Dobson 8 cali",
      m127: "Maksutow 127 mm",
    },
    eyepieceKits: {
      pair: "Okulary z zestawu",
      "plossl-set": "Zestaw okularów Plössla",
      none: "Na razie bez okularów",
    },
    scenes: {
      city: {
        title: "Centrum miasta",
        description:
          "Niebo świeci szaro albo pomarańczowo, widać tylko najjaśniejsze gwiazdy i planety, a Drogi Mlecznej nie ma wcale.",
      },
      suburb: {
        title: "Przedmieścia",
        description:
          "Główne gwiazdozbiory łatwo rozpoznać, ale Droga Mleczna to najwyżej słaba mgiełka wysoko nad głową.",
      },
      town: {
        title: "Dalekie przedmieścia lub małe miasto",
        description: "Widać setki gwiazd, a Droga Mleczna jest widoczna nad głową, ale blednie w stronę horyzontu.",
      },
      village: {
        title: "Wieś",
        description:
          "Droga Mleczna wyraźnie przecina niebo, a nisko nad horyzontem widać tylko kilka łun odległych miast.",
      },
      remote: {
        title: "Odludne, ciemne miejsce",
        description:
          "Gwiazdy wypełniają całe niebo, a Droga Mleczna jest tak jasna, że widać w niej ciemne pasma i jasne obłoki gwiazd.",
      },
    },
  },

  /** Kompas 16-kierunkowy, zgodnie z ruchem wskazówek zegara od północy (W = wschód, Z = zachód). */
  compass: [
    "Pn",
    "PnPnW",
    "PnW",
    "WPnW",
    "W",
    "WPdW",
    "PdW",
    "PdPdW",
    "Pd",
    "PdPdZ",
    "PdZ",
    "ZPdZ",
    "Z",
    "ZPnZ",
    "PnZ",
    "PnPnZ",
  ],

  tonight: {
    title: "Dziś w nocy",
    kicker: "Twoje niebo dziś w nocy",
    addSitePrompt: "Dodaj stanowisko obserwacyjne, żeby zobaczyć ocenę nocy",
    addSite: "Dodaj stanowisko",
    addTelescopePrompt: "Dodaj teleskop, żeby zobaczyć ocenę nocy",
    addTelescope: "Dodaj teleskop",
    setupPrompt: "Ustaw swoje stanowisko i teleskop — zajmie to około minuty",
    setup: "Skonfiguruj",
    logged: (p) => `Zapisano obserwację: ${p.object}.`,
    logFailed:
      "Nie udało się wczytać Twojego dziennika obserwacji, więc widziane obiekty nie są teraz przesuwane w dół.",
    eyepiecesFailed: "Nie udało się wczytać Twoich okularów, więc obiekty na dziś pokazujemy bez propozycji okularów.",
    noEyepiecesPrompt: "Dodaj okulary, a przy każdym obiekcie pokażemy parę do szukania i do szczegółów.",
    addEyepieces: "Dodaj okulary",
    failed: "Nie udało się obliczyć dzisiejszego nieba. Spróbuj ponownie.",
    loading: "Wczytuję dzisiejsze niebo…",
    loadingSlow: "To trwa dłużej niż zwykle.",
    reload: "Odśwież",
    siteSelector: {
      label: "Stanowisko",
      show: "Pokaż",
    },
    selector: {
      label: "Teleskop",
      show: "Pokaż",
    },
    rankingFor: (p) => `Dla: ${p.telescope}`,

    card: {
      kicker: "Niebo dziś w nocy",
      darkFrom: "Ciemno od",
      darkTo: "do",
      noDarkWindow: "Brak ciemnej nocy",
      timesIn: (p) => ` · czas w strefie ${p.zone}`,
    },

    nights: {
      // "nocy" (genitive plural) fits counts 5-21, which covers OUTLOOK_NIGHTS = 7; switch to plural() if it changes.
      heading: (p) => `Najbliższe ${p.count} nocy: ${p.site}`,
      jumpLink: (p) => `Najbliższe ${p.count} nocy ↓`,
      timesIn: (p) => `Czas w strefie ${p.zone}`,
      verdictLabel: "Ocena",
      outlookLabel: "Prognoza — bez oceny",
      noDarkness: "Brak ciemności",
      moon: (p) => `Księżyc ${p.percent}%`,
      moonFree: (p) => `${p.moon} · ${p.duration} pod horyzontem`,
      moonAllNight: (p) => `${p.moon} · nad horyzontem przez całe okno ciemności`,
      moonNone: (p) => `${p.moon} · pod horyzontem przez całą noc`,
      cloud: (p) => `Zachmurzenie ~${p.mean}%`,
      cloudRange: (p) => `Zachmurzenie ~${p.mean}%, chwilami ${p.min}%`,
      noCloud: "Brak jeszcze prognozy zachmurzenia",
    },

    object: {
      inConstellation: (p) => `gwiazdozbiór ${p.constellation}`,
      window: "Widoczność",
      best: "Najlepiej",
      findWith: "Do szukania:",
      detailWith: "do szczegółów:",
      magnification: (p) => `(${p.magnification}×)`,
      noneFit: (p) =>
        `Obiekt nie mieści się w polu widzenia żadnego z Twoich okularów; weź najszerszy (${p.name}) i przesuwaj teleskop po obiekcie`,
      seen: {
        one: (p) => `Widziany ${p.count} raz – ostatnio ${p.date}`,
        few: (p) => `Widziany ${p.count} razy – ostatnio ${p.date}`,
        many: (p) => `Widziany ${p.count} razy – ostatnio ${p.date}`,
        other: (p) => `Widziany ${p.count} razy – ostatnio ${p.date}`,
      },
      markObserved: "Zapisz obserwację",
    },

    // Planet names stay in the nominative: where one follows other words (the "Mark observed" link name), a colon
    // separates them, as in `logged`, so no grammatical case is needed.
    planets: {
      heading: "Planety dziś w nocy",
      listLabel: "Planety",
      window: (p) => `Od zmierzchu cywilnego do świtu, ${p.start}–${p.end}`,
      none: "Dziś między zmierzchem a świtem żadna planeta nie jest dobrze widoczna przez Twój teleskop.",
      noneInClearHours: "W pogodnych godzinach tej nocy żadna planeta nie jest dobrze widoczna przez Twój teleskop.",
      markObserved: (p) => `Zapisz obserwację: ${p.planet}`,
      weather: {
        line: (p) => `Dla planet: ${p.sky} — ${p.reason}`,
        clearRun: (p) => `${p.hours} godz. z rzędu z zachmurzeniem najwyżej ${p.cloud}% między zmierzchem a świtem`,
        humidityCap: (p) =>
          `między zmierzchem a świtem niebo dość czyste, ale wilgotność sięga ${p.humidity}%, więc spodziewaj się rosy i zamglenia`,
        fallbackCap: (p) =>
          `ostatnia zapisana prognoza pokazywała ${p.hours} godz. z rzędu z zachmurzeniem najwyżej ${p.cloud}% między zmierzchem a świtem, ale nie udało się jej odświeżyć`,
        noWeatherData: "brak danych pogodowych",
        clearHours: (p) => `pogodnie w godz. ${p.hours}`,
        clearHoursHumid: (p) =>
          `pogodnie w godz. ${p.hours}, ale wilgotność sięga ${p.humidity}%, więc spodziewaj się rosy i zamglenia`,
        clearHoursFallback: (p) =>
          `pogodnie w godz. ${p.hours} według ostatniej zapisanej prognozy, której nie udało się odświeżyć`,
      },
      magnitude: (p) => `jasność ${p.mag} mag`,
      size: (p) => `${p.arcsec}″`,
      phase: (p) => `faza ${p.percent}%`,
      rings: (p) => `pierścienie nachylone o ${p.degrees}°`,
      detailWith: "Do szczegółów:",
      reason: {
        high: {
          evening: (p) => `Wysoko około ${p.time} — najlepiej wieczorem`,
          night: (p) => `Wysoko około ${p.time} — najlepiej w środku nocy`,
          morning: (p) => `Wysoko około ${p.time} — najlepiej przed świtem`,
        },
        well: {
          evening: (p) => `Dość wysoko około ${p.time} — najlepiej wieczorem`,
          night: (p) => `Dość wysoko około ${p.time} — najlepiej w środku nocy`,
          morning: (p) => `Dość wysoko około ${p.time} — najlepiej przed świtem`,
        },
        low: {
          evening: (p) => `Nisko około ${p.time} — patrz zaraz po zmierzchu, przy odsłoniętym horyzoncie`,
          night: (p) => `Nisko około ${p.time} — potrzebujesz odsłoniętego horyzontu`,
          morning: (p) => `Nisko około ${p.time} — patrz tuż przed świtem, przy odsłoniętym horyzoncie`,
        },
      },
      note: {
        mercury:
          "Mała, jasna kropka nisko nad horyzontem o zmierzchu lub o świcie; przy większym powiększeniu możesz dostrzec fazę.",
        venus: "Oślepiająco jasna i bez szczegółów, ale jej fazę łatwo zobaczyć — wygląda jak maleńki Księżyc.",
        mars: "Mała pomarańczowa tarcza; szczegóły powierzchni wymagają spokojnego powietrza i cierpliwości, a często nie widać ich wcale.",
        jupiter: "Jasna tarcza z dwoma ciemnymi pasami chmur i nawet czterema księżycami ustawionymi w linii obok.",
        saturn:
          "Pierścienie widać wyraźnie już przy niewielkim powiększeniu; największy księżyc, Tytan, wygląda jak gwiazda tuż obok.",
        uranus:
          "Maleńka niebieskozielona tarcza: przy dużym powiększeniu widać, że to nie gwiazda, ale nie widać na niej żadnych szczegółów.",
        neptune: "Maleńka niebieskoszara kropka, trudna do odróżnienia od gwiazdy; samo odnalezienie jej to sukces.",
      },
    },

    // Lunar features by their established Polish names (Morze Przesileń, Zatoka Tęczy, Kopernik…); a crater's name
    // follows "krater"/"kraterów" in the nominative, as Polish observing guides write it.
    moon: {
      // Adjectives agreeing with the implied "Księżyc" (masculine), as in "Księżyc garbaty".
      phase: {
        "waxing-crescent": "Sierp przybywający",
        "first-quarter": "Pierwsza kwadra",
        "waxing-gibbous": "Garbaty przybywający",
        full: "Pełnia",
        "waning-gibbous": "Garbaty ubywający",
        "last-quarter": "Ostatnia kwadra",
        "waning-crescent": "Sierp ubywający",
      },
      lit: (p) => `oświetlony w ${p.percent}%`,
      phaseLine: (p) => `${p.phase} · ${p.lit}`,
      wholeDiscWith: "Cała tarcza:",
      detailWith: "do szczegółów:",
      partDisc: (p) => `Żaden z Twoich okularów nie mieści całej tarczy; najszerszy (${p.name}) pokaże jej część`,
      reason: {
        line: (p) => `Najwyżej ${p.altitude}° o ${p.time} — ${p.timing}`,
        low: (p) => `Najwyżej tylko ${p.altitude}° o ${p.time} — ${p.timing}; tak nisko obraz może falować`,
        timing: {
          evening: "najlepiej wieczorem",
          night: "najlepiej w środku nocy",
          morning: "najlepiej przed świtem",
        },
      },
      markObserved: (p) => `Zapisz obserwację: ${p.name}`,
      card: {
        kicker: "Księżyc dziś w nocy",
        discLabel: (p) => `Księżyc o ${p.time}: ${p.phase}, ${p.lit}`,
        slider: "Pora nocy",
        now: "Teraz",
        up: {
          all: "Nad horyzontem przez całą noc",
          sets: (p) => `Zachodzi o ${p.time}`,
          spans: (p) => `Nad horyzontem w godz. ${p.spans}`,
          never: "Dziś w nocy pod horyzontem",
        },
        faint: {
          washedOut: {
            one: (p) => `Jasny Księżyc: ${p.count} słaby obiekt ginie dziś w jego blasku`,
            few: (p) => `Jasny Księżyc: ${p.count} słabe obiekty giną dziś w jego blasku`,
            many: (p) => `Jasny Księżyc: ${p.count} słabych obiektów ginie dziś w jego blasku`,
            other: (p) => `Jasny Księżyc: ${p.count} słabego obiektu ginie dziś w jego blasku`,
          },
          unaffected: (p) => `Księżyc nad horyzontem w godz. ${p.spans} · żaden słaby obiekt nie ginie`,
          moonlit: "Niebo rozjaśnione Księżycem · żaden słaby obiekt nie ginie",
          dark: "Ciemna noc: bez Księżyca",
        },
      },
      note: {
        "waxing-crescent":
          "Wąski sierp wieczorem nad zachodnim horyzontem. Przy granicy cienia szukaj Morza Przesileń i łańcucha kraterów od Langrenusa do Petawiusza; ciemna część tarczy może słabo świecić światłem popielatym.",
        "first-quarter":
          "Połowa tarczy oświetlona, a rzeźba terenu jest najwyraźniejsza w całym miesiącu: przy granicy cienia szukaj Apeninów i Alp oraz kraterów Platon i Archimedes.",
        "waxing-gibbous":
          "Oświetlona jest większość tarczy. Przy granicy cienia szukaj krateru Kopernik, Zatoki Tęczy z łukiem gór na jej brzegu, a pod koniec tej fazy jasnego krateru Arystarch.",
        full: "Cieni prawie nie ma, więc kratery wyglądają płasko; szukaj za to jasnych promieni wokół kraterów Tycho i Kopernik oraz lśniącego krateru Arystarch. Jeśli blask męczy oko, filtr księżycowy albo małe powiększenie poprawią komfort.",
        "waning-gibbous":
          "Wschodzi coraz później wieczorem; granica cienia wyznacza teraz miejsca, gdzie na Księżycu zachodzi Słońce. W tej fazie szukaj przy niej kraterów Langrenus i Petawiusz, a nieco później krateru Teofil.",
        "last-quarter":
          "Połowa tarczy oświetlona, najlepiej przed świtem: granica cienia wydobywa kratery Platon i Kopernik oraz długie cienie Apeninów.",
        "waning-crescent":
          "Sierp przed świtem, nisko na wschodzie. Przy granicy cienia szukaj jasnego krateru Arystarch i ciemnego krateru Grimaldi; reszta tarczy może słabo świecić światłem popielatym.",
      },
    },

    time: {
      hours: (p) => `${p.hours} godz.`,
      minutes: (p) => `${p.minutes} min`,
      hoursMinutes: (p) => `${p.hours} godz. ${p.minutes} min`,
    },

    direction: (p) => `${p.point}, ${p.altitude}°`,

    reason: {
      line: (p) => `${p.lead} · ${p.second}`,
      duration: {
        lead: (p) => `Na niebie przez ${p.duration} w oknie ciemności`,
        follow: (p) => `na niebie przez ${p.duration} w oknie ciemności`,
      },
      moon: {
        lead: "Lepiej od innych znosi blask Księżyca",
        follow: "lepiej od innych znosi blask Księżyca",
      },
      brightness: {
        lead: (p) => `Jasny obiekt dla Twoich ${p.aperture} mm`,
        follow: (p) => `jasny obiekt dla Twoich ${p.aperture} mm`,
      },
      sky: {
        lead: (p) => `Poradzi sobie pod Twoim niebem (${p.bortle} w skali Bortle'a)`,
        follow: (p) => `poradzi sobie pod Twoim niebem (${p.bortle} w skali Bortle'a)`,
      },
    },

    verdictReason: {
      clearRun: (p) => `${p.hours} godz. z rzędu z zachmurzeniem najwyżej ${p.cloud}% w oknie ciemności`,
      humidityCap: (p) =>
        `niebo dość czyste, ale wilgotność sięga ${p.humidity}%, więc spodziewaj się rosy i zamglenia`,
      fallbackCap: (p) =>
        `ostatnia zapisana prognoza pokazywała ${p.hours} godz. z rzędu z zachmurzeniem najwyżej ${p.cloud}%, ale nie udało się jej odświeżyć`,
      noForecast: "prognoza nie obejmuje okna ciemności",
      cloudy: (p) => `za dużo chmur: w najczystszej ciemnej godzinie zachmurzenie wynosi ${p.cloud}%`,
      noWeatherData: "brak danych pogodowych",
      noDarkness: "dziś w nocy nie robi się wystarczająco ciemno",
    },

    all: {
      title: "Wszystkie obiekty",
      heading: {
        one: (p) => `${p.count} obiekt wart dziś uwagi`,
        few: (p) => `Wszystkie ${p.count} obiekty warte dziś uwagi`,
        many: (p) => `Wszystkie ${p.count} obiektów wartych dziś uwagi`,
        other: (p) => `Wszystkie ${p.count} obiektu wartego dziś uwagi`,
      },
      back: "Dziś w nocy",
      sortLabel: "Kolejność",
      byRank: "Według oceny",
      byTime: "Według najlepszej pory",
      sortHintRank: "Najlepsze najpierw, jak w widoku Dziś w nocy. Otwórz wiersz, aby zobaczyć szczegóły.",
      sortHintTime: "W kolejności, w jakiej są dziś najlepiej widoczne. Otwórz wiersz, aby zobaczyć szczegóły.",
      seeAll: "Zobacz wszystkie",
      seeAllCount: {
        one: (p) => `Zobacz ${p.count} obiekt`,
        few: (p) => `Zobacz wszystkie ${p.count} obiekty`,
        many: (p) => `Zobacz wszystkie ${p.count} obiektów`,
        other: (p) => `Zobacz wszystkie ${p.count} obiektu`,
      },
      empty: "Dziś żaden obiekt nie jest wart uwagi, więc nie ma czego wyświetlić.",
    },

    cleared: {
      none: "Dziś żaden obiekt nie jest wart uwagi",
      count: {
        one: (p) => `${p.count} obiekt wart dziś uwagi`,
        few: (p) => `${p.count} obiekty warte dziś uwagi`,
        many: (p) => `${p.count} obiektów wartych dziś uwagi`,
        other: (p) => `${p.count} obiektu wartego dziś uwagi`,
      },
    },

    washedOut: {
      line: {
        one: (p) => `${p.count} słaby obiekt ginie dziś w blasku Księżyca`,
        few: (p) => `${p.count} słabe obiekty giną dziś w blasku Księżyca`,
        many: (p) => `${p.count} słabych obiektów ginie dziś w blasku Księżyca`,
        other: (p) => `${p.count} słabego obiektu ginie dziś w blasku Księżyca`,
      },
      heading: "Giną w blasku Księżyca",
      intro:
        "Dzisiejszy Księżyc tak rozjaśnia niebo wokół tych słabych obiektów, że bardzo trudno byłoby je dostrzec. W bezksiężycową noc byłyby na liście.",
    },

    age: {
      lessThanMinute: "niecałą minutę",
      minutes: (p) => `${p.minutes} min`,
      hours: (p) => `${p.hours} godz.`,
      days: {
        one: (p) => `${p.count} dzień`,
        few: (p) => `${p.count} dni`,
        many: (p) => `${p.count} dni`,
        other: (p) => `${p.count} dnia`,
      },
    },

    forecast: {
      fresh: (p) => `Prognoza zaktualizowana ${p.age} temu`,
      fallback: (p) => `Serwis pogodowy nie odpowiada — pokazujemy prognozę pobraną ${p.age} temu`,
      none: "Brak danych pogodowych — serwis pogodowy nie odpowiada, a nie ma zapisanej wcześniejszej prognozy",
    },

    nextNight: {
      found: (p) => `Następna pogodniejsza noc: ${p.date} (${p.sky})`,
      beyondForecast:
        "Prognoza nie sięga dalej niż dzisiejsza noc, więc nie ma jeszcze kolejnej nocy do zaproponowania",
      noneThrough: (p) => `Brak pogodnej nocy w prognozie; ostatnia sprawdzona noc: ${p.date}`,
    },

    noDarkness: {
      latitude: (p) => `${p.degrees}° szerokości ${p.hemisphere}`,
      north: "północnej",
      south: "południowej",
      sunUp: (p) => `Na ${p.latitude} o tej porze roku Słońce przez całą noc pozostaje nad horyzontem`,
      shallow: (p) =>
        `Na ${p.latitude} o tej porze roku Słońce schodzi tylko ${p.depth}° pod horyzont, a Twoje niebo (${p.bortle} w skali Bortle'a) potrzebuje ${p.threshold}°`,
    },

    darkReturn: {
      never: "Okno ciemności nie wróci w ciągu najbliższego roku",
      on: (p) => `Następne okno ciemności: ${p.date} (${p.start}–${p.end})`,
    },

    attribution: {
      objectData: "Dane obiektów:",
      weather: "Pogoda:",
    },
  },

  targets: {
    planet: {
      mercury: "Merkury",
      venus: "Wenus",
      mars: "Mars",
      jupiter: "Jowisz",
      saturn: "Saturn",
      uranus: "Uran",
      neptune: "Neptun",
    },
    planetDetail: "Planeta",
    moon: "Księżyc",
    moonDetail: "Naturalny satelita Ziemi",
  },

  log: {
    kicker: "Dziennik obserwacji",
    title: (p) => `Nowy wpis: ${p.object}`,
    intro: "Potwierdź noc, stanowisko i teleskop, a potem oceń, jak poszło.",
    night: "Noc obserwacji",
    nightHint: "Data wieczoru, w którym zaczęła się noc — także gdy obserwacja była po północy.",
    site: "Stanowisko",
    telescope: "Teleskop",
    rating: "Jak poszło?",
    ratingLow: "1 · Nie udało się dostrzec",
    ratingHigh: "5 · Znakomicie",
    ratingHint: "Ocena 1–2 zostawia obiekt na swoim miejscu; 3–5 lekko obniża go w kolejnych rankingach.",
    submit: "Zapisz obserwację",
    back: "← Dziś w nocy",
    objectNotFound: "Sidereus nie zna tego obiektu.",
    needsGear: "Dodaj stanowisko i teleskop, zanim zapiszesz obserwację.",
    addGear: "Przejdź do sprzętu",
    manualTitle: "Dodaj obserwację",
    manualIntro:
      "Wybierz obiekt Messiera, Księżyc albo planetę, potwierdź noc, stanowisko i teleskop, a potem oceń, jak poszło.",
    backToLog: "← Dziennik",
    editTitle: (p) => `Edycja wpisu: ${p.object}`,
    editIntro: "Popraw obiekt, noc, stanowisko, teleskop lub ocenę albo usuń wpis.",
    saveChanges: "Zapisz zmiany",
    delete: "Usuń wpis",
    confirmDelete: (p) => `Usunąć wpis „${p.object}” z dziennika? Tej operacji nie można cofnąć.`,
    notFound: "Nie znaleziono wpisu",
    notFoundText: "Mógł już zostać usunięty.",
    backToLogLink: "Wróć do dziennika",
    picker: {
      label: "Obiekt",
      placeholder: "np. 31, Andromeda albo Jowisz",
      noMatch: "Żaden obiekt nie pasuje.",
    },
    list: {
      title: "Dziennik obserwacji",
      intro: "Wszystko, co udało Ci się zaobserwować, od najnowszej nocy. Otwórz wpis, aby go poprawić lub usunąć.",
      add: "Dodaj wpis",
      empty: "Dziennik jest pusty. Oznacz obiekt jako zaobserwowany w widoku Dziś w nocy albo dodaj wpis ręcznie.",
      toTonight: "Przejdź do Dziś w nocy",
      pageEmpty: "Na tej stronie nie ma wpisów.",
      toNewest: "Przejdź do najnowszych wpisów",
      edit: "Edytuj",
      rated: (p) => `Ocena ${p.rating} z 5`,
      deletedGear: (p) => `${p.name} (usunięte)`,
      pages: "Strony dziennika",
      newer: "← Nowsze",
      older: "Starsze →",
      saved: (p) => `Zapisano obserwację: ${p.object}.`,
      updated: (p) => `Zaktualizowano obserwację: ${p.object}.`,
      deleted: (p) => `Usunięto z dziennika obserwację: ${p.object}.`,
    },
  },

  skyChecks: {
    card: {
      kicker: "Ocena nieba",
      titleLastNight: "Jakie było niebo ostatniej nocy?",
      titleOn: (p) => `Jakie było niebo w nocy ${p.date}?`,
      weSaid: (p) => `${p.site} · Prognoza: ${p.headline}`,
      hint: "Twoje odpowiedzi pokazują, jak często prognoza się sprawdza.",
      answers: "Co było widać",
      skip: "Pomiń",
      all: "Wszystkie oceny nieba",
    },
    saved: "Zapisano w ocenach nieba.",
  },

  errors: {
    generic: "Coś poszło nie tak. Spróbuj ponownie.",
    notConfigured: "Baza danych nie jest skonfigurowana.",
    checkFields: "Sprawdź zaznaczone pola.",
    outOfRange: "Niektóre wartości są poza dozwolonym zakresem.",
    name: {
      required: "Podaj nazwę.",
      tooLong: "Nazwa może mieć najwyżej 60 znaków.",
    },
    site: {
      latitudeRange: "Podaj szerokość geograficzną od -90 do 90 stopni.",
      longitudeRange: "Podaj długość geograficzną od -180 do 180 stopni.",
      bortleRange: "Wybierz klasę w skali Bortle'a od 1 do 9.",
      minAltitudeRange: "Podaj minimalną wysokość jako liczbę całkowitą od 0 do 60 stopni.",
      timeZoneMode: "Wybierz, jak ustawić strefę czasową.",
      timeZone: "Wybierz poprawną strefę czasową.",
      timeZoneExample: "Wybierz poprawną strefę czasową, np. Europe/Warsaw.",
    },
    telescope: {
      apertureRange: "Podaj aperturę od 20 do 1000 mm.",
      focalLengthRange: "Podaj ogniskową od 100 do 5000 mm.",
    },
    eyepiece: {
      focalLengthRange: "Podaj ogniskową od 2 do 60 mm.",
      afovRange: "Podaj pozorne pole widzenia jako liczbę całkowitą od 30 do 120°.",
      type: "Wybierz typ okularu.",
    },
    onboarding: {
      eyepiecesMalformed: "Sprawdź swoje okulary.",
      eyepiecesTooMany: "Dodaj najwyżej 10 okularów.",
    },
    observation: {
      objectInvalid: "Wybierz obiekt Messiera od M1 do M110.",
      nightInvalid: "Podaj noc obserwacji jako datę.",
      nightInFuture: "Noc obserwacji nie może być późniejsza niż dzisiejsza.",
      nightTooEarly: "Podaj noc obserwacji od 1900 roku.",
      ratingRequired: "Oceń, jak poszło, w skali od 1 do 5.",
      siteRequired: "Wybierz miejsce obserwacji.",
      telescopeRequired: "Wybierz użyty teleskop.",
      gearNotFound: "To miejsce lub teleskop już nie istnieje.",
    },
    load: {
      sites: "Nie udało się wczytać Twoich stanowisk. Spróbuj ponownie.",
      telescopes: "Nie udało się wczytać Twoich teleskopów. Spróbuj ponownie.",
      eyepieces: "Nie udało się wczytać Twoich okularów. Spróbuj ponownie.",
      site: "Nie udało się wczytać stanowiska. Spróbuj ponownie.",
      telescope: "Nie udało się wczytać teleskopu. Spróbuj ponownie.",
      eyepiece: "Nie udało się wczytać okularu. Spróbuj ponownie.",
      setup: "Nie udało się wczytać Twojego sprzętu. Spróbuj ponownie.",
      observations: "Nie udało się wczytać Twojego dziennika obserwacji. Spróbuj ponownie.",
      skyChecks: "Nie udało się wczytać Twoich ocen nieba. Spróbuj ponownie.",
    },
    save: {
      site: "Nie udało się zapisać stanowiska. Spróbuj ponownie.",
      telescope: "Nie udało się zapisać teleskopu. Spróbuj ponownie.",
      eyepiece: "Nie udało się zapisać okularu. Spróbuj ponownie.",
      setup: "Nie udało się zapisać Twojego sprzętu. Spróbuj ponownie.",
      observation: "Nie udało się zapisać obserwacji. Spróbuj ponownie.",
      skyCheck: "Nie udało się zapisać odpowiedzi. Spróbuj ponownie.",
    },
    delete: {
      site: "Nie udało się usunąć stanowiska. Spróbuj ponownie.",
      telescope: "Nie udało się usunąć teleskopu. Spróbuj ponownie.",
      eyepiece: "Nie udało się usunąć okularu. Spróbuj ponownie.",
      observation: "Nie udało się usunąć obserwacji. Spróbuj ponownie.",
    },
    notFound: {
      site: "Nie znaleziono stanowiska.",
      telescope: "Nie znaleziono teleskopu.",
      eyepiece: "Nie znaleziono okularu.",
      observation: "Nie znaleziono obserwacji.",
      skyCheck: "Tej nocy nie można jeszcze ocenić albo już nie istnieje.",
    },
    geocoding: {
      failed: "Wyszukiwanie miejsc jest teraz niedostępne.",
    },
    auth: {
      notConfigured: "Supabase nie jest skonfigurowany",
      invalidCredentials: "Nieprawidłowy e-mail lub hasło.",
      userExists: "Ten adres e-mail jest już zarejestrowany. Spróbuj się zalogować.",
      weakPassword: "Wybierz silniejsze hasło.",
      invalidEmail: "Podaj poprawny adres e-mail.",
      rateLimited: "Za dużo prób. Poczekaj chwilę i spróbuj ponownie.",
      emailRateLimited: "Wysłaliśmy za dużo e-maili. Poczekaj trochę i spróbuj ponownie.",
      generic: "Nie udało się wykonać żądania. Spróbuj ponownie.",
    },
  },
} satisfies Messages;
