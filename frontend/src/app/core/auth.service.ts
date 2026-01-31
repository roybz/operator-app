import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import packageJson from '../../../package.json';

export type UserRole = 'admin' | 'user' | 'guest' | 'observer' | 'invitee';

export interface UserRecord {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
}

export interface InviteeRecord {
  id: string;
  username: string;
  password?: string;
  role: 'invitee';
  ownerId: string;
}

export interface UniversePresenceEntry {
  id: string;
  username: string;
  role: UserRole;
  ownerId: string;
  lastSeen: number;
}

export interface UniverseChatMessage {
  id: string;
  author: string;
  role: UserRole;
  content: string;
  createdAt: number;
}

export interface UniverseEditHolder {
  id: string;
  username: string;
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
  stickyNoteDefaultMode: 'rich' | 'markdown';
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
  universeId: string;
  universeName: string;
  multiUserEnabled: boolean;
  allowUniverseGuests: boolean;
  allowUniverseObservers: boolean;
  allowUniverseChat: boolean;
  universeGuestPassword: string;
  universeObserverPassword: string;
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
  sessionRole?: UserRole | null;
  sessionUsername?: string | null;
  universeOwnerId?: string | null;
  universeId?: string | null;
}

type StoredPreferences = Record<string, UserPreferences>;
type StoredPreviewPreferences = Record<string, UserPreferences>;

