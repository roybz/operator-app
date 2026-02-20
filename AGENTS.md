# Operator App – AI Contributor Notes

This repository contains a standalone Angular frontend in `frontend/`.

## High-level structure

- `frontend/src/app/app.ts`: main shell, dialogs, workspace UI, theme/app state wiring.
- `frontend/src/app/core/`: auth/session state, dialog/workspace state.
- `frontend/src/app/features/applications/`: app instances (todo, kanban, notes, etc.).
- `frontend/src/app/features/dependencies/`: shared app metadata/types and lightweight dependencies.
- `frontend/src/app/features/settings/`: settings pages and draft/apply flow.
- `frontend/src/assets/i18n/*.json`: UI strings (always add new strings here).

## Reuse/Shared pieces

- `DialogComponent` handles app windows (drag, resize, title editing).
- `DialogService` stores workspace/dialog state and persistence.
- `AppPreferencesService` provides app-friendly access to user preferences.
- `StorageService` provides async persistence via a pluggable `StorageAdapter` (default: localStorage).
- `features/dependencies/instance-state-storage.ts` is the shared source of truth for instance-scoped app state keying/clone/clear/persist helpers.
- `shared/horizontal-scroll-shadow.ts` is the shared source of truth for horizontal edge shadow state (kanban/data-table style behavior).

## Conventions

- Any new UI string goes into all i18n files (English text is acceptable).
- New application types must be added to:
  - `features/dependencies/app-types.ts`
  - `features/dependencies/app-registry.ts`
  - any UI lists that render app entries.
- Prefer `features/dependencies/` for shared app-level utilities to keep apps portable.
- Long-running processes (timers/sync/background loops) should live in services keyed by `universeId` with explicit start/stop, not inside UI component lifecycle hooks.

## Guest-only mode

Runtime config lives in `frontend/src/assets/op-config.js`.  
If `guestModeOnly` is true, the login form is hidden and only guest access is allowed.
`debugPerf` can be enabled for switch lifecycle/perf instrumentation (or overridden via localStorage `op_debug_perf` = `1`/`0`).

## Storage adapters

- All persistence goes through `StorageService` and `StorageAdapter`.
- `storageMode: 'local'` (default) uses async localStorage.
- `storageMode: 'remote'` uses the HTTP adapter in `frontend/src/app/core/storage/remote-storage.adapter.ts`.

## Storage/Backend adapters

Persistence is async. The adapter is provided in `frontend/src/app/app.config.ts` via `STORAGE_ADAPTER`.
Swap this to point to a backend adapter if you want server-backed storage.

## Testing

- Unit tests: `npm run test:unit`
- Lint: `npm run lint`
- E2E: `npm run test:e2e`
- You can explicitly request: "run checks and report results"; run `test:unit`, `lint`, and `build`, then summarize pass/fail and notable warnings/errors.
- Add or update focused service tests when changing cross-cutting state logic:
  - `core/dialog.service.spec.ts` for workspace/dialog state transitions.
  - `core/auth.service.spec.ts` for login preference/session synchronization flows.
