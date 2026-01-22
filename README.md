# Operator App

Operator App is an OS-like, browser-first experiment for running multiple lightweight apps (todos, notes, kanban, timers, etc.) inside movable dialogs with workspaces.

This repository is currently configured to run in **guest-only, local-storage mode** by default.

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

To experiment with a backend later:

- Set `apiBaseUrl` in `frontend/src/assets/op-config.js`.
- Provide the backend you want for users/sessions and app data.

## License

MIT. See `LICENSE`.
