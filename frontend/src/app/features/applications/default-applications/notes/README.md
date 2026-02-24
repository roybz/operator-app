# Notes App

Notes supports folders, selection, archiving, and multiple editor modes.

Dependencies to copy if extracting:

- `features/dependencies/app-types.ts`
- `features/dependencies/app-registry.ts`
- `features/dependencies/instance-state-storage.ts`

Notes persists instance state through `StorageService` using instance-scoped keys and participates in
remote invalidation sync (WebSocket/polling fallback) when cloud mode is enabled.

Current sync hardening includes:

- focus-aware dirty tracking for rich and markdown editors
- deferred remote apply while editing
- shared debounce/coalesce/backoff persistence queue (`core/realtime/instance-persist-queue.ts`)
