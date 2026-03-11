export type ContextFocusMode = 'edit' | 'inspect' | 'search' | 'present';

export type ContextSelectionIntent = 'link' | 'move' | 'tag' | 'compare' | 'inspect';

export type ContextRelationType = 'references' | 'blocks' | 'supports' | 'duplicate' | 'related';

export type ContextGoalStage = 'collect' | 'organize' | 'decide' | 'execute';

export interface ObjectRef {
  universeId: string;
  instanceId?: string;
  kind: string;
  id: string;
  title?: string;
  content?: string;
}

export interface FocusField {
  activeInstanceId: string | null;
  activeObjectRef?: ObjectRef | null;
  focusMode: ContextFocusMode;
}

export interface SelectionField {
  primaryRef: ObjectRef | null;
  selectedRefs: ObjectRef[];
  selectionIntent: ContextSelectionIntent;
}

export interface TopicField {
  topicTokens: string[];
  tags: string[];
  source: 'user' | 'ai';
  confidence?: number;
}

export interface LinkField {
  primaryRef: ObjectRef;
  relatedRefs: ObjectRef[];
  relationType: ContextRelationType;
}

export interface GoalField {
  goalId: string;
  goalLabel: string;
  stage: ContextGoalStage;
}

export interface ContextUniverseState {
  focus: FocusField | null;
  selection: SelectionField | null;
  topic: TopicField | null;
  goal: GoalField | null;
  latestLinkSuggestion: LinkField | null;
}
