# Compliance Prep (Pre-v1)

## Objective

Define implementation-linked compliance artifacts for pre-launch readiness while signup remains disabled by config.

## Data Classification

### Class A: Authentication/Identity

- Cognito subject/user identifiers
- username/email (when external auth is used)
- session role context

### Class B: User Content

- app instance state (todos, notes, kanban, sticky notes, etc.)
- universe metadata
- invitee metadata

### Class C: Operational Telemetry

- client observability events
- request/session correlation IDs
- API/Lambda runtime logs

## Storage and Processing

- Guest and test mode:
  - local-only, no remote writes
- Authenticated cloud mode:
  - remote storage through API Gateway/Lambda/DynamoDB
- Vault import payloads:
  - local IndexedDB by default
  - cloud sync only under explicit beta + entitlement/quota gates

## Retention and Deletion

- Product data retention:
  - retained until user/admin deletion or account deletion
- Operational logs:
  - managed by CloudWatch retention policies
- Deletion behavior:
  - account deletion removes user record and user-scoped app data keys
  - invitee removal revokes access path

## Access Control Model

- owner/admin/editor/observer/share-viewer policy centralized in `universe-role-policy`
- observer/share-viewer are read-only
- backend scopes data by authenticated token subject

## Security Controls (Current)

- JWT-protected storage APIs
- optimistic concurrency with conflict handling
- throttling and backoff for write pressure
- CSP includes restrictive `frame-src` defaults
- full external logout path for Cognito

## Gaps to Track

- formal DPA/privacy counsel review
- documented incident response SLA
- automated policy conformance checks in CI

## Evidence Mapping

- Auth and policy logic: `frontend/src/app/core/auth.service.ts`, `frontend/src/app/core/authz/universe-role-policy.ts`
- Remote API access path: `frontend/src/app/core/storage/remote-storage.adapter.ts`
- Realtime reliability path: `frontend/src/app/core/realtime/realtime-sync.service.ts`
- Cloud vault beta guards: `frontend/src/app/core/obsidian/vault-db.ts`, `frontend/src/app/core/billing/entitlement.service.ts`
