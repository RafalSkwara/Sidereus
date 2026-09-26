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

export const en = {
  common: {
    appName: "Sidereus",
    pageTitle: (p: { title: string }) => `${p.title} · Sidereus`,
    saving: "Saving...",
    name: "Name",
    focalLengthMm: "Focal length (mm)",
  },

  nav: {
    tonight: "Tonight",
    myGear: "My gear",
    welcome: "Welcome!",
    signIn: "Sign in",
    signOut: "Sign out",
  },

  preferences: {
    theme: "Theme",
    dark: "Dark theme",
    light: "Light theme",
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

  verdict: {
    level: { go: "Go", marginal: "Marginal", "no-go": "No-go" },
  },

  landing: {
    kicker: "Messier 1 – 110 · your sky, your kit",
    tagline: "Is tonight worth setting up for?",
    lead: "A clear verdict for the night and a short, explained list of what to point your telescope at, with the eyepieces you already own.",
    verdictsLabel: "Night verdicts",
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
      "Sidereus Tonight view: a Go verdict with the night's dark window, then the ranked Messier objects, each with where to look and which eyepiece to use.",
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
    kicker: "Your sky, your kit",
    back: "← My gear",
    backToGear: "Back to My gear",
    notFound: "Not found",
    sites: {
      heading: "Sites",
      add: "Add site",
      empty: "No sites yet. Add the place you observe from, so tonight's verdict uses your sky.",
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
      empty: "No telescopes yet. Add yours, so the suggested magnifications fit your scope.",
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
      empty: "No eyepieces yet. Add the ones in your case, so each object gets a pair you actually own.",
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

  onboarding: {
    title: "Set up Sidereus",
    intro: "Three quick choices, and tonight's verdict is ready. You can change any of it later in My gear.",
    submit: "Show me tonight",
    locationRequired: "Set a location above to continue.",
    where: {
      kicker: "1 · Where",
      heading: "Where do you observe from?",
      hint: "Your home, or wherever you usually set up. It is saved to about 1 km, never more precisely.",
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
      manualToggle: "Enter coordinates instead",
      usingDevice: "Using your current location (about 1 km)",
      usingPlace: (p: { place: string }) => `Using ${p.place} (about 1 km)`,
      usingCoordinates: "Using the coordinates you entered, rounded to about 1 km",
    },
    sky: {
      kicker: "2 · Sky",
      heading: "How dark is your sky?",
      hint: "Pick the scene closest to a clear, moonless night where you observe.",
    },
    kit: {
      kicker: "3 · Kit",
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

  /** The 16-wind compass rose, clockwise from north. */
  compass: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"],

  tonight: {
    title: "Tonight",
    kicker: "Your sky, tonight",
    addSitePrompt: "Add an observing site to see tonight",
    addSite: "Add site",
    addTelescopePrompt: "Add a telescope to see tonight",
    addTelescope: "Add telescope",
    setupPrompt: "Set up your site and telescope in about a minute",
    setup: "Set up",
    eyepiecesFailed: "Could not load your eyepieces, so tonight's objects are shown without eyepiece suggestions.",
    failed: "Could not work out tonight's sky. Please try again.",
    loading: "Loading tonight's sky…",
    loadingSlow: "This is taking longer than usual.",
    reload: "Reload",

    card: {
      kicker: "Tonight's verdict",
      darkFrom: "Dark from",
      darkTo: "to",
      noDarkWindow: "No dark window tonight",
      timesIn: (p: { zone: string }) => ` · times in ${p.zone}`,
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
      moon: {
        lead: (p: { percent: string }) => `${p.percent}% clear of moonlight`,
        follow: (p: { percent: string }) => `${p.percent}% clear of moonlight`,
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

    /** Lowercase phrases the verdict card puts after the level ("marginal — no weather data"). */
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

    cleared: {
      none: "No object cleared the bar tonight",
      count: {
        one: (p) => `${p.count} object cleared the bar tonight`,
        other: (p) => `${p.count} objects cleared the bar tonight`,
      } as PluralForms<Count>,
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
      found: (p: { date: string; level: string; reason: string }) =>
        `Next night worth a look: ${p.date} — ${p.level}, ${p.reason}`,
      /** Lowercase, mid-sentence: not the verdict card's capitalised labels. */
      level: { go: "go", marginal: "marginal", "no-go": "no-go" },
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

    attribution: {
      objectData: "Object data:",
      weather: "Weather:",
    },
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
    load: {
      sites: "Could not load your sites. Please try again.",
      telescopes: "Could not load your telescopes. Please try again.",
      eyepieces: "Could not load your eyepieces. Please try again.",
      site: "Could not load the site. Please try again.",
      telescope: "Could not load the telescope. Please try again.",
      eyepiece: "Could not load the eyepiece. Please try again.",
      setup: "Could not load your setup. Please try again.",
    },
    save: {
      site: "Could not save the site. Please try again.",
      telescope: "Could not save the telescope. Please try again.",
      eyepiece: "Could not save the eyepiece. Please try again.",
      setup: "Could not save your setup. Please try again.",
    },
    delete: {
      site: "Could not delete the site. Please try again.",
      telescope: "Could not delete the telescope. Please try again.",
      eyepiece: "Could not delete the eyepiece. Please try again.",
    },
    notFound: {
      site: "Site not found.",
      telescope: "Telescope not found.",
      eyepiece: "Eyepiece not found.",
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
