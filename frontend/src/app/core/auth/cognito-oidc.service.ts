import { Injectable, signal } from '@angular/core';
import { getOpConfig, type OpCognitoConfig } from '../op-config';

interface StoredCognitoSession {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
}

interface CognitoTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
}

interface OidcProfile {
  sub: string;
  username: string;
  email?: string;
}

const SESSION_STORAGE_STATE_KEY = 'op_cognito_oauth_state';
const SESSION_STORAGE_VERIFIER_KEY = 'op_cognito_oauth_verifier';
const LOCAL_SESSION_KEY = 'op_cognito_session_v1';

@Injectable({ providedIn: 'root' })
export class CognitoOidcService {
  private readonly sessionSignal = signal<StoredCognitoSession | null>(this.readStoredSession());
  readonly authenticated = signal(Boolean(this.sessionSignal()));

  isEnabled() {
    return this.authProvider() === 'cognito' && Boolean(this.config().enabled !== false);
  }

  authProvider() {
    return getOpConfig().authProvider ?? 'local';
  }

  config(): OpCognitoConfig {
    return getOpConfig().cognito ?? {};
  }

  isConfigured() {
    const config = this.config();
    return Boolean(config.domain && config.clientId && this.redirectUri());
  }

  async completeRedirectIfNeeded(): Promise<void> {
    if (!this.isEnabled() || !this.isConfigured() || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code) {
      this.syncStoredSession();
      return;
    }

    const expectedState = sessionStorage.getItem(SESSION_STORAGE_STATE_KEY);
    const verifier = sessionStorage.getItem(SESSION_STORAGE_VERIFIER_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_STATE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_VERIFIER_KEY);
    if (!state || !expectedState || state !== expectedState || !verifier) {
      this.clearSession();
      this.stripAuthParamsFromUrl(url);
      return;
    }

    const tokens = await this.exchangeAuthorizationCode(code, verifier);
    this.setSession(tokens);
    this.stripAuthParamsFromUrl(url);
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.isEnabled()) return null;
    await this.refreshIfNeeded();
    return this.sessionSignal()?.accessToken ?? null;
  }

  hasSession() {
    this.syncStoredSession();
    return Boolean(this.sessionSignal());
  }

  getProfile(): OidcProfile | null {
    const session = this.sessionSignal();
    if (!session) return null;
    const claims = this.parseJwt(session.idToken);
    if (!claims) return null;
    const sub = typeof claims['sub'] === 'string' ? claims['sub'] : null;
    if (!sub) return null;
    const username =
      (typeof claims['cognito:username'] === 'string' && claims['cognito:username']) ||
      (typeof claims['preferred_username'] === 'string' && claims['preferred_username']) ||
      (typeof claims['email'] === 'string' && claims['email']) ||
      sub;
    const email = typeof claims['email'] === 'string' ? claims['email'] : undefined;
    return { sub, username, email };
  }

  async startLogin() {
    if (!this.isEnabled() || !this.isConfigured() || typeof window === 'undefined') return;
    const state = this.randomString(32);
    const verifier = this.randomString(64);
    const challenge = await this.pkceChallenge(verifier);
    sessionStorage.setItem(SESSION_STORAGE_STATE_KEY, state);
    sessionStorage.setItem(SESSION_STORAGE_VERIFIER_KEY, verifier);

    const authorize = new URL(`${this.normalizedDomain()}/oauth2/authorize`);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('client_id', String(this.config().clientId));
    authorize.searchParams.set('redirect_uri', this.redirectUri());
    authorize.searchParams.set('scope', this.scopes().join(' '));
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('code_challenge_method', 'S256');
    authorize.searchParams.set('code_challenge', challenge);
    authorize.searchParams.set('prompt', 'login');
    window.location.assign(authorize.toString());
  }

  startLogout() {
    const logoutRedirectUri = this.logoutRedirectUri();
    const clientId = this.config().clientId;
    this.clearSession();
    if (!this.isEnabled() || !this.isConfigured() || typeof window === 'undefined') return;
    if (!logoutRedirectUri || !clientId) return;
    const url = new URL(`${this.normalizedDomain()}/logout`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('logout_uri', logoutRedirectUri);
    window.location.assign(url.toString());
  }

  clearSession() {
    this.sessionSignal.set(null);
    this.authenticated.set(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    }
  }

  private syncStoredSession() {
    const next = this.readStoredSession();
    this.sessionSignal.set(next);
    this.authenticated.set(Boolean(next));
  }

  private readStoredSession(): StoredCognitoSession | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StoredCognitoSession;
      if (!parsed?.accessToken || !parsed?.idToken || !parsed?.expiresAt) return null;
      if (Date.now() >= parsed.expiresAt && !parsed.refreshToken) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private setSession(tokens: CognitoTokenResponse) {
    const next: StoredCognitoSession = {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + Math.max(1, tokens.expires_in - 30) * 1000,
      tokenType: tokens.token_type || 'Bearer',
    };
    this.sessionSignal.set(next);
    this.authenticated.set(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(next));
    }
  }

  private async refreshIfNeeded() {
    const current = this.sessionSignal() ?? this.readStoredSession();
    if (!current) {
      this.clearSession();
      return;
    }
    if (Date.now() < current.expiresAt) {
      this.sessionSignal.set(current);
      this.authenticated.set(true);
      return;
    }
    if (!current.refreshToken) {
      this.clearSession();
      return;
    }

    const response = await fetch(`${this.normalizedDomain()}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: String(this.config().clientId ?? ''),
        refresh_token: current.refreshToken,
      }).toString(),
    });
    if (!response.ok) {
      this.clearSession();
      return;
    }
    const refreshed = (await response.json()) as CognitoTokenResponse;
    this.setSession({
      ...refreshed,
      refresh_token: refreshed.refresh_token ?? current.refreshToken,
    });
  }

  private async exchangeAuthorizationCode(code: string, verifier: string) {
    const response = await fetch(`${this.normalizedDomain()}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: String(this.config().clientId ?? ''),
        code,
        redirect_uri: this.redirectUri(),
        code_verifier: verifier,
      }).toString(),
    });
    if (!response.ok) {
      this.clearSession();
      throw new Error(`Cognito token exchange failed (${response.status})`);
    }
    return (await response.json()) as CognitoTokenResponse;
  }

  private normalizedDomain() {
    return String(this.config().domain ?? '').replace(/\/$/, '');
  }

  private redirectUri() {
    const config = this.config();
    if (config.redirectUri) return config.redirectUri;
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/login`;
  }

  private logoutRedirectUri() {
    const config = this.config();
    if (config.logoutRedirectUri) return config.logoutRedirectUri;
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/login`;
  }

  private scopes() {
    const configured = this.config().scopes;
    if (Array.isArray(configured) && configured.length) return configured;
    return ['openid', 'email', 'profile'];
  }

  private stripAuthParamsFromUrl(url: URL) {
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    if (typeof history !== 'undefined') {
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  private parseJwt(token: string): Record<string, unknown> | null {
    try {
      const [, payload] = token.split('.');
      if (!payload) return null;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private randomString(length: number) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
  }

  private async pkceChallenge(verifier: string) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const bytes = Array.from(new Uint8Array(digest));
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
}
