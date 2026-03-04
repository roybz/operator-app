# Observability Runbook (Pre-Launch)

## Scope

This runbook covers the storage/realtime collaboration path used by Operator App:

- frontend remote storage adapter
- API Gateway + Lambda storage API
- DynamoDB persistence
- WebSocket invalidation + polling fallback

## Correlation IDs

Client requests include:

- `X-Operator-Request-Id`
- `X-Operator-Session-Id`

Use these IDs in API Gateway/Lambda logs to trace a single UI action across retries/conflicts.

## Event Taxonomy

Client observability emits the following event families:

- Realtime lifecycle:
  - `realtime.connecting`
  - `realtime.connected`
  - `realtime.closed`
  - `realtime.reconnect_scheduled`
  - `realtime.buffered_write_queued`
  - `realtime.buffered_write_flush_completed`
- Conflict/deferred apply:
  - `remote_conflict.queued`
  - `remote_conflict.deferred`
  - `remote_conflict.applied`
- Storage failure classes:
  - `version_conflict` (`409`)
  - `too_many_requests` (`429`)
  - `quota_request_rate_exceeded` (client-side guard)

## Alert Conditions

Set CloudWatch alarms for:

1. Lambda `5XX` error count > 0 for 5 minutes.
2. API Gateway `4XX` where `status=429` > baseline threshold for 5 minutes.
3. Realtime `$connect` failures > baseline threshold for 5 minutes.
4. Storage `409` conflict spikes sustained above baseline for 15 minutes.

## Triage Flow

1. Confirm current frontend build and runtime config (`op-config.js`).
2. Inspect browser logs for request/session IDs and repeated failure class.
3. Query API Gateway access logs by request ID and status class.
4. Query Lambda logs for matching request ID/session ID and error code.
5. Check DynamoDB throttling/latency and API stage throttling configuration.
6. Validate fallback behavior:
   - WebSocket failure should degrade to polling.
   - Failed writes should queue/retry with backoff.

## Standard Mitigations

- Conflict storm (`409`):
  - verify key-space strategy classification
  - ensure clients are not in self-echo loop
  - increase merge/rebase retry delay only if needed
- Throttle storm (`429`):
  - raise API stage rate/burst cautiously
  - reduce client write burst (persist queue delays)
  - keep rate-limit guard enabled
- Realtime outage:
  - confirm polling fallback active
  - investigate `$connect` auth/token validation path

## Rollback Safety

If a deployment regresses sync stability:

1. Revert latest sync/adapter commit.
2. Keep API online and fallback polling enabled.
3. Verify guest/local mode remains fully usable.
