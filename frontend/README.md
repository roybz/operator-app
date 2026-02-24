# Operator App Frontend (Angular)

Angular frontend for Operator App (multi-dialog workspace shell + bundled mini apps).

## Development

```bash
npm install
npm run start
```

Open `http://localhost:4200/`.

## Common commands

- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

## Runtime config

Runtime config is served from `frontend/src/assets/op-config.js`.

Important flags:

- `guestModeOnly`
- `storageMode` (`local` / `remote`)
- `storageApiBaseUrl`
- `authProvider` (`local` / `cognito`)
- `cognito.*`
- `realtimeEnabled`
- `realtimeWebSocketUrl`
- `debugPerf`

## Persistence and sync

- All persistence flows through `StorageService` + `StorageAdapter`.
- Guest sessions are local-only.
- Authenticated sessions can use remote storage (HTTP API).
- Realtime sync is WebSocket-first with polling fallback.
- App-instance persistence uses a shared queue helper:
  - `src/app/core/realtime/instance-persist-queue.ts`

## Logout behavior (external auth)

When Cognito/external auth is enabled, `/logout` must trigger provider logout (not just local session
clear) to avoid immediate silent re-login via Hosted UI session cookies.

## Debug perf instrumentation

Lifecycle/perf instrumentation for Universe and Workspace switching is available in debug mode.

- Config flag: `src/assets/op-config.js` -> `debugPerf`
- Local override:
  - Enable: `localStorage.setItem('op_debug_perf', '1')`
  - Disable: `localStorage.setItem('op_debug_perf', '0')`
  - Reset: `localStorage.removeItem('op_debug_perf')`
