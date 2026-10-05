# ui-sky-light — manual verification evidence (2026-10-05)

Production preview on :4325 against local Supabase and the all-clear forecast fixture (:4400), throwaway user
onboarded in Madrid. Screenshots in the session scratchpad (`sky/p2/` before the chevrons, `sky/p3b/` final; not
committed), each checked by eye.

| Row | Evidence | Result |
| --- | --- | --- |
| 2.3 | `p3b/tonight-light-{en,pl}-{390,1280}.png` | Navy band from the Topbar to the silhouette; stars, star names, verdict, markers and compass legible; slider row on the light ground |
| 2.4 | `p3b/moon-light-{en,pl}-{390,1280}.png`, `p3b/state-moon-skeleton-light.png` | Page sky navy, back link legible; skeleton the same navy (no jump) |
| 2.5 | `p3b/state-popover-light.png` | Settings sheet opens light on a Tonight page |
| 2.6 | `p3b/tonight-{dark,red}-*`, `p3b/gear-light-en-{390,1280}.png` | Dark and red unchanged (compared with `p2/` and main); the light `/gear` header stays pale |
| 3.3 | `p3b/tonight-*-{390,1280}.png` | Chevrons at both edges in every theme, mid-strip, covering no label at load; they pan |
| 3.4 | `p3b/state-end-{left,right}-{dark,light,red}.png` | Each chevron hides at its end |
| 3.5 | `p3b/state-focus-*.png`, `p3b/state-after-enter-*.png` | `--ring` outline visible in every theme; Enter pans; at the end the focus moves to the other chevron (asserted) |
| 4.3 | the 50 files in `p3b/` | EN/PL × dark/light/red × 390/1280 for `/tonight` and `/tonight/moon`, plus the hover, focus, end, popover and skeleton states |
| 4.4 | as above | Chevron matrix: default, hover, focus shown; disabled = hidden at its end; error and empty N/A (no data dependency); loading = the skeleton's static navy sky |

Not shown: `/design` (dev only). The dev server already running on :4330 is not this session's and answered 500. The
specimen change is the same `TonightSky night` that the skeleton screenshots show.
