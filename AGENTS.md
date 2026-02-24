# Operator App - AI Contributor Notes

This repository contains a standalone Angular frontend in `frontend/`.

## High-level structure

- `frontend/src/app/app.ts`: main shell, dialogs, workspace UI, theme/app state wiring.
- `frontend/src/app/core/`: auth/session state, dialog/workspace state, realtime/storage services.
- `frontend/src/app/features/applications/`: app instances (todo, kanban, notes, etc.).
- `frontend/src/app/features/dependencies/`: shared app metadata/types and lightweight dependencies.
- `frontend/src/app/features/settings/`: settings pages and draft/apply flow.
- `frontend/src/assets/i18n/*.json`: UI strings (always add new strings here).

## Reuse/Shared pieces

- `DialogComponent` handles app windows (drag, resize, title editing).
- `DialogService` stores workspace/dialog state and persistence.
- `AuthService` owns login/session/preferences and local/external auth bridging.
- `StorageService` provides async persistence via a pluggable `StorageAdapter`.
- `core/realtime/remote-conflict.service.ts` tracks dirty keys and deferred remote conflicts.
- `core/realtime/instance-persist-queue.ts` is the shared debounce/coalesce/backoff helper for
  instance-scoped app persistence (`409`/`429` hardening).
- `features/dependencies/instance-state-storage.ts` is the shared source of truth for instance keying/clone/clear helpers.
- `shared/horizontal-scroll-shadow.ts` is the shared source of truth for horizontal edge shadows.

## Conventions

- Any new UI string goes into all i18n files (English text is acceptable).
- New application types must be added to:
  - `features/dependencies/app-types.ts`
  - `features/dependencies/app-registry.ts`
  - any UI lists that render app entries.
- Prefer `features/dependencies/` for shared app-level utilities to keep apps portable.
- Long-running processes (timers/sync/background loops) should live in services keyed by `universeId`
  with explicit start/stop, not inside UI component lifecycle hooks.
- When adding persistence to app instances, prefer `InstancePersistQueue` over ad-hoc timers/retries.

## Guest-only and test mode

Runtime config lives in `frontend/src/assets/op-config.js`.

- If `guestModeOnly` is true, the login form is hidden and only guest access is allowed.
- Guests are always local-only/test-mode (no remote writes).
- Admin test mode also forces local fallback for authenticated sessions.
- `debugPerf` can be enabled for switch lifecycle/perf instrumentation (or overridden via
  localStorage `op_debug_perf` = `1` / `0`).

## Storage adapters

- All persistence goes through `StorageService` and `StorageAdapter`.
- `storageMode: 'local'` uses async localStorage.
- `storageMode: 'remote'` uses the HTTP adapter in
  `frontend/src/app/core/storage/remote-storage.adapter.ts`.

## Auth / Logout notes

- External auth (Cognito) is integrated via `frontend/src/app/core/auth/cognito-oidc.service.ts`.
- Logout correctness matters:
  - `/logout` route handling must trigger full external provider logout when external auth is enabled.
  - Avoid local-only logout redirects for Cognito sessions, or users will appear to "instantly re-login".

## Realtime sync notes

- Realtime invalidation is WebSocket-first with polling fallback.
- WebSocket connect failures should degrade gracefully (app remains usable via polling).
- Focus-aware dirty tracking is required before applying remote invalidations to text editors.

## Testing

- Unit tests: `npm run test:unit`
- Lint: `npm run lint`
- E2E: `npm run test:e2e`
- "Run checks and report results" should run `test:unit`, `lint`, and `build`, then summarize
  pass/fail and notable warnings/errors.
- Add or update focused tests when changing cross-cutting state logic:
  - `core/dialog.service.spec.ts` for dialog/workspace persistence behavior
  - `core/auth.service.spec.ts` for login/session preference synchronization
  - `core/realtime/instance-persist-queue.spec.ts` for debounce/backoff/conflict queue behavior
