# Delegated decisions (ui-auth)

The run was autonomous: no question went to the user, and these non-UI choices were made by the agent.

- **Execution mode.** Both phases were implemented in the main context, with no subagent: the change is small. Two read-only subagents did the implementation review.
- **No new tests.** Screenshots show the change, and the existing e2e and smoke tests cover the auth selectors and the continue note's text. The user's standing rule is "keep new tests modest".
- **Deferred behaviour findings.** D1 (redirect signed-in visitors away from the auth forms) and D2 (carry `next` through sign-up) are auth-behaviour changes, so they are out of scope for a visual pass. They are recorded in `research.md`.
- **Impl-review F1 deferred.** The `FormField` `pr-11` fix touches a shared form component while three parallel passes are open. It is left as a one-line follow-up.
- **Commit messages.** The repo's style, `feat(<change-id>): … (pN)` plus `Refs: #86`, was approved by the agent itself.
- **Screenshot tooling.** A scratch script in the scratchpad (`auth-shots.mjs`, not committed) builds contact sheets per view and width. The pending state is captured by posting into a hidden iframe whose request never answers.
