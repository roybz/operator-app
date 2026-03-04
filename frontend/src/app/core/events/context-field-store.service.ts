import { Injectable, computed, inject, signal } from '@angular/core';
import { OperatorEvent, UniverseEventHubService } from './universe-event-hub.service';
import {
  ContextFocusMode,
  ContextGoalStage,
  ContextRelationType,
  ContextSelectionIntent,
  ContextUniverseState,
  FocusField,
  GoalField,
  LinkField,
  ObjectRef,
  SelectionField,
  TopicField,
} from './context-fields.types';

const emptyUniverseState = (): ContextUniverseState => ({
  focus: null,
  selection: null,
  topic: null,
  goal: null,
  latestLinkSuggestion: null,
});

@Injectable({ providedIn: 'root' })
export class ContextFieldStoreService {
  private readonly eventHub = inject(UniverseEventHubService);
  private readonly state = signal<Record<string, ContextUniverseState>>({});

  readonly snapshot = this.state.asReadonly();

  readonly universes = computed(() => Object.keys(this.state()).sort());

  constructor() {
    this.eventHub.subscribe((event) => this.consumeContextEvent(event), { scope: 'ui' });
  }

  focus(universeId: string) {
    return this.ensureUniverse(universeId).focus;
  }

  selection(universeId: string) {
    return this.ensureUniverse(universeId).selection;
  }

  topic(universeId: string) {
    return this.ensureUniverse(universeId).topic;
  }

  goal(universeId: string) {
    return this.ensureUniverse(universeId).goal;
  }

  setFocus(
    universeId: string,
    value: { activeInstanceId: string | null; activeObjectRef?: ObjectRef | null },
    options?: { mode?: ContextFocusMode; sourceInstanceId?: string },
  ) {
    const focus: FocusField = {
      activeInstanceId: value.activeInstanceId,
      activeObjectRef: value.activeObjectRef ?? null,
      focusMode: options?.mode ?? 'inspect',
    };
    this.patch(universeId, { focus });
    this.eventHub.publish({
      universeId,
      scope: 'ui',
      type: 'context.focus.changed',
      payload: focus,
      source: { instanceId: options?.sourceInstanceId, agent: 'context-field-store' },
      durable: false,
    });
  }

  setSelection(
    universeId: string,
    selectedRefs: ObjectRef[],
    options?: {
      intent?: ContextSelectionIntent;
      sourceInstanceId?: string;
      primaryRef?: ObjectRef | null;
    },
  ) {
    const normalized = selectedRefs.filter((ref) => ref.universeId === universeId);
    const selection: SelectionField = {
      primaryRef: options?.primaryRef ?? normalized[0] ?? null,
      selectedRefs: normalized,
      selectionIntent: options?.intent ?? 'inspect',
    };
    this.patch(universeId, { selection });
    this.eventHub.publish({
      universeId,
      scope: 'ui',
      type: 'context.selection.changed',
      payload: selection,
      source: { instanceId: options?.sourceInstanceId, agent: 'context-field-store' },
      durable: false,
    });
  }

  setTopic(
    universeId: string,
    value: { topicTokens: string[]; tags?: string[]; source?: 'user' | 'ai'; confidence?: number },
    options?: { sourceInstanceId?: string },
  ) {
    const topic: TopicField = {
      topicTokens: value.topicTokens,
      tags: value.tags ?? [],
      source: value.source ?? 'user',
      confidence: value.confidence,
    };
    this.patch(universeId, { topic });
    this.eventHub.publish({
      universeId,
      scope: 'ui',
      type: 'context.topic.changed',
      payload: topic,
      source: { instanceId: options?.sourceInstanceId, agent: 'context-field-store' },
      durable: false,
    });
  }

  setGoal(
    universeId: string,
    value: { goalId: string; goalLabel: string; stage: ContextGoalStage },
    options?: { sourceInstanceId?: string },
  ) {
    const goal: GoalField = {
      goalId: value.goalId,
      goalLabel: value.goalLabel,
      stage: value.stage,
    };
    this.patch(universeId, { goal });
    this.eventHub.publish({
      universeId,
      scope: 'ui',
      type: 'context.goal.changed',
      payload: goal,
      source: { instanceId: options?.sourceInstanceId, agent: 'context-field-store' },
      durable: false,
    });
  }

  suggestLink(
    universeId: string,
    value: { primaryRef: ObjectRef; relatedRefs: ObjectRef[]; relationType?: ContextRelationType },
    options?: { sourceInstanceId?: string },
  ) {
    const links: LinkField = {
      primaryRef: value.primaryRef,
      relatedRefs: value.relatedRefs,
      relationType: value.relationType ?? 'related',
    };
    this.patch(universeId, { latestLinkSuggestion: links });
    this.eventHub.publish({
      universeId,
      scope: 'ui',
      type: 'context.links.suggested',
      payload: links,
      source: { instanceId: options?.sourceInstanceId, agent: 'context-field-store' },
      durable: false,
    });
  }

  private consumeContextEvent(event: OperatorEvent) {
    if (!event.type.startsWith('context.')) return;
    if (event.source?.agent === 'context-field-store') return;
    const universeId = event.universeId;
    if (!universeId) return;
    switch (event.type) {
      case 'context.focus.changed': {
        const payload = event.payload as FocusField;
        this.patch(universeId, { focus: payload ?? null });
        break;
      }
      case 'context.selection.changed': {
        const payload = event.payload as SelectionField;
        this.patch(universeId, { selection: payload ?? null });
        break;
      }
      case 'context.topic.changed': {
        const payload = event.payload as TopicField;
        this.patch(universeId, { topic: payload ?? null });
        break;
      }
      case 'context.goal.changed': {
        const payload = event.payload as GoalField;
        this.patch(universeId, { goal: payload ?? null });
        break;
      }
      case 'context.links.suggested': {
        const payload = event.payload as LinkField;
        this.patch(universeId, { latestLinkSuggestion: payload ?? null });
        break;
      }
      default:
        break;
    }
  }

  private ensureUniverse(universeId: string) {
    const current = this.state();
    if (current[universeId]) return current[universeId];
    const created = { ...current, [universeId]: emptyUniverseState() };
    this.state.set(created);
    return created[universeId];
  }

  private patch(universeId: string, partial: Partial<ContextUniverseState>) {
    const current = this.ensureUniverse(universeId);
    this.state.set({
      ...this.state(),
      [universeId]: {
        ...current,
        ...partial,
      },
    });
  }
}
