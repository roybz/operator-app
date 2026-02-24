export interface OpCognitoConfig {
  enabled?: boolean;
  domain?: string;
  clientId?: string;
  redirectUri?: string;
  logoutRedirectUri?: string;
  scopes?: string[];
}

export interface OpRuntimeConfig {
  apiBaseUrl?: string;
  storageMode?: 'local' | 'remote';
  storageApiBaseUrl?: string;
  realtimeEnabled?: boolean;
  realtimeWsUrl?: string;
  mockMode?: boolean;
  guestModeOnly?: boolean;
  debugPerf?: boolean;
  cloudVaultAttachmentUploadBetaEnabled?: boolean;
  cloudVaultAttachmentUploadMaxTotalBytes?: number;
  cloudVaultAttachmentUploadMaxAssetBytes?: number;
  authProvider?: 'local' | 'cognito';
  cognito?: OpCognitoConfig;
}

export function getOpConfig(): OpRuntimeConfig {
  if (typeof window === 'undefined') return {};
  const config = (window as Window & { __OP_CONFIG__?: OpRuntimeConfig }).__OP_CONFIG__;
  return config ?? {};
}
