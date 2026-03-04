export type LlmProvider = 'openai' | 'anthropic' | 'ollama' | 'custom';
export type LlmResidentRole = 'observer' | 'editor';
export type LlmCredentialMode = 'clientHeld' | 'serverHeld';
export type LlmCredentialStatus = 'unverified' | 'verified' | 'revoked';
export type LlmAllowedActionType =
  | 'chat.post'
  | 'comment.create'
  | 'instance.create'
  | 'instance.write'
  | 'dialog.move'
  | 'dialog.resize';

// Persisted credential reference metadata. Secret material is never persisted in this record.
export interface LlmCredentialRef {
  id: string;
  userId: string;
  alias: string;
  provider: LlmProvider;
  mode: LlmCredentialMode;
  status: LlmCredentialStatus;
  model?: string;
  lastValidatedAt?: number;
  metadata?: { region?: string; baseUrl?: string };
  createdAt: number;
  updatedAt: number;
}

// Runtime-only secret material for Tier 1 client-held credentials.
export interface LlmSecretMaterial {
  credentialRefId: string;
  secret: string;
  source: 'memory' | 'session';
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
  id: string; // legacy convenience ID; same value as requestId where possible
  requestId: string;
  correlationId?: string;
  residentId: string;
  universeOwnerId: string;
  universeId: string;
  actionType: LlmAllowedActionType;
  payload: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  createdAt: number;
}

export interface LlmContext {
  universeOwnerId: string;
  universeId: string;
}

export interface LlmProviderRequest {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmProviderResponse {
  text: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export interface LlmProviderAdapter {
  readonly name: LlmProvider;
  readonly supportsClientHeld: boolean;
  validateCredential(secret: string): Promise<{ ok: boolean; message?: string }>;
  complete(request: LlmProviderRequest, secret: string): Promise<LlmProviderResponse>;
}

export const DEFAULT_LLM_POLICY: LlmPolicy = {
  enabled: false,
  requireActionConfirmation: true,
  maxActionsPerMinute: 20,
  maxTokensPerMinute: 12000,
  allowDestructiveActions: false,
};
