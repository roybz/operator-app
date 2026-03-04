import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { APP_REGISTRY } from '../features/dependencies/app-registry';
import { AppId, DialogRect } from '../features/dependencies/app-types';
import packageJson from '../../../package.json';
import { StorageService } from './storage/storage.service';
import { CognitoOidcService } from './auth/cognito-oidc.service';
import { writeWithConflictRetry } from './storage/remote-write-utils';
import { getOpCapabilities } from './op-config';
import {
  UniverseAccessContext,
  canEditUniverse,
  canGrantUniversePencil,
  canInviteToUniverse,
  getUniversePermissionSet,
  isUniverseViewOnly,
} from './authz/universe-role-policy';

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
  activeInstanceId?: string | null;
  activeObjectId?: string | null;
  activeMode?: 'edit' | 'inspect' | 'search' | 'present';
  activeUpdatedAt?: number;
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

export interface UniverseInfo {
  id: string;
  name: string;
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
  colorTheme: 'standard' | 'notepad' | 'ice' | 'lava' | 'green';
  accessibilityMode: boolean;
  phoneMode: boolean;
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
  universeOpened: boolean;
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

interface DialogInstanceState {
  id: string;
  appId: AppId;
  titleKey: string;
  rect: DialogRect;
  minimized: boolean;
  stashed: boolean;
  z: number;
  isMaximized: boolean;
  deleteLocked?: boolean;
}

interface DialogStateSnapshot {
  workspaces: { id: string; name: string }[];
  activeWorkspaceId: string;
  dialogsByWorkspace: Record<string, DialogInstanceState[]>;
  hiddenWorkspaces: Record<string, boolean>;
  zCounter: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';
const isNullableUserRole = (value: unknown): value is UserRole | null =>
  value === null ||
  value === 'admin' ||
  value === 'user' ||
  value === 'guest' ||
  value === 'observer' ||
  value === 'invitee';

const isSessionStateContract = (value: unknown): value is SessionState => {
  if (!isRecord(value)) return false;
  return (
    isNullableString(value['userId']) &&
    isNullableString(value['previewUserId']) &&
    isBoolean(value['previewPersist']) &&
    isNullableUserRole(value['sessionRole']) &&
    isNullableString(value['sessionUsername']) &&
    isNullableString(value['universeOwnerId']) &&
    isNullableString(value['universeId'])
  );
};

const isOrgSettingsContract = (value: unknown): value is OrgSettings => {
  if (!isRecord(value)) return false;
  return (
    isString(value['siteTitle']) &&
    isString(value['siteLogoEmoji']) &&
    isBoolean(value['testModeEnabled']) &&
    isBoolean(value['allowGuestLogin']) &&
    typeof value['defaultViewportWidth'] === 'number' &&
    typeof value['defaultViewportHeight'] === 'number' &&
    isBoolean(value['disableViewportSizing']) &&
    isBoolean(value['disableZoomControls']) &&
    isBoolean(value['allowServerBackground'])
  );
};

const USERS_KEY = 'op_users';
const SESSION_KEY = 'op_session';
const PREFS_KEY = 'op_prefs';
const PREVIEW_PREFS_KEY = 'op_preview_prefs';
const ORG_SETTINGS_KEY = 'op_org_settings';
const INVITEES_KEY = 'op_invitees';
const UNIVERSES_KEY = 'op_universes';
const ACTIVE_UNIVERSE_KEY = 'op_active_universe';
const UNIVERSE_PRESENCE_KEY = 'op_universe_presence';
const UNIVERSE_CHAT_KEY = 'op_universe_chat';
const UNIVERSE_EDIT_KEY = 'op_universe_edit_holder';
const UNIVERSE_GUEST_COUNTER_KEY = 'op_universe_guest_counter';
const UNIVERSE_KICK_KEY = 'op_universe_kick';
const GUEST_USER_ID = 'u_guest';
const GUEST_USERNAME = 'guest';
const DIALOG_STATE_KEY = 'op_dialog_state_v1';
const PREVIEW_STATE_KEY = 'op_preview_dialog_state_v1';
const MOCK_TODO_KEY = 'op_mock_todos';
const DEFAULT_ADMIN_HASH =
  'sha256:62d9ba597c35a2f737a0173ea82a5289c6628e5a06674ebbb140848810961838';
const LOGIN_SECURITY_KEY = 'op_login_security';
const LOGIN_PHONE_MODE_KEY = 'op_login_phone_mode';
const LOGIN_PHONE_MODE_APPLY_KEY = 'op_login_phone_mode_apply';
const DEVICE_UI_PREFS_KEY = 'op_device_ui_prefs_v1';
const SUPPORTED_LANGUAGES = [
  'af',
  'am',
  'ar',
  'bn',
  'ca',
  'cy',
  'de',
  'el',
  'en',
  'en-AU',
  'en-CA',
  'en-GB',
  'en-NZ',
  'en-US',
  'es',
  'es-419',
  'es-ES',
  'et',
  'fa',
  'fi',
  'fr',
  'fr-CA',
  'fr-FR',
  'ga',
  'ha',
  'he',
  'hi',
  'hr',
  'ht',
  'ig',
  'it',
  'ja',
  'jam',
  'km',
  'ko',
  'ms',
  'nl',
  'no',
  'pa',
  'pl',
  'pt',
  'pt-BR',
  'pt-PT',
  'ru',
  'sco',
  'sv',
  'sw',
  'th',
  'tr',
  'uk',
  'ur',
  'ur-PK',
  'vi',
  'yo',
  'zh-Hans',
  'zh-Hant',
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly usersSignal = signal<UserRecord[]>([]);
  private readonly inviteesSignal = signal<Record<string, InviteeRecord[]>>({});
  private readonly universesSignal = signal<Record<string, UniverseInfo[]>>({});
  private readonly activeUniverseSignal = signal<Record<string, string>>({});
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
  readonly universes = this.universesSignal.asReadonly();
  readonly activeUniverseIds = this.activeUniverseSignal.asReadonly();
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
  private storage = inject(StorageService);
  private cognitoOidc = inject(CognitoOidcService);

  constructor() {
    this.updateUniverseContextFromLocation();
  }

  async hydrate() {
    await this.loadFromStorage();
    this.applyExternalAuthSession();
    this.updateUniverseContextFromLocation();
    this.readySignal.set(true);
  }

  async login(username: string, password: string): Promise<{ ok: boolean; message?: string }> {
    if (this.usesExternalAuth()) {
      await this.cognitoOidc.startLogin();
      return { ok: false };
    }
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
      sessionRole: 'user',
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

    this.removeKey(`op_accessibility_prompted_${GUEST_USER_ID}`);
    this.keys()
      .filter((key) => key.startsWith(`op_accessibility_prompted_${GUEST_USER_ID}:`))
      .forEach((key) => this.removeKey(key));
  }

  logout() {
    const hadExternalAuth = this.usesExternalAuth();
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
    if (hadExternalAuth) {
      this.cognitoOidc.clearSession();
    }
  }

  usesExternalAuth(): boolean {
    const capabilities = getOpCapabilities();
    return capabilities.auth && this.cognitoOidc.isEnabled() && this.cognitoOidc.isConfigured();
  }

  canUsePasswordLogin(): boolean {
    return !this.usesExternalAuth();
  }

  getUniverseAccessContext(input?: {
    universeOwnerId?: string | null;
    universeEditHolderId?: string | null;
    multiUserEnabled?: boolean;
    viaShareLink?: boolean;
  }): UniverseAccessContext {
    const session = this.sessionSignal();
    const ownerId = input?.universeOwnerId ?? session.universeOwnerId ?? session.userId ?? null;
    return {
      sessionUserId: session.userId,
      sessionRole:
        session.sessionRole ?? this.actualUser()?.role ?? this.currentUser()?.role ?? 'user',
      universeOwnerId: ownerId,
      multiUserEnabled: Boolean(input?.multiUserEnabled ?? false),
      universeEditHolderId: input?.universeEditHolderId ?? null,
      viaShareLink: Boolean(input?.viaShareLink),
    };
  }

  getUniversePermissionSet(input?: {
    universeOwnerId?: string | null;
    universeEditHolderId?: string | null;
    multiUserEnabled?: boolean;
    viaShareLink?: boolean;
  }) {
    return getUniversePermissionSet(this.getUniverseAccessContext(input));
  }

  canEditUniverse(input?: {
    universeOwnerId?: string | null;
    universeEditHolderId?: string | null;
    multiUserEnabled?: boolean;
    viaShareLink?: boolean;
  }): boolean {
    return canEditUniverse(this.getUniverseAccessContext(input));
  }

  canInvite(input?: {
    universeOwnerId?: string | null;
    universeEditHolderId?: string | null;
    multiUserEnabled?: boolean;
    viaShareLink?: boolean;
  }): boolean {
    return canInviteToUniverse(this.getUniverseAccessContext(input));
  }

  canGrantPencil(input?: {
    universeOwnerId?: string | null;
    universeEditHolderId?: string | null;
    multiUserEnabled?: boolean;
    viaShareLink?: boolean;
  }): boolean {
    return canGrantUniversePencil(this.getUniverseAccessContext(input));
  }

  canViewOnly(input?: {
    universeOwnerId?: string | null;
    universeEditHolderId?: string | null;
    multiUserEnabled?: boolean;
    viaShareLink?: boolean;
  }): boolean {
    return isUniverseViewOnly(this.getUniverseAccessContext(input));
  }

  async startExternalLogin() {
    await this.cognitoOidc.startLogin();
  }

  async startExternalSignup(): Promise<{ ok: boolean; message?: string }> {
    if (!this.isPublicSignupEnabled()) {
      return { ok: false, message: 'auth.error.generic' };
    }
    await this.cognitoOidc.startSignup();
    return { ok: true };
  }

  isPublicSignupPrepared(): boolean {
    return getOpCapabilities().publicSignupPrepared;
  }

  isPublicSignupEnabled(): boolean {
    return getOpCapabilities().publicSignupEnabled;
  }

  startExternalLogout() {
    this.cognitoOidc.startLogout();
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
    this.removeKey(`${DIALOG_STATE_KEY}:${userId}`);
    this.removeKey(`${PREVIEW_STATE_KEY}:${userId}`);

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
    this.setLoginPhoneModePreference(prefs.phoneMode);
    const universeId = this.getActiveUniverseId(effectiveId) ?? prefs.universeId;
    const key = this.universeKey(effectiveId, universeId || this.createUniverseId());
    if (this.usesExternalAuth()) {
      this.setDevicePhoneModePreferenceFor(effectiveId, prefs.phoneMode);
    }
    const currentName = universeId
      ? this.getUniversesForUser(effectiveId).find((u) => u.id === universeId)?.name
      : undefined;
    const trimmedName = prefs.universeName?.trim() || '';
    const defaultName = this.defaultPreferences().universeName ?? 'Universe';
    const safeName =
      !trimmedName ||
      (currentName &&
        currentName.trim() &&
        (trimmedName === defaultName || trimmedName === 'Universe') &&
        currentName !== 'Universe')
        ? currentName || defaultName
        : trimmedName;
    const nextPrefs = {
      ...prefs,
      universeId: universeId ?? prefs.universeId,
      universeName: safeName,
      ...(this.usesExternalAuth()
        ? {
            phoneMode: this.prefsSignal()[key]?.phoneMode ?? this.defaultPreferences().phoneMode,
          }
        : {}),
    };

    if (this.isPreviewing() && !this.previewPersist()) {
      const nextPreviewPrefs = { ...this.previewPrefsSignal(), [key]: nextPrefs };
      this.previewPrefsSignal.set(nextPreviewPrefs);
      this.persistPreviewPrefs();
    } else {
      const nextAll = { ...this.prefsSignal(), [key]: nextPrefs };
      this.prefsSignal.set(nextAll);
      this.persistPrefs();
    }

    if (universeId) {
      const list = this.getUniversesForUser(effectiveId);
      if (list.length) {
        const nextList = list.map((u) => (u.id === universeId ? { ...u, name: safeName } : u));
        if (JSON.stringify(nextList) !== JSON.stringify(list)) {
          this.universesSignal.set({ ...this.universesSignal(), [effectiveId]: nextList });
          this.persistUniverses();
        }
      }
    }

    this.applyLanguageFromPreferences();
  }

  setLoginPhoneModePreference(enabled: boolean) {
    void this.storage.setItem(LOGIN_PHONE_MODE_KEY, JSON.stringify(Boolean(enabled)));
  }

  getLoginPhoneModePreference() {
    const raw = this.storage.getItemSync(LOGIN_PHONE_MODE_KEY);
    if (!raw) return null;
    try {
      return Boolean(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  applyLoginPhoneModePreference() {
    if (!this.isLoggedIn()) return;
    const pref = this.getLoginPhoneModePreference();
    if (pref === null) return;
    if (this.usesExternalAuth()) {
      const effectiveId = this.effectiveUserId();
      if (!effectiveId) return;
      this.setDevicePhoneModePreferenceFor(effectiveId, pref);
      return;
    }
    const prefs = this.preferences();
    if (prefs.phoneMode === pref) return;
    void this.storage.setItem(LOGIN_PHONE_MODE_APPLY_KEY, String(Date.now()));
    this.savePreferences({ ...prefs, phoneMode: pref });
  }

  consumeLoginPhoneModeApplyFlag() {
    const raw = this.storage.getItemSync(LOGIN_PHONE_MODE_APPLY_KEY);
    if (!raw) return false;
    void this.storage.removeItem(LOGIN_PHONE_MODE_APPLY_KEY);
    return true;
  }

  saveUniversePreferences(userId: string, universeId: string, prefs: UserPreferences) {
    const key = this.universeKey(userId, universeId);
    const nextAll = { ...this.prefsSignal(), [key]: prefs };
    this.prefsSignal.set(nextAll);
    this.persistPrefs();
  }

  markUniverseOpened(userId: string, universeId: string) {
    const key = this.universeKey(userId, universeId);
    const stored = this.prefsSignal()[key];
    if (!stored || stored.universeOpened) return;
    this.prefsSignal.set({ ...this.prefsSignal(), [key]: { ...stored, universeOpened: true } });
    this.persistPrefs();
  }

  getPreferencesFor(userId: string | null): UserPreferences {
    if (!userId) return this.defaultPreferences();

    if (this.isPreviewing() && !this.previewPersist()) {
      const universeId = this.getActiveUniverseId(userId) ?? this.defaultPreferences().universeId;
      const previewPrefs = this.previewPrefsSignal()[this.universeKey(userId, universeId)];
      if (previewPrefs) return { ...this.defaultPreferences(), ...previewPrefs };
    }

    const universeId = this.getActiveUniverseId(userId) ?? this.defaultPreferences().universeId;
    const stored = this.prefsSignal()[this.universeKey(userId, universeId)];
    const merged = stored ? { ...this.defaultPreferences(), ...stored } : this.defaultPreferences();
    const legacyHide = (stored as { hideViewportControls?: boolean } | undefined)
      ?.hideViewportControls;
    if (legacyHide !== undefined) {
      merged.hideViewportSizingControls = legacyHide;
      merged.hideZoomControls = legacyHide;
    }
    if (this.usesExternalAuth()) {
      const localPhoneMode = this.getDevicePhoneModePreferenceFor(userId);
      merged.phoneMode = localPhoneMode ?? this.getDefaultPhoneMode();
    }
    return merged;
  }

  private getDevicePhoneModePreferenceFor(userId: string) {
    const raw = this.safeJson<Record<string, { phoneMode?: boolean }>>(DEVICE_UI_PREFS_KEY, {});
    const phoneMode = raw[userId]?.phoneMode;
    return typeof phoneMode === 'boolean' ? phoneMode : null;
  }

  private setDevicePhoneModePreferenceFor(userId: string, enabled: boolean) {
    const raw = this.safeJson<Record<string, { phoneMode?: boolean }>>(DEVICE_UI_PREFS_KEY, {});
    raw[userId] = { ...(raw[userId] ?? {}), phoneMode: Boolean(enabled) };
    this.persist(DEVICE_UI_PREFS_KEY, raw);
  }

  private effectiveUserId(): string | null {
    if (this.guestModeOnly()) return GUEST_USER_ID;
    return (
      this.sessionSignal().previewUserId ??
      this.sessionSignal().universeOwnerId ??
      this.sessionSignal().userId
    );
  }

  private universeKey(userId: string, universeId: string) {
    return `${userId}:${universeId}`;
  }

  getUniversesForUser(userId: string) {
    return this.universesSignal()[userId] ?? [];
  }

  getActiveUniverseId(userId: string) {
    const session = this.sessionSignal();
    if (session.universeOwnerId === userId && session.universeId) {
      return session.universeId;
    }
    if (session.userId === userId && session.universeId) {
      return session.universeId;
    }
    const active = this.activeUniverseSignal()[userId];
    if (active) return active;
    const first = this.getUniversesForUser(userId)[0];
    return first?.id ?? null;
  }

  setActiveUniverseId(userId: string, universeId: string) {
    const list = this.getUniversesForUser(userId);
    if (!list.some((u) => u.id === universeId)) return;
    const next = { ...this.activeUniverseSignal(), [userId]: universeId };
    this.activeUniverseSignal.set(next);
    this.persistActiveUniverses();
    const session = this.sessionSignal();
    if (session.userId === userId) {
      this.sessionSignal.set({ ...session, universeId });
      this.persistSession();
    }
    this.markUniverseOpened(userId, universeId);
  }

  createUniverse(userId: string, name: string, activate = true) {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, message: 'universe.nameRequired' };
    const list = this.getUniversesForUser(userId);
    if (list.length >= 8) return { ok: false, message: 'universe.maxReached' };
    const id = this.createUniverseId();
    const nextList = [...list, { id, name: trimmed }];
    this.universesSignal.set({ ...this.universesSignal(), [userId]: nextList });
    this.persistUniverses();
    const baseUniverseId = this.getActiveUniverseId(userId) ?? list[0]?.id ?? null;
    const basePrefs = baseUniverseId
      ? this.getUniversePreferences(userId, baseUniverseId)
      : this.defaultPreferences();
    const prefs = {
      ...this.defaultPreferences(),
      universeId: id,
      universeName: trimmed,
      accessibilityMode: basePrefs.accessibilityMode,
    };
    const key = this.universeKey(userId, id);
    this.prefsSignal.set({ ...this.prefsSignal(), [key]: prefs });
    this.persistPrefs();
    if (activate) {
      this.setActiveUniverseId(userId, id);
    }
    return { ok: true, id };
  }

  renameUniverse(userId: string, universeId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const list = this.getUniversesForUser(userId);
    if (!list.length) return false;
    const nextList = list.map((u) => (u.id === universeId ? { ...u, name: trimmed } : u));
    this.universesSignal.set({ ...this.universesSignal(), [userId]: nextList });
    this.persistUniverses();
    const key = this.universeKey(userId, universeId);
    const stored = this.prefsSignal()[key];
    if (stored) {
      this.prefsSignal.set({ ...this.prefsSignal(), [key]: { ...stored, universeName: trimmed } });
      this.persistPrefs();
    }
    return true;
  }

  deleteUniverse(userId: string, universeId: string) {
    const list = this.getUniversesForUser(userId);
    if (list.length <= 1) return { ok: false, message: 'universe.minReached' };
    if (!list.some((u) => u.id === universeId)) {
      return { ok: false, message: 'universe.notFound' };
    }
    const nextList = list.filter((u) => u.id !== universeId);
    const activeId = this.getActiveUniverseId(userId);
    const nextActive = activeId === universeId ? (nextList[0]?.id ?? null) : activeId;

    const nextPrefs = { ...this.prefsSignal() };
    delete nextPrefs[this.universeKey(userId, universeId)];

    this.keys()
      .filter((key) => key.includes(`:${userId}:${universeId}:`))
      .forEach((key) => this.removeKey(key));
    this.removeKey(`${DIALOG_STATE_KEY}:${userId}:${universeId}`);
    this.removeKey(`${PREVIEW_STATE_KEY}:${userId}:${universeId}`);
    this.removeKey(`${UNIVERSE_PRESENCE_KEY}:${universeId}`);
    this.removeKey(`${UNIVERSE_CHAT_KEY}:${universeId}`);
    this.removeKey(`${UNIVERSE_EDIT_KEY}:${universeId}`);
    this.removeKey(`${UNIVERSE_GUEST_COUNTER_KEY}:${universeId}`);
    this.removeKey(`${UNIVERSE_KICK_KEY}:${universeId}`);

    this.universesSignal.set({ ...this.universesSignal(), [userId]: nextList });
    if (nextActive) {
      this.activeUniverseSignal.set({ ...this.activeUniverseSignal(), [userId]: nextActive });
    }
    this.prefsSignal.set(nextPrefs);
    this.persistUniverses();
    this.persistActiveUniverses();
    this.persistPrefs();

    const session = this.sessionSignal();
    if (session.userId === userId && session.universeId === universeId) {
      this.sessionSignal.set({ ...session, universeId: nextActive ?? null });
      this.persistSession();
      this.applyLanguageFromPreferences();
    }

    return { ok: true };
  }

  exportAllUniverses(userId: string) {
    if (typeof window === 'undefined') {
      return {
        version: 1,
        ownerId: userId,
        universes: [],
        activeUniverseId: null,
        preferences: {},
        entries: [],
      };
    }
    const universes = this.getUniversesForUser(userId);
    const activeUniverseId = this.getActiveUniverseId(userId);
    const preferences: Record<string, UserPreferences> = {};
    universes.forEach((u) => {
      const key = this.universeKey(userId, u.id);
      const stored = this.prefsSignal()[key];
      preferences[u.id] = stored
        ? { ...this.defaultPreferences(), ...stored }
        : this.getUniversePreferences(userId, u.id);
    });
    const entries = this.keys()
      .filter(
        (key) =>
          key.startsWith('op_app_state:') ||
          key.startsWith('op_mock_todos:') ||
          key.startsWith('op_dialog_state_v1:') ||
          key.startsWith('op_preview_dialog_state_v1:'),
      )
      .filter((key) => key.includes(`:${userId}:`))
      .map((key) => ({ key, value: this.getRaw(key) ?? '' }));
    return { version: 1, ownerId: userId, universes, activeUniverseId, preferences, entries };
  }

  importAllUniverses(
    userId: string,
    payload: {
      version?: number;
      ownerId?: string;
      universes?: UniverseInfo[];
      activeUniverseId?: string | null;
      preferences?: Record<string, UserPreferences>;
      entries?: { key?: string; value?: string }[];
    },
  ) {
    if (!payload?.universes || !Array.isArray(payload.universes) || !payload.universes.length) {
      return { ok: false, message: 'settings.importFailed' };
    }
    if (payload.universes.length > 8) {
      return { ok: false, message: 'universe.maxReached' };
    }
    const nextUniverses = payload.universes.map((u) => ({
      id: u.id,
      name: u.name?.trim() || 'Universe',
    }));
    const activeUniverseId =
      payload.activeUniverseId && nextUniverses.some((u) => u.id === payload.activeUniverseId)
        ? payload.activeUniverseId
        : nextUniverses[0].id;

    const nextPrefs = { ...this.prefsSignal() };
    Object.keys(nextPrefs)
      .filter((key) => key.startsWith(`${userId}:`))
      .forEach((key) => delete nextPrefs[key]);
    const prefsMap = payload.preferences ?? {};
    nextUniverses.forEach((u) => {
      const stored = prefsMap[u.id] ?? {};
      nextPrefs[this.universeKey(userId, u.id)] = {
        ...this.defaultPreferences(),
        ...stored,
        universeId: u.id,
        universeName: u.name,
      };
    });

    this.clearUniverseDataForUser(userId);
    if (payload.entries && Array.isArray(payload.entries)) {
      payload.entries.forEach((entry) => {
        if (!entry?.key || typeof entry.value !== 'string') return;
        const rewritten = this.rewriteUniverseKey(entry.key, payload.ownerId, userId);
        if (!this.isAllowedUniverseDataKey(rewritten, userId)) return;
        this.setRaw(rewritten, entry.value);
      });
    }

    this.universesSignal.set({ ...this.universesSignal(), [userId]: nextUniverses });
    this.activeUniverseSignal.set({ ...this.activeUniverseSignal(), [userId]: activeUniverseId });
    this.prefsSignal.set(nextPrefs);
    this.persistUniverses();
    this.persistActiveUniverses();
    this.persistPrefs();

    const session = this.sessionSignal();
    if (session.userId === userId) {
      this.sessionSignal.set({ ...session, universeId: activeUniverseId });
      this.persistSession();
    }

    this.applyLanguageFromPreferences();
    return { ok: true };
  }

  wipeAllUniverses(userId: string) {
    const nextId = this.createUniverseId();
    const nextUniverses = [{ id: nextId, name: 'Universe' }];

    const nextPrefs = { ...this.prefsSignal() };
    Object.keys(nextPrefs)
      .filter((key) => key.startsWith(`${userId}:`))
      .forEach((key) => delete nextPrefs[key]);
    nextPrefs[this.universeKey(userId, nextId)] = {
      ...this.defaultPreferences(),
      universeId: nextId,
      universeName: 'Universe',
    };

    this.clearUniverseDataForUser(userId);

    this.universesSignal.set({ ...this.universesSignal(), [userId]: nextUniverses });
    this.activeUniverseSignal.set({ ...this.activeUniverseSignal(), [userId]: nextId });
    this.prefsSignal.set(nextPrefs);
    this.persistUniverses();
    this.persistActiveUniverses();
    this.persistPrefs();

    const session = this.sessionSignal();
    if (session.userId === userId) {
      this.sessionSignal.set({ ...session, universeId: nextId });
      this.persistSession();
    }

    this.applyLanguageFromPreferences();
  }

  storageUserKey() {
    const session = this.sessionSignal();
    const userId = session.previewUserId ?? session.universeOwnerId ?? session.userId ?? 'guest';
    const universeId = this.getActiveUniverseId(userId) ?? 'default';
    return this.universeKey(userId, universeId);
  }

  private clearUniverseDataForUser(userId: string) {
    this.keys()
      .filter(
        (key) =>
          key.startsWith('op_app_state:') ||
          key.startsWith('op_mock_todos:') ||
          key.startsWith('op_dialog_state_v1:') ||
          key.startsWith('op_preview_dialog_state_v1:'),
      )
      .filter((key) => key.includes(`:${userId}:`))
      .forEach((key) => this.removeKey(key));

    const universeIds = this.getUniversesForUser(userId).map((u) => u.id);
    universeIds.forEach((id) => {
      this.removeKey(`${UNIVERSE_PRESENCE_KEY}:${id}`);
      this.removeKey(`${UNIVERSE_CHAT_KEY}:${id}`);
      this.removeKey(`${UNIVERSE_EDIT_KEY}:${id}`);
      this.removeKey(`${UNIVERSE_GUEST_COUNTER_KEY}:${id}`);
      this.removeKey(`${UNIVERSE_KICK_KEY}:${id}`);
    });
  }

  private migrateLegacyUniverseStorage(userId: string, universeId: string) {
    const legacyDialog = `${DIALOG_STATE_KEY}:${userId}`;
    const legacyPreview = `${PREVIEW_STATE_KEY}:${userId}`;
    const nextDialog = `${DIALOG_STATE_KEY}:${userId}:${universeId}`;
    const nextPreview = `${PREVIEW_STATE_KEY}:${userId}:${universeId}`;
    if (this.getRaw(legacyDialog) && !this.getRaw(nextDialog)) {
      this.setRaw(nextDialog, this.getRaw(legacyDialog) ?? '');
    }
    if (this.getRaw(legacyPreview) && !this.getRaw(nextPreview)) {
      this.setRaw(nextPreview, this.getRaw(legacyPreview) ?? '');
    }

    const prefixList = ['op_app_state:', 'op_mock_todos:'];
    this.keys().forEach((key) => {
      if (!prefixList.some((prefix) => key.startsWith(prefix))) return;
      const needle = `:${userId}:`;
      if (!key.includes(needle)) return;
      if (key.includes(`:${userId}:${universeId}:`)) return;
      const nextKey = key.replace(needle, `:${userId}:${universeId}:`);
      if (this.getRaw(nextKey) !== null) return;
      const value = this.getRaw(key);
      if (value !== null) {
        this.setRaw(nextKey, value);
      }
    });
  }

  private rewriteUniverseKey(key: string, sourceUserId: string | undefined, targetUserId: string) {
    if (!sourceUserId) return key;
    return key.replace(`:${sourceUserId}:`, `:${targetUserId}:`);
  }

  private isAllowedUniverseDataKey(key: string, userId: string) {
    const allowed =
      key.startsWith('op_app_state:') ||
      key.startsWith('op_mock_todos:') ||
      key.startsWith('op_dialog_state_v1:') ||
      key.startsWith('op_preview_dialog_state_v1:');
    if (!allowed) return false;
    return key.includes(`:${userId}:`);
  }

  private applyExternalAuthSession() {
    if (!this.usesExternalAuth()) return;
    const profile = this.cognitoOidc.getProfile();
    if (!profile) return;
    if (!this.usersSignal().some((user) => user.id === profile.sub)) {
      this.usersSignal.set([
        ...this.usersSignal(),
        {
          id: profile.sub,
          username: profile.username,
          password: '',
          role: 'admin',
        },
      ]);
      this.persistUsers();
    }
    if (!this.getUniversesForUser(profile.sub).length) {
      const universeId = this.createUniverseId();
      const universeName = 'Universe';
      this.universesSignal.set({
        ...this.universesSignal(),
        [profile.sub]: [{ id: universeId, name: universeName }],
      });
      this.activeUniverseSignal.set({ ...this.activeUniverseSignal(), [profile.sub]: universeId });
      this.prefsSignal.set({
        ...this.prefsSignal(),
        [this.universeKey(profile.sub, universeId)]: {
          ...this.defaultPreferences(),
          universeId,
          universeName,
        },
      });
      this.persistUniverses();
      this.persistActiveUniverses();
      this.persistPrefs();
    }
    const session = this.sessionSignal();
    const activeUniverseId = this.getActiveUniverseId(profile.sub);
    const nextSession = this.normalizeSessionState({
      userId: profile.sub,
      previewUserId: null,
      previewPersist: false,
      sessionRole: 'admin',
      sessionUsername: profile.username,
      universeOwnerId: null,
      universeId: activeUniverseId ?? session.universeId ?? null,
    });
    if (!this.sessionStatesEqual(session, nextSession)) {
      this.sessionSignal.set(nextSession);
      this.persistSession();
    }
    this.applyLoginPhoneModePreference();
  }

  private async loadFromStorage() {
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
      this.sessionSignal.set(
        this.normalizeSessionState({
          userId: validUserId,
          previewUserId: null,
          previewPersist: false,
        }),
      );
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
    const universes = this.safeJson<Record<string, UniverseInfo[]>>(UNIVERSES_KEY, {});
    const activeUniverses = this.safeJson<Record<string, string>>(ACTIVE_UNIVERSE_KEY, {});
    let prefsUpdated = false;
    let universesUpdated = false;

    const ensureUniversePrefs = (
      userId: string,
      universe: UniverseInfo,
      base?: UserPreferences,
      baseAccessibility?: boolean,
    ) => {
      const key = this.universeKey(userId, universe.id);
      if (!prefs[key]) {
        prefs[key] = {
          ...this.defaultPreferences(),
          ...base,
          universeId: universe.id,
          universeName: universe.name,
        };
        if (baseAccessibility) {
          prefs[key].accessibilityMode = true;
        }
        prefsUpdated = true;
      }
      if (!prefs[key].universeId) {
        prefs[key] = { ...prefs[key], universeId: universe.id };
        prefsUpdated = true;
      }
      if (!prefs[key].universeName?.trim()) {
        prefs[key] = { ...prefs[key], universeName: universe.name };
        prefsUpdated = true;
      }
      if (prefs[key].universeName === 'Universe' && universe.name !== 'Universe') {
        prefs[key] = { ...prefs[key], universeName: universe.name };
        prefsUpdated = true;
      }
      if (prefs[key].multiUserEnabled === undefined) {
        prefs[key] = { ...prefs[key], multiUserEnabled: true };
        prefsUpdated = true;
      }
      if (prefs[key].allowUniverseGuests === undefined) {
        prefs[key] = { ...prefs[key], allowUniverseGuests: false };
        prefsUpdated = true;
      }
      if (prefs[key].allowUniverseObservers === undefined) {
        prefs[key] = { ...prefs[key], allowUniverseObservers: false };
        prefsUpdated = true;
      }
      if (prefs[key].allowUniverseChat === undefined) {
        prefs[key] = { ...prefs[key], allowUniverseChat: true };
        prefsUpdated = true;
      }
      if (prefs[key].universeOpened === undefined) {
        prefs[key] = { ...prefs[key], universeOpened: false };
        prefsUpdated = true;
      }
      if (prefs[key].phoneMode === undefined) {
        prefs[key] = { ...prefs[key], phoneMode: this.isPhoneDevice() };
        prefsUpdated = true;
      }
      if (prefs[key].universeGuestPassword === undefined) {
        prefs[key] = { ...prefs[key], universeGuestPassword: '' };
        prefsUpdated = true;
      }
      if (prefs[key].universeObserverPassword === undefined) {
        prefs[key] = { ...prefs[key], universeObserverPassword: '' };
        prefsUpdated = true;
      }
    };

    const userIds = normalizedUsers.map((u) => u.id);
    userIds.forEach((userId) => {
      const legacy = prefs[userId];
      let list = universes[userId] ?? [];
      if (!list.length) {
        const universeId = legacy?.universeId ?? this.createUniverseId();
        const universeName =
          userId === GUEST_USER_ID
            ? 'Default universe'
            : legacy?.universeName?.trim() || 'Universe';
        list = [{ id: universeId, name: universeName }];
        if (userId === GUEST_USER_ID) {
          list.push({
            id: this.createUniverseId(),
            name: 'Example universe for guests 2',
          });
          list.push({
            id: this.createUniverseId(),
            name: 'Example universe for guests 3',
          });
        }
        universes[userId] = list;
        universesUpdated = true;
      }
      if (userId === GUEST_USER_ID && list.length >= 1) {
        const defaultName = list[0].name?.trim();
        if (!defaultName || defaultName === 'Universe') {
          list[0] = { ...list[0], name: 'Default universe' };
          universes[userId] = list;
          universesUpdated = true;
        }
        if (list.length < 3) {
          const existingNames = new Set(list.map((u) => u.name));
          if (!existingNames.has('Example universe for guests 2')) {
            list.push({
              id: this.createUniverseId(),
              name: 'Example universe for guests 2',
            });
          }
          if (!existingNames.has('Example universe for guests 3')) {
            list.push({
              id: this.createUniverseId(),
              name: 'Example universe for guests 3',
            });
          }
          universes[userId] = list;
          universesUpdated = true;
        }
      }
      if (list.length) {
        ensureUniversePrefs(userId, list[0], legacy);
      }
      const baseKey = list.length ? this.universeKey(userId, list[0].id) : null;
      const basePrefs = baseKey ? prefs[baseKey] : undefined;
      const baseAccessibility = Boolean(basePrefs?.accessibilityMode);
      list.forEach((u, idx) => {
        if (idx === 0) return;
        ensureUniversePrefs(userId, u, undefined, baseAccessibility);
      });
      if (legacy) {
        delete prefs[userId];
        prefsUpdated = true;
      }
      const active = activeUniverses[userId];
      if (!active || !list.some((u) => u.id === active)) {
        activeUniverses[userId] = list[0].id;
        universesUpdated = true;
      }
    });

    this.universesSignal.set(universes);
    this.activeUniverseSignal.set(activeUniverses);
    userIds.forEach((userId) => {
      const universeId = activeUniverses[userId];
      if (universeId) {
        this.migrateLegacyUniverseStorage(userId, universeId);
      }
    });
    const currentUserId = this.sessionSignal().userId;
    if (currentUserId && !this.sessionSignal().universeId) {
      const activeId = activeUniverses[currentUserId];
      if (activeId) {
        this.sessionSignal.set({ ...this.sessionSignal(), universeId: activeId });
      }
    }
    if (guestOnly) {
      const guestUniverseId = activeUniverses[GUEST_USER_ID];
      const key = guestUniverseId ? this.universeKey(GUEST_USER_ID, guestUniverseId) : null;
      this.prefsSignal.set(key ? { [key]: prefs[key] } : {});
    } else {
      this.prefsSignal.set(prefs);
    }

    this.seedGuestUniverseDialogs(universes[GUEST_USER_ID] ?? []);

    const previewPrefs = this.safeJson<StoredPreviewPreferences>(PREVIEW_PREFS_KEY, {});
    this.previewPrefsSignal.set(guestOnly ? {} : previewPrefs);

    const invitees = this.safeJson<Record<string, InviteeRecord[]>>(INVITEES_KEY, {});
    this.inviteesSignal.set(invitees);

    this.persistUsers();
    this.persistSession();
    if (prefsUpdated) this.persistPrefs();
    if (universesUpdated) {
      this.persistUniverses();
      this.persistActiveUniverses();
    }
    this.persistOrgSettings();
    this.applyLanguageFromPreferences();

    this.loginSecurity = this.safeJson<Record<string, { count: number; lockedUntil: number }>>(
      LOGIN_SECURITY_KEY,
      {},
    );
  }

  private seedGuestUniverseDialogs(universes: UniverseInfo[]) {
    if (!universes.length) return;
    universes.forEach((universe) => {
      const key = `${DIALOG_STATE_KEY}:${GUEST_USER_ID}:${universe.id}`;
      if (this.getRaw(key)) return;
      const workspaceId = `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const instances: DialogInstanceState[] = [];
      const addInstance = (appId: AppId, x: number, y: number, z: number) => {
        const def = APP_REGISTRY[appId];
        const rect = def?.defaultSize ?? { x: 0, y: 0, width: 480, height: 360 };
        instances.push({
          id: `dlg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          appId,
          titleKey: def?.labelKey ?? `apps.${appId}`,
          rect: { x, y, width: rect.width, height: rect.height },
          minimized: false,
          stashed: false,
          z,
          isMaximized: false,
          deleteLocked: false,
        });
      };
      addInstance('clock', 40, 40, 1);
      addInstance('stickyNotes', 420, 40, 2);
      addInstance('notes', 40, 320, 3);
      const snapshot: DialogStateSnapshot = {
        workspaces: [{ id: workspaceId, name: 'Workspace 1' }],
        activeWorkspaceId: workspaceId,
        dialogsByWorkspace: { [workspaceId]: instances },
        hiddenWorkspaces: {},
        zCounter: instances.length,
      };
      this.setRaw(key, JSON.stringify(snapshot));
    });
  }

