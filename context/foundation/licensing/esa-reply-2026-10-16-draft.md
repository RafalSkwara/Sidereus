**Reply in the same email thread** (so ESA's legal team sees the first message).

**Subject:** Re: Request for authorisation: commercial use of Hipparcos-derived star data in a small stargazing web app

Dear Dr [surname],

Thank you very much for your prompt and detailed reply, and for the time you and your colleagues spent on our request. It is a great help to us. Thank you in particular for explaining which of the data products fall within ESA's remit and for suggesting a route we can follow.

We understand the position on the HYG Database and on Tycho-2, and we withdraw both from our request. We would like to follow the option you propose: we kindly ask ESA to include in its assessment the direct commercial use of the Hipparcos Catalogue, Version 1 (ESA, 1997, ESA SP-1200; VizieR I/239), obtained directly instead of through HYG.

The details of the intended use are:

- **Source and fields:** the file `hip_main.dat` from VizieR I/239. For each star we would use only the HIP identifier, the right ascension and declination in degrees (ICRS, epoch J1991.25), the V magnitude, and the proper motions in right ascension and declination, which serve only to bring the positions to epoch J2000.
- **Derived products:**
  1. a file of the stars of magnitude 4.5 or brighter (about 925 stars: position, magnitude and HIP identifier), delivered to users' browsers as part of the web application to draw the night sky;
  2. a file of the stars of magnitude 7.5 or brighter (about 25,700 stars: position, magnitude and HIP identifier), kept on our server and used only to draw finder charts, which users receive as rendered images (SVG) of a few hundred stars each. Users never receive this second file.
- **Other sources:** star names and designations (for example "β And") would come from separately licensed public sources, not from the Hipparcos Catalogue.
- **Repository:** both files, and the script that generates them from I/239, would be part of our public source repository (https://github.com/RafalSkwara/Sidereus). If ESA would prefer that the derived files are not published there, we are happy to keep them private.
- **Credit:** "Credit: ESA" and the citation "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200" on every view that draws stars and in the repository's data licence file. We will not state or imply any endorsement by ESA or its staff, and will not use ESA's name or logo in marketing.
- **Scale and revenue (unchanged from our first message):** an optional subscription of [price range, e.g. a few euros per month], for [expected users, e.g. fewer than N users in the first year], with no advertising and no sale of data.

Until ESA's authorisation is in place, the application remains free of charge and we will not use the data for any commercial purpose. We have no current plans to use Gaia DR3. Should that change, we will write to you separately with the exact table, fields and delivery, as you describe.

We are happy to wait for the outcome of ESA's work on the commercial-use framework, and to provide any further detail that would help the assessment.

With kind regards and thanks again,

[Your full name]
[Role / company, if any]
Sidereus, https://github.com/RafalSkwara/Sidereus
