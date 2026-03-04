# Storybook Authoring Guide

Use this guide when adding or updating stories for Operator UI.

## 1. Choose the right scope

- `Shared/*`: reusable primitives (`modal-shell`, controls, overlays, badges).
- `Layout/*`: app shell and cross-feature layout UI (`top bar`, `app list`, side menus).
- `Features/*`: feature-level states (auth, settings, app slices such as todo/kanban/notes).

## 2. Create deterministic fixtures

- Build stable fixture objects in the story file.
- Avoid random values, real-time clocks, or network calls.
- Mock external dependencies through Storybook providers/decorators.

## 3. Add required state variants

At minimum for UI-impacting changes:

1. `Default` (normal state)
2. `Loading`
3. `Error` or `Degraded`
4. `Readonly` or `Disabled`
5. `Empty` where applicable

Add collaboration/realtime-specific variants when the component participates in those flows.

## 4. Use args first

- Prefer `args` for simple variants.
- Use `render` only for wrapper-only behavior (status banners, constrained containers).
- Keep templates semantic; avoid heavy inline style payloads in stories.

## 5. Accessibility checks before merge

1. Keyboard navigation works for all controls in the story.
2. Focus-visible is present and not suppressed.
3. Modal/overlay stories trap focus and support escape.
4. Readonly/disabled states remain understandable to screen readers.

## 6. Visual regression coverage

- Add or update `frontend/e2e/storybook-visual.spec.ts` for critical shared UI surfaces.
- Regenerate baseline only when intended UI change is confirmed:

```bash
npm run test:visual -- --update-snapshots
```

- Validate baseline afterward:

```bash
npm run test:visual
```

## 7. Required validation commands

From `frontend/`:

```bash
npm run lint
npm run test:unit -- --watch=false
npm run build
npm run build-storybook
npm run test:visual
```