  private persistUsers() {
    this.persist(USERS_KEY, this.usersSignal());
  }

  private persistInvitees() {
    this.persist(INVITEES_KEY, this.inviteesSignal());
  }

  private persistUniverses() {
    this.persist(UNIVERSES_KEY, this.universesSignal());
  }

  private persistActiveUniverses() {
    this.persist(ACTIVE_UNIVERSE_KEY, this.activeUniverseSignal());
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
    this.mirrorOrgSettingsForRuntimeGuards(this.orgSettingsSignal());
    this.persist(ORG_SETTINGS_KEY, this.orgSettingsSignal());
  }

  private persist(key: string, value: unknown) {
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      console.error(error);
      return;
    }
    if (this.getRaw(key) === serialized) return;
    void this.persistSerialized(key, serialized);
  }

  private async persistSerialized(key: string, serialized: string) {
    try {
      await writeWithConflictRetry({
        key,
        serialized,
        write: (payload) => this.storage.setItem(key, payload),
        getCurrentSerialized: () => this.getRaw(key),
        refresh: () => this.storage.getItem(key).then(() => undefined),
        maxRetries: 1,
        retryDelayMs: 120,
      });
    } catch (error) {
      console.error(error);
    }
  }

  private persistLoginSecurity() {
    this.persist(LOGIN_SECURITY_KEY, this.loginSecurity);
  }

