# Draft: courtesy request to the IAU Meteor Data Center

> **For the owner to send, if they choose.** The agent drafted it and never sends it. Owner decision 1 (2026-10-13): option A, a hand-written list of facts, with this email optional. The address comes from the MDC's contact page (https://ceresiaumdc.ta3.sk/contact): `mdc_showers [at] ta3.sk`. Add your own name and signature when you send it. Not legal advice.

---

**To:** mdc_showers [at] ta3.sk
**Subject:** Citing IAU MDC shower data in a small astronomy planning app

Dear IAU Meteor Data Center team,

I develop Sidereus (https://github.com/RafalSkwara/sidereus), a web app that helps beginner amateur astronomers plan an observing night. It is free today and may offer a paid plan in the future.

The app will show the peak nights of eight major annual meteor showers: the Quadrantids, Lyrids, Eta Aquariids, Southern Delta Aquariids, Perseids, Orionids, Leonids and Geminids. From the IAU MDC's list of established showers we take only two facts per shower, entered by hand and rounded to 1 degree and 1 km/s:
- the radiant's right ascension and declination (J2000);
- the geocentric velocity.

(In each case the annual solution of Jenniskens, 2023, with the largest sample on the shower's page.) We take nothing else from the MDC: the peak night comes from NASA's shower pages, and the solar longitude of the peak is computed by our own code from that date. We cross-check the values against other published sources by reading only, and we do not copy any table or its layout. The app credits the IAU MDC in its data notice and cites the references your references page (https://ceresiaumdc.ta3.sk/references) asks for:

- Jopek, T. J. et al. (2024), A&A 682, A159
- Jenniskens, P. et al. (2020), Planetary and Space Science 182, 104821

Could you confirm that using these values this way, with that citation, is acceptable to you, including if the app later charges for a plan? If you would prefer different wording in the citation, we will gladly use it.

Thank you for maintaining the database.

Kind regards,
[name]
Sidereus
