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
    myGear: "Mój sprzęt",
    welcome: "Witaj!",
    signIn: "Zaloguj się",
    signOut: "Wyloguj się",
  },

  preferences: {
    theme: "Motyw",
    dark: "Ciemny motyw",
    light: "Jasny motyw",
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
    level: { go: "Warto", marginal: "Na granicy", "no-go": "Nie warto" },
  },

  landing: {
    kicker: "Messier 1 – 110 · Twoje niebo, Twój sprzęt",
    tagline: "Czy dziś warto rozstawiać teleskop?",
    lead: "Jasna ocena nocy i krótka, uzasadniona lista obiektów, na które warto skierować teleskop — z okularami, które już masz.",
    verdictsLabel: "Oceny nocy",
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
      "Widok „Dziś w nocy” w Sidereusie: ocena „Warto” z oknem ciemności, a pod nią uszeregowane obiekty Messiera, każdy z kierunkiem na niebie i podpowiedzią okularu.",
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
    eyepiecesFailed: "Nie udało się wczytać Twoich okularów, więc obiekty na dziś pokazujemy bez propozycji okularów.",
    failed: "Nie udało się obliczyć dzisiejszego nieba. Spróbuj ponownie.",
    loading: "Wczytuję dzisiejsze niebo…",
    loadingSlow: "To trwa dłużej niż zwykle.",
    reload: "Odśwież",

    card: {
      kicker: "Ocena nocy",
      darkFrom: "Ciemno od",
      darkTo: "do",
      noDarkWindow: "Dziś w nocy nie będzie okna ciemności",
      timesIn: (p) => ` · czas w strefie ${p.zone}`,
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
        lead: (p) => `${p.percent}% bez blasku Księżyca`,
        follow: (p) => `${p.percent}% bez blasku Księżyca`,
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

    cleared: {
      none: "Dziś żaden obiekt nie jest wart uwagi",
      count: {
        one: (p) => `${p.count} obiekt wart dziś uwagi`,
        few: (p) => `${p.count} obiekty warte dziś uwagi`,
        many: (p) => `${p.count} obiektów wartych dziś uwagi`,
        other: (p) => `${p.count} obiektu wartego dziś uwagi`,
      },
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
      found: (p) => `Następna noc warta uwagi: ${p.date} — ${p.level}, ${p.reason}`,
      level: { go: "warto", marginal: "na granicy", "no-go": "nie warto" },
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
    load: {
      sites: "Nie udało się wczytać Twoich stanowisk. Spróbuj ponownie.",
      telescopes: "Nie udało się wczytać Twoich teleskopów. Spróbuj ponownie.",
      eyepieces: "Nie udało się wczytać Twoich okularów. Spróbuj ponownie.",
      site: "Nie udało się wczytać stanowiska. Spróbuj ponownie.",
      telescope: "Nie udało się wczytać teleskopu. Spróbuj ponownie.",
      eyepiece: "Nie udało się wczytać okularu. Spróbuj ponownie.",
      setup: "Nie udało się wczytać Twojego sprzętu. Spróbuj ponownie.",
    },
    save: {
      site: "Nie udało się zapisać stanowiska. Spróbuj ponownie.",
      telescope: "Nie udało się zapisać teleskopu. Spróbuj ponownie.",
      eyepiece: "Nie udało się zapisać okularu. Spróbuj ponownie.",
      setup: "Nie udało się zapisać Twojego sprzętu. Spróbuj ponownie.",
    },
    delete: {
      site: "Nie udało się usunąć stanowiska. Spróbuj ponownie.",
      telescope: "Nie udało się usunąć teleskopu. Spróbuj ponownie.",
      eyepiece: "Nie udało się usunąć okularu. Spróbuj ponownie.",
    },
    notFound: {
      site: "Nie znaleziono stanowiska.",
      telescope: "Nie znaleziono teleskopu.",
      eyepiece: "Nie znaleziono okularu.",
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