  private getRaw(key: string) {
    return this.storage.getItemSync(key);
  }

  private setRaw(key: string, value: string) {
    void this.storage.setItem(key, value);
  }

  private removeKey(key: string) {
    void this.storage.removeItem(key);
  }

  private keys() {
    return this.storage.keysSync();
  }

  private safeJson<T>(key: string, fallback: T): T {
    if (key === SESSION_KEY) {
      return this.storage.getJsonSyncValidated(
        key,
        fallback,
        isSessionStateContract as (value: unknown) => value is T,
      );
    }
    if (key === ORG_SETTINGS_KEY) {
      return this.storage.getJsonSyncValidated(
        key,
        fallback,
        isOrgSettingsContract as (value: unknown) => value is T,
      );
    }
    return this.storage.getJsonSync(key, fallback);
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
      phoneMode: this.isPhoneDevice(),
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
      universeOpened: false,
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

  getDefaultPhoneMode() {
    return this.isPhoneDevice();
  }

  private isPhoneDevice() {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    if (nav.userAgentData?.mobile !== undefined) return Boolean(nav.userAgentData.mobile);
    const ua = navigator.userAgent || '';
    return /Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(ua);
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
    const instanceIds = new Set<string>();
    [DIALOG_STATE_KEY, PREVIEW_STATE_KEY].forEach((key) => {
      const raw = this.getRaw(`${key}:${userId}`);
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
      this.removeKey(`${MOCK_TODO_KEY}:${userId}:${id}`);
      this.removeKey(`${MOCK_TODO_KEY}:${id}`);
    });
  }

  private clearAppStateForUser(userId: string) {
    this.keys()
      .filter((key) => key.startsWith('op_app_state:') && key.includes(`:${userId}:`))
      .forEach((key) => this.removeKey(key));
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
    const entries = Object.entries(this.universesSignal());
    for (const [userId, list] of entries) {
      if (list.some((u) => u.id === universeId)) return userId;
    }
    return null;
  }

  getUniversePreferences(ownerId: string, universeId?: string) {
    if (!universeId) return this.getPreferencesFor(ownerId);
    const key = this.universeKey(ownerId, universeId);
    const stored = this.prefsSignal()[key];
    return stored ? { ...this.defaultPreferences(), ...stored } : this.defaultPreferences();
  }

  setUniverseId(ownerId: string, universeId: string) {
    const currentId = this.getActiveUniverseId(ownerId);
    if (!currentId || currentId === universeId) return;
    const list = this.getUniversesForUser(ownerId);
    if (!list.length) return;
    if (list.some((u) => u.id === universeId)) return;

    const nextList = list.map((u) => (u.id === currentId ? { ...u, id: universeId } : u));
    this.universesSignal.set({ ...this.universesSignal(), [ownerId]: nextList });
    this.persistUniverses();

    const oldKey = this.universeKey(ownerId, currentId);
    const nextKey = this.universeKey(ownerId, universeId);
    const prefs = { ...this.prefsSignal() };
    if (prefs[oldKey]) {
      prefs[nextKey] = { ...prefs[oldKey], universeId };
      delete prefs[oldKey];
      this.prefsSignal.set(prefs);
      this.persistPrefs();
    }

    const activeMap = { ...this.activeUniverseSignal() };
    if (activeMap[ownerId] === currentId) {
      activeMap[ownerId] = universeId;
      this.activeUniverseSignal.set(activeMap);
      this.persistActiveUniverses();
    }

    const session = this.sessionSignal();
    if (session.userId === ownerId && session.universeId === currentId) {
      this.sessionSignal.set({ ...session, universeId });
      this.persistSession();
    }

    const oldToken = `:${ownerId}:${currentId}`;
    const newToken = `:${ownerId}:${universeId}`;
    this.keys()
      .filter((key) => key.includes(oldToken))
      .forEach((key) => {
        const value = this.getRaw(key);
        const nextKeyName = key.replace(oldToken, newToken);
        this.removeKey(key);
        if (value !== null) {
          this.setRaw(nextKeyName, value);
        }
      });
    const presenceKeys = [
      `${UNIVERSE_PRESENCE_KEY}:${currentId}`,
      `${UNIVERSE_CHAT_KEY}:${currentId}`,
      `${UNIVERSE_EDIT_KEY}:${currentId}`,
      `${UNIVERSE_GUEST_COUNTER_KEY}:${currentId}`,
      `${UNIVERSE_KICK_KEY}:${currentId}`,
    ];
    presenceKeys.forEach((key) => {
      const value = this.getRaw(key);
      if (value === null) return;
      this.removeKey(key);
      const nextKeyName = key.replace(`:${currentId}`, `:${universeId}`);
      this.setRaw(nextKeyName, value);
    });
  }

  getInviteesForOwner(ownerId: string) {
    return this.inviteesSignal()[ownerId] ?? [];
  }

  async createInvitee(ownerId: string, username: string, password: string) {
    if (!this.canInvite({ universeOwnerId: ownerId })) {
      return { ok: false, message: 'users.error.adminOnly' };
    }
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
    if (!this.canInvite({ universeOwnerId: ownerId })) {
      return { ok: false, message: 'users.error.adminOnly' };
    }
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
    if (!this.canInvite({ universeOwnerId: ownerId })) {
      return;
    }
    const list = this.getInviteesForOwner(ownerId);
    const nextList = list.filter((u) => u.id !== inviteeId);
    this.inviteesSignal.set({ ...this.inviteesSignal(), [ownerId]: nextList });
    this.persistInvitees();
  }

  async loginInvitee(
    ownerId: string,
    universeId: string | null,
    username: string,
    password: string,
  ) {
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
    const ownerPrefs = this.getUniversePreferences(ownerId, universeId ?? undefined);
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

  async loginUniverseGuest(ownerId: string, universeId: string | null, password: string) {
    const prefs = this.getUniversePreferences(ownerId, universeId ?? undefined);
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

  async loginUniverseObserver(ownerId: string, universeId: string | null, password: string) {
    const prefs = this.getUniversePreferences(ownerId, universeId ?? undefined);
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

  markAccessibilityPromptShown(userId: string, universeId?: string | null) {
    const key = universeId ? `${userId}:${universeId}` : userId;
    this.setRaw(`op_accessibility_prompted_${key}`, 'true');
  }

  hasSeenAccessibilityPrompt(userId: string, universeId?: string | null) {
    const key = universeId ? `${userId}:${universeId}` : userId;
    if (this.getRaw(`op_accessibility_prompted_${key}`) === 'true') return true;
    return this.getRaw(`op_accessibility_prompted_${userId}`) === 'true';
  }

  getUniversePresence(universeId: string) {
    return this.cleanupUniversePresence(universeId);
  }

  touchUniversePresence(universeId: string, entry: UniversePresenceEntry) {
    const list = this.cleanupUniversePresence(universeId);
    const now = Date.now();
    const next = list.filter((item) => item.id !== entry.id);
    const hasActiveScope =
      Boolean(entry.activeInstanceId) || Boolean(entry.activeObjectId) || Boolean(entry.activeMode);
    next.push({
      ...entry,
      lastSeen: now,
      activeUpdatedAt: hasActiveScope ? now : (entry.activeUpdatedAt ?? now),
    });
    this.persist(this.universePresenceKey(universeId), next);
    return next;
  }

  removeUniversePresence(universeId: string, userId: string) {
    const list = this.cleanupUniversePresence(universeId).filter((item) => item.id !== userId);
    if (list.length === 0) {
      this.removeKey(this.universePresenceKey(universeId));
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
    this.removeKey(this.universeChatKey(universeId));
  }

  getUniverseEditHolder(universeId: string) {
    return this.safeJson<UniverseEditHolder | null>(this.universeEditKey(universeId), null);
  }

  setUniverseEditHolder(universeId: string, holder: UniverseEditHolder | null) {
    if (!holder) {
      this.removeKey(this.universeEditKey(universeId));
      return;
    }
    this.persist(this.universeEditKey(universeId), holder);
  }

  nextUniverseGuestNumber(universeId: string) {
    const presence = this.cleanupUniversePresence(universeId);
    const hasGuests = presence.some((entry) => entry.role === 'guest');
    if (!hasGuests) {
      this.removeKey(this.universeGuestCounterKey(universeId));
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
      this.removeKey(this.universeGuestCounterKey(universeId));
      this.removeKey(this.universeEditKey(universeId));
    }
  }

  private cleanupUniversePresence(universeId: string) {
    const list = this.safeJson<UniversePresenceEntry[]>(this.universePresenceKey(universeId), []);
    const now = Date.now();
    const next = list.filter((entry) => now - entry.lastSeen < 15_000);
    if (next.length !== list.length) {
      if (next.length === 0) {
        this.removeKey(this.universePresenceKey(universeId));
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

  private normalizeSessionState(
    value: Partial<SessionState> &
      Pick<SessionState, 'userId' | 'previewUserId' | 'previewPersist'>,
  ): SessionState {
    return {
      userId: value.userId ?? null,
      previewUserId: value.previewUserId ?? null,
      previewPersist: Boolean(value.previewPersist),
      sessionRole: value.sessionRole ?? null,
      sessionUsername: value.sessionUsername ?? null,
      universeOwnerId: value.universeOwnerId ?? null,
      universeId: value.universeId ?? null,
    };
  }

  private sessionStatesEqual(a: SessionState, b: SessionState): boolean {
    return (
      a.userId === b.userId &&
      a.previewUserId === b.previewUserId &&
      a.previewPersist === b.previewPersist &&
      (a.sessionRole ?? null) === (b.sessionRole ?? null) &&
      (a.sessionUsername ?? null) === (b.sessionUsername ?? null) &&
      (a.universeOwnerId ?? null) === (b.universeOwnerId ?? null) &&
      (a.universeId ?? null) === (b.universeId ?? null)
    );
  }

  private mirrorOrgSettingsForRuntimeGuards(value: OrgSettings) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(ORG_SETTINGS_KEY, JSON.stringify(value));
    } catch {
      // Ignore browser storage failures; async storage remains source of truth.
    }
  }

  markUniverseKick(universeId: string) {
    this.setRaw(`${UNIVERSE_KICK_KEY}:${universeId}`, String(Date.now()));
  }

  consumeUniverseKick(universeId: string) {
    const key = `${UNIVERSE_KICK_KEY}:${universeId}`;
    const exists = this.getRaw(key);
    if (!exists) return false;
    this.removeKey(key);
    return true;
  }
}
