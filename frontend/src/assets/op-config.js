window.__OP_CONFIG__ = {
  apiBaseUrl: 'https://4j8meghx2i.execute-api.us-east-1.amazonaws.com',
  storageMode: 'remote', // 'local' | 'remote'
  storageApiBaseUrl: 'https://4j8meghx2i.execute-api.us-east-1.amazonaws.com',
  mockMode: true,
  guestModeOnly: false,
  debugPerf: false,
  authProvider: 'cognito', // 'local' | 'cognito'
  cognito: {
    enabled: true,
    domain: 'https://operator-app-roy-2026.auth.us-east-1.amazoncognito.com',
    clientId: '32bfn92gkldr6bhed85hjkfrgb',
    redirectUri: 'https://plannerdemo.roy.bz/login',
    logoutRedirectUri: 'https://plannerdemo.roy.bz/login',
    scopes: ['openid', 'email', 'profile'],
  },
};
