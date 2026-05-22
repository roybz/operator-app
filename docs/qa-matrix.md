# Public-Ready QA Matrix

Use this worksheet before production publishes and before asking an external tester, browser
automation agent, or product reviewer to evaluate Operator App.

Operator App should be tested as a browser workspace environment, not as a conventional landing
page. The first pass should validate whether a new user can enter the app, understand the workspace,
launch tools, move between contexts, and recover from ordinary friction without special project
knowledge.

## Test Entry Points

| Entry point             | Purpose                   | Notes                                                                             |
| ----------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| Local dev               | Contributor smoke testing | Run from `frontend/` with `npm run start`.                                        |
| Hosted deployment       | Production-like visual QA | Use the current public deployment for layout, onboarding, and interaction checks. |
| Guest session           | Default first-pass QA     | Guest mode must stay local-only and safe for repeat testing.                      |
| Authenticated test user | Cloud and permission QA   | Use a dedicated disposable test account, never a personal account.                |

## Guest-First Visual QA

Run this pass before authenticated or cloud-mode testing.

| ID    | Scenario                  | Steps                                                                                  | Expected                                                                                                       |
| ----- | ------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GQ-01 | First screen orientation  | Open the app as a new visitor and choose guest/local entry                             | The user can find a safe entry path without needing cloud credentials.                                         |
| GQ-02 | Workspace shell scan      | Inspect the primary workspace, navigation, available apps, dialogs, and settings entry | The product reads as an OS-like workspace; key controls are discoverable and not visually crowded.             |
| GQ-03 | Launch core apps          | Open Todo, Notes, Kanban, Sticky Notes, Timer, and any default utility apps            | Each app launches in a usable dialog/window with clear title, controls, and empty state.                       |
| GQ-04 | Dialog ergonomics         | Move, resize, focus, minimize/close, and relaunch several app dialogs                  | Dialogs remain within usable bounds; controls do not overlap; focus and close behavior are predictable.        |
| GQ-05 | Basic app data            | Create sample items in Todo, Notes, Kanban, and Sticky Notes                           | Entries are saved locally, rendered clearly, and do not corrupt other app instances.                           |
| GQ-06 | Workspace persistence     | Refresh the browser and return to the guest workspace                                  | Local app state and dialog layout restore as expected, or loss of state is clearly intentional.                |
| GQ-07 | Import/export affordances | Find and exercise any available export/import or reset controls                        | Data safety actions are understandable and do not surprise-delete active work.                                 |
| GQ-08 | Settings comprehension    | Open settings and review available sections without changing cloud credentials         | Settings are grouped clearly; unavailable beta/cloud features are gated or explained by affordance, not error. |
| GQ-09 | Mobile layout             | Repeat entry, app launch, dialog focus, and settings checks on a mobile viewport       | Core workflows remain usable without clipped text, unreachable controls, or incoherent overlap.                |
| GQ-10 | Keyboard/mouse basics     | Use Tab, Enter, Escape, pointer drag, and common browser zoom levels                   | Basic interaction remains accessible and does not trap focus or break layout.                                  |

## Resilience And Persistence QA

| ID    | Scenario                 | Steps                                                                        | Expected                                                                         |
| ----- | ------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| RQ-01 | Guest local-only storage | Use guest mode and mutate app data                                           | No remote storage writes are required; only local persistence is used.           |
| RQ-02 | Offline continuity       | Disconnect network after the app loads, make local edits, then reconnect     | Local work remains usable; reconnect does not drop or duplicate guest data.      |
| RQ-03 | Burst interaction        | Rapidly drag/resize dialogs and make repeated edits in a core app            | The UI remains responsive; persistence queues do not cause visible thrash.       |
| RQ-04 | Browser refresh recovery | Refresh during normal use and during an edit-heavy moment                    | The app returns to a coherent state without broken dialogs or partial UI.        |
| RQ-05 | Storage reset recovery   | Use documented reset/clear controls or clear local storage between sessions  | The app starts cleanly and does not show stale identity, workspace, or app data. |
| RQ-06 | Realtime fallback        | In a configured cloud environment, block or interrupt websocket connectivity | The app remains usable through polling/fallback behavior.                        |

## Authenticated Cloud QA

Use a dedicated disposable test account and test universe. Do not use a personal production account
for release QA.

| ID    | Scenario                       | Steps                                                                            | Expected                                                                             |
| ----- | ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| CQ-01 | Dedicated test login           | Sign in with a test account and open a test universe                             | Cloud identity is isolated from personal data; test state is easy to reset.          |
| CQ-02 | Same user multi-device         | Open the same universe on desktop and mobile, then edit Todo/Kanban/Sticky/Notes | State converges without data loss or infinite conflict loops.                        |
| CQ-03 | Editor concurrency             | Two sessions mutate the same app instance in a short interval                    | Merge/rebase/conflict behavior is deterministic and understandable.                  |
| CQ-04 | Observer read-only             | Login as observer and attempt edits, import, delete, and layout mutation         | Write actions are blocked; read-only affordances are visible.                        |
| CQ-05 | Share-viewer read-only         | Enter via a share/viewer path and attempt writes                                 | Viewer identity is assigned; no writes are permitted.                                |
| CQ-06 | Admin test mode                | Enable test/local mode for an authenticated user and mutate data                 | Remote writes pause while test mode is enabled.                                      |
| CQ-07 | External logout                | Logout from UI and any `/logout` route                                           | External session clears; the next sign-in requires credentials.                      |
| CQ-08 | Credential-gated beta features | Attempt to access beta/LLM resident surfaces without suitable permissions        | Secret material is not persisted unexpectedly; unavailable actions are gated safely. |

## Release Gate Command Output

Run from `frontend/`:

```bash
npm run test:release-gates
```

Attach output/log references here before sign-off.

## Evidence Log

| ID    | Result | Build/Commit | Notes |
| ----- | ------ | ------------ | ----- |
| GQ-01 |        |              |       |
| GQ-02 |        |              |       |
| GQ-03 |        |              |       |
| GQ-04 |        |              |       |
| GQ-05 |        |              |       |
| GQ-06 |        |              |       |
| GQ-07 |        |              |       |
| GQ-08 |        |              |       |
| GQ-09 |        |              |       |
| GQ-10 |        |              |       |
| RQ-01 |        |              |       |
| RQ-02 |        |              |       |
| RQ-03 |        |              |       |
| RQ-04 |        |              |       |
| RQ-05 |        |              |       |
| RQ-06 |        |              |       |
| CQ-01 |        |              |       |
| CQ-02 |        |              |       |
| CQ-03 |        |              |       |
| CQ-04 |        |              |       |
| CQ-05 |        |              |       |
| CQ-06 |        |              |       |
| CQ-07 |        |              |       |
| CQ-08 |        |              |       |
