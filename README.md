# Operator App
![Spatial workspace overview](screenshots/workspace-overview.jpeg)

Operator App is an OS-like, browser-first experiment for running multiple lightweight apps (todos, notes, kanban, timers, etc.) inside movable dialogs with workspaces.

This repository is currently configured to run in **guest-only, local-storage mode** by default.
All persistence goes through an async storage adapter, so swapping to a backend is plug-and-play.

## Quick start

```
cd frontend
npm install
npm run start
```

## Guest-only mode (default)

Guest-only mode hides the login form and allows only guest access.

To change it:

1) Update `frontend/package.json`:
```
"guestModeOnly": false
```

2) Update `frontend/src/assets/op-config.js`:
```
guestModeOnly: false
```

## Test mode and persistence

By default, the app uses local storage (test mode). You can explore the UI without any backend.

Persistence flows through `StorageService` and the `StorageAdapter` interface. The default adapter is
`LocalStorageAdapter`, but you can swap it out via `frontend/src/assets/op-config.js`. Hydration runs
in `APP_INITIALIZER`, so the UI won’t read state until storage is ready.

To experiment with a backend later:

- Set `storageMode: 'remote'` and `storageApiBaseUrl` in `frontend/src/assets/op-config.js`.
- Provide the backend you want for users/sessions and app data.

### Storage adapter endpoints (remote mode)

The built‑in remote adapter expects these JSON endpoints:

- `GET {base}/storage/keys` → `{ keys: string[] }`
- `GET {base}/storage/item?key=...` → `{ value: string | null }`
- `PUT {base}/storage/item` with body `{ key, value }`
- `DELETE {base}/storage/item?key=...`

## License

MIT. See `LICENSE`.
