# Operator Engineering Conventions

This is the canonical style guide for day-to-day implementation work.

## 1. Repository-wide Principles

- Optimize for deterministic behavior over cleverness.
- Prefer shared primitives over app-local one-offs.
- Keep guest/test-mode guarantees intact in all changes.
- New behavior must be test-covered when it affects cross-cutting state, auth, storage, or realtime.

## 2. TypeScript Conventions

## 2.1 File and Symbol Layout

Use this order for new/modified files:

1. Imports (grouped: Angular, third-party, internal).
2. Type aliases/interfaces/constants/helpers.
3. Component/service class declaration.
4. Public API methods.
5. Internal/private methods.

## 2.2 Class Member Ordering

Use this ordering inside classes:

1. `@Input`/`@Output`/public signals and computed values.
2. DI fields (`inject(...)` / constructor dependencies).
3. Lifecycle hooks (`ngOnInit`, `ngOnDestroy`, etc.).
4. Public event handlers and command methods.
5. Private helpers.

Keep related methods adjacent (for example `startX`, `finishX`, `isX`).

## 2.3 Naming and Contracts

- Prefer explicit nouns in state names (`vaultImportStatus`, `selectedIds`).
- Use discriminated unions for mode/state branching.
- Avoid `any`; if narrowing is not feasible, use `unknown` and narrow.
- Keep adapter/service contracts in shared modules (`core/*` or `features/dependencies/*`) when reused by 2+ apps.

## 2.4 Persistence and Realtime

- Instance persistence must use `InstancePersistQueue`.
- Cross-key conflict behavior must route through key-space strategy modules.
- Realtime degradation must stay functional under WebSocket failure.

## 3. SCSS and Styling Conventions

## 3.1 Global Tokens

- Define design tokens in shared SCSS partials (colors, spacing, radii, shadows, z-index).
- Consume tokens via CSS variables (`var(--color-*)`) in components.
- Avoid hard-coded color literals in templates unless explicitly temporary.
- Use these token prefixes consistently:
  - `--color-*` for semantic color values (including `--color-accent-contrast`)
  - `--space-*` for spacing scale
  - `--radius-*` for corner radii
  - `--font-*` and `--line-height-*` for typography
  - `--shadow-*` for elevation
  - `--motion-*` and `--easing-*` for animation timing

## 3.2 Mixins and Shared Utilities

- Repeated style patterns (panel shell, control rows, focus rings, phone/desktop transitions) should be extracted into mixins.
- New mixins belong under `frontend/src/styles/` partials.

## 3.3 Inline Style Policy

- New feature work should not introduce additional inline style literals in templates.
- Existing inline styles should be migrated opportunistically when touching a component.

## 4. Unit Test Conventions

## 4.1 Structure

Use Arrange / Act / Assert structure and keep one behavior focus per test.

- Arrange: create state/mocks.
- Act: invoke one command.
- Assert: check state/effects.

## 4.2 Naming

Test names should describe expected behavior:

- `it('buffers writes while offline and flushes in order on reconnect', ...)`
- `it('does not start signup flow when public signup capability is disabled', ...)`

## 4.3 Required Coverage Areas

Changes in these areas require focused tests:

- Auth/session/logout.
- Storage adapter behavior and conflict handling.
- Realtime queue/backoff logic.
- Role and permission policy.
- App-specific merge/reconcile logic.

## 5. E2E Test Conventions

- Keep scenarios user-centered and minimal, focused on critical path confidence.
- Prefer stable selectors and deterministic waits over arbitrary timeouts.
- Cover at least:
  - app bootstrap,
  - open/create/edit flow for key app types,
  - auth/logout redirects,
  - guest/test-mode safety.

## 6. Security Conventions

- Default to `sessionStorage` for Cognito session persistence; `localStorage` is explicit opt-in.
- Never bypass Angular sanitization for user-authored HTML unless strictly necessary and reviewed.
- Do not log access tokens, id tokens, or raw auth headers.
- Keep signup disabled by capability unless explicitly enabled by config.

## 7. Quality Gates (Required)

Run from `frontend/`:

```bash
npm run lint
npm run test:unit -- --watch=false
npm run build
```

Before PR merge to main:

```bash
npm run test:release-gates
npm run test:e2e
```

## 8. Storybook Conventions

## 8.1 Story naming and placement

- Co-locate stories with the component when practical (`*.stories.ts`).
- Use `Title/Component` hierarchy that mirrors the app domain:
  - `Shared/...` for reusable primitives
  - `Layout/...` for shell/navigation
  - `Features/...` for app feature slices
- Story export names must describe the UI state, not implementation details (`Readonly`, `RealtimeDegraded`, `ValidationError`).

## 8.2 Args and fixtures

- Prefer `args` for standard variants and controls.
- Use explicit fixture builders for complex state (auth/session/realtime/collaboration), not inline ad-hoc objects.
- Keep stories deterministic: no live timers, random IDs, or network dependencies.

## 8.3 Required edge-state coverage

For new or materially changed reusable UI, include at minimum:

- default/normal state
- loading state
- empty state (if applicable)
- error/degraded state
- readonly/disabled state
- accessibility/high-contrast variant where styling or affordances differ

## 8.4 Accessibility checks in story review

- Ensure keyboard reachability for interactive controls.
- Validate focus visibility and focus order in modal/overlay scenarios.
- Ensure semantic/ARIA labels remain present for icon-only or compact controls.
- Prefer token-based contrast-safe colors over literal values in stories and components.
