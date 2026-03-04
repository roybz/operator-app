# Security Pass Report (2026-03-04)

## Scope

- Dependency vulnerability scan.
- Auth/session persistence and logout flow review.
- Realtime/storage conflict/retry surface review.
- HTML rendering entry points review.

## Results

## 1. Dependency Audit

Command:

```bash
npm audit --audit-level=moderate --json
```

Result:

- `4 high` vulnerabilities remain, all in the Angular/Storybook build toolchain path:
  - `serialize-javascript` (via `copy-webpack-plugin`)
  - `copy-webpack-plugin`
  - `@angular-devkit/build-angular`
  - `@storybook/angular`
- `npm audit fix` does not provide a safe in-place fix for the current stack. The suggested
  downgrade path (`@storybook/angular@5.1.11`) is not acceptable for this repo.
- Previously removed audit surface:
  - `@compodoc/compodoc` was removed from devDependencies.

Current risk posture:

- Runtime app code does not import or execute this vulnerable path directly.
- Exposure is limited to build/dev toolchain usage.
- Treat as release gate for infra/toolchain hardening, not as a blocker for app-runtime fixes.

Planned remediation options (in order):

1. Upgrade to upstream Angular/Storybook versions that lift `copy-webpack-plugin`/`serialize-javascript`.
2. Isolate Storybook build in a separate workspace/toolchain so production app build path is minimal.
3. If needed, replace Storybook Angular builder path with a controlled alternative where dependency tree is auditable.

## 2. Auth and Session Hardening

Implemented in this pass:

- Cognito session persistence now defaults to `sessionStorage` (reduced XSS blast radius).
- `localStorage` persistence remains explicit opt-in via config.
- Added unit tests to lock behavior.

## 3. Signup Guardrail

Defense-in-depth remains in place:

- Signup flow is capability-gated in auth service.
- Direct Cognito service signup path is also hard-guarded by capability.

## 4. Logout Correctness

- Full external logout path remains enforced via `/logout` and service-level `logoutEverywhere`.
- Existing tests cover forced external logout behavior.

## 5. HTML Rendering Review

- `notes`/`sticky-notes` render user content through Angular `[innerHTML]` bindings without trust bypass.
- No new `bypassSecurityTrustHtml` usage introduced.
- `navigator` uses resource URL sanitizer for iframe target handling and remains feature-flag/deprecation constrained.

## Follow-up Recommendations

1. Keep CSP headers strict in deployment layer and review quarterly.
2. Re-run `npm audit` and release gates on every dependency bump PR.
3. Add periodic manual abuse tests for auth flows and share-link boundaries.
