# Backend Setup (Provider-Agnostic)

This guide describes the Operator App backend contract so you can use AWS (current setup) or a different backend provider later.

## Goal

Enable authenticated cloud persistence while preserving:

- existing frontend UI/state model
- `StorageAdapter` abstraction
- local guest mode (`localStorage`)
- easy future enablement of public sign-up

## Frontend Integration Points

Key files:

- `frontend/src/app/core/storage/storage-adapter.ts`
- `frontend/src/app/core/storage/remote-storage.adapter.ts`
- `frontend/src/app/core/storage/storage.service.ts`
- `frontend/src/app/core/auth/cognito-oidc.service.ts`
- `frontend/src/app/core/op-config.ts`
- `frontend/src/assets/op-config.js`

Behavior:

- Guest/no-token path uses local storage.
- Authenticated path uses remote storage with `Authorization: Bearer <JWT>`.
- Authenticated requests also send correlation headers:
  - `X-Operator-Request-Id`
  - `X-Operator-Session-Id`
- App hydrates asynchronously at startup using existing `APP_INITIALIZER`.
- Realtime invalidation is WebSocket-first with polling fallback (optional but recommended).

## Required Backend Responsibilities

Any backend provider must implement a durable, user-scoped key/value API:

1. Authenticate requests and validate bearer tokens.
2. Derive the user identity from the token (never trust user ID in request body).
3. Scope all data access to that authenticated user.
4. Store opaque values (the backend does not parse app-specific JSON).
5. Return structured JSON responses matching the frontend adapter contract.

## HTTP Contract

Base path: `/storage`

### `GET /storage/keys`

Returns:

```json
{ "keys": ["key1", "key2"] }
```

### `GET /storage/item?key=...`

Returns:

```json
{
  "value": "...",
  "version": 3,
  "updatedAt": 1730000000000
}
```

`404` is acceptable for not-found.

### `PUT /storage/item`

Body:

```json
{
  "key": "logical-key",
  "value": "...",
  "version": 3
}
```

Returns:

```json
{
  "version": 4,
  "updatedAt": 1730000000000
}
```

Conflict behavior:

- Return `409` on version mismatch (optimistic concurrency).

### `DELETE /storage/item?key=...`

Deletes item; can return `{ "ok": true }`.

### `POST /storage/batchGet` (recommended)

Body:

```json
{ "keys": ["a", "b", "c"] }
```

Returns:

```json
{
  "items": {
    "a": { "value": "...", "version": 1, "updatedAt": 1730000000000 }
  }
}
```

This prevents slow startup hydration when many keys exist.

## Auth Path Strategy

Recommended long-term shape:

- Single authenticated path: external identity provider (Cognito today)
- Separate guest path: local-only

Why this works:

- Public sign-up can be enabled later in the identity provider with minimal app changes.
- Guest mode stays simple and private to the local browser.

## Runtime Config Pattern

Use `frontend/src/assets/op-config.js` to select backend/auth provider:

- `storageMode`: `'local' | 'remote'`
- `authProvider`: `'local' | 'cognito'` (can be extended)
- `storageApiBaseUrl`
- provider-specific auth config
- `realtimeEnabled`
- `realtimeWebSocketUrl`

For another provider:

1. Add a new auth service/provider implementation.
2. Keep the same remote storage HTTP contract if possible.
3. If contract differs, adapt only `RemoteStorageAdapter`.

## Minimum Production Readiness Checklist

- Authentication enabled for all remote storage routes
- CORS restricted to frontend origin(s)
- Request logging (without sensitive payload logging)
- Correlation ID propagation (`request id` + `session id`) through API/Lambda logs
- Rate limiting / throttling
- Durable data store backups / PITR equivalent
- Separate IAM/service account credentials (not root)
- Domain callback/logout URLs kept in sync with auth provider config
- Explicit logout route/provider logout behavior (avoid local-only logout with external auth)
- Realtime connect failures degrade gracefully (polling fallback or similar)

## Frontend Sync Hardening Pattern (Current App)

The frontend now uses a shared instance-scoped persist queue helper to reduce conflict/throttle thrash:

- debounce/coalesce writes
- serialize in-flight persistence
- back off on `429 Too Many Requests`
- hook app-specific handling for `409 version_conflict`

Reference:

- `frontend/src/app/core/realtime/instance-persist-queue.ts`
