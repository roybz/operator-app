Status: Foundational engineering principles
Version: 0.1

---

# Operator Architecture Principles

This document translates the Operator Cognitive Primitives into
engineering rules that guide system architecture and feature design.

Operator is not a typical productivity application.

It is designed as a **cognitive environment** whose primary goal is to
strengthen the signal relationship between human thought and accessible knowledge.

To maintain coherence as the system evolves, the following principles
must guide all development.

---

# 1. Structural Stability First

Operator prioritizes **state stability over feature velocity**.

All persistent state must follow the system’s persistence discipline.

Rules:

- All writes must go through `InstancePersistQueue`.
- No feature may bypass persistence safeguards.
- State conflicts must always resolve deterministically.
- Remote invalidations must never corrupt local working state.

These rules prevent cognitive environments from becoming unreliable.

Unreliable state destroys cognitive momentum.

---

# 2. Visual Environments Over Hidden State

Operator favors **spatial visibility over hierarchical navigation**.

Knowledge should remain visible in the workspace rather than hidden behind
menus, tabs, or nested navigation.

Rules:

- Information should remain spatially accessible when possible.
- UI components should avoid deep navigation chains.
- Workspace layout should persist across sessions.

The system should behave more like a **physical desk** than a file explorer.

---

# 3. Retrieval Latency Must Be Minimized

Operator aims to reduce the delay between:
`thought → information → action`

Rules:

- Navigation depth must remain shallow.
- Frequently accessed information should remain locally available.
- UI actions should respond immediately whenever possible.

If a feature increases retrieval latency, it must provide strong value.

---

# 4. Cross-Instance Coordination Must Use Events

Instances must not manipulate each other’s state directly.

Cross-instance coordination must occur through **events**.

Rules:

- Instances communicate through the Universe Event Hub.
- Instances respond to events rather than importing state directly.
- Direct coupling between instances should be avoided.

This preserves modularity and prevents architecture decay.

---

# 5. Durable State Changes Must Be Idempotent

All durable domain events must be safe to apply multiple times.

Rules:

- Durable events must produce the same result when replayed.
- Conflict resolution must not introduce non-deterministic state.
- Event handlers must tolerate duplicate deliveries.

This enables reliable synchronization across devices and users.

---

# 6. Feedback Must Be Immediate and Visible

Users must understand the system’s state.

Operator therefore prioritizes strong feedback loops.

Rules:

- User actions must produce visible responses.
- Persistence activity should provide subtle feedback signals.
- System state changes should be observable when relevant.

Clear feedback stabilizes user interaction patterns.

---

# 7. Cognitive Momentum Must Be Preserved

Operator must avoid interrupting thought.

Rules:

- Avoid forcing context switches.
- Avoid unnecessary dialog interruptions.
- Preserve workspace state whenever possible.

The workspace should support **continuous thinking**.

---

# 8. Features Must Strengthen Cognitive Primitives

Every feature must reinforce at least one cognitive primitive:

- Salience
- Visual Permanence
- Retrieval Latency
- Context Bandwidth
- Structural Coherence
- Feedback Loops
- Cognitive Momentum
- Collective Intelligence

If a feature does not strengthen these properties, it likely increases
informational entropy and should be reconsidered.

---

# 9. Multi-Agent Environments Are a First-Class Future Goal

Operator is designed to eventually support collaborative cognition.

Future environments may include:

- multiple human users
- AI agents
- shared workspaces
- collaborative knowledge structures

Architectural decisions should avoid blocking this evolution.

---

# 10. Architecture Must Resist Entropy

All systems tend toward disorder as they grow.

Operator intentionally resists this tendency through:

- strong primitives
- disciplined persistence
- event-based coordination
- spatial cognitive environments

Maintaining this discipline ensures that Operator remains a coherent
cognitive system rather than degrading into a collection of disconnected tools.

---
