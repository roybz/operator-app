window.__OP_CONFIG__ = {
  apiBaseUrl: '',
  storageMode: 'local', // 'local' | 'remote'
  storageApiBaseUrl: '',
  realtimeEnabled: false,
  realtimeWsUrl: '',
  realtimeReconnectBaseDelayMs: 2000,
  realtimeReconnectMaxDelayMs: 60000,
  realtimeReconnectExponentCap: 4,
  realtimeReconnectStormWindowMs: 60000,
  realtimeReconnectStormThreshold: 8,
  realtimeReconnectStormDelayMs: 60000,
  mockMode: true,
  guestModeOnly: true,
  debugPerf: false,
  cloudVaultAttachmentUploadBetaEnabled: false,
  cloudVaultAttachmentUploadMaxTotalBytes: 1572864, // 1.5 MB beta cap
  cloudVaultAttachmentUploadMaxAssetBytes: 393216, // 384 KB per attachment beta cap
  quotaStorageBytes: 25165824, // 24 MB total storage budget
  quotaRequestsPerMinute: 240,
  quotaRealtimeChannels: 6,
  quotaVaultTotalBytes: 6291456, // 6 MB per vault budget
  quotaVaultAttachmentTotalBytes: 1572864,
  quotaVaultAttachmentAssetBytes: 393216,
  authProvider: 'local', // 'local' | 'cognito'
  publicSignupPrepared: true, // signup flow plumbing can exist
  publicSignupEnabled: false, // keep disabled until pricing/onboarding is ready
  navigatorEnabled: false, // deprecated by default (can be re-enabled for local testing)
  navigatorAllowedOrigins: [],
  llmSecretBrokerEnabled: false,
  llmSecretBrokerBaseUrl: '',
  llmSecretBrokerTimeoutMs: 12000,
  capabilities: {
    auth: true,
    realtime: false,
    cloudVault: false,
    billingGuard: true,
    shareLinks: true,
    navigatorApp: false,
    publicSignupPrepared: true,
    publicSignupEnabled: false,
    llmSecretBroker: false,
  },
  cognito: {
    enabled: false,
    domain: '',
    clientId: '',
    redirectUri: 'https://plannerdemo.roy.bz/login',
    logoutRedirectUri: 'https://plannerdemo.roy.bz/login',
    scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
  },
};
