# Designation check: star-designations table against the HYG-era finder file

One-off comparison for the `star-source-switch` change (Phase 2), made before the star files switch to Hipparcos. It records how the new designation table (`scripts/data/star-designations.json`, built from Wikidata under CC0, Hipparcos positions for the constellation filter, and `scripts/data/star-designation-overrides.json`) compares with what the committed, HYG-era `src/lib/catalogue/finder-stars.json` ships today, so every designation that is lost, changed or added is a known and accepted decision, and no designation was guessed.

## Method

- The throwaway script that produced this file lives outside the repository (the session scratchpad). It reads the HYG-era `finder-stars.json` from the working tree (still HYG-era until Phase 4), decodes it (`pos` = `raCenti * 18001 + decCenti + 9000`, magnitude-tenth runs, designations keyed by index) and matches each star to a Hipparcos star by position (within 0.05 degree, magnitude within 0.25) as the nearest unused pair. This is the only place HYG-era data is read: the regeneration script `scripts/build-star-designations.mjs` never reads HYG, and no override takes a value from it: the fourteen `omit` overrides name this comparison as the reason for the omission (the HYG-era file disagreed with Wikidata on a component digit), and every one of them removes a value rather than adding one.
- 25,713 of the 25,723 Hipparcos stars at V <= 7.5 match a HYG-era star (the ten stars without an astrometric solution do not, see below). Everything is keyed by HIP in the new table, so unlike a position join the Trapezium, close doubles and component stars cannot be mixed up.
- Independent check: the IAU Working Group on Star Names list (`https://exopla.net/star-names/modern-iau-star-names/`, public-domain names, fetched 2026-10-16) carries a Bayer ID for each named star. It is a published source that neither Wikidata nor HYG feeds, so it is used both as the cross-check below and as the citable source of an override.
- Decision rules: a value is never guessed. A disagreement is settled by an override that cites a published source (the IAU WGSN list, or Wikidata's own statement of the star's catalogue record), or the value is omitted (`omit`). A gap (the HYG-era file has a value, the table has none) is an accepted omission.

## Counts

|                                       | HYG-era file | New table                                                             |
| ------------------------------------- | ------------ | --------------------------------------------------------------------- |
| Designated stars (Bayer or Flamsteed) | 3307         | 3222                                                                  |
| Bayer values                          | 1535         | 1471                                                                  |
| Flamsteed values                      | 2724         | 2639                                                                  |
| Both Bayer and Flamsteed              | 952          | 888                                                                   |
| Proper names (all stars at V <= 7.5)  | 377          | 498 IAU names within the Hipparcos rows (566 HIPs in the names table) |

