window.__OP_CONFIG__ = {
  apiBaseUrl: 'https://4j8meghx2i.execute-api.us-east-1.amazonaws.com',
  storageMode: 'remote', // 'local' | 'remote'
  storageApiBaseUrl: 'https://4j8meghx2i.execute-api.us-east-1.amazonaws.com',
  realtimeEnabled: true,
  realtimeWsUrl: 'wss://kor4dh9vtl.execute-api.us-east-1.amazonaws.com/prod',
  realtimeReconnectBaseDelayMs: 2000,
  realtimeReconnectMaxDelayMs: 60000,
  realtimeReconnectExponentCap: 4,
  realtimeReconnectStormWindowMs: 60000,
  realtimeReconnectStormThreshold: 8,
  realtimeReconnectStormDelayMs: 60000,
  mockMode: true,
  guestModeOnly: false,
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
  authProvider: 'cognito', // 'local' | 'cognito'
  publicSignupPrepared: true, // signup flow plumbing can exist
  publicSignupEnabled: false, // keep disabled until pricing/onboarding is ready
  navigatorEnabled: false, // deprecated by default (can be re-enabled for local testing)
  navigatorAllowedOrigins: [],
  capabilities: {
    auth: true,
    realtime: true,
    cloudVault: true,
    billingGuard: true,
    shareLinks: true,
    navigatorApp: false,
    publicSignupPrepared: true,
    publicSignupEnabled: false,
  },
  cognito: {
    enabled: true,
    domain: 'https://operator-app-roy-2026.auth.us-east-1.amazoncognito.com',
    clientId: '32bfn92gkldr6bhed85hjkfrgb',
    redirectUri: 'https://plannerdemo.roy.bz/login',
    logoutRedirectUri: 'https://plannerdemo.roy.bz/login',
    scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
  },
};
