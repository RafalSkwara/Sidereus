---
title: "ESA's reply on the Hipparcos licence: assessment and next step"
date: 2026-10-16
status: assessment (not legal advice)
author: herdr agent "reviewer" (independent licensing analyst), for the owner
relates_to: PRD Open Question 21; roadmap M-4 "External" item 2; context/archive/2026-10-11-finder-chart (research §9, §9.1; plan D-2, D-5, D-10, O-6; esa-licence-request.md)
input: ESA's reply received about 2026-10-16 (Head Scientist, ESA Space Science Archives), to the owner's request sent 2026-10-14
---

# ESA's reply on the Hipparcos licence: assessment and next step

**Not legal advice.** I am an analyst reading licences, terms pages and ESA's letter. Every point marked
**[lawyer]** or **[rightsholder]** must be confirmed by a lawyer or by the party that holds the right before money
is taken. All web sources were read on 2026-10-16; the list is at the end.

## 0. Summary

- **The owner is half right.** We did ask ESA about things ESA does not control: the HYG compilation as a
  product, our HYG-derived files, and Tycho-2 (which ESA says belongs to Høg et al., not ESA; our research had
  filed it under ESA). But the owner's reading goes too far in one direction: the Hipparcos data inside HYG
  _does_ belong to ESA (ESA says so and HYG's author says HYG "started with the Hipparcos data"). ESA did not say
  HYG is fine; it said it cannot speak for a third party's package. **The risk is unassigned, not gone.**
- **Keep shipping HYG while the app is free.** The ESA non-commercial condition is not triggered by an app that
  takes no money (M-4 takes none). Our HYG obligations (attribution, ShareAlike on the derived files) are met,
  with small gaps listed in §2.3.
- **For a paid product, HYG cannot be made clean by paperwork.** HYG's author licensed what he owns (CC BY-SA
  4.0); Creative Commons' own guidance says a licensor "should not apply a license to material that you do not own"
  and "the CC license only applies to the rights you have in the work". Asking the HYG provider, as ESA suggests,
  yields nothing new. The only two ways out are (a) a legal opinion that no ESA right reaches our files
  **[lawyer]**, or (b) ESA's authorisation for Hipparcos Version 1 used directly, which ESA has offered to assess.
- **Recommendation: take ESA's offer.** Reply now (ESA asked us to say so, and assessments are being batched to
  the end of November 2026), ask ESA to include the direct use of Hipparcos Version 1 (VizieR I/239,
  `hip_main.dat`), and in parallel prepare a source-agnostic star build so the switch is a re-run when the
  authorisation arrives. Keep SAO as the fallback if ESA refuses or prices it out. Gaia DR3 later, and only if
  deeper charts are ever wanted. No payment before one of these is settled.
- **Nothing here touches the M-4 deadline (2026-11-04).** M-4 takes no money; the payments milestone was already
  gated on Open Question 21.

## 1. Was the owner right? What our request got wrong

ESA's letter makes three rulings and one offer:

1. HYG v4.1 "is a separately prepared third-party compilation … ESA cannot grant commercial-use authorisation for
   HYG or for files derived from HYG"; permission "would therefore need to be addressed with the HYG provider or
   rightsholder".
2. Tycho-2 "is not an ESA product and ESA does not hold its intellectual property rights; these are held by
   E. Høg et al. (2000)".
3. Gaia DR3: ESA can assess a direct use once we name the table, the fields and how the data would be exposed.
4. Offer: "ESA holds the intellectual property rights for Hipparcos Version 1 and can assess its direct commercial
   use" (ESA, 1997 / ESA SP-1200 / VizieR I/239); say so and it joins the assessment ESA aims to finish by the end
   of November 2026.

What the request got wrong, against the record:

