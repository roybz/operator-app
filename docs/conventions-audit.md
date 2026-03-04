# Conventions Audit

Generated: 2026-03-04T15:54:46.741Z

## Scope

- Source root: `frontend/src/app`
- Files scanned: **148**

## Totals

- Inline style attributes (`style=`): **572**
- Dynamic style bindings (`[style]` / `[style.*]`): **117**
- Hardcoded color literals (`#hex`, `rgb*`, `hsl*`): **139**
- Accessibility attribute usage (`aria-*` and `role=`): **15**
- Button elements missing explicit `type`: **216**

## Top Files Requiring Convention Cleanup

| File | Inline styles | Hardcoded colors | Buttons missing type |
| --- | ---: | ---: | ---: |
| `frontend/src/app/features/applications/default-applications/notes/notes.component.ts` | 86 | 12 | 33 |
| `frontend/src/app/app.component.html` | 59 | 7 | 27 |
| `frontend/src/app/features/applications/default-applications/calendar/calendar.component.ts` | 44 | 8 | 12 |
| `frontend/src/app/features/applications/default-applications/todo/todo.component.ts` | 45 | 6 | 13 |
| `frontend/src/app/features/applications/default-applications/kanban/kanban.component.ts` | 37 | 7 | 13 |
| `frontend/src/app/features/applications/default-applications/calculator/calculator.component.ts` | 15 | 2 | 29 |
| `frontend/src/app/layout/desktop/desktop-shell.component.ts` | 27 | 0 | 13 |
| `frontend/src/app/features/applications/default-applications/data-table/data-table.component.ts` | 22 | 5 | 11 |
| `frontend/src/app/features/auth/login.component.html` | 34 | 2 | 0 |
| `frontend/src/app/features/applications/default-applications/sticky-notes/sticky-notes.component.ts` | 21 | 4 | 4 |
| `frontend/src/app/features/settings/multi-user/multi-user.component.ts` | 19 | 1 | 7 |
| `frontend/src/app/layout/shared/top-bar.component.ts` | 0 | 16 | 7 |
| `frontend/src/app/features/settings/universe/universe.component.ts` | 13 | 3 | 5 |
| `frontend/src/app/features/settings/applications/applications.component.ts` | 12 | 2 | 4 |
| `frontend/src/app/features/applications/default-applications/clock/clock.component.ts` | 14 | 0 | 3 |

## Interpretation

- This report is a static convention baseline, not a blocker-only gate.
- Priority is to reduce inline styles and hardcoded colors in reusable/shared surfaces first.
- Accessibility attributes are present across multiple surfaces, but this does not certify WCAG conformance.
- WCAG conformance still requires manual keyboard/focus testing and contrast verification.
