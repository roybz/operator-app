import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import packageJson from '../../../package.json';

export type UserRole = 'admin' | 'user';

export interface UserRecord {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
}

export interface SavedCredential {
  label: string;
  username?: string;
  password?: string;
}

export interface UserPreferences {
  language: string;
  city: string;
  timeZone: string;
  showTime: boolean;
  timeFormat: '12h' | '24h';
  themeMode: 'system' | 'light' | 'dark' | 'timeZone';
  colorTheme: 'standard' | 'notepad' | 'ice';
  accessibilityMode: boolean;
  credentials: SavedCredential[];
  maxPersistedApps: number;
  canvasWidth: number;
  canvasHeight: number;
  lockCanvasSize: boolean;
  hideViewportSizingControls: boolean;
  hideZoomControls: boolean;
  backgroundImageUrl: string;
  backgroundImageMode: 'repeat' | 'center' | 'stretch';
  disabledApps: string[];
  showGrid: boolean;
  gridSize: number;
}

export interface OrgSettings {
  siteTitle: string;
  siteLogoEmoji: string;
  testModeEnabled: boolean;
  allowGuestLogin: boolean;
  defaultViewportWidth: number;
  defaultViewportHeight: number;
  disableViewportSizing: boolean;
  disableZoomControls: boolean;
  allowServerBackground: boolean;
}

interface SessionState {
  userId: string | null;
  previewUserId: string | null;
  previewPersist: boolean;
}

type StoredPreferences = Record<string, UserPreferences>;
type StoredPreviewPreferences = Record<string, UserPreferences>;

const USERS_KEY = 'op_users';
const SESSION_KEY = 'op_session';
const PREFS_KEY = 'op_prefs';
const PREVIEW_PREFS_KEY = 'op_preview_prefs';
const ORG_SETTINGS_KEY = 'op_org_settings';
const GUEST_USER_ID = 'u_guest';
const GUEST_USERNAME = 'guest';
const DIALOG_STATE_KEY = 'op_dialog_state_v1';
const PREVIEW_STATE_KEY = 'op_preview_dialog_state_v1';
const MOCK_TODO_KEY = 'op_mock_todos';
const DEFAULT_ADMIN_HASH =
  'sha256:62d9ba597c35a2f737a0173ea82a5289c6628e5a06674ebbb140848810961838';
