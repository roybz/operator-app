export type LlmProvider = 'openai' | 'anthropic' | 'ollama' | 'custom';
export type LlmResidentRole = 'observer' | 'editor';

export interface LlmCredentialRecord {
  id: string;
  label: string;
  provider: LlmProvider;
  model?: string;
  encryptedSecret: string;
  createdAt: number;
  updatedAt: number;
}

export interface LlmResidentPermissions {
  canWrite: boolean;
  canMoveDialogs: boolean;
  canCreateInstances: boolean;
  canComment: boolean;
}

export interface LlmResident {
  id: string;
  universeOwnerId: string;
  universeId: string;
  name: string;
  provider: LlmProvider;
  model: string;
  role: LlmResidentRole;
  active: boolean;
  permissions: LlmResidentPermissions;
  createdAt: number;
  updatedAt: number;
}

export interface LlmPolicy {
  enabled: boolean;
  requireActionConfirmation: boolean;
  maxActionsPerMinute: number;
  maxTokensPerMinute: number;
  allowDestructiveActions: boolean;
}

export interface LlmActionEnvelope {
  id: string;
  residentId: string;
  universeOwnerId: string;
  universeId: string;
  actionType:
    | 'create_instance'
    | 'update_content'
    | 'move_dialog'
    | 'resize_dialog'
    | 'chat_message';
  payload: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  createdAt: number;
}

export interface LlmContext {
  universeOwnerId: string;
  universeId: string;
}

export const DEFAULT_LLM_POLICY: LlmPolicy = {
  enabled: false,
  requireActionConfirmation: true,
  maxActionsPerMinute: 20,
  maxTokensPerMinute: 12000,
  allowDestructiveActions: false,
};
