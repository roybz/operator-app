# Public-Ready Pre-v1 Release Checklist

## Critical Scenarios Matrix

Use `Docs/qa-matrix.md` as the execution sheet and evidence log for these scenarios.

1. Same user, two devices:
   - edit same instance from desktop + mobile
   - verify convergence without data loss
2. Multi-user roles:
   - owner/admin/editor/observer/share-viewer permissions
   - verify read-only enforcement for observer/share-viewer
3. Share-link access:
   - non-owner access cannot mutate universe data
4. Offline/reconnect:
   - edits buffered offline, flushed in order on reconnect
   - no reconnect storm loops
5. Guest/test-mode guarantees:
   - guest mode never writes remote data
   - admin test mode forces local-only behavior
6. Logout correctness:
   - logout route and UI logout both clear external auth session
   - sign-in requires credentials with configured prompt behavior

## Required Gate Commands

Run from `frontend/`:

```bash
npm run test:release-gates
npm run test:e2e
```

## UI-impacting PR Command Sequence

For PRs that change templates, styles, shared components, Storybook fixtures, or visual behavior:

```bash
npm run lint
npm run test:unit -- --watch=false
npm run build
npm run build-storybook
npm run test:visual
npm run test:e2e
```

If the UI change is intentional and affects approved snapshots:

```bash
npm run test:visual -- --update-snapshots
```

## Pre-Deploy Config Verification

Check `frontend/src/assets/op-config.js`:

- `guestModeOnly` expected value
- `publicSignupPrepared: true`
- `publicSignupEnabled: false`
- `storageMode` and API URLs correct
- realtime URL correct
- quota defaults set
- navigator disabled unless explicitly required

## AWS Verification

1. API Gateway stage health and throttling.
2. Lambda error rate and recent logs.
3. DynamoDB PITR status and throughput health.
4. WebSocket `$connect` success baseline.
5. CloudWatch alarms active for storage/realtime incident classes.

## Load/Backpressure Verification

Run `docs/realtime-load-profile.md` and attach evidence for pass criteria before sign-off.

## Release Sign-off

- [ ] All critical scenarios passed
- [ ] All gates green
- [ ] Storybook build green (`npm run build-storybook`)
- [ ] Storybook visual baseline green (`npm run test:visual`)
- [ ] No unresolved P0/P1 sync/auth regressions
- [ ] Rollback commit identified
- [ ] Release notes prepared
