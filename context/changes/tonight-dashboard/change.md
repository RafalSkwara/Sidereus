---
change_id: tonight-dashboard
title: Tonight as a dashboard of tiles leading to focused pages
status: implementing
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Notes

Rework the Tonight page (dashboard) in the sidereus project: it's still too cluttered after the redesign, and panels link to other panels on the same page, which is unclear and bad UX.

- Roadmap S-11 (MS-11), GitHub #87. Builds on the Nightfall Tonight shipped in tonight-nightfall (#91, #92, archived #93).

- Screenshot gate (2026-10-04): https://claude.ai/artifact/A1s7ppPdn7PDQ7metwTGrK. User feedback applied before the PR: the Planets page says why there are no planets; Moon, Planets and Nights keep their section heading for screen readers only; Targets shows the best 5 in full, then "Show the other N" opens the rest as a scrollable list; old `/tonight/all#…` fragments are covered every day by `#more`, and the Moon page links to the washed-out group. Progress 5.3 (gate approval) stays open until the user reviews the PR.
