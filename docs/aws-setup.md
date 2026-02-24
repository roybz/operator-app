# AWS Setup (Cognito + API Gateway + Lambda + DynamoDB)

This document captures the AWS setup used for the Operator App cloud backend on February 22, 2026.

## Architecture

- Frontend (Cloudflare Pages or any static host)
- Cognito User Pool (authentication, manual user creation only for now)
- API Gateway HTTP API (JWT authorizer)
- Lambda (`operator-app-storage-api`)
- DynamoDB (`OperatorStorage`)

Guest mode remains local-only (`localStorage`) and does not use AWS storage.

## Current Resources (us-east-1)

- AWS account: `750142453913`
- Region: `us-east-1`
- DynamoDB table: `OperatorStorage`
- Cognito user pool: `us-east-1_QW0Cl4GWI`
- Cognito hosted UI domain:
  `https://operator-app-roy-2026.auth.us-east-1.amazoncognito.com`
- Cognito SPA app client ID: `32bfn92gkldr6bhed85hjkfrgb`
- Lambda function: `operator-app-storage-api`
- API Gateway HTTP API ID: `4j8meghx2i`
- API base URL:
  `https://4j8meghx2i.execute-api.us-east-1.amazonaws.com`

## Cognito Settings

- Public self sign-up: disabled (`AllowAdminCreateUserOnly=true`)
- OAuth flow: Authorization Code + PKCE
- App client secret: disabled (SPA client)
- Allowed scopes: `openid`, `email`, `profile`, `aws.cognito.signin.user.admin`
- Callback URL (current): `https://plannerdemo.roy.bz/login`
- Logout URL (current): `https://plannerdemo.roy.bz/login`

## DynamoDB Data Model

Single-table key-value storage, scoped by authenticated Cognito `sub`.

- PK: `USER#{sub}`
- SK: `KEY#{logicalKey}`

Item shape:

```json
{
  "PK": "USER#<cognito-sub>",
  "SK": "KEY#<logical-key>",
  "value": "<string-json-or-string>",
  "version": 1,
  "updatedAt": 1730000000000
}
```

## API Contract (HTTP API)

All routes require JWT auth via Cognito authorizer.

- `GET /storage/keys`
- `GET /storage/item?key=...`
- `PUT /storage/item`
- `DELETE /storage/item?key=...`
- `POST /storage/batchGet`

Notes:

- User identity comes from JWT `sub` claim, never request body.
- Backend stores logical keys opaquely (no app-specific interpretation).
- `PUT /storage/item` supports optimistic versioning and returns `409` on conflicts.

## Frontend Runtime Config (`frontend/src/assets/op-config.js`)

Current cloud-enabled values:

```js
apiBaseUrl: 'https://4j8meghx2i.execute-api.us-east-1.amazonaws.com',
storageMode: 'remote',
storageApiBaseUrl: 'https://4j8meghx2i.execute-api.us-east-1.amazonaws.com',
guestModeOnly: false,
authProvider: 'cognito',
cognito: {
  enabled: true,
  domain: 'https://operator-app-roy-2026.auth.us-east-1.amazoncognito.com',
  clientId: '32bfn92gkldr6bhed85hjkfrgb',
  redirectUri: 'https://plannerdemo.roy.bz/login',
  logoutRedirectUri: 'https://plannerdemo.roy.bz/login',
  scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
}
```

## Realtime (WebSocket) Notes

Realtime invalidation is enabled via a separate WebSocket API and connection Lambdas.

- WebSocket API URL: `wss://kor4dh9vtl.execute-api.us-east-1.amazonaws.com/prod`
- If WebSocket connect fails, the frontend falls back to polling sync.
- The Cognito access token must include `aws.cognito.signin.user.admin` because the connect Lambda
  uses Cognito `GetUser` for token validation.

## Updating the Domain Later

If you move from `plannerdemo.roy.bz` to a new domain:

1. Update Cognito app client callback/logout URLs.
2. Update `frontend/src/assets/op-config.js` `redirectUri` / `logoutRedirectUri`.
3. Redeploy frontend.
4. Update API Gateway CORS allowed origins if frontend origin changes.

## Operational Notes

- API Gateway `$default` stage uses basic throttling (`burst 20`, `rate 10 rps`).
- API Gateway access logs are enabled.
- Lambda logs go to CloudWatch automatically.
- DynamoDB PITR is enabled.

## Security Notes

- Prefer using an IAM user/role (not root) for ongoing CLI work.
- Rotate the initial Cognito password after first successful sign-in.
- Avoid committing production-only secrets to the repo. (Current frontend config contains public IDs/URLs only, not secrets.)
