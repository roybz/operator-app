# Realtime/API Load Profile and Backpressure Guardrails

This document defines the C6 hardening baseline for pre-v1 public readiness.

## Scope

- UI drag/edit bursts across app instances
- API `429` throttling behavior
- WebSocket degradation and polling fallback
- Event outbox durability under conflict/throttle pressure

## Runtime Guardrails

## Client Retry Ceilings

- Instance persist queue:
  - `baseBackoffMs`: `200`
  - `maxBackoffMs`: `2000`
  - Uses `Retry-After` when present and clamps to max.
- Remote apply pipeline:
  - Retries throttled applies with capped exponential backoff.
- Realtime reconnect:
  - Base/max/exponent/storm-guard thresholds are runtime-configurable in `op-config`.
  - Storm guard transitions to degraded behavior instead of tight reconnect loops.

## Degraded Mode Contract

- If WebSocket cannot connect:
  - App remains usable via polling fallback.
  - Local edits remain buffered and are flushed in order when connectivity returns.
- Buffered-write failures:
  - Logged as structured events.
  - No hot-loop retry amplification.

## Outbox and Conflict Handling

- Durable domain events are queued and persisted through `EventOutboxService`.
- Version conflicts reconcile local+remote snapshots and retry once through queue flow.
- Queue normalization bounds outbox size to avoid unbounded growth.

## Load Test Profile (Manual + Observable)

Run while collecting browser console + CloudWatch logs:

1. Open same universe on desktop + mobile.
2. For 3 minutes:
   - continuously drag dialogs
   - edit sticky/todo/notes rapidly
   - switch workspaces periodically
3. Toggle network offline for 30 seconds, then restore.
4. Repeat while a second signed-in session edits overlapping instances.

## Pass Criteria

- No sustained 409/429 amplification loops.
- No UI freeze during drag/edit bursts.
- Buffered edits survive offline window and converge after reconnect.
- Realtime connectivity settles to `connected` or `degraded-polling`, never infinite connect thrash.
- No data loss in todo/kanban/sticky/notes merge paths.

## Incident Signals to Watch

- `realtime.reconnect_storm_guard`
- `realtime.buffered_write_queued`
- `realtime.buffered_write_flush_failed`
- `remote.apply.flush_error`
- `EventOutboxConflictReconciled`

If any signal trends upward continuously for >5 minutes under normal usage, treat as release blocker.