| In our request (`esa-licence-request.md`, sent 2026-10-14)                                                                                 | What was off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Source of the error                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asked whether "the authorisation cover[s] the derived files" built from HYG, and described HYG's commit, filter and output files at length | ESA can only license its own catalogue. We asked it to bless a third party's package of ESA's data. The ask should have been scoped to the ESA component: Hipparcos positions and magnitudes as they reach the product, ideally taken from ESA's own file.                                                                                                                                                                                                                                                                                                   | Research §9 and plan D-10 framed the problem as "HYG inherits ESA's terms", true as far as it goes, but then asked ESA to rule on HYG.                        |
| Asked about Tycho-2 "(Credit: ESA, Gaia DPAC)" as an ESA product                                                                           | Tycho-2 (Høg et al. 2000) is a separate catalogue built on Tycho star-mapper data plus the Astrographic Catalogue; ESA disclaims the rights. Note the contradiction: the VizieR I/259 ReadMe carries the line "License: CC-BY-NC-3.0 IGO", and ESA's own page says only "The Hipparcos and Tycho Catalogues" (the 1997 pair) are CC BY-NC 3.0 IGO. Debian's `tycho2` copyright file records Erik Høg answering "OK" in 2015 to a BSD-2-Clause proposal, without an explicit grant text. Tycho-2's status is muddled, not ESA's to settle. **[rightsholder]** | Research §9 table row "Hipparcos / Tycho / Tycho-2 (ESA)" lumped three catalogues under ESA's page; PRD OQ21 repeats it ("ESA's Hipparcos, Tycho-2 or Gaia"). |
| "We do not download from the ESA archives directly"                                                                                        | Correct and honest, and exactly the fact that let ESA decline. Not a mistake, but it made the HYG question unanswerable for ESA.                                                                                                                                                                                                                                                                                                                                                                                                                             | -                                                                                                                                                             |
| Gaia DR3 asked in the abstract                                                                                                             | ESA's answer is reasonable: ask when it is concrete. Not a mistake, just premature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                             |

**Verdict on (1):** the owner is right that we asked ESA about HYG, HYG-derived files and Tycho-2, none of which
ESA controls. The owner is wrong if the reading is "so ESA has no stake": ESA states it holds the rights to the
Hipparcos data that HYG contains, and ESA has neither waived nor denied that those rights reach HYG. It declined
to rule.

## 2. Can Sidereus keep shipping HYG-derived star files commercially?

### 2.1 What we actually ship, and where each field comes from

Per `scripts/build-stars.mjs`, `bright-stars.meta.json` and `finder-stars.meta.json`: from HYG v4.1 (pinned commit
`c7f7f883…`, 2025-02-14) we keep position (ra, dec), visual magnitude, the HYG id, and for 3,342 stars the Bayer
letter, Flamsteed number, constellation and proper name. The 925-star file (mag ≤ 4.5) is sent to browsers; the
25,791-star file (mag ≤ 7.5) stays on the server and reaches users only as rendered SVG charts.

HYG's author describes the build (astronexus "HYG details" page): he "started with the Hipparcos data", consulted
Gliese "to fill in gaps", added Yale Bright Star Catalog data via the HD number; the `bf` field is "primarily from
the Fifth Edition of the Yale Bright Star Catalog"; proper names "are taken from the International Astronomical
Union"; "the Hipparcos magnitude measurements are often superior" and distances come from Hipparcos. So, for our
files:

| Field                                                     | Upstream                                | Rights picture                                                                                                                                                           |
| --------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ra, dec, mag for the ~25,700 stars with a HIP number      | Hipparcos Catalogue (ESA 1997)          | ESA: CC BY-NC 3.0 IGO, "Credit: ESA"; ESDC terms require prior authorisation for any commercial use.                                                                     |
| ra, dec, mag for the ~78 stars ≤ 7.5 without a HIP number | Gliese 3 / Yale BSC5 via HYG            | Yale BSC5: no licence; Debian treats altered redistribution as forbidden without the authors' permission. Negligible count; droppable.                                   |
| Bayer, Flamsteed                                          | Yale BSC5 via HYG                       | Historical designations (Bayer 1603, Flamsteed 1725) are facts; the _mapping_ was typed into BSC5. Low risk; replaceable by a CC0 source (§3, Wikidata) or the IAU list. |
| Proper names                                              | IAU Working Group on Star Names via HYG | IAU's official names; facts, public.                                                                                                                                     |
| Constellation                                             | HYG (source not stated)                 | Computable from position with IAU boundaries; `astronomy-engine`, already a dependency, has a `Constellation()` function.                                                |
| HYG id                                                    | HYG's own numbering                     | HYG's own; CC BY-SA 4.0.                                                                                                                                                 |

### 2.2 Layer one: HYG's own licence (CC BY-SA 4.0). Met, with small gaps

CC BY-SA 4.0 allows commercial use. Its conditions on us, as the maker of Adapted Material:

- **Attribution (§3(a)):** retain the creator's identification, a copyright notice if supplied (HYG supplies none),
  a notice referring to the licence, a URI to the material "to the extent reasonably practicable", and "indicate if
  You modified the Licensed Material". We do this in `LICENSE-DATA.md` (filter and normalisations listed), the two
  meta files and `Attribution.astro` (HYG linked, "CC BY-SA 4.0").
