export interface OpCognitoConfig {
  enabled?: boolean;
  domain?: string;
  clientId?: string;
  redirectUri?: string;
  logoutRedirectUri?: string;
  scopes?: string[];
  sessionPersistence?: 'localStorage' | 'sessionStorage';
}

export interface OpCapabilityConfig {
  auth?: boolean;
  realtime?: boolean;
  cloudVault?: boolean;
  billingGuard?: boolean;
  shareLinks?: boolean;
  navigatorApp?: boolean;
  publicSignupPrepared?: boolean;
  publicSignupEnabled?: boolean;
  llmSecretBroker?: boolean;
}

export interface OpRuntimeConfig {
  apiBaseUrl?: string;
  storageMode?: 'local' | 'remote';
  storageApiBaseUrl?: string;
  realtimeEnabled?: boolean;
  realtimeWsUrl?: string;
  realtimeReconnectBaseDelayMs?: number;
  realtimeReconnectMaxDelayMs?: number;
  realtimeReconnectExponentCap?: number;
  realtimeReconnectStormWindowMs?: number;
  realtimeReconnectStormThreshold?: number;
  realtimeReconnectStormDelayMs?: number;
  mockMode?: boolean;
  guestModeOnly?: boolean;
  debugPerf?: boolean;
  cloudVaultAttachmentUploadBetaEnabled?: boolean;
  cloudVaultAttachmentUploadMaxTotalBytes?: number;
  cloudVaultAttachmentUploadMaxAssetBytes?: number;
  quotaStorageBytes?: number;
  quotaRequestsPerMinute?: number;
  quotaRealtimeChannels?: number;
  quotaVaultTotalBytes?: number;
  quotaVaultAttachmentTotalBytes?: number;
  quotaVaultAttachmentAssetBytes?: number;
  authProvider?: 'local' | 'cognito';
  publicSignupPrepared?: boolean;
  publicSignupEnabled?: boolean;
  navigatorEnabled?: boolean;
  navigatorAllowedOrigins?: string[];
  llmSecretBrokerEnabled?: boolean;
  llmSecretBrokerBaseUrl?: string;
  llmSecretBrokerTimeoutMs?: number;
  capabilities?: OpCapabilityConfig;
  cognito?: OpCognitoConfig;
}

export interface OpRuntimeCapabilities {
  auth: boolean;
  realtime: boolean;
  cloudVault: boolean;
  billingGuard: boolean;
  shareLinks: boolean;
  navigatorApp: boolean;
  publicSignupPrepared: boolean;
  publicSignupEnabled: boolean;
  llmSecretBroker: boolean;
}

export function getOpConfig(): OpRuntimeConfig {
  if (typeof window === 'undefined') return {};
  const config = (window as Window & { __OP_CONFIG__?: OpRuntimeConfig }).__OP_CONFIG__;
  return config ?? {};
}

export function getOpCapabilities(config = getOpConfig()): OpRuntimeCapabilities {
  const capabilities = config.capabilities ?? {};
  const authProvider = config.authProvider ?? 'local';
  const authDefault = authProvider === 'local' || Boolean(config.cognito?.enabled !== false);
  const publicSignupPrepared = Boolean(
    capabilities.publicSignupPrepared ?? config.publicSignupPrepared,
  );
  const publicSignupEnabled = Boolean(
    capabilities.publicSignupEnabled ?? config.publicSignupEnabled,
  );
  const llmSecretBroker = Boolean(capabilities.llmSecretBroker ?? config.llmSecretBrokerEnabled);

  return {
    auth: Boolean(capabilities.auth ?? authDefault),
    realtime: Boolean(capabilities.realtime ?? config.realtimeEnabled),
    cloudVault: Boolean(capabilities.cloudVault ?? true),
    billingGuard: Boolean(capabilities.billingGuard ?? true),
    shareLinks: Boolean(capabilities.shareLinks ?? true),
    navigatorApp: Boolean(capabilities.navigatorApp ?? config.navigatorEnabled ?? false),
    publicSignupPrepared,
    publicSignupEnabled: publicSignupPrepared && publicSignupEnabled,
    llmSecretBroker,
  };
}
