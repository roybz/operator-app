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

## Conventions
- Any new UI string goes into all i18n files (English text is acceptable).
- New application types must be added to:
  - `features/dependencies/app-types.ts`
  - `features/dependencies/app-registry.ts`
  - any UI lists that render app entries.
- Prefer `features/dependencies/` for shared app-level utilities to keep apps portable.

## Guest-only mode
Runtime config lives in `frontend/src/assets/op-config.js`.  
If `guestModeOnly` is true, the login form is hidden and only guest access is allowed.

## Testing
- Unit tests: `npm run test:unit`
- Lint: `npm run lint`
- E2E: `npm run test:e2e`
