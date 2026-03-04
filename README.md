# Operator App

![Spatial workspace overview](screenshots/workspace-overview.jpeg)

Operator App is an OS-like, browser-first experiment for running multiple lightweight apps
(todos, notes, kanban, timers, etc.) inside movable dialogs with workspaces.

The app supports:

- guest/local mode (`localStorage`, no cloud writes)
- authenticated cloud mode (Cognito + remote storage API)
- realtime invalidation (WebSocket) with polling fallback

All persistence goes through an async storage adapter, so backend storage is pluggable.

## Quick start

```bash
cd frontend
npm install
npm run start
```

## Guest-only mode

Guest-only mode hides the login form and allows only guest access.

To enable guest-only mode:

1. Update `frontend/package.json`:

```json
"guestModeOnly": true
```

2. Update `frontend/src/assets/op-config.js`:

```js
guestModeOnly: true;
```

## Test mode and persistence

- Guests always use local storage (test mode), even when cloud auth/storage is enabled.
- Authenticated users can also be forced into local test mode via org settings.

Persistence flows through `StorageService` and the `StorageAdapter` interface. Hydration runs in
`APP_INITIALIZER`, so the UI does not read persisted state until storage is ready.

To use remote storage:

- Set `storageMode: 'remote'` and `storageApiBaseUrl` in `frontend/src/assets/op-config.js`
- Configure an auth provider (Cognito is implemented)

### Remote storage endpoints

The built-in remote adapter expects these endpoints:

- `GET {base}/storage/keys` -> `{ keys: string[] }`
- `GET {base}/storage/item?key=...` -> `{ value: string | null, version?: number, updatedAt?: number }`
- `PUT {base}/storage/item` with body `{ key, value, version }`
- `DELETE {base}/storage/item?key=...`
- `POST {base}/storage/batchGet` with body `{ keys }`

The remote adapter uses optimistic concurrency (`version`) and handles `409` conflicts.

## Realtime sync

Realtime sync uses WebSocket invalidation when available and polling fallback when not.

- WebSocket failures should not block app usage.
- App-instance persistence uses debounce/coalescing and `409`/`429` handling to reduce thrash.

## Docs

- `Docs/aws-setup.md` - current AWS resources and deployment notes
- `Docs/backend-setup.md` - provider-agnostic backend contract
- `Docs/observability-runbook.md` - correlation IDs, alert taxonomy, and incident triage flow
- `Docs/compliance-prep.md` - data classification, retention, and access-control prep artifacts
- `Docs/qa-matrix.md` - pre-launch scenario matrix and evidence worksheet
- `Docs/release-checklist.md` - pre-launch matrix and ship checklist

## License

MIT. See `LICENSE`.
