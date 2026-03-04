# LLM Spec Delta Validation (2026-03-04)

This document validates `Ledger/llm-spec.md` against the current branch implementation and records stricter security choices.

## Baseline Result

Current implementation path is aligned with the spec and hardened beyond it in secret handling, mode guards, idempotency, policy control, and admin operations.

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
- Provider registry + mock adapter + orchestrator execution guardrails/tests
- Resident admin facade for policy/resident/lease operations and tests
- Pencil lease TTL/revoke primitives and tests
- Settings UI wiring:
  - `Settings > Credentials` for credential refs + session secret assignment
  - `Settings > Multi-user` for policy, resident roster, lease controls, and action log viewer
- Focused component tests for multi-user LLM admin flows

## Remaining Work (Planned)

- Live provider adapters beyond mock (OpenAI/Anthropic/Ollama production adapters).
- Propose/approve/execute UX wired into universe chat/action cards.
- End-to-end permission and spotty-network flows for resident orchestration.
- Optional server-held secret broker path (beta) with stricter server-side controls.

## Security Caveat

Session storage is safer than cloud persistence but still client-exposed (XSS risk). Maintain CSP hardening and avoid any trust-bypass HTML paths.