const LOGIN_SECURITY_KEY = 'op_login_security';
const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'nl',
  'no',
  'pl',
  'hu',
  'ca',
  'et',
  'hr',
  'ru',
  'uk',
  'ar',
  'fa',
  'hi',
  'pa',
  'bn',
  'ur',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'th',
  'vi',
  'sw',
  'ha',
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly usersSignal = signal<UserRecord[]>([]);
  private readonly sessionSignal = signal<SessionState>({
    userId: null,
    previewUserId: null,
    previewPersist: false,
  });
  private readonly prefsSignal = signal<StoredPreferences>({});
  private readonly previewPrefsSignal = signal<StoredPreviewPreferences>({});
  private readonly orgSettingsSignal = signal<OrgSettings>(this.defaultOrgSettings());
  private readonly readySignal = signal(false);
  private loginSecurity: Record<string, { count: number; lockedUntil: number }> = {};

  readonly users = this.usersSignal.asReadonly();
  readonly session = this.sessionSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();

  readonly isLoggedIn = computed(() => Boolean(this.sessionSignal().userId));
  readonly currentUser = computed(() => {
    const id = this.effectiveUserId();
    return this.usersSignal().find((user) => user.id === id) ?? null;
  });
  readonly actualUser = computed(() => {
    const id = this.sessionSignal().userId;
    return this.usersSignal().find((user) => user.id === id) ?? null;
  });
  readonly isAdmin = computed(() => this.actualUser()?.role === 'admin');
  readonly isPreviewing = computed(() => Boolean(this.sessionSignal().previewUserId));
  readonly previewPersist = computed(() => this.sessionSignal().previewPersist);
  readonly preferences = computed(() => this.getPreferencesFor(this.effectiveUserId()));
  readonly orgSettings = this.orgSettingsSignal.asReadonly();

  private translate = inject(TranslateService);

  constructor() {
    this.loadFromStorage();
    this.readySignal.set(true);
  }

  async login(username: string, password: string): Promise<{ ok: boolean; message?: string }> {
    if (this.guestModeOnly()) {
      return { ok: false, message: 'auth.error.guestOnly' };
    }
    const trimmed = username.trim();
    if (this.isLoginLocked(trimmed)) {
      return { ok: false, message: 'auth.error.locked' };
    }
    const user = this.usersSignal().find((u) => u.username === trimmed);
    if (!user) {
      this.recordLoginFailure(trimmed);
      return { ok: false, message: 'auth.error.notFound' };
    }
    const expected = user.password ?? '';
    if (expected) {
      if (expected.startsWith('sha256:')) {
        const hashed = await this.hashPassword(password);
        if (expected !== hashed) {
          this.recordLoginFailure(trimmed);
          return { ok: false, message: 'auth.error.invalid' };
        }
      } else if (expected !== password) {
        this.recordLoginFailure(trimmed);
        return { ok: false, message: 'auth.error.invalid' };
      } else {
        const hashed = await this.hashPassword(password);
        this.setUserPassword(user.id, hashed);
      }
    } else if (password.trim().length > 0) {
      this.recordLoginFailure(trimmed);
      return { ok: false, message: 'auth.error.invalid' };
    }

    this.clearLoginFailures(trimmed);
    this.sessionSignal.set({ userId: user.id, previewUserId: null, previewPersist: false });
    this.persistSession();
    this.applyLanguageFromPreferences();
    return { ok: true };
  }

  loginAsGuest() {
    if (!this.orgSettingsSignal().allowGuestLogin && !this.guestModeOnly()) return;
    this.ensureGuestUser();
    this.sessionSignal.set({ userId: GUEST_USER_ID, previewUserId: null, previewPersist: false });
    this.persistSession();
    this.applyLanguageFromPreferences();
  }

  resetGuestAccount() {
    this.clearMockTodosForUser(GUEST_USER_ID);
    this.clearAppStateForUser(GUEST_USER_ID);
    const prefs = { ...this.prefsSignal() };
    prefs[GUEST_USER_ID] = this.defaultPreferences();
    this.prefsSignal.set(prefs);
    this.persistPrefs();

    const previewPrefs = { ...this.previewPrefsSignal() };
    delete previewPrefs[GUEST_USER_ID];
    this.previewPrefsSignal.set(previewPrefs);
    this.persistPreviewPrefs();

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`op_accessibility_prompted_${GUEST_USER_ID}`);
    }
  }

  logout() {
    this.sessionSignal.set({ userId: null, previewUserId: null, previewPersist: false });
    this.persistSession();
  }

  async createUser(input: { username: string; password: string; role: UserRole }): Promise<{
    ok: boolean;
    message?: string;
  }> {
    if (this.guestModeOnly()) {
      return { ok: false, message: 'users.error.guestOnly' };
    }
    const username = input.username.trim();
    if (!username) return { ok: false, message: 'users.error.usernameRequired' };
    if (!input.password || !input.password.trim()) {
      return { ok: false, message: 'users.error.passwordRequired' };
    }
    if (this.usersSignal().some((u) => u.username === username)) {
      return { ok: false, message: 'users.error.usernameTaken' };
    }

    const password = await this.hashPassword(input.password);
    const user: UserRecord = {
      id: this.uid('u'),
      username,
      password,
      role: input.role,
    };

    const next = [...this.usersSignal(), user];
    this.usersSignal.set(next);
    this.persistUsers();
    const nextPrefs = {
      ...this.prefsSignal(),
      [user.id]: this.defaultPreferences(this.translate.currentLang || 'en'),
    };
    this.prefsSignal.set(nextPrefs);
    this.persistPrefs();
    return { ok: true };
  }

  async updateUser(
    userId: string,
    updates: { username: string; password?: string; role: UserRole },
  ): Promise<{
    ok: boolean;
    message?: string;
  }> {
    const username = updates.username.trim();
    if (!username) return { ok: false, message: 'users.error.usernameRequired' };
    if (this.usersSignal().some((u) => u.username === username && u.id !== userId)) {
      return { ok: false, message: 'users.error.usernameTaken' };
    }

    let nextPassword: string | undefined;
    if (updates.password && updates.password.trim()) {
      nextPassword = await this.hashPassword(updates.password);
    }

    const next = this.usersSignal().map((user) => {
      if (user.id !== userId) return user;
      const password = user.id === GUEST_USER_ID ? '' : (nextPassword ?? user.password ?? '');
      return { ...user, username, password, role: updates.role };
    });
    this.usersSignal.set(next);
    this.persistUsers();
    return { ok: true };
  }

  deleteUser(userId: string): { ok: boolean; message?: string } {
    const users = this.usersSignal();
    const target = users.find((user) => user.id === userId);
    if (!target) return { ok: true };

    if (target.role === 'admin') {
      const adminCount = users.filter((user) => user.role === 'admin').length;
      if (adminCount <= 1) {
        return { ok: false, message: 'users.error.lastAdmin' };
      }
    }

    const next = users.filter((user) => user.id !== userId);
    this.usersSignal.set(next);
    this.persistUsers();

    const remainingPrefs = { ...this.prefsSignal() };
    delete remainingPrefs[userId];
    this.prefsSignal.set(remainingPrefs);
    this.persistPrefs();

    const remainingPreviewPrefs = { ...this.previewPrefsSignal() };
    delete remainingPreviewPrefs[userId];
    this.previewPrefsSignal.set(remainingPreviewPrefs);
    this.persistPreviewPrefs();

    const session = this.sessionSignal();
    if (session.userId === userId) {
      this.logout();
    }
    if (session.previewUserId === userId) {
      this.setPreviewUser(null);
    }

    return { ok: true };
  }

  setPreviewUser(userId: string | null) {
    if (!this.isAdmin()) return;
    const actualId = this.sessionSignal().userId;
    const nextPreview = userId && userId !== actualId ? userId : null;
    const shouldPersist =
      nextPreview && nextPreview === this.sessionSignal().previewUserId
        ? this.sessionSignal().previewPersist
        : false;
    this.sessionSignal.set({
      ...this.sessionSignal(),
      previewUserId: nextPreview,
      previewPersist: shouldPersist,
    });
    this.persistSession();
    this.applyLanguageFromPreferences();
  }

  setPreviewPersist(persist: boolean) {
    if (!this.isAdmin()) return;
    this.sessionSignal.set({ ...this.sessionSignal(), previewPersist: persist });
    this.persistSession();
  }

  savePreferences(prefs: UserPreferences) {
    const effectiveId = this.effectiveUserId();
    if (!effectiveId) return;

    if (this.isPreviewing() && !this.previewPersist()) {
      const nextPreviewPrefs = { ...this.previewPrefsSignal(), [effectiveId]: prefs };
      this.previewPrefsSignal.set(nextPreviewPrefs);
      this.persistPreviewPrefs();
    } else {
      const nextPrefs = { ...this.prefsSignal(), [effectiveId]: prefs };
      this.prefsSignal.set(nextPrefs);
      this.persistPrefs();
    }

    this.applyLanguageFromPreferences();
  }

  getPreferencesFor(userId: string | null): UserPreferences {
    if (!userId) return this.defaultPreferences();

    if (this.isPreviewing() && !this.previewPersist()) {
      const previewPrefs = this.previewPrefsSignal()[userId];
      if (previewPrefs) return { ...this.defaultPreferences(), ...previewPrefs };
    }

    const stored = this.prefsSignal()[userId];
    const merged = stored ? { ...this.defaultPreferences(), ...stored } : this.defaultPreferences();
    const legacyHide = (stored as { hideViewportControls?: boolean } | undefined)
      ?.hideViewportControls;
    if (legacyHide !== undefined) {
      merged.hideViewportSizingControls = legacyHide;
      merged.hideZoomControls = legacyHide;
    }
    return merged;
  }

  private effectiveUserId(): string | null {
    if (this.guestModeOnly()) return GUEST_USER_ID;
    return this.sessionSignal().previewUserId ?? this.sessionSignal().userId;
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;

    const storedUsers = this.safeJson<UserRecord[]>(USERS_KEY, []);
    const users = storedUsers.length > 0 ? storedUsers : [this.defaultAdmin()];
    const hasGuest = users.some((user) => user.id === GUEST_USER_ID);
    if (!hasGuest) {
      users.push(this.guestUser());
    }
    const normalized = users.map((user) => {
      if (user.username === 'admin') {
        return { ...user, password: DEFAULT_ADMIN_HASH };
      }
      return user;
    });
    const guestOnly = this.guestModeOnly();
    const normalizedUsers = guestOnly ? [this.guestUser()] : normalized;
    this.usersSignal.set(normalizedUsers);

    const orgSettings = this.safeJson<OrgSettings>(ORG_SETTINGS_KEY, this.defaultOrgSettings());
    const legacyDisable = (orgSettings as { disableViewportAdjustments?: boolean })
      .disableViewportAdjustments;
    const nextOrg = {
      ...this.defaultOrgSettings(),
      ...orgSettings,
      ...(legacyDisable !== undefined
        ? { disableViewportSizing: legacyDisable, disableZoomControls: legacyDisable }
        : {}),
    };
    this.orgSettingsSignal.set({
      ...nextOrg,
      allowGuestLogin: guestOnly ? true : nextOrg.allowGuestLogin,
    });

    const session = this.safeJson<SessionState>(SESSION_KEY, {
      userId: null,
      previewUserId: null,
      previewPersist: false,
    });
    const validUserId = normalizedUsers.find((user) => user.id === session.userId)?.id ?? null;
    const validPreviewId =
      session.previewUserId && normalizedUsers.some((user) => user.id === session.previewUserId)
        ? session.previewUserId
        : null;
    this.sessionSignal.set(session);
    if (session.userId !== validUserId || session.previewUserId !== validPreviewId) {
      this.sessionSignal.set({
        userId: validUserId,
        previewUserId: validPreviewId,
        previewPersist: session.previewPersist && Boolean(validPreviewId),
      });
    }

    const actualRole = normalizedUsers.find((user) => user.id === validUserId)?.role ?? 'user';
    if (actualRole !== 'admin') {
      this.sessionSignal.set({ userId: validUserId, previewUserId: null, previewPersist: false });
    }

    if (guestOnly) {
      const nextSession = this.sessionSignal();
      const keepGuest = nextSession.userId === GUEST_USER_ID;
      this.sessionSignal.set({
        userId: keepGuest ? GUEST_USER_ID : null,
        previewUserId: null,
        previewPersist: false,
      });
    }

    const prefs = this.safeJson<StoredPreferences>(PREFS_KEY, {});
    if (!prefs[GUEST_USER_ID]) {
      prefs[GUEST_USER_ID] = this.defaultPreferences();
    }
    if (guestOnly) {
      this.prefsSignal.set({ [GUEST_USER_ID]: prefs[GUEST_USER_ID] });
    } else {
      this.prefsSignal.set(prefs);
    }

    const previewPrefs = this.safeJson<StoredPreviewPreferences>(PREVIEW_PREFS_KEY, {});
    this.previewPrefsSignal.set(guestOnly ? {} : previewPrefs);

    this.persistUsers();
    this.persistSession();
    this.persistPrefs();
    this.persistOrgSettings();
    this.applyLanguageFromPreferences();

    this.loginSecurity = this.safeJson<Record<string, { count: number; lockedUntil: number }>>(
      LOGIN_SECURITY_KEY,
      {},
    );
  }

  private persistUsers() {
    this.persist(USERS_KEY, this.usersSignal());
  }

  private persistSession() {
    this.persist(SESSION_KEY, this.sessionSignal());
  }

  private persistPrefs() {
    this.persist(PREFS_KEY, this.prefsSignal());
  }

  private persistPreviewPrefs() {
    this.persist(PREVIEW_PREFS_KEY, this.previewPrefsSignal());
  }

  private persistOrgSettings() {
    this.persist(ORG_SETTINGS_KEY, this.orgSettingsSignal());
  }

  private persist(key: string, value: unknown) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  private persistLoginSecurity() {
    this.persist(LOGIN_SECURITY_KEY, this.loginSecurity);
  }

  private safeJson<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private defaultAdmin(): UserRecord {
    return { id: this.uid('u'), username: 'admin', password: DEFAULT_ADMIN_HASH, role: 'admin' };
  }

  private guestUser(): UserRecord {
    return { id: GUEST_USER_ID, username: GUEST_USERNAME, password: '', role: 'user' };
  }

  private ensureGuestUser() {
    if (this.usersSignal().some((user) => user.id === GUEST_USER_ID)) return;
    const next = [...this.usersSignal(), this.guestUser()];
    this.usersSignal.set(next);
    this.persistUsers();
    if (!this.prefsSignal()[GUEST_USER_ID]) {
      const nextPrefs = { ...this.prefsSignal(), [GUEST_USER_ID]: this.defaultPreferences() };
      this.prefsSignal.set(nextPrefs);
      this.persistPrefs();
    }
  }

  private defaultPreferences(language = ''): UserPreferences {
    const browserTimeZone =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        : 'UTC';
    const org = this.orgSettingsSignal();
    return {
      language,
      city: '',
      timeZone: browserTimeZone,
      showTime: true,
      timeFormat: '12h',
      themeMode: 'system',
      colorTheme: 'standard',
      accessibilityMode: false,
      credentials: [],
      maxPersistedApps: 60,
      canvasWidth: org.defaultViewportWidth,
      canvasHeight: org.defaultViewportHeight,
      lockCanvasSize: false,
      hideViewportSizingControls: false,
      hideZoomControls: false,
      backgroundImageUrl: '',
      backgroundImageMode: 'repeat',
      disabledApps: ['navigator'],
      showGrid: true,
      gridSize: 50,
    };
  }

  private defaultOrgSettings(): OrgSettings {
    return {
      siteTitle: 'Operator App',
      siteLogoEmoji: '🌎',
      testModeEnabled: true,
      allowGuestLogin: true,
      defaultViewportWidth: 1920,
      defaultViewportHeight: 1080,
      disableViewportSizing: false,
      disableZoomControls: false,
      allowServerBackground: false,
    };
  }

  private applyLanguageFromPreferences() {
    const prefs = this.getPreferencesFor(this.effectiveUserId());
    this.translate.setDefaultLang('en');
    const fallback = this.getBrowserLanguage();
    const preferred = this.normalizeLanguage(prefs.language || fallback || 'en');
    this.translate.use(preferred);
  }

  private getBrowserLanguage() {
    if (typeof navigator === 'undefined') return 'en';
    const raw = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return this.normalizeLanguage(raw);
  }

  private normalizeLanguage(raw: string) {
    const normalized = raw.replace('_', '-');
    const lower = normalized.toLowerCase();
    if (lower.startsWith('zh')) {
      if (lower.includes('tw') || lower.includes('hk') || lower.includes('mo')) {
        return 'zh-Hant';
      }
      return 'zh-Hans';
    }
    const base = lower.split('-')[0];
    const exactMatch = SUPPORTED_LANGUAGES.find((code) => code.toLowerCase() === lower);
    if (exactMatch) return exactMatch;
    if (SUPPORTED_LANGUAGES.includes(base)) return base;
    return 'en';
  }

  private uid(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private async hashPassword(raw: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return `sha256:${hex}`;
  }

  private setUserPassword(userId: string, password: string) {
    const next = this.usersSignal().map((user) =>
      user.id === userId ? { ...user, password } : user,
    );
    this.usersSignal.set(next);
    this.persistUsers();
  }

  private isLoginLocked(username: string) {
    const entry = this.loginSecurity[username];
    if (!entry) return false;
    if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
    if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
      delete this.loginSecurity[username];
      this.persistLoginSecurity();
    }
    return false;
  }

  private recordLoginFailure(username: string) {
    const entry = this.loginSecurity[username] ?? { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= 6) {
      entry.lockedUntil = Date.now() + 5 * 60 * 60 * 1000;
    }
    this.loginSecurity[username] = entry;
    this.persistLoginSecurity();
  }

  private clearLoginFailures(username: string) {
    if (!this.loginSecurity[username]) return;
    delete this.loginSecurity[username];
    this.persistLoginSecurity();
  }

  private clearMockTodosForUser(userId: string) {
    if (typeof window === 'undefined') return;
    const instanceIds = new Set<string>();
    [DIALOG_STATE_KEY, PREVIEW_STATE_KEY].forEach((key) => {
      const raw = window.localStorage.getItem(`${key}:${userId}`);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as {
          dialogsByWorkspace?: Record<string, { id: string }[]>;
        };
        Object.values(parsed.dialogsByWorkspace ?? {}).forEach((items) => {
          items.forEach((item) => instanceIds.add(item.id));
        });
      } catch {
        // ignore malformed stored data
      }
    });
    instanceIds.forEach((id) => {
      window.localStorage.removeItem(`${MOCK_TODO_KEY}:${userId}:${id}`);
      window.localStorage.removeItem(`${MOCK_TODO_KEY}:${id}`);
    });
  }

  private clearAppStateForUser(userId: string) {
    if (typeof window === 'undefined') return;
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('op_app_state:') && key.includes(`:${userId}:`))
      .forEach((key) => window.localStorage.removeItem(key));
  }

  saveOrgSettings(next: OrgSettings) {
    if (!this.isAdmin()) return;
    this.orgSettingsSignal.set(next);
    this.persistOrgSettings();
  }

  updateAllUserViewports(width: number, height: number) {
    if (!this.isAdmin()) return;
    const updated = { ...this.prefsSignal() };
    Object.keys(updated).forEach((userId) => {
      updated[userId] = { ...updated[userId], canvasWidth: width, canvasHeight: height };
    });
    this.prefsSignal.set(updated);
    this.persistPrefs();
  }

  isBackendConnected(): boolean {
    if (typeof window === 'undefined') return false;
    const config = (window as Window & { __OP_CONFIG__?: { apiBaseUrl?: string } }).__OP_CONFIG__;
    return Boolean(config?.apiBaseUrl);
  }

  guestModeOnly(): boolean {
    if (typeof window === 'undefined') return Boolean(packageJson.guestModeOnly);
    const config = (window as Window & { __OP_CONFIG__?: { guestModeOnly?: boolean } })
      .__OP_CONFIG__;
    return Boolean(config?.guestModeOnly ?? packageJson.guestModeOnly);
  }

  markAccessibilityPromptShown(userId: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`op_accessibility_prompted_${userId}`, 'true');
  }

  hasSeenAccessibilityPrompt(userId: string) {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(`op_accessibility_prompted_${userId}`) === 'true';
  }
}
