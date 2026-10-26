---
change_id: sky-check-record-cause
title: Sky-check record failure leaves no cause in the log
status: archived
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20T19:21:11Z
---

## Notes

Production fault of 2026-10-20 (owner's S-07 checks, version 6aa032a5): one `GET /_server-islands/TonightContent` logged `sidereus: tonight.sky-check-record failed` with only `{step}` about 6.3 s after the request began (event wallTime 6308 ms). Two separate questions: (1) why the line carries no cause, (2) why the record write failed or took about 6 s. Raw tail: the scratchpad file skycheck-prod-tail.jsonl of the orchestrator session. Follows error-visibility (M-4 S-07), which is still implementing and is not edited here.