Of the 3290 matched stars that carried a Bayer or Flamsteed value in the HYG-era file, 101 carry neither in the new table (3.1 %). 17 HYG-era designated stars have no Hipparcos counterpart at all (HYG's non-Hipparcos Gliese and Yale companion rows: Alp 66 Gem (Castor B); Gam 29 Vir; Zet 79 UMa; Xi 53 UMa (Alula Australis); Xi 53 UMa (Alula Australis B); Xi Sco (Graffias); Xi Sco; Gam CrA; 36 Oph (Guniibuu B); Alp 42 Com; Tau 69 Oph; Mu 21 Dra (Alrakis); Eta 2 CrB; Mu-2 78 Cyg; 53 Aqr; Eta Car; Sig 17 CrB); they disappear with the source switch, as the research recorded.

Constellation: the computed constellation (`Constellation()` on the Hipparcos position) differs from the HYG-era `con` for 0 of the 3290 matched designated stars.

Label fallback: 15 Bayer and 10 Flamsteed values come from the items' English labels (only where the item has no catalogue-code value of that kind), each also constrained by the computed constellation. Wikidata values dropped by the shape rules: 447 Latin-letter Bayer values, 4 with a component letter.

## Bayer disagreements (21)

The two files give the same star different Bayer values. Almost all differ only in the component digit (bare letter against a superscript, or the digits swapped); none changes the Greek letter or the constellation. The comparison uses the table as Wikidata gives it, before the overrides; the last column is the decision and its outcome.

| HIP    | Con | HYG-era   | Wikidata (table before overrides) | Final table | Decision                                                                     |
| ------ | --- | --------- | --------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| 8832   | Ari | Gam-2 Ari | Gam Ari                           | none        | Omitted (override): no citable tie-break for the component digit.            |
| 9347   | Cet | Ups Cet   | Ups-1 Cet                         | none        | Omitted (override): no citable tie-break for the component digit.            |
| 9640   | And | Gam-1 And | Gam And                           | Gam And     | Table kept: IAU WGSN Almach "γ And" agrees with the table (bare letter).     |
| 13847  | Eri | The-1 Eri | The Eri                           | The-1 Eri   | Override to The-1: IAU WGSN Acamar "θ1 Eri" (specific form).                 |
| 39953  | Vel | Gam-2 Vel | Gam Vel                           | none        | Omitted (override): no citable tie-break for the component digit.            |
| 40023  | Cnc | Psi Cnc   | Psi-2 Cnc                         | none        | Omitted (override): no citable tie-break for the component digit.            |
| 40167  | Cnc | Zet-2 Cnc | Zet Cnc                           | Zet Cnc     | Table kept: IAU WGSN Tegmine "ζ Cnc" agrees with the table (bare letter).    |
| 50583  | Leo | Gam-1 Leo | Gam Leo                           | Gam-1 Leo   | Override to Gam-1: IAU WGSN Algieba "γ1 Leo" (specific form).                |
| 60718  | Cru | Alp-1 Cru | Alp Cru                           | Alp Cru     | Table kept: IAU WGSN Acrux "α Cru" agrees with the table (bare letter).      |
| 69481  | Boo | Kap-1 Boo | Kap Boo                           | none        | Omitted (override): no citable tie-break for the component digit.            |
| 71762  | Boo | Pi-1 Boo  | Pi Boo                            | none        | Omitted (override): no citable tie-break for the component digit.            |
| 75411  | Boo | Mu-1 Boo  | Mu Boo                            | Mu Boo      | Table kept: IAU WGSN Alkalurops "μ Boo" agrees with the table (bare letter). |
| 81710  | TrA | Eta-1 TrA | Eta TrA                           | none        | Omitted (override): no citable tie-break for the component digit.            |
| 84345  | Her | Alp-1 Her | Alp Her                           | Alp-1 Her   | Override to Alp-1: IAU WGSN Rasalgethi "α1 Her" (specific form).             |
| 86974  | Her | Mu Her    | Mu-1 Her                          | none        | Omitted (override): no citable tie-break for the component digit.            |
| 90968  | CrA | Kap-1 CrA | Kap-2 CrA                         | none        | Omitted (override): no citable tie-break for the component digit.            |
| 90969  | CrA | Kap-2 CrA | Kap-1 CrA                         | none        | Omitted (override): no citable tie-break for the component digit.            |
| 91926  | Lyr | Eps-2 Lyr | Eps Lyr                           | none        | Omitted (override): no citable tie-break for the component digit.            |
| 101923 | Cap | Tau Cap   | Tau-2 Cap                         | none        | Omitted (override): no citable tie-break for the component digit.            |
| 107310 | Cyg | Mu-1 Cyg  | Mu Cyg                            | none        | Omitted (override): no citable tie-break for the component digit.            |
| 110960 | Aqr | Zet-1 Aqr | Zet Aqr                           | none        | Omitted (override): no citable tie-break for the component digit.            |

Rule applied: a disagreement that the IAU WGSN list settles is settled by it (an override to its specific form, or no change where it agrees with the table). One it does not settle is omitted: with only two compilations (Wikidata and the HYG-era file) and no published tie-break, a wrong component digit would be a wrong designation, and an omitted Bayer value only costs a label (Flamsteed and the proper name still show).

## Flamsteed disagreements (1) and the conflicts the research quoted

| HIP   | Con | HYG-era | Wikidata | Final table | Decision                                                                                                                                                                                                                                            |
| ----- | --- | ------- | -------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 48552 | Sex | 8 Sex   | 9 Sex    | 9 Sex       | Override pins 9 (Wikidata item Q66481576, English label "9 Sextantis"). The HYG-era file gives "8 Sex" to two different stars (HIP 48437, the other, and this one), so at least one of its values is wrong; Wikidata gives each number to one star. |

The research (`research.md` section 5) listed five Flamsteed conflicts found by joining on position within 0.06 degree, three of them quoted ("41 Ori" against "43 Ori", "16 Dra" against "17 Dra", "8 Sex" against "9 Sex"). With the table keyed by HIP only one of them is a real disagreement, the last. The other two quoted conflicts were artefacts of the position join, which mixed neighbours: "41 Ori" sits on the Trapezium stars HIP 26220, 26221 and 26224 (the table carries no Flamsteed number for any of them; Wikidata's "43 Ori" belongs to HIP 26235, a different star), and "16 Dra" on HIP 81290 (a gap below; Wikidata gives "17 Dra" to HIP 81292 and nothing to 81290). Against the HIP-keyed table the one Flamsteed disagreement left is HIP 48552.

## Flamsteed gaps (96): the HYG-era file has a number, the table has none

Accepted omissions, none an override: there is no published, citable source for the number in this change's inputs, and a guessed number is worse than none. Reasons are from the saved Wikidata responses.

By reason: 95 no Wikidata value; 1 several values.

| HIP    | Star (HYG-era) | Reason                 | Decision          |
| ------ | -------------- | ---------------------- | ----------------- |
| 2548   | 51 Psc         | no Wikidata value      | accepted omission |
| 5131   | 74 Psc         | no Wikidata value      | accepted omission |
| 5132   | 74 Psc         | no Wikidata value      | accepted omission |
| 5144   | 77 Psc         | no Wikidata value      | accepted omission |
| 5737   | 86 Psc         | no Wikidata value      | accepted omission |
| 5743   | 86 Psc         | no Wikidata value      | accepted omission |
| 5799   | 37 Cet         | no Wikidata value      | accepted omission |
| 9631   | 61 Cet         | no Wikidata value      | accepted omission |
| 10176  | 59 And         | no Wikidata value      | accepted omission |
| 10180  | 59 And         | no Wikidata value      | accepted omission |
| 10305  | 66 Cet         | no Wikidata value      | accepted omission |
| 12184  | 30 Ari         | no Wikidata value      | accepted omission |
| 12189  | 30 Ari         | no Wikidata value      | accepted omission |
| 13531  | 18 Per         | no Wikidata value      | accepted omission |
| 13879  | 22 Per         | no Wikidata value      | accepted omission |
| 14668  | 27 Per         | no Wikidata value      | accepted omission |
| 14817  | 28 Per         | no Wikidata value      | accepted omission |
| 16335  | 35 Per         | no Wikidata value      | accepted omission |
| 16826  | 37 Per         | no Wikidata value      | accepted omission |
| 17358  | 39 Per         | no Wikidata value      | accepted omission |
| 17529  | 41 Per         | no Wikidata value      | accepted omission |
| 19335  | 50 Per         | no Wikidata value      | accepted omission |
| 19812  | 51 Per         | no Wikidata value      | accepted omission |
| 19849  | 40 Eri         | no Wikidata value      | accepted omission |
| 24727  | 16 Aur         | no Wikidata value      | accepted omission |
| 25695  | 118 Tau        | no Wikidata value      | accepted omission |
| 26220  | 41 Ori         | no Wikidata value      | accepted omission |
| 26221  | 41 Ori         | no Wikidata value      | accepted omission |
| 26224  | 41 Ori         | no Wikidata value      | accepted omission |
| 30419  | 8 Mon          | no Wikidata value      | accepted omission |
| 31158  | 20 Gem         | no Wikidata value      | accepted omission |
| 31978  | 15 Mon         | no Wikidata value      | accepted omission |
| 35731  | 20 Lyn         | no Wikidata value      | accepted omission |
| 35783  | 19 Lyn         | no Wikidata value      | accepted omission |
| 35785  | 19 Lyn         | no Wikidata value      | accepted omission |
| 37842  | 2 Pup          | no Wikidata value      | accepted omission |
| 37843  | 2 Pup          | no Wikidata value      | accepted omission |
| 41211  | 1 Hya          | no Wikidata value      | accepted omission |
| 41909  | 33 Cnc         | no Wikidata value      | accepted omission |
| 42556  | 41 Cnc         | no Wikidata value      | accepted omission |
| 43100  | 48 Cnc         | no Wikidata value      | accepted omission |
| 43103  | 48 Cnc         | no Wikidata value      | accepted omission |
| 44154  | 64 Cnc         | no Wikidata value      | accepted omission |
| 45170  | 81 Cnc         | no Wikidata value      | accepted omission |
| 47096  | 7 Leo          | no Wikidata value      | accepted omission |
| 50414  | 22 Sex         | no Wikidata value      | accepted omission |
| 55846  | 83 Leo         | no Wikidata value      | accepted omission |
| 58112  | 65 UMa         | no Wikidata value      | accepted omission |
| 58117  | 65 UMa         | no Wikidata value      | accepted omission |
| 61415  | 24 Com         | no Wikidata value      | accepted omission |
| 61418  | 24 Com         | no Wikidata value      | accepted omission |
| 63121  | 12 CVn         | no Wikidata value      | accepted omission |
| 63125  | 12 CVn         | no Wikidata value      | accepted omission |
| 66465  | 81 Vir         | no Wikidata value      | accepted omission |
| 67275  | 4 Boo          | no Wikidata value      | accepted omission |
| 69483  | 17 Boo         | no Wikidata value      | accepted omission |
| 70497  | 23 Boo         | no Wikidata value      | accepted omission |
| 75415  | 51 Boo         | no Wikidata value      | accepted omission |
| 78820  | 8 Sco          | no Wikidata value      | accepted omission |
| 78821  | 8 Sco          | no Wikidata value      | accepted omission |
| 79043  | 7 Her          | no Wikidata value      | accepted omission |
| 79045  | 7 Her          | no Wikidata value      | accepted omission |
| 79607  | 17 CrB         | no Wikidata value      | accepted omission |
| 80331  | 14 Dra         | no Wikidata value      | accepted omission |
| 81290  | 16 Dra         | no Wikidata value      | accepted omission |
| 84625  | 39 Oph         | no Wikidata value      | accepted omission |
| 84626  | 39 Oph         | no Wikidata value      | accepted omission |
| 85998  | 53 Oph         | no Wikidata value      | accepted omission |
| 86614  | 31 Dra         | no Wikidata value      | accepted omission |
| 86620  | 31 Dra         | no Wikidata value      | accepted omission |
| 86831  | 61 Oph         | no Wikidata value      | accepted omission |
| 86974  | 86 Her         | no Wikidata value      | accepted omission |
| 88817  | 100 Her        | no Wikidata value      | accepted omission |
| 88818  | 100 Her        | no Wikidata value      | accepted omission |
| 89153  | 1 Sgr          | several values (1, 11) | accepted omission |
| 92117  | 5 Aql          | no Wikidata value      | accepted omission |
| 92946  | 63 Ser         | no Wikidata value      | accepted omission |
| 92951  | 63 Ser         | no Wikidata value      | accepted omission |
| 95947  | 6 Cyg          | no Wikidata value      | accepted omission |
| 95951  | 6 Cyg          | no Wikidata value      | accepted omission |
| 96895  | 16 Cyg         | no Wikidata value      | accepted omission |
| 97966  | 57 Aql         | no Wikidata value      | accepted omission |
| 97967  | 57 Aql         | no Wikidata value      | accepted omission |
| 98036  | 60 Aql         | no Wikidata value      | accepted omission |
| 100345 | 9 Cap          | no Wikidata value      | accepted omission |
| 101123 | 12 Cap         | no Wikidata value      | accepted omission |
| 101589 | 4 Del          | no Wikidata value      | accepted omission |
| 102531 | 12 Del         | no Wikidata value      | accepted omission |
| 102532 | 12 Del         | no Wikidata value      | accepted omission |
| 103571 | 1 Equ          | no Wikidata value      | accepted omission |
| 104214 | 61 Cyg         | no Wikidata value      | accepted omission |
| 104217 | 61 Cyg         | no Wikidata value      | accepted omission |
| 106032 | 8 Cep          | no Wikidata value      | accepted omission |
| 111544 | 8 Lac          | no Wikidata value      | accepted omission |
| 113281 | 16 Lac         | no Wikidata value      | accepted omission |
| 115126 | 94 Aqr         | no Wikidata value      | accepted omission |

## Bayer gaps (60): the HYG-era file has a Bayer value, the table has none

Accepted omissions (not required to list individually by the plan; listed for completeness).

| HIP    | Star (HYG-era) | Reason                                                          | Decision          |
| ------ | -------------- | --------------------------------------------------------------- | ----------------- |
| 4084   | Lam-1 Tuc      | no Wikidata value                                               | accepted omission |
| 5131   | Psi-1 Psc      | no Wikidata value                                               | accepted omission |
| 5132   | Psi-1 Psc      | no Wikidata value                                               | accepted omission |
| 5737   | Zet Psc        | no Wikidata value                                               | accepted omission |
| 5743   | Zet Psc        | no Wikidata value                                               | accepted omission |
| 5896   | Kap Tuc        | no Wikidata value                                               | accepted omission |
| 13702  | Rho-3 Ari      | several values (Rho, Rho-3)                                     | accepted omission |
| 16245  | Kap Ret        | no Wikidata value                                               | accepted omission |
| 19780  | Alp Ret        | no Wikidata value                                               | accepted omission |
| 19849  | Omi-2 Eri      | no Wikidata value                                               | accepted omission |
| 19921  | Eps Ret        | no Wikidata value                                               | accepted omission |
| 22531  | Iot Pic        | no Wikidata value                                               | accepted omission |
| 22534  | Iot Pic        | no Wikidata value                                               | accepted omission |
| 25303  | The Pic        | no Wikidata value                                               | accepted omission |
| 26220  | The-1 Ori      | Wikidata value not usable (θ¹ Ori A: component or Latin letter) | accepted omission |
| 26221  | The-1 Ori      | Wikidata value not usable (θ¹ Ori C: component or Latin letter) | accepted omission |
| 26224  | The-1 Ori      | Wikidata value not usable (θ¹ Ori D: component or Latin letter) | accepted omission |
| 29353  | Eta-2 Dor      | several values (Eta, Eta-2)                                     | accepted omission |
| 30419  | Eps Mon        | no Wikidata value                                               | accepted omission |
| 34473  | Gam-1 Vol      | no Wikidata value                                               | accepted omission |
| 34481  | Gam-2 Vol      | no Wikidata value                                               | accepted omission |
| 37504  | Zet Vol        | no Wikidata value                                               | accepted omission |
| 40817  | Kap-1 Vol      | no Wikidata value                                               | accepted omission |
| 40834  | Kap-2 Vol      | no Wikidata value                                               | accepted omission |
| 41909  | Eta Cnc        | no Wikidata value                                               | accepted omission |
| 42556  | Eps Cnc        | no Wikidata value                                               | accepted omission |
| 43100  | Iot Cnc        | no Wikidata value                                               | accepted omission |
| 43103  | Iot Cnc        | no Wikidata value                                               | accepted omission |
| 43587  | Rho-1 Cnc      | no Wikidata value                                               | accepted omission |
| 44154  | Sig-3 Cnc      | no Wikidata value                                               | accepted omission |
| 45170  | Pi-1 Cnc       | no Wikidata value                                               | accepted omission |
| 67275  | Tau Boo        | no Wikidata value                                               | accepted omission |
| 70497  | The Boo        | no Wikidata value                                               | accepted omission |
| 74824  | Bet Cir        | no Wikidata value                                               | accepted omission |
| 76669  | Zet-1 CrB      | several values (Zet, Zet-2)                                     | accepted omission |
| 78384  | Eta Lup        | no Wikidata value                                               | accepted omission |
| 78820  | Bet-1 Sco      | no Wikidata value                                               | accepted omission |
| 78821  | Bet-2 Sco      | no Wikidata value                                               | accepted omission |
| 79043  | Kap Her        | no Wikidata value                                               | accepted omission |
| 79045  | Kap Her        | no Wikidata value                                               | accepted omission |
| 79607  | Sig CrB        | no Wikidata value                                               | accepted omission |
| 80331  | Eta Dra        | no Wikidata value                                               | accepted omission |
| 84625  | Omi Oph        | no Wikidata value                                               | accepted omission |
| 84626  | Omi Oph        | no Wikidata value                                               | accepted omission |
| 85829  | Nu-2 Dra       | no Wikidata value                                               | accepted omission |
| 86614  | Psi-1 Dra      | no Wikidata value                                               | accepted omission |
| 86620  | Psi-1 Dra      | no Wikidata value                                               | accepted omission |
| 91919  | Eps-1 Lyr      | no Wikidata value                                               | accepted omission |
| 92226  | Mu CrA         | no Wikidata value                                               | accepted omission |
| 92946  | The-1 Ser      | no Wikidata value                                               | accepted omission |
| 95241  | Bet-1 Sgr      | no Wikidata value                                               | accepted omission |
| 95947  | Bet-1 Cyg      | no Wikidata value                                               | accepted omission |
| 98036  | Bet Aql        | no Wikidata value                                               | accepted omission |
| 99572  | Xi-2 Cap       | several values (Xi, Xi-2)                                       | accepted omission |
| 100345 | Bet Cap        | no Wikidata value                                               | accepted omission |
| 101123 | Omi Cap        | no Wikidata value                                               | accepted omission |
| 101589 | Zet Del        | no Wikidata value                                               | accepted omission |
| 102125 | Mu-2 Oct       | no Wikidata value                                               | accepted omission |
| 103571 | Eps Equ        | no Wikidata value                                               | accepted omission |
| 106032 | Bet Cep        | no Wikidata value                                               | accepted omission |

## Omitted multi-value stars (5)

Stars for which Wikidata gives several different values in the computed constellation, so the table omits the value rather than guess (the policy of the plan).

| HIP   | Kind      | Con | Wikidata values | HYG-era   | Decision                                                                          |
| ----- | --------- | --- | --------------- | --------- | --------------------------------------------------------------------------------- |
| 13702 | bayer     | Ari | ρ Ari / ρ³ Ari  | Rho-3 Ari | Accepted omission: no published source in this change tells the components apart. |
| 29353 | bayer     | Dor | η² Dor / η Dor  | Eta-2 Dor | Accepted omission: no published source in this change tells the components apart. |
| 76669 | bayer     | CrB | ζ CrB / ζ² CrB  | Zet-1 CrB | Accepted omission: no published source in this change tells the components apart. |
| 89153 | flamsteed | Sgr | 1 Sgr / 11 Sgr  | 1 Sgr     | Accepted omission: no published source in this change tells the components apart. |
| 99572 | bayer     | Cap | ξ² Cap / ξ Cap  | Xi-2 Cap  | Accepted omission: no published source in this change tells the components apart. |

Multi-value stars that the constellation filter resolves (17): Wikidata gives several values, only one is in the star's own constellation (for example HIP 677, Alpheratz, "α And" and "δ Peg": the star lies in Andromeda, so "α And" is kept). 117 further omissions (113 Flamsteed, 4 Bayer) have a single Wikidata value in a former or neighbouring constellation ("54 And" for a star now in Perseus, "1 Crt" for a star now in Hydra): the plan's policy keeps only values in the computed constellation. They are listed in the `omitted` array of the table's meta. None of them is a gap: the HYG-era file carries no number or letter for any matched one of them (it leaves a value out when the constellation changed).

## Additions (23 Bayer, 23 Flamsteed)

Values the table has and the HYG-era file lacks. Each is a single Wikidata value in the star's own constellation; accepted. They need no override.

Bayer: HIP 1007 Omi Oct; HIP 9061 Ups-2 Cet; HIP 10280 Iot Tri; HIP 10729 Chi Per; HIP 20535 Ups-3 Eri; HIP 21998 Lam Cae; HIP 22488 Nu Cae; HIP 38901 Chi Pup; HIP 40007 Psi-1 Cnc; HIP 75848 Zet-2 Lib; HIP 76695 Pi-2 UMi; HIP 82868 Rho-1 Ara; HIP 83057 Rho-2 Ara; HIP 87314 Nu-1 Ara; HIP 87379 Nu-2 Ara; HIP 99675 Omi-1 Cyg; HIP 99848 Omi-2 Cyg; HIP 100325 Bet-2 Cap; HIP 101751 Tau-1 Cap; HIP 103569 Eps Equ; HIP 103813 Lam Equ; HIP 104031 Zet Equ; HIP 113190 Tau-2 Gru.

Flamsteed: HIP 7588 70 Eri; HIP 32968 87 Gem; HIP 37379 140 Pup; HIP 38146 188 Pup; HIP 38423 212 Pup; HIP 41616 33 Vel; HIP 42570 53 Vel; HIP 42794 9 Cha; HIP 45386 113 Vel; HIP 50847 191 Car; HIP 58799 89 Cen; HIP 59184 93 Cen; HIP 72773 26 Cir; HIP 73095 36 Lup; HIP 84605 38 Oph; HIP 85365 47 Oph; HIP 88760 30 Sgr; HIP 89980 70 Sgr; HIP 91726 2 Sct; HIP 92204 205 Dra; HIP 103569 1 Equ; HIP 109369 36 Aqr; HIP 112355 54 Oct.

## Route stars of the published-hop references and the example chart

Every star the finder-chart reference hops name (`src/lib/engine/fixtures/finder-reference.ts`: β, μ and ν And; η, ζ and π Her; β and γ Lyr; α UMa; 24 UMa; γ Sge) and the four designated stars of the example chart (`EXAMPLE_STAR_DESIGNATIONS`, the Corona Borealis field), found at their HYG-era finder index, resolved to a HIP by position, and compared with the final table and the computed constellation. "Expected" is what the reference fixture or the example chart carries (`bayer` in the app's `Abc` / `Abc-n` form, `flamsteed`, `con`).

| Star                               | HIP   | V    | IAU name | Expected bayer | Table bayer | Expected flamsteed | Table flamsteed | Expected con | Computed con | Identical |
| ---------------------------------- | ----- | ---- | -------- | -------------- | ----------- | ------------------ | --------------- | ------------ | ------------ | --------- |
| β And (Mirach)                     | 5447  | 2.07 | Mirach   | Bet            | Bet         | (not checked)      | 43              | And          | And          | yes       |
| μ And                              | 4436  | 3.86 |          | Mu             | Mu          | (not checked)      | 37              | And          | And          | yes       |
| ν And                              | 3881  | 4.53 |          | Nu             | Nu          | (not checked)      | 35              | And          | And          | yes       |
| η Her                              | 81833 | 3.48 |          | Eta            | Eta         | (not checked)      | 44              | Her          | Her          | yes       |
| ζ Her                              | 81693 | 2.81 | Tianji   | Zet            | Zet         | (not checked)      | 40              | Her          | Her          | yes       |
| π Her                              | 84380 | 3.16 | Nüchuang | Pi             | Pi          | (not checked)      | 67              | Her          | Her          | yes       |
| β Lyr                              | 92420 | 3.52 | Sheliak  | Bet            | Bet         | (not checked)      | 10              | Lyr          | Lyr          | yes       |
| γ Lyr                              | 93194 | 3.25 | Sulafat  | Gam            | Gam         | (not checked)      | 14              | Lyr          | Lyr          | yes       |
| α UMa (Dubhe)                      | 54061 | 1.81 | Dubhe    | Alp            | Alp         | (not checked)      | 50              | UMa          | UMa          | yes       |
| 24 UMa                             | 46977 | 4.54 |          | (not checked)  | none        | 24                 | 24              | UMa          | UMa          | yes       |
| γ Sge                              | 98337 | 3.51 | Telum    | Gam            | Gam         | (not checked)      | 12              | Sge          | Sge          | yes       |
| α CrB (example chart, index 71)    | 76267 | 2.22 | Alphecca | Alp            | Alp         | 5                  | 5               | CrB          | CrB          | yes       |
| ε CrB (example chart, index 594)   | 78159 | 4.14 |          | Eps            | Eps         | 13                 | 13              | CrB          | CrB          | yes       |
| ν¹ CrB (example chart, index 2103) | 80197 | 5.2  |          | Nu-1           | Nu-1        | 20                 | 20              | CrB          | CrB          | yes       |
| υ CrB (example chart, index 4106)  | 79757 | 5.8  |          | Ups            | Ups         | 18                 | 18              | CrB          | CrB          | yes       |

All fifteen resolve to a HIP with identical `bayer`, `flamsteed` and `con`; no override was needed for any of them. Magnitudes: ν And (V 4.53) and 24 UMa (V 4.54) round to tenths 45, the values the reference bands rely on.

## Ten stars checked against a published source

Compared (not copied in bulk) with the Bayer ID the IAU Working Group on Star Names publishes for the named stars, `https://exopla.net/star-names/modern-iau-star-names/` (fetched 2026-10-16). Five Bayer values, one of them a multi-value star, and five Flamsteed values.

| Kind      | HIP   | Star                                     | IAU WGSN Bayer ID | Table value | Computed con | Wikidata values for the HIP | Match |
| --------- | ----- | ---------------------------------------- | ----------------- | ----------- | ------------ | --------------------------- | ----- |
| bayer     | 5447  | Mirach                                   | β And             | Bet And     | And          | β And                       | yes   |
| bayer     | 91262 | Vega                                     | α Lyr             | Alp Lyr     | Lyr          | α Lyr                       | yes   |
| bayer     | 27989 | Betelgeuse                               | α Ori             | Alp Ori     | Ori          | α Ori                       | yes   |
| bayer     | 677   | Alpheratz (multi-value: α And and δ Peg) | α And             | Alp And     | And          | α And / δ Peg               | yes   |
| bayer     | 11767 | Polaris                                  | α UMi             | Alp UMi     | UMi          | α UMi                       | yes   |
| flamsteed | 43587 | Copernicus                               | 55 Cnc            | 55 Cnc      | Cnc          | 55 Cnc                      | yes   |
| flamsteed | 5824  | Buranun                                  | 88 Psc            | 88 Psc      | Psc          | 88 Psc                      | yes   |
| flamsteed | 72220 | Maenalus                                 | 109 Virginis      | 109 Vir     | Vir          | 109 Vir                     | yes   |
| flamsteed | 71995 | Alrumh                                   | 34 Bootis         | 34 Boo      | Boo          | 34 Boo                      | yes   |
| flamsteed | 13209 | Bharani                                  | 41 Ari            | 41 Ari      | Ari          | 41 Ari                      | yes   |

Wider cross-check, all stars with a WGSN name inside the Hipparcos rows at V <= 7.5 (499 named stars): 433 agree with the table, 2 differ only in the component digit (the WGSN gives the bare letter for Toliman α Cen, Rigil Kentaurus α Cen; the table's value is the more specific one), 0 disagree, 18 named stars have no value of that kind in the table (accepted gaps: Tepiamenit τ Bootis, Yuyu ι Cnc, Lumbung 39 Cru, Tarandus 2 UMi, Rhombus α Ret, Athebyne η Dra, Dziban ψ1 Dra, Meleph ε Cnc, Revati ζ Psc, Marsic κ Her, Arkab Prior β1 Sgr, Keid ο2 Eri, Acrab β1 Sco, Alfirk β Cep, Alshain β Aql, Alya θ1 Ser, Dabih β1 Cap, Albireo β Cyg), and 46 WGSN rows carry no comparable Bayer ID (empty, a Hipparcos or variable-star name, or a component letter).

## The ten stars positioned from RAhms/DEdms

These ten stars at V <= 7.5 have no astrometric solution in `hip_main.dat`, so they match no HYG-era star by magnitude and position the way the others do (the HYG-era file carries Gliese or Yale components near them, not the Hipparcos entry); their designations come from Wikidata by HIP like all others.

| HIP    | V    | Con | Table [bayer, flamsteed] | IAU name        | HYG-era designated stars within 0.05 degree                          |
| ------ | ---- | --- | ------------------------ | --------------- | -------------------------------------------------------------------- |
| 31067  | 6.18 | Gem | [null,null]              |                 | none                                                                 |
| 31500  | 7.37 | CMa | [null,null]              |                 | none                                                                 |
| 34716  | 7.35 | CMa | [null,null]              |                 | none                                                                 |
| 50572  | 7.19 | Vel | [null,null]              |                 | none                                                                 |
| 52800  | 6.94 | Hya | [null,null]              |                 | none                                                                 |
| 55203  | 3.79 | UMa | ["Xi",53]                | Alula Australis | Xi 53 UMa (Alula Australis) @4.3; Xi 53 UMa (Alula Australis B) @4.8 |
| 59273  | 6.65 | Crv | [null,null]              |                 | none                                                                 |
| 78727  | 4.16 | Sco | ["Xi",null]              |                 | Xi Sco (Graffias) @4.8; Xi Sco @5                                    |
| 80579  | 6.69 | Nor | [null,null]              |                 | Eps Nor @4.5                                                         |
| 115125 | 5.19 | Aqr | [null,null]              |                 | 94 Aqr @5.2                                                          |

## Names

17 matched stars carry a proper name in the HYG-era file that is not an IAU WGSN name and so disappears: 82 G. Eri, Acrab B, Alya B, Alkalurops B, 268 G. Cet, Dziban B, Lalande 21185, p Eridani, Groombridge 1830, 96 G. Psc, Marsic B, Mesarthim, Albireo B, Ras Elased Australis, Cor Caroli B, Lacaille 8760, Lacaille 9352. 144 stars gain an IAU name the HYG-era file lacks. The names table has 566 HIPs (498 within the Hipparcos rows at V <= 7.5); HIP 72105 appears twice in the WGSN list (Izar and Pulcherrima) and keeps Izar.

## Overrides (18)

`scripts/data/star-designation-overrides.json`, each entry with a citable source (none cites HYG or the Yale Bright Star Catalogue):

| HIP    | Override       | Source kind                                                                                                |
| ------ | -------------- | ---------------------------------------------------------------------------------------------------------- |
| 8832   | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 9347   | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 13847  | bayer The-1    | IAU WGSN list                                                                                              |
| 39953  | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 40023  | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 48552  | flamsteed 9    | Wikidata item statement                                                                                    |
| 50583  | bayer Gam-1    | IAU WGSN list                                                                                              |
| 69481  | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 71762  | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 81710  | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 84345  | bayer Alp-1    | IAU WGSN list                                                                                              |
| 86974  | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 90968  | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 90969  | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 91926  | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 101923 | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 107310 | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
| 110960 | omit ["bayer"] | Omitted: the one-off HYG-era comparison disagreed with Wikidata on the component digit, no tie-break found |