- **ShareAlike (§3(b)):** our Adapted Material must be CC BY-SA 4.0 or later or a BY-SA-compatible licence, and we
  "may not offer or impose any additional or different terms or conditions". The four generated files are declared
  CC BY-SA 4.0 in `LICENSE-DATA.md`. Good.
- **Database rights (§4):** if sui generis rights apply, the database we build from a substantial portion is Adapted
  Material. Already covered by the declaration above.

Gaps, all cheap: (a) the signed-out landing image `public/landing/tonight.png` shows HYG-derived stars with no
credit (already noted in PRD OQ21); (b) rendered finder-chart SVGs are arguably Adapted Material of the star file
and therefore BY-SA themselves. That is harmless for a sky chart but should be stated once in `LICENSE-DATA.md`
**[lawyer, minor]**; (c) `Attribution.astro` carries no link to the licence text itself (the CC URI). Optional.

**Conclusion for layer one:** HYG's licence is no obstacle to a paid product, and our compliance is essentially
complete.

### 2.3 Layer two: ESA's Hipparcos content inside HYG. Not cured by anything HYG can do

- Creative Commons' FAQ: "You should not apply a license to material that you do not own or that you are not
  authorized to license" and "The CC license only applies to the rights you have in the work." HYG's grant cannot
  carry ESA's rights, if ESA has any that reach the data as compiled.
- ESA's Hipparcos page: "The Hipparcos and Tycho Catalogues are distributed under the CC BY-NC 3.0 IGO licence";
  the ESDC terms "require users to acknowledge ESA using 'Credit: ESA'". CC BY-NC 3.0 IGO §4(b) forbids exercising the
  licensed rights "in any manner that is primarily intended for or directed toward commercial advantage or private
  monetary compensation". The ESDC terms add: "Prior to any commercial use by the User of any Data or Data Product,
  including any use or application that directly or indirectly generates a financial gain, a detailed request for
  authorisation/licence shall be made by the User by sending email to data.licences@esa.int"; governed by French law,
  ICC arbitration in Paris.
- The CC FAQ on NonCommercial: "Whether a use is commercial will depend on the specifics of the situation and the
  intentions of the user"; CC "cannot advise you on what is and is not commercial use"; "if you are unsure … contact
  the rights holder". A subscription whose selling point includes finder charts drawn from these stars is squarely
  commercial under both texts. Even the free tier of a product with paid plans may be read as "indirectly generates a
  financial gain" **[lawyer]**.

**Does ESA's right actually reach our files? Open, both ways [lawyer]:**

1. _Copyright._ CC 3.0 IGO defines a database as a "Work" only where "by reason of the selection and arrangement of
   its contents" it is an intellectual creation. Measured positions and magnitudes are facts. We keep ~22 % of the
   catalogue by our own brightness cut, in our own layout. Whether anything protectable by copyright survives into
   our files is arguable; EU and US law both deny copyright in the facts themselves.
2. _EU sui generis database right (Directive 96/9/EC)._ Protects substantial investment for 15 years from completion
   (1997, so nominally expired ~2012 unless a later substantial new investment restarted it). Article 11 limits the
   right to makers who are nationals or companies of a Member State; ESA is an intergovernmental organisation, and
   ESA's own page on the right says only that it "does not apply to databases created by companies located outside
   the European Union". Whether an IGO qualifies is unsettled in anything I found.
3. _Contract._ The ESDC terms bind "the User" of the archive. We never used ESA's archive; HYG's author compiled
   Hipparcos data years before ESA attached a CC licence (the IGO ports of CC 3.0 date from 2013), at a time when
   NASA's ADC, a distributor of the catalogue, stated "All ADC data are public domain unless otherwise stated in the
   ReadMe file" (quoted in Debian's `kstars-data-extra-tycho2` copyright file, which also quotes the ADC's "The data
   are for scientific use only and have no commercial value"). Whether a later licence label can bind a compilation
   built from an earlier public-domain distribution is a question for a lawyer, not for me.
