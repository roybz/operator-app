# Public-Ready QA Matrix (Pre-v1)

Use this file as the execution worksheet before each production publish.

## Test Matrix

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| QA-01 | Same user multi-device | Open same universe on desktop + mobile, edit same Todo/Kanban/Sticky/Notes item | Converges without data loss; no infinite 409 loop |
| QA-02 | Editor concurrency | Two editor sessions mutate same instance in short interval | Deterministic merge/rebase behavior per app policy |
| QA-03 | Observer read-only | Login as observer and attempt edits/import/delete | All write actions blocked; read-only affordances visible |
| QA-04 | Share-viewer read-only | Enter via universe/share path and attempt edits | Viewer identity assigned; no writes permitted |
| QA-05 | Offline buffering | Disconnect network, edit locally, reconnect | Writes flush in order; no dropped edits |
| QA-06 | Throttle resilience | Trigger burst writes (drag/move/high-frequency edits) | 429 handled with backoff/retry-after; no retry storm |
| QA-07 | Guest local-only | Login as guest and mutate data | No remote storage writes; only local persistence |
| QA-08 | Admin test mode local-only | Enable test mode as authenticated user and mutate data | No remote writes while mode is enabled |
| QA-09 | External logout | Logout from UI and `/logout` route | External session cleared; next sign-in requires credentials |
| QA-10 | Realtime degrade path | Block websocket endpoint and keep app open | App remains usable with polling fallback |

## Release Gate Command Output

Run from `frontend/`:

```bash
npm run test:release-gates
```

Attach output/log references here before sign-off.

## Evidence Log

| ID | Result | Build/Commit | Notes |
| --- | --- | --- | --- |
| QA-01 |  |  |  |
| QA-02 |  |  |  |
| QA-03 |  |  |  |
| QA-04 |  |  |  |
| QA-05 |  |  |  |
| QA-06 |  |  |  |
| QA-07 |  |  |  |
| QA-08 |  |  |  |
| QA-09 |  |  |  |
| QA-10 |  |  |  |