const USERS_KEY = 'op_users';
const SESSION_KEY = 'op_session';
const PREFS_KEY = 'op_prefs';
const PREVIEW_PREFS_KEY = 'op_preview_prefs';
const ORG_SETTINGS_KEY = 'op_org_settings';
const INVITEES_KEY = 'op_invitees';
const UNIVERSE_PRESENCE_KEY = 'op_universe_presence';
const UNIVERSE_CHAT_KEY = 'op_universe_chat';
const UNIVERSE_EDIT_KEY = 'op_universe_edit_holder';
const UNIVERSE_GUEST_COUNTER_KEY = 'op_universe_guest_counter';
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
  private readonly inviteesSignal = signal<Record<string, InviteeRecord[]>>({});
  private readonly sessionSignal = signal<SessionState>({
    userId: null,
    previewUserId: null,
    previewPersist: false,
    sessionRole: null,
    sessionUsername: null,
    universeOwnerId: null,
    universeId: null,
  });
  private readonly prefsSignal = signal<StoredPreferences>({});
  private readonly previewPrefsSignal = signal<StoredPreviewPreferences>({});
  private readonly orgSettingsSignal = signal<OrgSettings>(this.defaultOrgSettings());
  private readonly readySignal = signal(false);
  private loginSecurity: Record<string, { count: number; lockedUntil: number }> = {};
  private readonly universeContextSignal = signal<{ ownerId: string; universeId: string } | null>(
    null,
  );

  readonly users = this.usersSignal.asReadonly();
  readonly invitees = this.inviteesSignal.asReadonly();
  readonly session = this.sessionSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();
  readonly universeContext = this.universeContextSignal.asReadonly();

  readonly isLoggedIn = computed(() => Boolean(this.sessionSignal().userId));
  readonly currentUser = computed(() => {
    const id = this.effectiveUserId();
    return this.usersSignal().find((user) => user.id === id) ?? null;
  });
  readonly actualUser = computed(() => {
    const id = this.sessionSignal().userId;
    const existing = this.usersSignal().find((user) => user.id === id) ?? null;
    if (existing) return existing;
    const session = this.sessionSignal();
    if (session.userId && session.sessionRole && session.sessionUsername) {
      return {
        id: session.userId,
        username: session.sessionUsername,
        password: '',
        role: session.sessionRole,
      } as UserRecord;
    }
    return null;
  });
  readonly isAdmin = computed(() => this.actualUser()?.role === 'admin');
  readonly isPreviewing = computed(() => Boolean(this.sessionSignal().previewUserId));
  readonly previewPersist = computed(() => this.sessionSignal().previewPersist);
  readonly preferences = computed(() => this.getPreferencesFor(this.effectiveUserId()));
  readonly orgSettings = this.orgSettingsSignal.asReadonly();

  private translate = inject(TranslateService);

  constructor() {
    this.loadFromStorage();
    this.updateUniverseContextFromLocation();
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
    this.sessionSignal.set({
      userId: user.id,
      previewUserId: null,
      previewPersist: false,
      sessionRole: user.role,
      sessionUsername: user.username,
      universeOwnerId: null,
      universeId: null,
    });
    this.persistSession();
    this.applyLanguageFromPreferences();
    return { ok: true };
  }

  loginAsGuest() {
    if (!this.orgSettingsSignal().allowGuestLogin && !this.guestModeOnly()) return;
    this.ensureGuestUser();
    this.sessionSignal.set({
      userId: GUEST_USER_ID,
      previewUserId: null,
      previewPersist: false,
      sessionRole: 'guest',
      sessionUsername: GUEST_USERNAME,
      universeOwnerId: null,
      universeId: null,
    });
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
    const session = this.sessionSignal();
    const universeId = session.universeId ?? null;
    if (universeId && session.userId) {
      this.removeUniversePresence(universeId, session.userId);
    }
    this.sessionSignal.set({
      userId: null,
      previewUserId: null,
      previewPersist: false,
      sessionRole: null,
      sessionUsername: null,
      universeOwnerId: null,
      universeId: null,
    });
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
    const normalizedRole = input.role;
    if (!input.password || !input.password.trim()) {
      if (normalizedRole !== 'guest' && normalizedRole !== 'observer') {
        return { ok: false, message: 'users.error.passwordRequired' };
      }
    }
    if (this.usersSignal().some((u) => u.username === username)) {
      return { ok: false, message: 'users.error.usernameTaken' };
    }

    const password =
      normalizedRole === 'guest' || normalizedRole === 'observer'
        ? ''
        : await this.hashPassword(input.password);
    const user: UserRecord = {
      id: this.uid('u'),
      username,
      password,
      role: normalizedRole,
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
    const normalizedRole = updates.role;
    if (normalizedRole === 'guest' || normalizedRole === 'observer') {
      nextPassword = '';
    } else if (updates.password && updates.password.trim()) {
      nextPassword = await this.hashPassword(updates.password);
    }

    const next = this.usersSignal().map((user) => {
      if (user.id !== userId) return user;
      const password =
        normalizedRole === 'guest' || normalizedRole === 'observer'
          ? ''
          : user.id === GUEST_USER_ID
            ? ''
            : (nextPassword ?? user.password ?? '');
      return { ...user, username, password, role: normalizedRole };
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

  wipeUserData(userId: string): { ok: boolean; message?: string } {
    if (!this.isAdmin()) return { ok: false, message: 'users.error.adminOnly' };
    this.clearMockTodosForUser(userId);
    this.clearAppStateForUser(userId);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`${DIALOG_STATE_KEY}:${userId}`);
      window.localStorage.removeItem(`${PREVIEW_STATE_KEY}:${userId}`);
    }

    const remainingPrefs = { ...this.prefsSignal() };
    delete remainingPrefs[userId];
    this.prefsSignal.set(remainingPrefs);
    this.persistPrefs();

    const remainingPreviewPrefs = { ...this.previewPrefsSignal() };
    delete remainingPreviewPrefs[userId];
    this.previewPrefsSignal.set(remainingPreviewPrefs);
    this.persistPreviewPrefs();

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
    return (
      this.sessionSignal().previewUserId ??
      this.sessionSignal().universeOwnerId ??
      this.sessionSignal().userId
    );
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;

    const storedUsers = this.safeJson<UserRecord[]>(USERS_KEY, []);
    const users = storedUsers.length > 0 ? storedUsers : [this.defaultAdmin()];
    const hasGuest = users.some((user) => user.id === GUEST_USER_ID);
    if (!hasGuest) {
      users.push(this.guestUser());
    }
    const hasAdmin = users.some((user) => user.username === 'admin');
    if (!hasAdmin) {
      users.push(this.defaultAdmin());
    }
    const normalized = users.map((user) => {
      if (user.username === 'admin') {
        return { ...user, password: DEFAULT_ADMIN_HASH };
      }
      if (user.id === GUEST_USER_ID) {
        return { ...user, role: 'user' };
      }
      return user;
    });
    const guestOnly = this.guestModeOnly();
    const normalizedUsers = (guestOnly ? [this.guestUser()] : normalized) as UserRecord[];
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
      sessionRole: null,
      sessionUsername: null,
      universeOwnerId: null,
      universeId: null,
    });
    const isUniverseSession =
      session.sessionRole === 'invitee' ||
      session.sessionRole === 'guest' ||
      session.sessionRole === 'observer';
    const validUserId =
      normalizedUsers.find((user) => user.id === session.userId)?.id ??
      (isUniverseSession ? session.userId : null);
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
        sessionRole: session.sessionRole ?? null,
        sessionUsername: session.sessionUsername ?? null,
        universeOwnerId: session.universeOwnerId ?? null,
        universeId: session.universeId ?? null,
      });
    }

    const actualRole =
      normalizedUsers.find((user) => user.id === validUserId)?.role ??
      session.sessionRole ??
      'user';
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
    let prefsUpdated = false;
    Object.keys(prefs).forEach((userId) => {
      if (!prefs[userId]) {
        prefs[userId] = this.defaultPreferences();
        prefsUpdated = true;
        return;
      }
      if (!prefs[userId].universeId) {
        prefs[userId] = {
          ...this.defaultPreferences(),
          ...prefs[userId],
          universeId: this.createUniverseId(),
        };
        prefsUpdated = true;
      }
      if (!prefs[userId].universeName) {
        prefs[userId] = { ...prefs[userId], universeName: 'Universe' };
        prefsUpdated = true;
      }
      if (prefs[userId].multiUserEnabled === undefined) {
        prefs[userId] = { ...prefs[userId], multiUserEnabled: true };
        prefsUpdated = true;
      }
      if (prefs[userId].allowUniverseGuests === undefined) {
        prefs[userId] = { ...prefs[userId], allowUniverseGuests: false };
        prefsUpdated = true;
      }
      if (prefs[userId].allowUniverseObservers === undefined) {
        prefs[userId] = { ...prefs[userId], allowUniverseObservers: false };
        prefsUpdated = true;
      }
      if (prefs[userId].allowUniverseChat === undefined) {
        prefs[userId] = { ...prefs[userId], allowUniverseChat: true };
        prefsUpdated = true;
      }
      if (prefs[userId].universeGuestPassword === undefined) {
        prefs[userId] = { ...prefs[userId], universeGuestPassword: '' };
        prefsUpdated = true;
      }
      if (prefs[userId].universeObserverPassword === undefined) {
        prefs[userId] = { ...prefs[userId], universeObserverPassword: '' };
        prefsUpdated = true;
      }
    });
    if (guestOnly) {
      this.prefsSignal.set({ [GUEST_USER_ID]: prefs[GUEST_USER_ID] });
    } else {
      this.prefsSignal.set(prefs);
    }

    const previewPrefs = this.safeJson<StoredPreviewPreferences>(PREVIEW_PREFS_KEY, {});
    this.previewPrefsSignal.set(guestOnly ? {} : previewPrefs);

    const invitees = this.safeJson<Record<string, InviteeRecord[]>>(INVITEES_KEY, {});
    this.inviteesSignal.set(invitees);

    this.persistUsers();
    this.persistSession();
    if (prefsUpdated) this.persistPrefs();
    else this.persistPrefs();
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

  private persistInvitees() {
    this.persist(INVITEES_KEY, this.inviteesSignal());
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
      stickyNoteDefaultMode: 'rich',
      themeMode: 'system',
      colorTheme: 'standard',
      accessibilityMode: false,
      credentials: [],
      maxPersistedApps: 255,
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
      universeId: this.createUniverseId(),
      universeName: 'Universe',
      multiUserEnabled: true,
      allowUniverseGuests: false,
      allowUniverseObservers: false,
      allowUniverseChat: true,
      universeGuestPassword: '',
      universeObserverPassword: '',
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

  private createUniverseId() {
    return Math.random().toString(36).slice(2, 10);
  }

  async hashPassword(raw: string) {
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

  updateUniverseContextFromLocation() {
    if (typeof window === 'undefined') return;
    const raw = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (!raw || raw === 'login') {
      this.universeContextSignal.set(null);
      return;
    }
    const universeId = raw.split('/')[0];
    const ownerId = this.findOwnerByUniverseId(universeId);
    if (!ownerId) {
      this.universeContextSignal.set(null);
      return;
    }
    this.universeContextSignal.set({ ownerId, universeId });
  }

  private findOwnerByUniverseId(universeId: string) {
    const entries = Object.entries(this.prefsSignal());
    for (const [userId, prefs] of entries) {
      if (prefs?.universeId === universeId) return userId;
    }
    return null;
  }

  getUniversePreferences(ownerId: string) {
    return this.getPreferencesFor(ownerId);
  }

  setUniverseId(ownerId: string, universeId: string) {
    const prefs = this.prefsSignal()[ownerId];
    if (!prefs) return;
    const next = { ...this.prefsSignal(), [ownerId]: { ...prefs, universeId } };
    this.prefsSignal.set(next);
    this.persistPrefs();
  }

  getInviteesForOwner(ownerId: string) {
    return this.inviteesSignal()[ownerId] ?? [];
  }

  async createInvitee(ownerId: string, username: string, password: string) {
    const trimmed = username.trim();
    if (!trimmed) return { ok: false, message: 'users.error.usernameRequired' };
    if (!password || !password.trim()) {
      return { ok: false, message: 'users.error.passwordRequired' };
    }
    const existing = this.getInviteesForOwner(ownerId).some((u) => u.username === trimmed);
    if (existing) return { ok: false, message: 'users.error.usernameTaken' };
    const hashed = await this.hashPassword(password);
    const invitee: InviteeRecord = {
      id: this.uid('inv'),
      ownerId,
      username: trimmed,
      password: hashed,
      role: 'invitee',
    };
    const next = {
      ...this.inviteesSignal(),
      [ownerId]: [...this.getInviteesForOwner(ownerId), invitee],
    };
    this.inviteesSignal.set(next);
    this.persistInvitees();
    return { ok: true };
  }

  async updateInvitee(
    ownerId: string,
    inviteeId: string,
    updates: { username: string; password?: string },
  ) {
    const trimmed = updates.username.trim();
    if (!trimmed) return { ok: false, message: 'users.error.usernameRequired' };
    const list = this.getInviteesForOwner(ownerId);
    if (list.some((u) => u.username === trimmed && u.id !== inviteeId)) {
      return { ok: false, message: 'users.error.usernameTaken' };
    }
    let nextPassword: string | undefined;
    if (updates.password && updates.password.trim()) {
      nextPassword = await this.hashPassword(updates.password);
    }
    const nextList = list.map((u) =>
      u.id === inviteeId ? { ...u, username: trimmed, password: nextPassword ?? u.password } : u,
    );
    this.inviteesSignal.set({ ...this.inviteesSignal(), [ownerId]: nextList });
    this.persistInvitees();
    return { ok: true };
  }

  deleteInvitee(ownerId: string, inviteeId: string) {
    const list = this.getInviteesForOwner(ownerId);
    const nextList = list.filter((u) => u.id !== inviteeId);
    this.inviteesSignal.set({ ...this.inviteesSignal(), [ownerId]: nextList });
    this.persistInvitees();
  }

  async loginInvitee(ownerId: string, username: string, password: string) {
    const trimmed = username.trim();
    if (this.isLoginLocked(trimmed)) {
      return { ok: false, message: 'auth.error.locked' };
    }
    const invitee = this.getInviteesForOwner(ownerId).find((u) => u.username === trimmed);
    if (!invitee) {
      this.recordLoginFailure(trimmed);
      return { ok: false, message: 'auth.error.notFound' };
    }
    const expected = invitee.password ?? '';
    if (expected) {
      const hashed = await this.hashPassword(password);
      if (expected !== hashed) {
        this.recordLoginFailure(trimmed);
        return { ok: false, message: 'auth.error.invalid' };
      }
    }
    this.clearLoginFailures(trimmed);
    const ownerPrefs = this.getPreferencesFor(ownerId);
    this.sessionSignal.set({
      userId: invitee.id,
      previewUserId: null,
      previewPersist: false,
      sessionRole: 'invitee',
      sessionUsername: invitee.username,
      universeOwnerId: ownerId,
      universeId: ownerPrefs.universeId,
    });
    this.persistSession();
    this.applyLanguageFromPreferences();
    return { ok: true };
  }

  async loginUniverseGuest(ownerId: string, password: string) {
    const prefs = this.getPreferencesFor(ownerId);
    if (!prefs.allowUniverseGuests) return { ok: false, message: 'auth.error.guestOnly' };
    if (prefs.universeGuestPassword) {
      const hashed = await this.hashPassword(password);
      if (hashed !== prefs.universeGuestPassword) {
        this.recordLoginFailure('universe_guest');
        return { ok: false, message: 'auth.error.invalid' };
      }
    }
    this.clearLoginFailures('universe_guest');
    const guestNumber = this.nextUniverseGuestNumber(prefs.universeId);
    const guestId = this.uid('ug');
    this.sessionSignal.set({
      userId: guestId,
      previewUserId: null,
      previewPersist: false,
      sessionRole: 'guest',
      sessionUsername: `Guest (${guestNumber})`,
      universeOwnerId: ownerId,
      universeId: prefs.universeId,
    });
    this.persistSession();
    this.applyLanguageFromPreferences();
    return { ok: true };
  }

  async loginUniverseObserver(ownerId: string, password: string) {
    const prefs = this.getPreferencesFor(ownerId);
    if (!prefs.allowUniverseObservers) return { ok: false, message: 'auth.error.guestOnly' };
    if (prefs.universeObserverPassword) {
      const hashed = await this.hashPassword(password);
      if (hashed !== prefs.universeObserverPassword) {
        this.recordLoginFailure('universe_observer');
        return { ok: false, message: 'auth.error.invalid' };
      }
    }
    this.clearLoginFailures('universe_observer');
    const observerId = this.uid('uo');
    this.sessionSignal.set({
      userId: observerId,
      previewUserId: null,
      previewPersist: false,
      sessionRole: 'observer',
      sessionUsername: 'Observer',
      universeOwnerId: ownerId,
      universeId: prefs.universeId,
    });
    this.persistSession();
    this.applyLanguageFromPreferences();
    return { ok: true };
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

  getUniversePresence(universeId: string) {
    return this.cleanupUniversePresence(universeId);
  }

  touchUniversePresence(universeId: string, entry: UniversePresenceEntry) {
    const list = this.cleanupUniversePresence(universeId);
    const now = Date.now();
    const next = list.filter((item) => item.id !== entry.id);
    next.push({ ...entry, lastSeen: now });
    this.persist(this.universePresenceKey(universeId), next);
    return next;
  }

  removeUniversePresence(universeId: string, userId: string) {
    const list = this.cleanupUniversePresence(universeId).filter((item) => item.id !== userId);
    if (list.length === 0) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(this.universePresenceKey(universeId));
      }
    } else {
      this.persist(this.universePresenceKey(universeId), list);
    }
    this.clearUniverseSessionIfNeeded(universeId, list);
  }

  getUniverseChat(universeId: string) {
    return this.safeJson<UniverseChatMessage[]>(this.universeChatKey(universeId), []);
  }

  appendUniverseChat(universeId: string, message: UniverseChatMessage) {
    const list = this.getUniverseChat(universeId);
    const next = [...list, message].slice(-200);
    this.persist(this.universeChatKey(universeId), next);
    return next;
  }

  clearUniverseChat(universeId: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(this.universeChatKey(universeId));
  }

  getUniverseEditHolder(universeId: string) {
    return this.safeJson<UniverseEditHolder | null>(this.universeEditKey(universeId), null);
  }

  setUniverseEditHolder(universeId: string, holder: UniverseEditHolder | null) {
    if (typeof window === 'undefined') return;
    if (!holder) {
      window.localStorage.removeItem(this.universeEditKey(universeId));
      return;
    }
    this.persist(this.universeEditKey(universeId), holder);
  }

  nextUniverseGuestNumber(universeId: string) {
    const presence = this.cleanupUniversePresence(universeId);
    const hasGuests = presence.some((entry) => entry.role === 'guest');
    if (!hasGuests && typeof window !== 'undefined') {
      window.localStorage.removeItem(this.universeGuestCounterKey(universeId));
    }
    const raw = this.safeJson<number>(this.universeGuestCounterKey(universeId), 0);
    const next = raw + 1;
    this.persist(this.universeGuestCounterKey(universeId), next);
    return next;
  }

  private clearUniverseSessionIfNeeded(universeId: string, presence?: UniversePresenceEntry[]) {
    const list = presence ?? this.cleanupUniversePresence(universeId);
    const active = list.filter((entry) => entry.role !== 'observer');
    if (active.length === 0) {
      this.clearUniverseChat(universeId);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(this.universeGuestCounterKey(universeId));
        window.localStorage.removeItem(this.universeEditKey(universeId));
      }
    }
  }

  private cleanupUniversePresence(universeId: string) {
    const list = this.safeJson<UniversePresenceEntry[]>(this.universePresenceKey(universeId), []);
    const now = Date.now();
    const next = list.filter((entry) => now - entry.lastSeen < 15_000);
    if (next.length !== list.length) {
      if (next.length === 0 && typeof window !== 'undefined') {
        window.localStorage.removeItem(this.universePresenceKey(universeId));
      } else {
        this.persist(this.universePresenceKey(universeId), next);
      }
    }
    this.clearUniverseSessionIfNeeded(universeId, next);
    return next;
  }

  private universePresenceKey(universeId: string) {
    return `${UNIVERSE_PRESENCE_KEY}:${universeId}`;
  }

  private universeChatKey(universeId: string) {
    return `${UNIVERSE_CHAT_KEY}:${universeId}`;
  }

  private universeEditKey(universeId: string) {
    return `${UNIVERSE_EDIT_KEY}:${universeId}`;
  }

  private universeGuestCounterKey(universeId: string) {
    return `${UNIVERSE_GUEST_COUNTER_KEY}:${universeId}`;
  }
}
