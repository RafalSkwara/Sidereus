# ui-landing — follow-ups

- **F7 (impl-review):** the Topbar logo links to `/`; signed in, that is now a 302 to `/tonight`. Point it at `/tonight` for a signed-in user in a change that owns `Topbar.astro` (not done here: shared with the auth and gear shells during the concurrent UI passes).
- **Topbar at 320 px, Polish, signed out (pre-existing, found by this pass):** the brand, "Zaloguj się" and the two icon buttons need 342 px, so the settings button overflows the viewport by 22 px (also on `/auth/*`). The old landing hid it with `overflow-hidden` on its root, which clipped the button. Below the 390 px target; belongs to the Topbar's owner. Evidence: scratchpad `shots/p3/pl-dark-320.png`.
