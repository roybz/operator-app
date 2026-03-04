# Architecture Snapshot 0.0.3

Purpose: freeze the architecture as shipped in `0.0.3` to prevent drift during future feature work.

## 1) System Layers

1. Presentation layer
- Angular standalone components under `frontend/src/app`.
- Primary shell/orchestration in `frontend/src/app/app.ts` and `frontend/src/app/app.component.html`.
- App windows rendered via `DialogComponent`; desktop/phone shells split under `layout/`.

2. Application feature layer
- Default app modules under `frontend/src/app/features/applications/default-applications/`.
- Shared app metadata + registries under `frontend/src/app/features/dependencies/`.
- Settings domain under `frontend/src/app/features/settings/`.

3. Core domain/service layer
- Auth/session + universe policy: `core/auth.service.ts`, `core/authz/`.
- Dialog/workspace state: `core/dialog.service.ts`.
- Persistence abstraction: `core/storage/`.
- Realtime + conflict path: `core/realtime/`.
- LLM resident runtime/policy: `core/llm/`.
- Event/outbox/context fields: `core/events/`.
- Quotas/billing/observability in corresponding `core/*` services.

4. Runtime configuration and policy surface
- App/runtime flags from `frontend/src/app/core/op-config.ts` and `frontend/src/assets/op-config.js`.
- Capabilities (signup, realtime, billing, etc.) are config-driven.

5. External infrastructure boundary
- Cognito OIDC auth for external sessions.
- REST storage API + optional realtime WebSocket backend.
- Client remains functional in local-only mode when remote capabilities are unavailable or blocked.

## 2) State Model

1. Shell state
- Managed in `AppComponent` signals: viewport/canvas, overlays, universe bar/chat, prompt visibility, mode flags.

2. Auth/session state
- Centralized in `AuthService` with explicit user/session/org settings/preferences signals.
- Session role and active universe determine effective permissions.

3. Dialog + workspace state
- Canonical dialog/workspace structures live in `DialogService`.
- App instances keyed by `instanceId`, grouped by app type and workspace.

4. App instance state
- Persisted per instance through `StorageService` using deterministic key patterns.
- Shared helper discipline via `features/dependencies/instance-state-storage.ts`.

5. Draft vs applied settings state
- Changes staged in `SettingsDraftService`; applied explicitly, not implicitly.

## 3) Realtime Model

1. Connectivity model
- WebSocket-first invalidation via `RealtimeSyncService`.
- Polling fallback retained for degraded states.
- Buffered writes + reconnect backoff + storm guard implemented.

2. State machine (client)
- Connectivity states: `idle`, `connected`, `degraded-polling`, `offline-buffering`, `reconciling`.
- Transition logic is explicit in realtime service and shell effects.

3. Event propagation
- Remote events produce invalidation signals.
- Shell invokes targeted hydration/refresh paths rather than blind full reload where possible.

4. Guest/test-mode behavior
- Guest and test/local-only paths are excluded from remote sync startup.
- Local-only operation remains first-class and not a degraded error mode.

## 4) Agent Orchestration

1. Resident runtime surface
- LLM orchestration in `core/llm/llm-orchestrator.service.ts`.
- Provider registry abstraction in `core/llm/llm-provider-registry.service.ts`.
- Provider adapters include mock + live adapters (OpenAI/Anthropic/Ollama path support).

2. Policy and guardrails
- `llm-policy.service.ts` and mode guards enforce eligibility (role/mode/config).
- Guests/test-mode/observer restrictions are enforced before execution.

3. Action workflow
- Proposal/approval/execution card flow through `llm-action-card.service.ts`.
- Action log/audit trail and envelope/idempotency guards exist for deterministic replay safety.

4. Lease/authority coordination
- Pencil lease and revoke primitives in `llm-pencil-lease.service.ts` and resident admin facade.

5. Secret handling modes
- Local credential references are guarded and redaction-aware.
- Optional server-held broker path (beta) via `llm-secret-broker.service.ts`.

## 5) Conflict Resolution Rules

1. Baseline rule
- Do not blindly overwrite newer remote state.
- Use optimistic concurrency (`409`/version conflict aware) and reconcile where defined.

2. Key-space strategy
- Conflict strategy matrix in `core/realtime/key-space-conflict-strategy.ts`.
- System/shell keys and app keys do not share identical merge behavior.

3. Pipeline discipline
- Remote apply through `RemoteApplyPipeline`; not ad-hoc scattered writes.
- Dirty overlap + recent local write checks gate auto-apply.
- Deferred apply banner is used for non-safe immediate merges.

4. App-specific merge paths
- Todo/Kanban/Sticky/Notes/Calendar/DataTable and others have targeted reconciliation logic.
- Rich-text/notes paths use collaboration-aware merge adapters where available.

5. Backpressure discipline
- `429` handling honors retry metadata and shared queue semantics (`InstancePersistQueue`).

## 6) Persistence Discipline

1. Single persistence interface
- All reads/writes flow through `StorageService` + `StorageAdapter`.
- Adapter selection is config-driven (`local` vs `remote`).

2. Local-first guarantees
- Guests are always local-only.
- Admin test mode enforces local fallback even if backend is configured.

3. Keying and migration discipline
- Deterministic key naming; app instance helpers centralized.
- Storage migration scaffolding exists and is version-aware.

4. Write path discipline
- No hot-loop direct write spam from UI primitives.
- Shared queue/debounce/retry used for instance-scoped mutation persistence.

5. Data durability boundaries
- IndexedDB used for vault-scale imports where localStorage is insufficient.
- localStorage remains for lightweight shell/session/config state where appropriate.

## 7) Auth / Permissions Model

1. Identity sources
- Local auth path for local/demo operation.
- External OIDC path (Cognito) for remote authenticated sessions.

2. Effective role model
- Owner/admin, user/editor, observer/invitee/guest semantics enforced by universe role policy.
- Permission checks centralized in authz policy helpers rather than duplicated UI-only checks.

3. Universe-level controls
- Invite/presence/pencil-holder concepts maintained in universe state.
- Owner can grant/revoke active edit authority.

4. Logout correctness
- External auth logout must execute full external provider logout path.
- `/logout` route and button flows align to avoid silent immediate re-login.

5. Public signup gating
- Public sign-up can be prepared in config but disabled by default.
- Direct signup path blocked when capability flag is disabled.

## Snapshot Guardrails

Any PR changing these architecture boundaries should:

1. Update this snapshot file explicitly.
2. Add/adjust focused unit tests near changed boundaries.
3. Include migration notes if state shape, key strategy, or policy semantics change.
