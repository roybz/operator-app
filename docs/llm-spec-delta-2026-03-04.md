# LLM Spec Delta Validation (2026-03-04)

This document validates `Ledger/llm-spec.md` against the current branch implementation and records stricter security choices.

## Baseline Result

Current implementation path is aligned with the spec and is being hardened to exceed it in secret handling and mode guards.

## Security Decisions (Stricter Than Source Spec)

1. Credential records are metadata-only.
- Persisted objects never contain raw secret material.
- Secrets are session-scoped runtime values (`sessionStorage` + memory cache) via `LlmCredentialRefService`.

2. Triple mode guard is explicit in code.
- Guard service: `LlmModeGuardService`.
- Policy activation and credential writes require cloud-allowed mode.
- Guest/test/observer paths hard-block cloud LLM.

3. Envelope idempotency guard is explicit.
- `LlmEnvelopeGuardService` deduplicates request IDs per universe with TTL.
- Prevents replay/duplicate side effects under retries and spotty network.

4. Audit entries remain summary-safe.
- `LlmActionLogService` persists bounded append-only logs.
- No secret fields in action envelopes or log record shape.

## Feature Delta

Implemented foundations:
- Resident policy service and tests
- Resident registry service
- Append-only action log service and tests
- Mode guard service and tests
- Credential reference service (metadata persistence + session-only secret material) and tests
- Envelope guard service and tests

## Remaining Work (Planned)

- Provider adapters (OpenAI/Anthropic/Ollama + mock) with no-secret logging policy.
- Orchestrator service for propose/approve/execute flow.
- Pencil lease primitives and TTL/revoke controls.
- Resident management UI + policy matrix + chat action cards.
- E2E coverage for invite/lease/revoke/conflict/spotty network.

## Security Caveat

Session storage is safer than cloud persistence but still client-exposed (XSS risk). Maintain CSP hardening and avoid any trust-bypass HTML paths.