4. _Practice._ Debian ships Stellarium in `main` with its Hipparcos-derived star files ("From ESA (European Space
   Agency) and the Hipparcos mission", no separate data licence), while it keeps the Tycho-2 extras and the Yale
   catalogue in `non-free`. Paid planetarium apps advertise Gaia and Hipparcos stars (Stellarium Mobile Plus: "Gaia
   DR2 catalog") and publish no ESA licence. Industry practice is loose, which is not a defence.

**Conclusion for layer two:** the legal exposure is uncertain and possibly small; the _relationship_ exposure is
now concrete. ESA knows Sidereus by name, knows it ships Hipparcos data through HYG, has stated its non-commercial
position, and has offered a clean route. Launching paid plans on HYG after this letter would be a knowing departure
from the rightsholder's stated terms. Our own `LICENSE-DATA.md` already says "until ESA answers the files must not
be used to generate financial gain"; ESA has now answered "not via HYG".

**Answer to (2):** yes while free. For a paid product, only with (a) a lawyer's opinion that no ESA right reaches the
files, which leaves the risk with us, or (b) ESA's authorisation for Hipparcos Version 1 taken directly. The HYG
provider cannot lift ESA's condition, so ESA's pointer to "the HYG provider or rightsholder" is a dead end for
permission (a courtesy note to David Nash about provenance is optional, not needed).

## 3. Options for a paid product, ranked

| #     | Option                                                                                 | Licence position                                                                                                                                                                                                                                                              | Effort (agent-days)                                                                                                                                                                                                                                                                                                                                                                                                                                          | Risk                                                                                                                                                                                                                                                                                                                                             | What changes in build and attribution                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1** | **Hipparcos Version 1 direct (VizieR I/239, `hip_main.dat`) with ESA's authorisation** | ESA holds the rights and has offered to assess exactly this. CC BY-NC 3.0 IGO plus a written authorisation.                                                                                                                                                                   | 3-4: new parser (HIP, RAdeg, DEdeg (ICRS, epoch J1991.25), Vmag, pmRA/pmDE for epoch propagation, trivial at our 0.01° packing), same two output files; designations from a CC0/IAU source (below); constellation computed; count guards re-pinned (≈25,713 stars ≤ 7.5 with a HIP number instead of 25,791; 925 bright stars expected unchanged, verify); fixtures and `stars.test.ts` / `finder-stars.test.ts` provenance assertions; CLAUDE.md tripwires. | Decision not before end of November 2026; ESA may attach conditions or a fee; the authorisation's wording decides whether the public repo may hold the derived files and whether the 925-star browser file counts as "exposing" ESA data. Positions and magnitudes are what HYG already carries from Hipparcos, so chart behaviour barely moves. | Meta `licence` becomes "CC BY-NC 3.0 IGO (commercial use under ESA authorisation ref. …)", `attribution` "Credit: ESA"; `Attribution.astro` drops HYG, keeps "Hipparcos, Credit: ESA", adds the citation "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200"; the derived files are no longer BY-SA (no HYG) but NC with ESA's conditions; `LICENSE-DATA.md` rewritten for the new source and the designation source. |
| **2** | **SAO Star Catalog J2000 (VizieR I/131A), the agreed fallback**                        | No licence statement in the ReadMe; the ADC distribution policy of the era said ADC data are public domain unless the ReadMe says otherwise; NASA NTRS marks the 1966 volumes and ADC documentation "public use permitted". No formal grant **[lawyer]**. Independent of ESA. | 3-4 (fixed-width parse; same designation layer as option 1).                                                                                                                                                                                                                                                                                                                                                                                                 | Legal: low but informal. Quality: medium. Research §9.1 measured 99.5 % of HYG's stars ≤ 7.5 matched, but                                                                                                                                                                                                                                        | ΔV                                                                                                                                                                                                                                                                                                                                                                                                                             | p90 0.38 and p99 0.98, and 4.5 % of SAO's faint entries have no HYG counterpart within a magnitude, so faint chart stars will be mis-bright or spurious; hop stars (≤ 6.5) are fine (0.49 % mismatched). No Bayer/Flamsteed. | Meta source/licence/attribution rewritten ("SAO Star Catalog, Smithsonian Astrophysical Observatory 1966; J2000 version USNO/ADC 1990"); `Attribution.astro` drops HYG and ESA; `LICENSE-DATA.md` states the public-use basis and its informality. |
| **3** | **Keep HYG, rely on compliance plus a legal opinion**                                  | HYG obligations met. The ESA layer stays as an unassigned risk unless a lawyer concludes no ESA right reaches the files.                                                                                                                                                      | 0 build; 1 for the notices.                                                                                                                                                                                                                                                                                                                                                                                                                                  | Risk stays with us after ESA has stated its position to us by name. Reverses our own `LICENSE-DATA.md` promise. If ESA's end-of-November framework turns out permissive, this converges with option 1 anyway.                                                                                                                                    | Only the notices: record ESA's letter in `LICENSE-DATA.md` and the PRD.                                                                                                                                                                                                                                                                                                                                                        |
| **4** | **Gaia DR3 later**                                                                     | ESA, CC BY-NC 3.0 IGO, assessable by ESA once we name the table and fields.                                                                                                                                                                                                   | 7+: G→V transform, bright-end supplement (Gaia is incomplete and saturated at the bright end; research §9 counted 36,663 sources G < 7.5 with no bright stars), HIP cross-match for designations.                                                                                                                                                                                                                                                            | Same ESA dependency as option 1 with far more work, for depth the finder does not need (D-5 caps the chart at 7.5).                                                                                                                                                                                                                              | Credit "ESA/Gaia/DPAC"; everything else as option 1.                                                                                                                                                                                                                                                                                                                                                                           |
| -     | _Not recommended:_ Tycho-2 direct; Hipparcos new reduction (van Leeuwen 2007, I/311)   | Tycho-2: ESA says Høg et al.; CDS labels it NC IGO; Høg's 2015 "OK" to Debian is not a licence text. I/311: no licence line at CDS; derived from ESA's raw data; holder unclear. Both **[rightsholder]**.                                                                     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Legal muddle for no gain over option 1.                                                                                                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Designations without Yale BSC5 (needed by options 1, 2 and 4):** the proper names come from the IAU WGSN list
(public, keyed by HIP number); Bayer and Flamsteed designations can be taken from Wikidata (CC0, properties
"Bayer designation" and "Flamsteed designation", linked to HIP ids) and spot-checked against HYG's `bf` field at
build time (compare, not copy); constellation from `astronomy-engine`'s `Constellation()`. This removes the last
Yale BSC5 dependency, which was itself a quiet risk (Debian: altered redistribution needs the authors' permission).

## 4. Recommendation, and whether to reply now

**Recommendation:** option 1, prepared so that option 2 is a parameter change.

1. **Reply to ESA now: yes.** ESA wrote "If you would like to follow that option, please let me know and we can
   include the specific direct use of Hipparcos Version 1 in our assessment", with the framework due by the end of
   November 2026. Not replying keeps Sidereus out of that batch and costs months. The reply should: accept the
   Hipparcos Version 1 route; drop the HYG and Tycho-2 questions; give the specifics ESA asked for in the Gaia
   paragraph (which they will want for Hipparcos too): the exact file and fields, the two derived products, how
   each is delivered; confirm the app stays non-commercial until ESA authorises; park Gaia. Draft in §5.
2. **Meanwhile, no payments, and HYG stays for M-4.** The non-commercial condition is not engaged by a free app;
   `LICENSE-DATA.md` already says so.
3. **Prepare the switch before the answer, as its own change after M-4 (or in a quiet M-4 slot if the owner
   wants):** make `scripts/build-stars.mjs` source-agnostic (readers for HYG today, Hipparcos V1 and SAO), add the
   CC0/IAU designation layer and computed constellations, re-pin the count guards per source, keep the pinned HYG
   output as the shipped default until ESA answers. Then the switch is "flip the source, re-run, review the diff,
   update the notices". If ESA refuses or prices it out, run the SAO reader instead.
4. **Lawyer check, once, before the first payment:** the authorisation's wording (public repo, browser-delivered
   file, "Credit: ESA" placement, fee, term), and if the owner prefers to stay on HYG instead, the §2.3 reach
   question. One consultation, not a research project.
5. **Do not ask the HYG provider for permission.** He has already granted all he can (CC BY-SA 4.0). A courtesy note
   is optional and can wait.

## 5. Draft reply to ESA (English; the owner sends it)

> **Subject:** Re: Request for authorisation: commercial use of Hipparcos-derived star data in a small stargazing web app
>
> Dear [title and surname of the Head Scientist],
>
> Thank you for the clear reply and for reviewing which products fall within an ESA authorisation. We understand the
> position on HYG and on Tycho-2 and withdraw both from our request.
>
> We would like to follow the option you propose: please include the direct commercial use of the Hipparcos
> Catalogue, Version 1 (ESA, 1997, ESA SP-1200; VizieR I/239) in your assessment. The specifics are:
>
> - **Source file and fields:** `hip_main.dat` from I/239; for each star the HIP identifier, right ascension and
>   declination in degrees (ICRS, epoch J1991.25), the V magnitude, and the proper motions (used only to propagate
>   the positions to J2000). No other field.
> - **Derived products:** (1) a file of the stars brighter than magnitude 4.5 (about 925 stars: position as a unit
>   vector, magnitude, identifier), delivered to users' browsers as part of the web app to draw the night sky; (2) a
>   file of the stars brighter than magnitude 7.5 (about 25,700 stars: position, magnitude, identifier), kept on our
>   server and used only to render finder charts as images (SVG) of a few hundred stars each. Users never receive
>   the second file. Both files and the script that generates them from I/239 would be committed to our public
>   source repository, https://github.com/RafalSkwara/Sidereus, unless you prefer otherwise.
> - **Credit:** "Credit: ESA" and the citation "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200" on every
>   view that draws stars and in the repository's data-licence file; no statement or implication of endorsement, no
>   use of ESA's name or logo in marketing.
> - **Scale and revenue, unchanged from our first message:** a small optional subscription (a few euros per month,
>   fewer than [N] users in the first year), no advertising, no sale of data.
>
> Until ESA's authorisation is in place the application remains free of charge and we will not use the data for
> any commercial purpose. We will come back to you about Gaia DR3 only if we ever decide to use it, with the exact
> table, fields and delivery as you describe.
>
> Please let me know if you need anything further for the assessment, and we are happy to wait for the outcome of
> ESA's framework at the end of November.
>
> Kind regards,
> [Owner's name]
> [Role / company, if any]
> Sidereus, https://github.com/RafalSkwara/Sidereus

Notes for the owner before sending: replace `[N]` with the number used in the first message; the field names
`HIP`, `RAdeg`, `DEdeg`, `Vmag`, `pmRA`, `pmDE` are the I/239 ReadMe's labels; the counts are HYG-measured
estimates and are worded as "about". Keep the thread (reply in the same email conversation) so ESA's legal team sees
the first message.

## 6. Concrete repo follow-ups (list only, nothing edited here)

Through the change chain, never in `context/archive/`:

1. **`src/lib/catalogue/LICENSE-DATA.md`, "Upstream: Hipparcos (ESA)":** record ESA's reply (date, the three
   rulings and the offer), state that ESA cannot authorise HYG-derived files and that a direct Hipparcos Version 1
   authorisation is being sought; keep "must not be used to generate financial gain"; add ESA's citation
   "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200"; one sentence that rendered charts from the star
   files are treated as BY-SA Adapted Material too; drop any implication that Tycho-2 is ESA's.
2. **`src/components/tonight/Attribution.astro`:** no change needed now ("HYG (CC BY-SA 4.0) · Hipparcos, Credit:
   ESA (CC BY-NC 3.0 IGO)" is right for the HYG era). On the switch: remove HYG, keep "Hipparcos, Credit: ESA", add
   the SP-1200 citation (new i18n keys in `en.ts` and `pl.ts`); its header comment and the Open-Meteo CC BY 4.0 line
   stay.
3. **`public/landing/tonight.png`:** the signed-out landing shows stars with no credit (pre-existing, PRD OQ21).
   Add the credit under the image or in the landing's footer.
4. **PRD Open Question 21, star paragraph:** correct "ESA's Hipparcos, Tycho-2 or Gaia" (Tycho-2 is Høg et al.,
   per ESA 2026-10); record ESA's answer of 2026-10 and the decision path: direct Hipparcos Version 1 with ESA's
   authorisation (assessment earliest end of November 2026), SAO as the fallback, no payment before either; note
   that the HYG rightsholder cannot lift ESA's condition; add the lawyer check before the first payment; point to
   this file.
5. **Roadmap:** M-4 "External" item 2 becomes "ESA assessment of direct Hipparcos V1 use, earliest end Nov 2026;
   does not block M-4"; "Ready to charge" (Parked) gains the dependency "star source settled (ESA authorisation or
   SAO)"; add a candidate change `star-source-switch` (source-agnostic `build-stars.mjs`, CC0/IAU designation layer,
   computed constellations, per-source count guards) that can be prepared before ESA answers; retire the wording
   "a refusal opens its own change to switch to SAO" in favour of that change.
6. **`context/handoff.md`:** replace "awaits the reply" (lines ~29, 51, 90) with the state above and the owner's
   action (send the reply).
7. **`scripts/build-stars.mjs` and the meta files (on the switch, not now):** source readers; `licence`,
   `attribution` and a new `upstream` entry per source; `EXPECTED_COUNT` / `FINDER_EXPECTED_COUNT` per source;
   `stars.test.ts` and `finder-stars.test.ts` provenance assertions (today they pin "CC BY-SA 4.0" and the HYG
   commit); CLAUDE.md's two star tripwires and the Catalogue paragraph.
8. **New change folder for the ESA correspondence:** the sent request is archived and immutable; the reply draft
   above and ESA's letter belong in a new `context/changes/<id>/` (or `context/foundation/` beside this file) so
   the thread is on record without touching the archive.
9. **Research correction note:** `context/archive/2026-10-11-finder-chart/research.md` §9 mis-files Tycho-2 under
   ESA; it cannot be edited. Record the correction in the PRD note (item 4) and in `lessons.md` if the owner wants a
   lesson ("ask a rightsholder about its own product, scoped to its fields; verify who holds each catalogue").

## 7. Sources (all read 2026-10-16)

ESA and CDS:

- ESA, The Hipparcos and Tycho Catalogues (licence CC BY-NC 3.0 IGO, "Credit: ESA", citation SP-1200):
  https://www.cosmos.esa.int/web/hipparcos/catalogues
- ESA, ESDC Terms and Conditions (commercial use, data.licences@esa.int, endorsement, French law):
  https://www.cosmos.esa.int/web/esdc/terms-and-conditions
- ESA, Gaia data licence (CC BY-NC 3.0 IGO, commercial use per the ESDC terms):
  https://www.cosmos.esa.int/web/gaia-users/license
- ESA, Sui generis right protection (15 years; "does not apply to databases created by companies located outside
  the European Union"): https://www.esa.int/About_Us/Law_at_ESA/Intellectual_Property_Rights/Sui_generis_right_protection
- VizieR I/239 ReadMe, Hipparcos and Tycho Catalogues ("License: CC-BY-NC-3.0 IGO"; Perryman, O'Flaherty,
  Ochsenbein, 1997-02-11): https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/239
- VizieR I/259 ReadMe, Tycho-2 ("License: CC-BY-NC-3.0 IGO"; Høg et al. 2000):
  https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/259
- VizieR I/311 ReadMe, Hipparcos, the New Reduction (no licence line): https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/311
- VizieR I/131A ReadMe, SAO Star Catalog J2000 (no licence line; USNO J2000 positions; HD and DM ids, no
  Bayer/Flamsteed): https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/131A
- VizieR V/50 ReadMe, Bright Star Catalogue 5th ed. ("made available only for dissemination on the Astronomical
  Data Center CD ROM"): https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/V/50
- CDS, VizieR usage rules ("free of usage in a scientific context"; "The commercial usage of the data is subject
  to rules depending of the origin"): https://cds.unistra.fr/vizier-org/licences_vizier.html
- HEASARC, SAO Star Catalog overview (ADC provenance, USNO J2000): https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/sao.html

HYG:

- astronexus, HYG Database (CC BY-SA 4.0; Hipparcos, Yale BSC5, Gliese 3; current v4.2): https://www.astronexus.com/hyg
- astronexus, HYG details (build method: "started with the Hipparcos data"; `bf` from Yale BSC5; names from the
  IAU): https://astronexus.com/projects/hyg-details
- Codeberg, astronexus/hyg README (CC BY-SA 4.0; "every identifiable star in the HIPPARCOS, Yale Bright Star, and
  Gliese … catalogs"): https://codeberg.org/astronexus/hyg
- GitHub, astronexus/HYG-Database (archived 2025-02-14, read-only): https://github.com/astronexus/HYG-Database

Creative Commons:

- CC BY-SA 4.0 legal code (§1, §2(a)(5), §3(a), §3(b), §4): https://creativecommons.org/licenses/by-sa/4.0/legalcode
- CC BY-NC 3.0 IGO legal code (§1 "Work" incl. databases by selection and arrangement; §4(b) NonCommercial; §4(c)
  attribution): https://creativecommons.org/licenses/by-nc/3.0/igo/legalcode
- CC FAQ ("You should not apply a license to material that you do not own"; "The CC license only applies to the
  rights you have in the work"; NonCommercial depends on "the specifics of the situation and the intentions of the
  user"; a commercial remix "cannot incorporate material released under one of the NonCommercial licenses"):
  https://creativecommons.org/faq/
- CC, ShareAlike compatible licences (BY-SA 4.0: Free Art License 1.3, GPLv3 one-way): https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/

Third-party practice and Tycho-2:

- Debian `tycho2` copyright (Høg's 2015 "OK" to a BSD-2-Clause proposal; "the distribution itself has no license
  note"): https://tracker.debian.org/media/packages/t/tycho2/copyright-2-4
- Debian `kstars-data-extra-tycho2` copyright (non-free; ADC: "All ADC data are public domain unless otherwise
  stated in the ReadMe file"; "The data are for scientific use only and have no commercial value"):
  https://metadata.ftp-master.debian.org/changelogs/non-free/k/kstars-data-extra-tycho2/stable_copyright
- Debian `yale` copyright (Hoffleit & Warren 1991; "the data files must NOT be altered in any way (without
  permission of the original authors)"): https://metadata.ftp-master.debian.org/changelogs/non-free/y/yale/stable_copyright
- Debian `stellarium` copyright (main; Hipparcos "From ESA (European Space Agency) and the Hipparcos mission", no
  separate data licence): https://metadata.ftp-master.debian.org/changelogs/main/s/stellarium/proposed-updates_copyright
- free-astro.org, KStars/Siril catalogue licence notes (Hipparcos "seems to be public domain"; ADC Tycho-2 policy
  quoted): https://free-astro.org/download/kstars-siril-catalogues/LICENSES.txt
- Stellarium Labs, Stellarium Mobile Plus ("Gaia DR2 catalog", paid): https://www.stellarium-labs.com/stellarium-mobile-plus

Repo record (read 2026-10-16): `context/archive/2026-10-11-finder-chart/{esa-licence-request.md,research.md,plan.md}`,
`context/foundation/prd.md` (Non-Goals "Payments"; Open Question 21), `context/foundation/roadmap.md` (M-4 External
item 2; Parked "Ready to charge"), `context/handoff.md`, `src/lib/catalogue/{LICENSE-DATA.md,bright-stars.meta.json,
finder-stars.meta.json,stars.ts,star-names.ts}`, `scripts/build-stars.mjs`, `src/components/tonight/Attribution.astro`,
`src/i18n/messages/en.ts` (`starData`, `hipparcosCredit`).

---

## Podsumowanie dla właściciela (PL)

**Werdykt do (1):** Masz rację w połowie. Zapytaliśmy ESA o rzeczy, których ESA nie kontroluje: o kompilację HYG
jako produkt, o nasze pliki pochodne z HYG i o Tycho-2 (to katalog Høga i in., nie ESA; nasz research błędnie
przypisał go ESA). Ale dane Hipparcosa _wewnątrz_ HYG należą do ESA i ESA tego nie zrzekło się ani nie zaprzeczyło;
odmówiło tylko orzekania o cudzym pakiecie. Ryzyko nie zniknęło, jest nieprzypisane. Autor HYG nie może nam dać
praw ESA, więc „zapytaj dostawcę HYG” to ślepa uliczka.

**Rekomendacja:** przyjąć ofertę ESA i poprosić o ocenę bezpośredniego użycia Hipparcos Version 1 (VizieR I/239,
`hip_main.dat`); odpowiedzieć **teraz**, bo ESA wprost prosi o sygnał, a oceny idą pakietem do końca listopada 2026.
Do czasu zgody: aplikacja bezpłatna (HYG zostaje na M-4, bez wpływu na termin 2026-11-04), żadnych płatności.
Równolegle, własną zmianą po M-4, przygotować build gwiazd niezależny od źródła (czytniki HYG / Hipparcos V1 / SAO,
oznaczenia Bayera i Flamsteeda z Wikidata CC0 + nazwy IAU, gwiazdozbiory liczone przez `astronomy-engine`), żeby
przełączenie było ponownym uruchomieniem skryptu. SAO zostaje planem awaryjnym, jeśli ESA odmówi albo wyceni za
wysoko. Gaia DR3 tylko później i tylko gdyby kiedyś były potrzebne głębsze mapy. Przed pierwszą płatnością jedna
konsultacja z prawnikiem co do treści zgody ESA (publiczne repo, plik 925 gwiazd w przeglądarce, opłata, okres).

Gotowy szkic odpowiedzi do ESA po angielsku jest w §5 (wysyłasz Ty; uzupełnij `[N]` i podpis, odpowiedz w tym samym
wątku).

**QUESTION FOR OWNER:** (a) Czy wysyłasz odpowiedź do ESA ze szkicu w §5 (zalecane: tak, teraz)? (b) Czy zmianę
`star-source-switch` (build niezależny od źródła, przygotowany zanim ESA odpowie) planujemy po M-4, czy w wolnym
slocie M-4? (c) Czy chcesz jednorazowej opinii prawnika przed pierwszą płatnością, czy traktujemy warunek NC ESA jako
wiążący bez tego kroku i idziemy drogą zgody ESA (zalecane)?
