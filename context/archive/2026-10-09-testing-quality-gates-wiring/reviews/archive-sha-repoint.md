# Archive SHA repoint: testing-quality-gates-wiring

- **Date**: 2026-10-09
- **Target**: `origin/main`, snapshot after #150 (merge commit 542aeac)
- **Integration**: PR #150 merged as a merge commit of the branch rebased onto `main` (after #149 and #151). The Progress SHAs were written before that rebase, so they are not in `main`'s history.
- **Evidence**: for each pair, `git patch-id --stable` of the old and new commit is identical; each new commit is an ancestor of `origin/main`.
- **Decision**: the owner chose "Zaktualizuj i archiwizuj" (update and archive), 2026-10-09.

| Rows | Old suffix | New SHA | Commit |
|------|------------|---------|--------|
| 1.1–1.8 | 7aa8446 | 12d59e9 | test(testing-quality-gates-wiring): lint coverage (p1) |
| 2.1–2.3, 2.5 | 52f96c3 | c446377 | test(testing-quality-gates-wiring): CI gates (p2) |
| 3.1–3.5 | 595ddf7 | 918a76c | feat(testing-quality-gates-wiring): end-of-turn agent hook (p3) |
| 4.1–4.3 | d53a120 | 33852e9 | docs(testing-quality-gates-wiring): docs and cookbook (p4) |

Total: 20 rows repointed. Rows 2.4/2.6 are marked dropped; 3.6, 3.7 and 5.1–5.4 were still open at archive (manual hook checks and the post-merge local registration).
