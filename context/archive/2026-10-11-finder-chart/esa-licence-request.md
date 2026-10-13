# Draft: commercial licence request to ESA (Hipparcos data)

> Draft for the owner to review and send (O-6, option A, 2026-10-13). Not sent. Replace every `[…]` placeholder.
> Terms behind it: https://www.cosmos.esa.int/web/esdc/terms-and-conditions ("Prior to any commercial use … a detailed
> request for authorisation/licence shall be made by the User by sending email to data.licences@esa.int").
> Background: `research.md` §9 and §9.1.

**To:** data.licences@esa.int
**Subject:** Request for authorisation: commercial use of Hipparcos-derived star data in a small stargazing web app

---

Dear ESA Data Licensing team,

I am writing to request authorisation, under the Terms and Conditions for the use of data in the ESA Space Science
Archives, to use data derived from the Hipparcos Catalogue in a small web application that may later charge a
subscription.

**The application.** Sidereus ([public URL]) is a stargazing planner for beginner amateur astronomers. It tells a user
what is worth observing tonight from their site with their telescope, shows the sky, and (in development) draws
finder charts that guide them from a naked-eye star to a target. It is developed by [owner's name / company name, if
any], based in [country]. The source code is public at https://github.com/RafalSkwara/Sidereus.

**Revenue model.** The app is free today and takes no payment. We may introduce an optional paid subscription for
advanced features such as the finder charts. The scale is small: [expected number of users, e.g. "fewer than N
users in the first year"]; [expected price range, e.g. "a few euros per month"]. There is no advertising and no sale
of data.

**The data.** We do not download from the ESA archives directly. We use the HYG database v4.1 (David Nash,
https://github.com/astronexus/HYG-Database, CC BY-SA 4.0), which is compiled mainly from the Hipparcos Catalogue,
pinned at commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce`. From it we keep only position (converted to J2000 unit
vectors), visual magnitude, an identifier and a designation or name:

1. the 925 stars of magnitude 4.5 or brighter, used to draw the sky in the browser; and
2. about 25,800 stars of magnitude 7.5 or brighter, used only on our server to draw finder charts.

**How the data is used.**

- The sky view and the finder charts are rendered images (SVG) of a few hundred stars around a target. Users never
  receive the 7.5-magnitude file.
- The derived files are part of the app. They are committed to the public repository above (as `bright-stars.json`
  and `finder-stars.json`), alongside the scripts that generate them from the pinned HYG file.
- The 4.5-magnitude file is also delivered to users' browsers as part of the web app.

**Credit and endorsement.** Every view that draws stars shows a data credit next to the HYG credit. We are adding
"Credit: ESA" for Hipparcos to it, and to the repository's data licence file, with the finder-chart release. We will not state or
imply any endorsement by ESA or its staff, and we will not use ESA's name or logo in marketing.

**Our questions.**

1. May we use the Hipparcos-derived data described above in the app if it charges a subscription?
2. Does the authorisation cover the derived files in the public repository and in the app as delivered to users?
3. Are there conditions, fees or a required credit wording beyond "Credit: ESA"?
4. If we later add Tycho-2 or Gaia DR3 data ("Credit: ESA, Gaia DPAC"), should we send a separate request?

I am happy to provide any further detail.

Kind regards,
[Owner's full name]
[Role / company, if any]
[Email address]
[Postal address or country, if ESA needs it]
