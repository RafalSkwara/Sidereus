/**
 * The English message catalogue: the source of truth for every user-facing string. `pl.ts` must
 * have exactly the same keys and kinds (`satisfies Messages`, plus a runtime parity test).
 *
 * Parameterised messages are functions of a typed params object. Every number a message shows
 * arrives already formatted for the locale (a string), so messages never format numbers.
 * Messages that `?error=` or a zod issue carries are string leaves, addressed by dotted key
 * ("errors.site.latitudeRange"), and must never contain a submitted value.
 *
 * Island-safe: no imports.
 */

/** One form per `Intl.PluralRules` category; `few` and `many` are only needed where a locale uses them. */
export interface PluralForms<T = string> {
  one: T;
  few?: T;
  many?: T;
  other: T;
}

type Count = (p: { count: string }) => string;
type Seen = (p: { count: string; date: string }) => string;

export const en = {
  common: {
    appName: "Sidereus",
    pageTitle: (p: { title: string }) => `${p.title} · Sidereus`,
    saving: "Saving...",
    name: "Name",
    focalLengthMm: "Focal length (mm)",
    cancel: "Cancel",
  },

  nav: {
    tonight: "Tonight",
    log: "Log",
    myGear: "My gear",
    signIn: "Sign in",
    signOut: "Sign out",
    settings: "Settings",
    primary: "Main",
    signedInAs: "Signed in as",
  },

  preferences: {
    theme: "Theme",
    dark: "Dark theme",
    light: "Light theme",
    red: "Red night mode",
    darkShort: "Dark",
    lightShort: "Light",
    redShort: "Red",
    /** Theme button: the current theme and the one a tap switches to (short names). */
    cycle: (p: { current: string; next: string }) => `Theme: ${p.current}. Switch to ${p.next}.`,
    language: "Language",
    english: "English",
    polish: "Polski",
  },

  config: {
    warning: "Warning:",
    docs: "Documentation",
    supabase: {
      message: "Supabase is not configured — authentication is disabled.",
      docsLabel: "See the setup instructions",
    },
  },

  /**
   * The sky headline (moonlight-and-the-verdict): what the forecast checks, the sky over the dark window, never a
   * judgement of the whole night. `skyHeadline` in `src/lib/tonight/format.ts` picks one from the level and reason.
   */
  verdict: {
    /** The cloud words, by level: a clear run, a shorter or cloudier run, or too cloudy. */
    level: { go: "Clear", marginal: "Partly clear", "no-go": "Cloudy" },
    /** Headlines for a reason that says more than its level. A no-darkness night uses `tonight.card.noDarkWindow`. */
    sky: {
      humidityCap: "Clear, but damp",
      fallbackCap: "Clear (old forecast)",
      noForecast: "No forecast",
    },
    /** Every headline in lowercase, for mid-sentence use ("Next clearer night: Fri 9 Oct (partly clear)"). */
    inline: {
      go: "clear",
      marginal: "partly clear",
      "no-go": "cloudy",
      humidityCap: "clear, but damp",
      fallbackCap: "clear, from an old forecast",
      noForecast: "no forecast",
      noDarkness: "no dark window",
    },
  },

  landing: {
    kicker: "Messier 1 – 110 · your sky, your kit",
    tagline: "Is tonight worth setting up for?",
    lead: "A clear verdict for the night and a short, explained list of what to point your telescope at, with the eyepieces you already own.",
    verdictsLabel: "Sky forecasts",
    howItWorks: "How it works",
    steps: {
      where: "Tell us where you observe",
      kit: "Pick your telescope and eyepieces",
      tonight: "Get tonight's verdict and up to five targets",
    },
    getStarted: "Get started",
    signIn: "Sign in",
    openTonight: "Open Tonight",
    screenshotAlt:
      "Sidereus Tonight view: a clear sky tonight, with the night's dark window, then the ranked Messier objects, each with where to look and which eyepiece to use.",
    footerPrefix: "Named after Galileo's",
    footerWork: "Sidereus Nuncius",
    footerSuffix: ", 1610.",
  },

  auth: {
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    signIn: {
      title: "Sign in",
      passwordPlaceholder: "Your password",
      submit: "Sign in",
      pending: "Signing in...",
      noAccount: "Don't have an account?",
      signUpLink: "Sign up",
      continueNote: "Sign in to continue.",
    },
    signUp: {
      title: "Sign up",
      passwordPlaceholder: "Min. 6 characters",
      confirmPassword: "Confirm password",
      confirmPlaceholder: "Re-enter your password",
      submit: "Create account",
      pending: "Creating account...",
      haveAccount: "Already have an account?",
      signInLink: "Sign in",
      moreCharacters: {
        one: (p) => `${p.count} more character needed`,
        other: (p) => `${p.count} more characters needed`,
      } as PluralForms<Count>,
    },
    validation: {
      emailRequired: "Email is required",
      emailInvalid: "Enter a valid email address",
      passwordRequired: "Password is required",
      passwordTooShort: (p: { min: string }) => `Password must be at least ${p.min} characters`,
      confirmRequired: "Please confirm your password",
      passwordsDiffer: "Passwords do not match",
    },
    confirmEmail: {
      registered: {
        heading: "Registration successful",
        description: "Your account has been created. You can now sign in.",
        link: "Go to sign in",
      },
      checkEmail: {
        heading: "Check your email",
        description: "We've sent a confirmation link to your email address. Click it to activate your account.",
        link: "Back to sign in",
      },
    },
  },

  databaseMissing: {
    title: "Database not configured",
    bodyPrefix: "Sidereus cannot reach its database, so your sites and gear cannot be shown or saved. Set",
    and: "and",
    bodySuffix: "and restart the server.",
  },

  gear: {
    title: "My gear",
    subtitle: "Where you observe from, and what you observe with.",
    backToGear: "Back to My gear",
    notFound: "Not found",
    /** Band headings on the add and edit pages. */
    detailsHeading: "Details",
    deleteHeading: "Delete",
    /** After a save or delete the hub shows one of these; the kind comes from a fixed `?saved=` / `?deleted=` value. */
    notice: {
      saved: { site: "Site saved.", telescope: "Telescope saved.", eyepiece: "Eyepiece saved." },
      deleted: { site: "Site deleted.", telescope: "Telescope deleted.", eyepiece: "Eyepiece deleted." },
    },
    sites: {
      heading: "Sites",
      add: "Add site",
      emptyTitle: "No sites yet",
      emptyWhy:
        "Tonight needs a site to read your sky: when it gets dark, what rises and how dark it is where you stand.",
      bortle: (p: { bortle: string }) => `Bortle ${p.bortle}`,
      minAltitude: (p: { degrees: string }) => `Min ${p.degrees}°`,
      zonePinned: "pinned",
      zoneAuto: "auto",
      newTitle: "Add site",
      editTitle: "Edit site",
      fallbackTitle: "Site",
      notFoundText: "This site does not exist, or it is not yours.",
      delete: "Delete site",
      confirmDelete: "Delete this site? This cannot be undone.",
    },
    telescopes: {
      heading: "Telescopes",
      add: "Add telescope",
      emptyTitle: "No telescopes yet",
      emptyWhy: "Tonight needs a telescope to rank the objects it can show and suggest magnifications that fit it.",
      aperture: (p: { mm: string }) => `${p.mm} mm aperture`,
      focalLength: (p: { mm: string }) => `${p.mm} mm focal length`,
      newTitle: "Add telescope",
      editTitle: "Edit telescope",
      fallbackTitle: "Telescope",
      notFoundText: "This telescope does not exist, or it is not yours.",
      delete: "Delete telescope",
      confirmDelete: "Delete this telescope? This cannot be undone.",
    },
    eyepieces: {
      heading: "Eyepieces",
      add: "Add eyepiece",
      emptyTitle: "No eyepieces yet",
      emptyWhy: "Optional. Add the ones in your case, and each object gets an eyepiece you actually own.",
      focalLength: (p: { mm: string }) => `${p.mm} mm`,
      afov: (p: { degrees: string; type: string }) => `${p.degrees}° AFOV · ${p.type}`,
      otherType: "Other",
      newTitle: "Add eyepiece",
      editTitle: "Edit eyepiece",
      fallbackTitle: "Eyepiece",
      notFoundText: "This eyepiece does not exist, or it is not yours.",
      delete: "Delete eyepiece",
      confirmDelete: "Delete this eyepiece? This cannot be undone.",
    },
  },

  /** Each preset has a short name (the gear list) and a long label with its AFOV hint (the form). */
  eyepiecePresets: {
    plossl: { short: "Plössl", long: "Plössl (~50°)" },
    wide: { short: "Wide-field", long: "Wide-field (~68°)" },
    ultrawide: { short: "Ultra-wide", long: "Ultra-wide (~82°)" },
    other: "Other (enter the AFOV)",
  },

  siteForm: {
    namePlaceholder: "Back garden",
    latitude: "Latitude (°)",
    longitude: "Longitude (°)",
    coordinatesHint: "Coordinates are rounded to 2 decimals (about 1 km) when saved. North and east are positive.",
    bortle: "Sky darkness (Bortle class)",
    chooseBortle: "Choose a class",
    bortleOption: (p: { value: string; label: string }) => `${p.value} · ${p.label}`,
    bortleLabels: {
      1: "Excellent dark site",
      2: "Truly dark site",
      3: "Rural sky",
      4: "Rural to suburban",
      5: "Suburban sky",
      6: "Bright suburban sky",
      7: "Suburban to city",
      8: "City sky",
      9: "Inner-city sky",
    },
    minAltitude: "Minimum altitude (°)",
    minAltitudeHint: "Objects lower than this, e.g. behind trees or roofs, are skipped.",
    timeZone: "Time zone",
    autoCurrent: (p: { zone: string }) => `Automatic, currently ${p.zone}`,
    autoFromCoordinates: "Automatic (from coordinates)",
    location: "Location",
    previousLocation: (p: { latitude: string; longitude: string }) => `Was ${p.latitude}, ${p.longitude}`,
    undoLocation: "Undo",
    submit: "Save site",
  },

  telescopeForm: {
    namePlaceholder: "130 mm Newtonian",
    aperture: "Aperture (mm)",
    focalRatio: "Focal ratio",
    focalRatioHint: "Focal length ÷ aperture, a quick check that both numbers are right. Not saved.",
    submit: "Save telescope",
  },

  eyepieceForm: {
    namePlaceholder: "25 mm Plössl",
    type: "Eyepiece type",
    chooseType: "Choose a type",
    typeHint: "The type sets the apparent field of view. Check the eyepiece barrel or its box if unsure.",
    afov: "Apparent field of view (°)",
    submit: "Save eyepiece",
  },

  location: {
    useLocation: "Use my location",
    locating: "Finding your location...",
    locationDenied:
      "Location access is blocked, so search for a place instead. You can allow it later in your browser settings.",
    locationUnavailable: "Your location could not be found. Search for a place instead.",
    or: "or",
    searchLabel: "Search for a town or city",
    searchPlaceholder: "e.g. Kraków",
    searching: "Searching...",
    noResults: "No places found. Check the spelling or try a nearby town.",
    resultsLabel: "Matching places",
    resultsCount: {
      one: (p) => `${p.count} place found`,
      other: (p) => `${p.count} places found`,
    } as PluralForms<Count>,
    searchFallback: "You can enter coordinates instead, below.",
    usingDevice: "Using your current location (about 1 km)",
    usingPlace: (p: { place: string }) => `Using ${p.place} (about 1 km)`,
    usingCoordinates: "Using the coordinates you entered, rounded to about 1 km",
  },

  onboarding: {
    title: "Set up Sidereus",
    intro: "Three quick choices, and tonight's verdict is ready. You can change any of it later in My gear.",
    submit: "Show me tonight",
    locationRequired: "Set a location above to continue.",
    where: {
      heading: "Where do you observe from?",
      hint: "Your home, or wherever you usually set up. It is saved to about 1 km, never more precisely.",
      manualToggle: "Enter coordinates instead",
    },
    sky: {
      heading: "How dark is your sky?",
      hint: "Pick the scene closest to a clear, moonless night where you observe.",
    },
    kit: {
      heading: "What's in your kit?",
      telescope: "Telescope",
      telescopeHint:
        "Pick the closest match, then adjust the numbers if yours differ. They are printed on the tube or in the manual.",
      eyepieces: "Eyepieces",
      eyepiecesHint: "Start from a set, then edit, remove or add eyepieces to match your case.",
      emptyKit: "Add them later in My gear",
      noEyepieces: "No eyepieces yet. Tonight's list still works, and you can add them later.",
      eyepieceLegend: (p: { number: string }) => `Eyepiece ${p.number}`,
      removeEyepiece: (p: { number: string }) => `Remove eyepiece ${p.number}`,
      eyepieceLimit: "That's 10, the most you can add here. Add more later in My gear.",
    },
    credit: {
      placeSearch: "Place search:",
      locationData: "Location data based on",
    },
    /** The name every onboarding site gets (FR-004); it can be renamed later in `/gear`. */
    homeSiteName: "Home",
    telescopes: {
      r102: "102 mm refractor",
      n130: "130 mm reflector",
      n150: "150 mm reflector",
      d200: "8-inch Dobsonian",
      m127: "127 mm Maksutov",
    },
    eyepieceKits: {
      pair: "Supplied pair",
      "plossl-set": "Plössl set",
      none: "No eyepieces yet",
    },
    scenes: {
      city: {
        title: "City centre",
        description:
          "The sky glows grey or orange, only the brightest stars and planets show, and there is no Milky Way.",
      },
      suburb: {
        title: "Suburb",
        description:
          "The main constellations are easy to trace, but the Milky Way is at most a faint haze straight up.",
      },
      town: {
        title: "Outer suburb or small town",
        description: "Hundreds of stars show, and the Milky Way is visible overhead but fades out towards the horizon.",
      },
      village: {
        title: "Village or countryside",
        description:
          "The Milky Way stretches clearly across the sky, with only a few glows from distant towns low down.",
      },
      remote: {
        title: "Remote dark site",
        description: "Stars crowd the whole sky, and the Milky Way is bright enough to show dark lanes and clumps.",
      },
    },
  },

  tonight: {
    title: "Tonight",
    kicker: "Your sky, tonight",
    addSitePrompt: "Add an observing site to see tonight",
    addSite: "Add site",
    addTelescopePrompt: "Add a telescope to see tonight",
    addTelescope: "Add telescope",
    setupPrompt: "Set up your site and telescope in about a minute",
    setup: "Set up",
    logged: (p: { object: string }) => `${p.object} logged.`,
    logFailed: "Could not load your observation log, so objects you have seen are not moved down right now.",
    eyepiecesFailed: "Could not load your eyepieces, so tonight's objects are shown without eyepiece suggestions.",
    /** FR-021: the kit has no eyepieces, so the ranking shows without pairs. */
    noEyepiecesPrompt: "Add eyepieces to get a finding and detail pair for each object.",
    addEyepieces: "Add eyepieces",
    failed: "Could not work out tonight's sky. Please try again.",
    loading: "Loading tonight's sky…",
    loadingSlow: "This is taking longer than usual.",
    reload: "Reload",
    /** FR-012: shown only to users who own two or more sites; the label must differ from `selector.label`. */
    siteSelector: {
      label: "Site",
      show: "Show",
    },
    /** FR-019: shown only to users who own two or more telescopes. */
    selector: {
      label: "Telescope",
      show: "Show",
    },
    rankingFor: (p: { telescope: string }) => `For your ${p.telescope}`,

    card: {
      darkFrom: "Dark from",
      darkTo: "to",
      /** Also the sky headline of a no-darkness night, on the card and on any night of the strip. */
      noDarkWindow: "No dark window",
      timesIn: (p: { zone: string }) => ` · times in ${p.zone}`,
    },

    /** FR-011: the seven-night strip. Nights 1-3 carry a verdict; nights 4-7 only an outlook (invariant 5). */
    nights: {
      /** `count` is `OUTLOOK_NIGHTS`, pre-formatted; the wording assumes more than one night. */
      heading: (p: { count: string; site: string }) => `Next ${p.count} nights at ${p.site}`,
      timesIn: (p: { zone: string }) => `Times in ${p.zone}`,
      verdictLabel: "Verdict",
      outlookLabel: "Outlook — no verdict",
      noDarkness: "No darkness",
      moon: (p: { percent: string }) => `Moon ${p.percent}%`,
      moonFree: (p: { moon: string; duration: string }) => `${p.moon} · ${p.duration} moon-free`,
      /** The Moon is up for the whole dark window (0 min moon-free). */
      moonAllNight: (p: { moon: string }) => `${p.moon} · up the whole dark window`,
      /** The Moon stays below the horizon for the whole dark window. */
      moonNone: (p: { moon: string }) => `${p.moon} · below the horizon all night`,
      cloud: (p: { mean: string }) => `Cloud ~${p.mean}%`,
      cloudRange: (p: { mean: string; min: string }) => `Cloud ~${p.mean}%, down to ${p.min}%`,
      noCloud: "No cloud outlook yet",
    },

    object: {
      inConstellation: (p: { constellation: string }) => `in ${p.constellation}`,
      window: "Window",
      best: "Best",
      findWith: "Find with",
      detailWith: "detail with",
      magnification: (p: { magnification: string }) => `(${p.magnification}×)`,
      noneFit: (p: { name: string }) =>
        `Larger than any field in your kit; use your widest (${p.name}) and sweep across it`,
      seen: {
        one: (p) => `Seen ${p.count} time – last ${p.date}`,
        other: (p) => `Seen ${p.count} times – last ${p.date}`,
      } as PluralForms<Seen>,
      markObserved: "Mark observed",
    },

    /**
     * M-2 S-01: the "Planets tonight" section (planets only again since moonlight-and-the-verdict: the Moon has its
     * own card beside the sky card). The planet window runs from civil dusk to civil dawn (sun below
     * `PLANET_WINDOW_SUN_ALTITUDE_DEG`), so its wording never says "dark window".
     */
    planets: {
      heading: "Planets tonight",
      /** Why the Planets page lists nothing (tonight-dashboard); `cloudPct` is the clearest hour's cloud cover. */
      absent: {
        noWindow: "No planets tonight: the sky never gets dark enough between dusk and dawn.",
        cloudy: (p: { cloudPct: string }) =>
          `No planets tonight: too cloudy between dusk and dawn (the clearest hour has ${p.cloudPct}% cloud).`,
        unavailable: "Planet details aren't available right now.",
      },
      /** The planet list's accessible name. */
      listLabel: "Planets",
      window: (p: { start: string; end: string }) => `From civil dusk to dawn, ${p.start}–${p.end}`,
      /** No planet is listed: none clears the minimum altitude, or the ones that do are gated out by aperture. */
      none: "No planet is well placed for your telescope between dusk and dawn tonight.",
      /** The same, on a night whose planets are limited to the clear hours (a no-go or no dark window). */
      noneInClearHours: "No planet is well placed for your telescope in tonight's clear hours.",
      /** The "Mark observed" link's accessible name; the colon keeps the planet name in its base form. */
      markObserved: (p: { planet: string }) => `Mark observed: ${p.planet}`,
      /**
       * Shown only when the verdict card does not already cover the planet window: a no-go, no dark window, or a
       * planet verdict whose level differs from the card's.
       */
      weather: {
        /** `sky` is `verdict.inline`. */
        line: (p: { sky: string; reason: string }) => `For planets: ${p.sky} — ${p.reason}`,
        clearRun: (p: { hours: string; cloud: string }) =>
          `${p.hours} h in a row with at most ${p.cloud}% cloud between dusk and dawn`,
        humidityCap: (p: { humidity: string }) =>
          `clear enough between dusk and dawn, but humidity reaches ${p.humidity}%, so expect dew and haze`,
        fallbackCap: (p: { hours: string; cloud: string }) =>
          `the last saved forecast showed ${p.hours} h in a row with at most ${p.cloud}% cloud between dusk and dawn, but it could not be refreshed`,
        noWeatherData: "no weather data",
        /**
         * On a no-go or no-darkness night the planets are limited to the planet window's clear hours, named here
         * as "19:00–20:00 and 05:00–06:00" (a locale-formatted list).
         */
        clearHours: (p: { hours: string }) => `clear ${p.hours}`,
        clearHoursHumid: (p: { hours: string; humidity: string }) =>
          `clear ${p.hours}, but humidity reaches ${p.humidity}%, so expect dew and haze`,
        clearHoursFallback: (p: { hours: string }) =>
          `clear ${p.hours} in the last saved forecast, which could not be refreshed`,
      },
      magnitude: (p: { mag: string }) => `mag ${p.mag}`,
      size: (p: { arcsec: string }) => `${p.arcsec}″`,
      /** Mercury and Venus only. */
      phase: (p: { percent: string }) => `${p.percent}% lit`,
      /** Saturn only. */
      rings: (p: { degrees: string }) => `rings tilted ${p.degrees}°`,
      detailWith: "Detail with",
      /** By placement (peak altitude) × timing (which third of the planet window holds the peak). */
      reason: {
        high: {
          evening: (p: { time: string }) => `High around ${p.time} — best early in the night`,
          night: (p: { time: string }) => `High around ${p.time} — best in the middle of the night`,
          morning: (p: { time: string }) => `High around ${p.time} — best before dawn`,
        },
        well: {
          evening: (p: { time: string }) => `Well up around ${p.time} — best early in the night`,
          night: (p: { time: string }) => `Well up around ${p.time} — best in the middle of the night`,
          morning: (p: { time: string }) => `Well up around ${p.time} — best before dawn`,
        },
        low: {
          evening: (p: { time: string }) => `Low around ${p.time} — look soon after dusk, with a clear view low down`,
          night: (p: { time: string }) => `Low around ${p.time} — you need a clear view low down`,
          morning: (p: { time: string }) =>
            `Low around ${p.time} — look shortly before dawn, with a clear view low down`,
        },
      },
      /** What a 100-200 mm telescope shows a beginner; deliberately modest. */
      note: {
        mercury: "A small, bright dot low in the twilight; at higher power you may just make out its phase.",
        venus: "Dazzling and featureless, but its phase is easy to see, like a tiny Moon.",
        mars: "A small orange disc; surface markings need steady air and patience, and often don't show at all.",
        jupiter: "A bright disc crossed by two dark cloud belts, with up to four moons strung out in a line beside it.",
        saturn: "The rings show clearly even at modest power; its largest moon, Titan, looks like a star close by.",
        uranus: "A tiny blue-green disc: at high power it is clearly not a star, but it shows no detail.",
        neptune: "A tiny blue-grey dot that is hard to tell from a star; finding it is the achievement.",
      },
    },

    /**
     * The Moon card beside the sky card (moonlight-and-the-verdict; the Moon target since M-2 S-02): the phase, the
     * disc, when the Moon is up and what it does to faint objects, then the observing details when it is a target.
     */
    moon: {
      /** By elongation band (`MOON_PHASE_BANDS`), so waxing and waning differ. */
      phase: {
        "waxing-crescent": "Waxing crescent",
        "first-quarter": "First quarter",
        "waxing-gibbous": "Waxing gibbous",
        full: "Full Moon",
        "waning-gibbous": "Waning gibbous",
        "last-quarter": "Last quarter",
        "waning-crescent": "Waning crescent",
      },
      lit: (p: { percent: string }) => `${p.percent}% lit`,
      /** "Waxing gibbous · 78% lit" */
      phaseLine: (p: { phase: string; lit: string }) => `${p.phase} · ${p.lit}`,
      wholeDiscWith: "Whole disc with",
      detailWith: "detail with",
      /** No eyepiece's true field reaches `MOON_WHOLE_DISC_FIELD_DEG`; `name` is the widest. */
      partDisc: (p: { name: string }) =>
        `No eyepiece in your kit fits the whole disc; your widest (${p.name}) shows part of it`,
      /** The highest point of the Moon's best window, then the third of the window that holds it. */
      reason: {
        line: (p: { altitude: string; time: string; timing: string }) =>
          `Highest ${p.altitude}° at ${p.time} — ${p.timing}`,
        /** Below `MOON_LOW_ALTITUDE_DEG` at its highest. */
        low: (p: { altitude: string; time: string; timing: string }) =>
          `Highest only ${p.altitude}° at ${p.time} — ${p.timing}; this low, the view may shimmer`,
        timing: {
          evening: "best early in the night",
          night: "best in the middle of the night",
          morning: "best before dawn",
        },
      },
      /** The "Mark observed" link's accessible name; the colon keeps the name in its base form. */
      markObserved: (p: { name: string }) => `Mark observed: ${p.name}`,
      card: {
        kicker: "Moon tonight",
        /**
         * The disc's accessible name for the moment the time slider shows: `time` is that moment's "23:40" in the
         * site's time zone, `phase` is `phase[band]`, `lit` is `lit`.
         */
        discLabel: (p: { time: string; phase: string; lit: string }) => `Moon at ${p.time}: ${p.phase}, ${p.lit}`,
        /** The time slider's accessible name; its value reads as the time shown. */
        slider: "Time of night",
        /** Returns the slider to the page-load moment (clamped into the window). */
        now: "Now",
        /**
         * When the Moon is up in the card's window (the dark window, or civil dusk to dawn without one), read off a
         * 10-minute track: each time is the first sample at which the Moon is up, or down again.
         */
        up: {
          /** Up at every sample of the window. */
          all: "Up all night",
          /** Up at the window's start, sets inside it and stays down. */
          sets: (p: { time: string }) => `Sets ${p.time}`,
          /** Any other part of the window; `spans` is a locale-formatted list of "22:10–06:58". */
          spans: (p: { spans: string }) => `Up ${p.spans}`,
          never: "Not up tonight",
        },
        /**
         * What the Moon does to faint objects tonight, on a night the ranking runs: `washedOut` when it washes out
         * any (`count`), else by how long it is up. No percent here: the card's phase line carries the % lit.
         */
        faint: {
          washedOut: {
            one: (p) => `Bright Moon: ${p.count} faint object washed out tonight`,
            other: (p) => `Bright Moon: ${p.count} faint objects washed out tonight`,
          } as PluralForms<Count>,
          unaffected: (p: { spans: string }) => `Moon up ${p.spans} · no faint objects washed out`,
          moonlit: "Moonlit sky · no faint objects lost",
          dark: "Dark night: no Moon",
        },
      },
      /**
       * One fixed note per phase band (research §4: RASC, Sky at Night). Hedged on purpose: libration moves the
       * shadow line (the terminator) by about half a day, so a feature is named as "near" it, never promised.
       */
      note: {
        "waxing-crescent":
          "A thin crescent in the evening west. Near the shadow line look for Mare Crisium and the crater chain from Langrenus to Petavius; the dark part of the disc may glow faintly with earthshine.",
        "first-quarter":
          "Half lit, with the strongest relief of the month: near the shadow line look for the Apennine and Alps mountains and the craters Plato and Archimedes.",
        "waxing-gibbous":
          "Most of the disc is lit. Near the shadow line look for the crater Copernicus, the bay of Sinus Iridum with its curved mountain rim, and later in this phase bright Aristarchus.",
        full: "Few shadows, so craters look flat; look instead for the bright rays of Tycho and Copernicus and the brilliant crater Aristarchus. If the glare tires your eye, a Moon filter or low power makes it more comfortable.",
        "waning-gibbous":
          "Rising later each evening; the shadow line is now where the Sun is setting on the Moon. Near it look around this phase for the craters Langrenus and Petavius, and a little later Theophilus.",
        "last-quarter":
          "Half lit and best before dawn: the shadow line brings out the craters Plato and Copernicus and the long shadows of the Apennines.",
        "waning-crescent":
          "A pre-dawn crescent low in the east. Near the shadow line look for bright Aristarchus and dark Grimaldi; the rest of the disc may glow faintly with earthshine.",
      },
    },

    time: {
      hours: (p: { hours: string }) => `${p.hours} h`,
      minutes: (p: { minutes: string }) => `${p.minutes} min`,
      hoursMinutes: (p: { hours: string; minutes: string }) => `${p.hours} h ${p.minutes} min`,
    },

    direction: (p: { point: string; altitude: string }) => `${p.point}, ${p.altitude}°`,

    /** FR-015: the leading component's phrase in sentence case, then the runner-up's in lower case. */
    reason: {
      line: (p: { lead: string; second: string }) => `${p.lead} · ${p.second}`,
      duration: {
        lead: (p: { duration: string }) => `Up for ${p.duration} of the dark window`,
        follow: (p: { duration: string }) => `up for ${p.duration} of the dark window`,
      },
      /** The moon component measures how little the Moon brightens the sky where the object sits, by its type. */
      moon: {
        lead: "Holds up better in moonlight than the rest",
        follow: "holds up better in moonlight than the rest",
      },
      brightness: {
        lead: (p: { aperture: string }) => `Bright for your ${p.aperture} mm`,
        follow: (p: { aperture: string }) => `bright for your ${p.aperture} mm`,
      },
      sky: {
        lead: (p: { bortle: string }) => `Holds up under your Bortle ${p.bortle} sky`,
        follow: (p: { bortle: string }) => `holds up under your Bortle ${p.bortle} sky`,
      },
    },

    /** Lowercase phrases the verdict card puts after the headline ("No forecast — no weather data"). */
    verdictReason: {
      clearRun: (p: { hours: string; cloud: string }) =>
        `${p.hours} h in a row with at most ${p.cloud}% cloud in the dark window`,
      humidityCap: (p: { humidity: string }) =>
        `clear enough, but humidity reaches ${p.humidity}%, so expect dew and haze`,
      fallbackCap: (p: { hours: string; cloud: string }) =>
        `the last saved forecast showed ${p.hours} h in a row with at most ${p.cloud}% cloud, but it could not be refreshed`,
      noForecast: "no forecast covers the dark window",
      cloudy: (p: { cloud: string }) => `too cloudy: the clearest dark hour has ${p.cloud}% cloud`,
      noWeatherData: "no weather data",
      noDarkness: "the sky never gets dark enough tonight",
    },

    all: {
      sortLabel: "Order",
      byRank: "By rank",
      byTime: "By best time",
      sortHintRank: "Best first. Open a row for its details.",
      sortHintTime: "In the order they are best placed tonight. Open a row for its details.",
      empty: "No object cleared the bar tonight, so there is nothing to list.",
    },

    cleared: {
      none: "No object cleared the bar tonight",
      count: {
        one: (p) => `${p.count} object cleared the bar tonight`,
        other: (p) => `${p.count} objects cleared the bar tonight`,
      } as PluralForms<Count>,
    },

    /** moonlight-and-the-verdict: faint objects tonight's Moon hides, counted on Tonight and listed on /tonight/targets. */
    washedOut: {
      line: {
        one: (p) => `${p.count} faint object is washed out by the Moon tonight`,
        other: (p) => `${p.count} faint objects are washed out by the Moon tonight`,
      } as PluralForms<Count>,
      heading: "Washed out by the Moon",
      intro:
        "Tonight's Moon brightens the sky around these faint objects so much that they would be very hard to see. On a moonless night they would be on the list.",
    },

    age: {
      lessThanMinute: "less than a minute",
      minutes: (p: { minutes: string }) => `${p.minutes} min`,
      hours: (p: { hours: string }) => `${p.hours} h`,
      days: {
        one: (p) => `${p.count} day`,
        other: (p) => `${p.count} days`,
      } as PluralForms<Count>,
    },

    forecast: {
      fresh: (p: { age: string }) => `Forecast updated ${p.age} ago`,
      fallback: (p: { age: string }) => `Weather service unreachable — showing the forecast from ${p.age} ago`,
      none: "No weather data — the weather service could not be reached and no earlier forecast is saved",
    },

    nextNight: {
      /** `sky` is the night's headline in lowercase (`verdict.inline`); the night is never a no-go. */
      found: (p: { date: string; sky: string }) => `Next clearer night: ${p.date} (${p.sky})`,
      beyondForecast: "The forecast doesn't reach past tonight, so there is no next night to suggest yet",
      noneThrough: (p: { date: string }) => `No clear night in the forecast through ${p.date}`,
    },

    noDarkness: {
      latitude: (p: { degrees: string; hemisphere: string }) => `${p.degrees}° ${p.hemisphere}`,
      north: "N",
      south: "S",
      sunUp: (p: { latitude: string }) =>
        `At ${p.latitude} at this time of year the sun stays above the horizon all night`,
      shallow: (p: { latitude: string; depth: string; threshold: string; bortle: string }) =>
        `At ${p.latitude} at this time of year the sun only sinks ${p.depth}° below the horizon, short of the ${p.threshold}° your Bortle ${p.bortle} sky needs`,
    },

    darkReturn: {
      never: "It does not return within the next year",
      on: (p: { date: string; start: string; end: string }) =>
        `The dark window returns on the night of ${p.date} (${p.start}–${p.end})`,
    },

    /** The interactive sky on the dashboard (interactive-sky): the panorama strip and its time slider. */
    sky: {
      /** The swipeable panorama's accessible name. */
      panorama: "Tonight's sky, swipe to look around",
      /** The time slider's accessible name; its value reads as the time shown. */
      slider: "Time of night",
      /** Moves the sky to the frame nearest the current time (clamped into the range). */
      now: "Now",
      /** The legend for the dark window's span on the slider's track. */
      darkWindow: "Dark window",
      /**
       * A marker's accessible name at the slider's time: `alt` is whole degrees, pre-formatted; `direction` a compass
       * point (`@/lib/compass`, international in every locale); `time` the frame's "23:40".
       */
      bodyLabel: (p: { name: string; alt: string; direction: string; time: string }) =>
        `${p.name}, ${p.alt}° up in the ${p.direction} at ${p.time}`,
    },

    attribution: {
      objectData: "Object data:",
      starData: "Star data:",
      weather: "Weather:",
    },

    /** tonight-nightfall: the giant word over the sky. Used only there; the sky headline stays the canonical wording. */
    verdict: {
      word: { go: "Go", marginal: "Marginal", "no-go": "No-go" },
    },

    /** The summary under the sky (tonight-nightfall): since tonight-dashboard, tiles that each open a page. */
    summary: {
      targets: "Point here first",
      targetsCaption: {
        one: (p) => `Each at the time it stands highest. ${p.count} target tonight.`,
        other: (p) => `Each at the time it stands highest. ${p.count} targets tonight.`,
      } as PluralForms<Count>,
      moon: "The Moon",
      planets: "Planets",
      /** `count` is `OUTLOOK_NIGHTS`, pre-formatted; the wording assumes more than one night. */
      nights: (p: { count: string }) => `Next ${p.count} nights`,
      /** `count` is `VERDICT_NIGHTS`, pre-formatted; the wording assumes more than one night. */
      nightsCaption: (p: { count: string }) =>
        `Height is clear sky. Colour and mark show the verdict for the next ${p.count} nights.`,
      noTargets: "No targets to point at tonight.",
    },

    /**
     * tonight-dashboard: the focused pages under /tonight/* that the summary tiles open. The Moon, Planets and Next 7
     * nights pages take their titles from `summary` (`moon`, `planets`, `nights`); the back link is `nav.tonight`.
     */
    pages: {
      targets: "Targets",
      /** The page sky's context line: the headline beside the verdict dot, read by screen readers only. */
      skyVerdict: (p: { headline: string }) => `Sky: ${p.headline}.`,
      /** A focused page without a site or a telescope; Tonight holds the setup prompts. */
      noGear: "Add a site and a telescope to see this page.",
      toTonight: "Go to Tonight",
      /** The view has no Moon card (only when building it failed). */
      moonUnavailable: "Moon details aren't available right now.",
      /** Targets without a ranking (weather no-go or no darkness), under the view's explanation. */
      noTargets: "No object cleared the bar tonight, so there is nothing to point at.",
      /** `count` is `OUTLOOK_NIGHTS`, pre-formatted; the wording assumes more than one night. */
      seeNights: (p: { count: string }) => `See the next ${p.count} nights`,
      /** Targets: the button that opens the rest of the list, after the best few. */
      showRest: {
        one: (p) => `Show the other ${p.count} object`,
        other: (p) => `Show the other ${p.count} objects`,
      } as PluralForms<Count>,
      /** The scrollable list's accessible name. */
      restLabel: "The other objects that cleared the bar",
      /** The Moon page's link to the objects it washes out, listed on Targets. */
      seeWashedOut: {
        one: (p) => `See the ${p.count} washed-out object`,
        other: (p) => `See the ${p.count} washed-out objects`,
      } as PluralForms<Count>,
      /** A summary tile's accessible suffix after its heading; `page` is the page's title. */
      open: (p: { page: string }) => `Open ${p.page}`,
    },
  },

  /** How the log names a target that is not a Messier object (M-2 S-01): by its localised name. */
  targets: {
    planet: {
      mercury: "Mercury",
      venus: "Venus",
      mars: "Mars",
      jupiter: "Jupiter",
      saturn: "Saturn",
      uranus: "Uranus",
      neptune: "Neptune",
    },
    /** The picker's secondary line for a planet. */
    planetDetail: "Planet",
    /** The Moon as a log target: headings, notices and the picker. */
    moon: "Moon",
    /** The picker's secondary line for the Moon. */
    moonDetail: "Earth's satellite",
  },

  log: {
    kicker: "Observation log",
    title: (p: { object: string }) => `Log ${p.object}`,
    intro: "Confirm the night, site and telescope, then rate how it went.",
    night: "Observing night",
    nightHint: "The evening the night began, even if you looked after midnight.",
    site: "Site",
    telescope: "Telescope",
    rating: "How did it go?",
    ratingLow: "1 · Couldn't make it out",
    ratingHigh: "5 · Superb",
    ratingHint: "A rating of 1-2 keeps the object where it is; 3-5 moves it down gently in later rankings.",
    submit: "Save observation",
    objectNotFound: "Sidereus doesn't know that object.",
    needsGear: "Add a site and a telescope before logging an observation.",
    addGear: "Go to my gear",
    manualTitle: "Add an observation",
    manualIntro:
      "Pick a Messier object, the Moon or a planet, then confirm the night, site and telescope and rate how it went.",
    editTitle: (p: { object: string }) => `Edit ${p.object}`,
    editIntro: "Fix the object, night, site, telescope or rating, or delete the entry.",
    saveChanges: "Save changes",
    delete: "Delete entry",
    confirmDelete: (p: { object: string }) => `Delete this ${p.object} entry from your log? This cannot be undone.`,
    notFound: "Entry not found",
    notFoundText: "It may have been deleted already.",
    backToLogLink: "Back to the log",
    picker: {
      label: "Object",
      placeholder: "e.g. 31, Andromeda or Jupiter",
      noMatch: "No object matches.",
    },
    list: {
      title: "Observation log",
      intro: "Everything you have observed, newest night first. Open an entry to fix or delete it.",
      add: "Add entry",
      empty: "Nothing logged yet. Mark an object observed on Tonight, or add an entry by hand.",
      toTonight: "Go to Tonight",
      pageEmpty: "No entries on this page.",
      toNewest: "Go to the newest entries",
      edit: "Edit",
      rated: (p: { rating: string }) => `Rated ${p.rating} of 5`,
      deletedGear: (p: { name: string }) => `${p.name} (deleted)`,
      pages: "Log pages",
      skyChecks: "Sky checks",
      newer: "← Newer",
      older: "Older →",
      saved: (p: { object: string }) => `${p.object} logged.`,
      updated: (p: { object: string }) => `${p.object} updated.`,
      deleted: (p: { object: string }) => `${p.object} deleted from the log.`,
    },
    deleteHeading: "Delete",
  },

  /** The verdict check (verdict-check): asking afterwards whether the sky matched Tonight's headline. */
  skyChecks: {
    card: {
      titleLastNight: "How was the sky last night?",
      titleOn: (p: { date: string }) => `How was the sky on ${p.date}?`,
      weSaid: (p: { site: string; headline: string }) => `${p.site} · We said: ${p.headline}`,
      hint: "Your answers show how often the forecast was right.",
      answers: "What you saw",
      skip: "Skip",
      all: "All sky checks",
    },
    saved: "Saved to your sky checks.",
    page: {
      title: "Sky checks",
      intro:
        "Every night Tonight judged for you, and what you saw. A night can be answered once its dark window has started.",
      empty: "No sky checks yet. Open Tonight before dark, and the next morning Sidereus asks how the sky was.",
      toTonight: "Go to Tonight",
      pageEmpty: "No nights on this page.",
      toNewest: "Go to the newest nights",
      pages: "Sky check pages",
      newer: "← Newer",
      older: "Older →",
      weSaid: (p: { headline: string }) => `We said: ${p.headline}`,
      youSaw: (p: { answer: string }) => `You saw: ${p.answer}`,
      notAnswered: "Not answered yet",
      answers: "What you saw",
      answersFor: (p: { night: string; site: string }) => `What you saw on ${p.night} at ${p.site}`,
      nightsHeading: "Nights",
    },
    tally: {
      title: "How often the forecast was right",
      none: "No answers yet. Answer a night below, or on Tonight the morning after.",
      matched: {
        one: (p) => `${p.matched} of ${p.answered} night matched`,
        other: (p) => `${p.matched} of ${p.answered} nights matched`,
      } as PluralForms<(p: { matched: string; answered: string }) => string>,
      misses: (p: { optimistic: string; pessimistic: string }) =>
        `${p.optimistic} too optimistic · ${p.pessimistic} too pessimistic`,
      byWord: "By what we said",
      word: (p: { matched: string; answered: string }) => `${p.matched} of ${p.answered}`,
      hint: "Too optimistic means the sky was cloudier than we said: the costlier mistake, since it wastes a setup.",
    },
    outcome: { match: "Matched", optimistic: "Too optimistic", pessimistic: "Too pessimistic" },
  },

  /**
   * Every value a route may put into `?error=`, a zod issue may carry, or a store may return. Fixed
   * strings only: none of them may ever contain a submitted value.
   */
  errors: {
    generic: "Something went wrong. Please try again.",
    notConfigured: "The database is not configured.",
    checkFields: "Check the highlighted fields.",
    outOfRange: "Some values are out of the allowed range.",
    name: {
      required: "Enter a name.",
      tooLong: "Keep the name to 60 characters or fewer.",
    },
    site: {
      latitudeRange: "Enter a latitude between -90 and 90 degrees.",
      longitudeRange: "Enter a longitude between -180 and 180 degrees.",
      bortleRange: "Choose a Bortle class from 1 to 9.",
      minAltitudeRange: "Enter a minimum altitude as a whole number from 0 to 60 degrees.",
      timeZoneMode: "Choose how the time zone is set.",
      timeZone: "Choose a valid time zone.",
      timeZoneExample: "Choose a valid time zone, e.g. Europe/Warsaw.",
    },
    telescope: {
      apertureRange: "Enter an aperture between 20 and 1000 mm.",
      focalLengthRange: "Enter a focal length between 100 and 5000 mm.",
    },
    eyepiece: {
      focalLengthRange: "Enter a focal length between 2 and 60 mm.",
      afovRange: "Enter an apparent field of view as a whole number from 30 to 120°.",
      type: "Choose an eyepiece type.",
    },
    onboarding: {
      eyepiecesMalformed: "Check your eyepieces.",
      eyepiecesTooMany: "Add at most 10 eyepieces.",
    },
    observation: {
      objectInvalid: "Choose a Messier object from M1 to M110.",
      nightInvalid: "Enter the observing night as a date.",
      nightInFuture: "The observing night cannot be later than tonight.",
      nightTooEarly: "Enter an observing night from 1900 onwards.",
      ratingRequired: "Rate how it went, from 1 to 5.",
      siteRequired: "Choose the site you observed from.",
      telescopeRequired: "Choose the telescope you used.",
      gearNotFound: "That site or telescope no longer exists.",
    },
    load: {
      sites: "Could not load your sites. Please try again.",
      telescopes: "Could not load your telescopes. Please try again.",
      eyepieces: "Could not load your eyepieces. Please try again.",
      site: "Could not load the site. Please try again.",
      telescope: "Could not load the telescope. Please try again.",
      eyepiece: "Could not load the eyepiece. Please try again.",
      setup: "Could not load your setup. Please try again.",
      observations: "Could not load your observation log. Please try again.",
      skyChecks: "Could not load your sky checks. Please try again.",
    },
    save: {
      site: "Could not save the site. Please try again.",
      telescope: "Could not save the telescope. Please try again.",
      eyepiece: "Could not save the eyepiece. Please try again.",
      setup: "Could not save your setup. Please try again.",
      observation: "Could not save the observation. Please try again.",
      skyCheck: "Could not save your answer. Please try again.",
    },
    delete: {
      site: "Could not delete the site. Please try again.",
      telescope: "Could not delete the telescope. Please try again.",
      eyepiece: "Could not delete the eyepiece. Please try again.",
      observation: "Could not delete the observation. Please try again.",
    },
    notFound: {
      site: "Site not found.",
      telescope: "Telescope not found.",
      eyepiece: "Eyepiece not found.",
      observation: "Observation not found.",
      skyCheck: "That night can't be checked yet, or it no longer exists.",
    },
    geocoding: {
      failed: "Place search is unavailable right now.",
    },
    auth: {
      notConfigured: "Supabase is not configured",
      invalidCredentials: "Incorrect email or password.",
      userExists: "This email is already registered. Try signing in instead.",
      weakPassword: "Choose a stronger password.",
      invalidEmail: "Enter a valid email address.",
      rateLimited: "Too many attempts. Please wait a moment and try again.",
      emailRateLimited: "Too many emails sent. Please wait a while and try again.",
      generic: "Could not complete the request. Please try again.",
    },
  },
} as const;
