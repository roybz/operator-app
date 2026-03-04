import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AuthService,
  UniverseChatMessage,
  UniverseEditHolder,
  UniversePresenceEntry,
  UserRole,
} from './core/auth.service';
import { DialogInstance, DialogService } from './core/dialog.service';
import { DialogComponent } from './shared/dialog/dialog.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { TodoPageComponent } from './features/applications/default-applications/todo/todo.component';
import { CalculatorComponent } from './features/applications/default-applications/calculator/calculator.component';
import { TimerComponent } from './features/applications/default-applications/timer/timer.component';
import { NavigatorComponent } from './features/applications/default-applications/navigator/navigator.component';
import { NotesComponent } from './features/applications/default-applications/notes/notes.component';
import { CalendarComponent } from './features/applications/default-applications/calendar/calendar.component';
import { ClockComponent } from './features/applications/default-applications/clock/clock.component';
import { KanbanComponent } from './features/applications/default-applications/kanban/kanban.component';
import { StickyNotesComponent } from './features/applications/default-applications/sticky-notes/sticky-notes.component';
import { DataTableComponent } from './features/applications/default-applications/data-table/data-table.component';
import { SettingsComponent } from './features/settings/settings.component';
import { LicenseComponent } from './features/license/license.component';
import { PhoneShellComponent } from './layout/phone/phone-shell.component';
import { DesktopShellComponent } from './layout/desktop/desktop-shell.component';
import { TopBarComponent, UniverseItem } from './layout/shared/top-bar.component';
import { LongPressDirective } from './shared/long-press/long-press.directive';
import { ModalShellComponent } from './shared/modal-shell/modal-shell.component';
import { SettingsDraftService } from './features/settings/settings-draft.service';
import { APP_REGISTRY } from './features/dependencies/app-registry';
import { AppId } from './features/dependencies/app-types';
import { cloneCalculatorState } from './features/applications/default-applications/calculator/calculator.component';
import { cloneNavigatorState } from './features/applications/default-applications/navigator/navigator.component';
import { cloneNotesState } from './features/applications/default-applications/notes/notes.component';
import { cloneTimerState } from './features/applications/default-applications/timer/timer.component';
import { cloneCalendarState } from './features/applications/default-applications/calendar/calendar.component';
import { cloneClockState } from './features/applications/default-applications/clock/clock.component';
import {
  KanbanState,
  cloneKanbanState,
  loadKanbanState,
  saveKanbanState,
} from './features/applications/default-applications/kanban/kanban.component';
import { cloneStickyNoteState } from './features/applications/default-applications/sticky-notes/sticky-notes.component';
import { cloneDataTableState } from './features/applications/default-applications/data-table/data-table.component';
import {
  TodoState,
  TodoSubtask,
  cloneTodoState,
  createSubtask,
  createTodoItem,
  loadTodoState,
  saveTodoState,
} from './features/applications/default-applications/todo/todo-api';
import { InstanceSettingsService } from './core/instance-settings.service';
import { StorageService } from './core/storage/storage.service';
import { DebugPerfService } from './core/debug-perf.service';
import { RealtimeSyncService } from './core/realtime/realtime-sync.service';
import { RemoteConflictService } from './core/realtime/remote-conflict.service';
import { RemoteApplyPipeline } from './core/realtime/remote-apply-pipeline';
import { EventOutboxService } from './core/events/event-outbox.service';
import { ContextFieldStoreService } from './core/events/context-field-store.service';
import { ClientObservabilityService } from './core/observability/client-observability.service';
import { getOpCapabilities, getOpConfig } from './core/op-config';
import {
  APP_GROUPS,
  PHONE_MODE_BOOT_KEY,
  RESERVED_SIDEBAR_WIDTH,
  RESERVED_TOPBAR_HEIGHT,
  RESERVED_WORKSPACE_HEIGHT,
  CanvasMode,
  createFallbackRect,
} from './app-shell.constants';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    TranslateModule,
    DialogComponent,
    ConfirmDialogComponent,
    PhoneShellComponent,
    DesktopShellComponent,
    TopBarComponent,
    TodoPageComponent,
    CalculatorComponent,
    TimerComponent,
    NavigatorComponent,
    NotesComponent,
    StickyNotesComponent,
    CalendarComponent,
    ClockComponent,
    KanbanComponent,
    DataTableComponent,
    SettingsComponent,
    LicenseComponent,
    LongPressDirective,
    ModalShellComponent,
  ],
  styles: [
    `
      .floating-control {
        position: fixed;
        z-index: 90;
        opacity: 0.6;
        transition: opacity 120ms ease;
      }

      .floating-control:hover {
        opacity: 1;
      }

      .square-btn {
        padding: 5px 6px;
        border-radius: 3px;
      }

      .remote-conflict-banner {
        position: fixed;
        right: 12px;
        top: 12px;
        z-index: 3100;
        max-width: min(520px, calc(100vw - 24px));
        border: 1px solid #d97706;
        background: #fffbeb;
        color: #7c2d12;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .remote-conflict-banner__actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .accessibility-prompt {
        box-sizing: border-box;
        padding: 20px 22px;
        width: min(460px, calc(100vw - 48px));
      }

      .accessibility-prompt__title {
        margin: 0 0 12px;
      }

      .accessibility-prompt__body {
        margin: 0;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .accessibility-prompt__toggle {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-top: 14px;
      }

      .accessibility-prompt__actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 18px;
      }

      .workspace-chip {
        transition:
          transform 120ms ease,
          box-shadow 120ms ease,
          background 120ms ease;
        user-select: none;
        -webkit-user-drag: none;
      }

      .workspace-shell {
        user-select: none;
        -webkit-user-drag: none;
      }

      .workspace-chip.dragging {
        opacity: 0.5;
      }

      .workspace-chip span {
        user-select: none;
      }

      .workspace-drop-line {
        position: absolute;
        top: 6px;
        bottom: 6px;
        width: 2px;
        background: var(--color-accent);
        box-shadow: 0 0 6px color-mix(in srgb, var(--color-accent) 60%, transparent);
        border-radius: 2px;
      }

      .workspace-drop-line.left {
        left: -6px;
      }

      .workspace-drop-line.right {
        right: -6px;
      }

      .app-shell {
        overflow: visible;
        flex: 0 0 auto;
      }

      .app-main {
        flex: 1;
        min-height: 0;
      }

      :host {
        display: flex;
        flex-direction: column;
        height: 100dvh;
      }

      button {
        -webkit-tap-highlight-color: transparent;
      }

      #app-viewport {
        height: 100%;
        min-height: 0;
      }

      .phone-mode #app-viewport {
        align-items: flex-start;
        justify-content: flex-start;
      }

      .phone-mode #app-canvas {
        margin: 0;
      }

      .universe-bar {
        position: fixed;
        bottom: 0;
        right: 0;
        border-top: 1px solid var(--color-border);
        background: var(--color-surface);
        z-index: 1200;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.12);
      }

      .phone-mode .universe-bar {
        left: 0;
        right: 0;
        flex-wrap: nowrap;
        flex-direction: column;
        gap: 6px;
        padding: 8px 10px;
        align-items: stretch;
        max-height: 18vh;
        align-content: flex-start;
      }

      .phone-mode .universe-actions {
        width: 100%;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-left: 0;
      }

      .phone-mode .universe-invitees {
        width: 100%;
        flex: 0 0 auto;
        display: none;
      }

      .phone-mode .universe-chat {
        right: 8px;
        width: min(420px, 96vw);
      }

      .universe-chip {
        padding: 6px 10px;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        background: var(--color-bg);
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .universe-chip--active {
        box-shadow: 0 0 8px rgba(0, 194, 209, 0.6);
      }

      .universe-fade {
        opacity: 0.7;
      }

      .universe-chat {
        position: fixed;
        right: 16px;
        width: min(420px, 92vw);
        max-height: 525px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
        display: flex;
        flex-direction: column;
        z-index: 2000;
        font-size: 0.9em;
      }

      .universe-chat__messages {
        flex: 1;
        overflow: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .universe-chat__input {
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 8px;
        min-height: 64px;
        resize: vertical;
      }

      .universe-chat__send {
        min-height: 34px;
        min-width: 80px;
        padding: 6px 10px;
        font-size: 14px;
      }
    `,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly dialogService = inject(DialogService);
  readonly settingsDraft = inject(SettingsDraftService);
  readonly instanceSettings = inject(InstanceSettingsService);
  readonly storage = inject(StorageService);
  private readonly debugPerf = inject(DebugPerfService);
  private readonly realtimeSync = inject(RealtimeSyncService);
  private readonly remoteConflict = inject(RemoteConflictService);
  private readonly eventOutbox = inject(EventOutboxService);
  private readonly contextFields = inject(ContextFieldStoreService);
  private readonly observability = inject(ClientObservabilityService);
  private router = inject(Router);
  isMockMode = computed(() => {
    const backendConnected = this.auth.isBackendConnected();
    const isGuest = this.auth.actualUser()?.id === 'u_guest';
    return isGuest || !backendConnected || this.auth.orgSettings().testModeEnabled;
  });
  navOpen = true;
  editingWorkspaceId = signal<string | null>(null);
  editingWorkspaceName = signal('');
  workspaceDragId = signal<string | null>(null);
  private readonly translate = inject(TranslateService);
  private timeInterval?: number;
  private universeInterval?: number;
  private loadingTimeout?: number;
  private loginLoadingTimeout?: number;
  private now = signal(new Date());
  workspaceMenuOpen = signal(false);
  hoverWorkspaceId = signal<string | null>(null);
  hoverWorkspaceSide = signal<'left' | 'right' | null>(null);
  workspacePointerState: {
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null = null;
  suppressWorkspaceClick = false;
  topBarOpen = signal(true);
  settingsOpen = signal(false);
  licenseOpen = signal(false);
  settingsCloseConfirmOpen = signal(false);
  phoneModeConfirmOpen = signal(false);
  pendingPhoneMode = signal<boolean | null>(null);
  resetMenuOpen = signal(false);
  deleteTargetId = signal<string | null>(null);
  cloneTargetId = signal<string | null>(null);
  archiveTargetId = signal<string | null>(null);
  moveWorkspaceTargetId = signal<string | null>(null);
  universeMenuOpen = signal(false);
  universeSwitchConfirmOpen = signal(false);
  universeMenuPendingOpen = signal(false);
  phoneModeUniversePromptOpen = signal(false);
  pendingUniverseSwitchId = signal<string | null>(null);
  universeBarOpen = signal(true);
  universeChatOpen = signal(false);
  clearUniverseChatConfirmOpen = signal(false);
  universeChatDraft = signal('');
  universePresence = signal<UniversePresenceEntry[]>([]);
  universeChatMessages = signal<UniverseChatMessage[]>([]);
  universeEditHolder = signal<UniverseEditHolder | null>(null);
  universeChatUnread = signal(0);
  universeChatLastCount = signal(0);
  universeChatSticky = signal(true);
  accessibilityPromptOpen = signal(false);
  accessibilityPromptEnabled = signal(true);
  loadingVisible = signal(true);
  loadingFading = signal(false);
  loginLoadingVisible = signal(true);
  loginLoadingFading = signal(false);
  canvasBounds = signal<DOMRect>(createFallbackRect(1920, 1080));
  viewportBounds = signal<DOMRect>(createFallbackRect(0, 0));
  editingTileId = signal<string | null>(null);
  editingTitle = signal('');
  tileDragState: {
    id: string;
    startX: number;
    startY: number;
    origin: { x: number; y: number };
  } | null = null;
  panState: { startX: number; startY: number; scrollLeft: number; scrollTop: number } | null = null;
  isPanning = signal(false);
  canvasWidth = signal(1920);
  canvasHeight = signal(1080);
  canvasScale = signal(1);
  canvasDraftWidth = signal(1920);
  canvasDraftHeight = signal(1080);
  phoneActiveDialogId = signal<string | null>(null);
  private navOpenBeforePhone = true;
  private lastPhoneMode = false;
  private lastPhoneAppliedId: string | null = null;
  private phoneBootChecked = false;
  private phoneModeReloading = false;
  private accessibilityPromptSessionScopes = new Set<string>();
  private remoteSyncInterval?: number;
  private remoteSyncInFlight = false;
  private remoteSyncApplyPending = false;
  private lastRealtimeEventSeq = 0;
  private lastStorageRemoteChangeSeq = 0;
  private deferredRemoteApplyTimer?: number;
  private deferredRemoteApplyBannerTimer?: number;
  private suppressRemoteChangeSignature: string | null = null;
  private suppressRemoteChangeUntil = 0;
  private readonly remoteApplyPipeline = new RemoteApplyPipeline({
    flush: async (keys) => {
      await this.applyRemoteStorageChange(keys);
    },
    onFlushStart: (keys) => {
      this.remoteSyncApplyPending = true;
      this.observability.logInfo('remote.apply.flush_started', { keyCount: keys.length });
    },
    onFlushComplete: (keys) => {
      this.remoteSyncApplyPending = false;
      this.observability.logInfo('remote.apply.flush_completed', { keyCount: keys.length });
    },
    onError: (error, keys) => {
      this.remoteSyncApplyPending = false;
      this.observability.logWarn('remote.apply.flush_error', {
        keyCount: keys.length,
        message: error instanceof Error ? error.message : 'unknown_error',
      });
    },
  });
  workspaceRenameInput = viewChild<ElementRef<HTMLInputElement>>('workspaceRenameInput');
  universeChatScroll = viewChild<ElementRef<HTMLDivElement>>('universeChatScroll');
  universeChatInput = viewChild<ElementRef<HTMLTextAreaElement>>('universeChatInput');
  remoteConflictPending = this.remoteConflict.pending.asReadonly();
  remoteConflictBannerVisible = signal(false);

  activeDialogs = computed(() => this.dialogService.getActiveDialogs());
  dialogsHidden = computed(() => this.dialogService.isActiveWorkspaceHidden());
  phoneMode = computed(() => Boolean(this.auth.preferences().phoneMode));
  phoneDialogs = computed(() => this.activeDialogs().filter((instance) => !instance.archived));
  phoneActiveInstance = computed(() => {
    if (!this.phoneMode()) return null;
    const list = this.phoneDialogs().filter((instance) => !this.isPhoneStashed(instance));
    const current = list.find((instance) => instance.id === this.phoneActiveDialogId());
    const currentVisible = current && !this.isPhoneMinimized(current) ? current : null;
    if (currentVisible) return currentVisible;
    return list.find((instance) => !this.isPhoneMinimized(instance)) ?? null;
  });
  visibleDialogs = computed(() => {
    if (this.phoneMode()) {
      const active = this.phoneActiveInstance();
      if (!active || this.isPhoneMinimized(active) || this.isPhoneStashed(active)) return [];
      return [active];
    }
    return this.activeDialogs().filter(
      (instance) =>
        !this.dialogsHidden() && !instance.stashed && !instance.minimized && !instance.archived,
    );
  });
  stashedDialogs = computed(() => {
    if (this.phoneMode()) {
      return this.activeDialogs()
        .filter((instance) => this.isPhoneStashed(instance) && !instance.archived)
        .map((instance) => ({
          ...instance,
          tileRect: instance.phoneTileRect ?? instance.tileRect,
        }));
    }
    return this.activeDialogs().filter((instance) => instance.stashed && !instance.archived);
  });
  isOverlayActive = computed(
    () =>
      this.settingsOpen() ||
      Boolean(this.deleteTargetId()) ||
      this.settingsCloseConfirmOpen() ||
      this.licenseOpen() ||
      this.accessibilityPromptOpen() ||
      this.guestBlocked() ||
      this.loadingVisible() ||
      Boolean(this.cloneTargetId()) ||
      Boolean(this.archiveTargetId()) ||
      Boolean(this.moveWorkspaceTargetId()) ||
      this.universeSwitchConfirmOpen() ||
      this.phoneModeConfirmOpen() ||
      this.phoneModeUniversePromptOpen() ||
      this.clearUniverseChatConfirmOpen(),
  );

  moveWorkspaceInstance = computed(() => {
    const id = this.moveWorkspaceTargetId();
    if (!id) return null;
    return this.dialogService.getActiveDialogs().find((instance) => instance.id === id) ?? null;
  });

  moveWorkspaceCurrentId = computed(() => {
    const id = this.moveWorkspaceTargetId();
    if (!id) return null;
    return this.dialogService.findWorkspaceForInstance(id);
  });

  moveWorkspaceLabel = computed(() => {
    const instance = this.moveWorkspaceInstance();
    return instance ? this.instanceLabel(instance) : '';
  });

  timeLabel = computed(() => {
    const prefs = this.auth.preferences();
    const timeZone = prefs.timeZone;
    const hour12 = prefs.timeFormat === '12h';
    const language = this.translate.currentLang || 'en';
    return new Intl.DateTimeFormat(language, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    }).format(this.now());
  });

  showTime = computed(() => this.auth.preferences().showTime);
  showViewportSizingControls = computed(() => {
    const prefs = this.auth.preferences();
    const org = this.auth.orgSettings();
    return !org.disableViewportSizing && !prefs.hideViewportSizingControls;
  });

  showZoomControls = computed(() => {
    const prefs = this.auth.preferences();
    const org = this.auth.orgSettings();
    return !org.disableZoomControls && !prefs.hideZoomControls;
  });
  showCanvasDivider = computed(() => this.showViewportSizingControls() && this.showZoomControls());
  isCanvasLocked = computed(() => this.auth.preferences().lockCanvasSize ?? false);
  canvasDraftDirty = computed(
    () =>
      this.isCanvasLocked() &&
      (this.canvasDraftWidth() !== this.canvasWidth() ||
        this.canvasDraftHeight() !== this.canvasHeight()),
  );

  guestBlocked = computed(
    () => !this.auth.orgSettings().allowGuestLogin && this.auth.actualUser()?.id === 'u_guest',
  );

  universeOwnerId = computed(
    () => this.auth.session().universeOwnerId ?? this.auth.session().userId ?? null,
  );
  currentUserId = computed(() => this.auth.actualUser()?.id ?? null);
  universesList = computed<UniverseItem[]>(() =>
    this.currentUserId() ? this.auth.getUniversesForUser(this.currentUserId()!) : [],
  );
  currentUniverseName = computed(() => {
    const userId = this.currentUserId();
    if (!userId) return '';
    const active = this.auth.getActiveUniverseId(userId);
    const found = this.universesList().find((u) => u.id === active);
    return found?.name ?? '';
  });
  canSwitchUniverse = computed(() => this.isUniverseOwner() && this.universesList().length >= 2);
  workspaceLimit = computed(() => (this.isMainGuest() ? 9 : 12));
  universePrefs = computed(() => {
    const ownerId = this.universeOwnerId();
    return ownerId ? this.auth.getUniversePreferences(ownerId) : null;
  });
  universeId = computed(() => this.universePrefs()?.universeId ?? null);
  multiUserEnabled = computed(() => Boolean(this.universePrefs()?.multiUserEnabled));
  allowUniverseChat = computed(() => Boolean(this.universePrefs()?.allowUniverseChat));
  isUniverseOwner = computed(() => {
    const ownerId = this.universeOwnerId();
    return Boolean(ownerId && ownerId === this.auth.session().userId);
  });
  sessionRole = computed<UserRole>(() => {
    return (
      this.auth.session().sessionRole ??
      this.auth.actualUser()?.role ??
      this.auth.currentUser()?.role ??
      'user'
    );
  });
  isLimitedRole = computed(() => ['guest', 'observer', 'invitee'].includes(this.sessionRole()));
  canOpenSettings = computed(() => !this.isLimitedRole());
  canEdit = computed(() => {
    return this.auth.canEditUniverse({
      universeOwnerId: this.universeOwnerId(),
      multiUserEnabled: this.multiUserEnabled(),
      universeEditHolderId: this.universeEditHolder()?.id ?? null,
    });
  });
  inviteesOnline = computed(() =>
    this.universePresence().filter((entry) => entry.role === 'invitee'),
  );
  guestCount = computed(
    () => this.universePresence().filter((entry) => entry.role === 'guest').length,
  );
  observerCount = computed(
    () => this.universePresence().filter((entry) => entry.role === 'observer').length,
  );
  hasUniverseParticipants = computed(
    () => this.inviteesOnline().length > 0 || this.guestCount() > 0 || this.observerCount() > 0,
  );
  isMainGuest = computed(() => this.auth.actualUser()?.id === 'u_guest');
  showUniverseBar = computed(() => this.auth.isLoggedIn() && this.multiUserEnabled());
  previewUserLabel = computed(() => this.auth.currentUser()?.username ?? '');
  loggedInAsLabel = computed(() => {
    const role = this.sessionRole();
    if (role === 'guest') return this.translate.instant('auth.roleGuest');
    if (role === 'observer') return this.translate.instant('auth.roleObserver');
    if (role === 'invitee') return this.translate.instant('auth.roleInvitee');
    return this.auth.currentUser()?.username ?? '';
  });
  siteTitle = computed(() => this.auth.orgSettings().siteTitle || 'Operator App');
  siteLogoEmoji = computed(() => this.auth.orgSettings().siteLogoEmoji ?? '🌎');
  disabledApps = computed(() => new Set(this.auth.preferences().disabledApps ?? []));
  visibleAppGroups = computed(() => {
    const hiddenByConfig = new Set<string>();
    const capabilities = getOpCapabilities(getOpConfig());
    if (!capabilities.navigatorApp) {
      hiddenByConfig.add('navigator');
    }
    return APP_GROUPS.filter(
      (app) => !this.disabledApps().has(app.id) && !hiddenByConfig.has(app.id),
    );
  });
  instancesByApp = computed(() => ({
    kanban: this.dialogService.getAppInstances('kanban', { includeArchived: true }),
    todo: this.dialogService.getAppInstances('todo', { includeArchived: true }),
    calculator: this.dialogService.getAppInstances('calculator', { includeArchived: true }),
    timer: this.dialogService.getAppInstances('timer', { includeArchived: true }),
    navigator: this.dialogService.getAppInstances('navigator', { includeArchived: true }),
    notes: this.dialogService.getAppInstances('notes', { includeArchived: true }),
    stickyNotes: this.dialogService.getAppInstances('stickyNotes', { includeArchived: true }),
    calendar: this.dialogService.getAppInstances('calendar', { includeArchived: true }),
    clock: this.dialogService.getAppInstances('clock', { includeArchived: true }),
    dataTable: this.dialogService.getAppInstances('dataTable', { includeArchived: true }),
  }));
  canvasStyle = computed(() => {
    const prefs = this.auth.preferences();
    const backgroundImageUrl = prefs.backgroundImageUrl?.trim();
    const mode = (prefs.backgroundImageMode ?? 'repeat') as CanvasMode;
    const showGrid = prefs.showGrid ?? true;
    const gridSize = Math.min(800, Math.max(8, prefs.gridSize ?? 50));

    const layers: string[] = [];
    const sizes: string[] = [];
    const repeats: string[] = [];
    const positions: string[] = [];

    if (showGrid) {
      layers.push('linear-gradient(var(--color-border) 1px, transparent 1px)');
      layers.push('linear-gradient(90deg, var(--color-border) 1px, transparent 1px)');
      sizes.push(`${gridSize}px ${gridSize}px`, `${gridSize}px ${gridSize}px`);
      repeats.push('repeat', 'repeat');
      positions.push('0 0', '0 0');
    }

    if (backgroundImageUrl) {
      layers.push(`url("${backgroundImageUrl}")`);
      if (mode === 'stretch') {
        sizes.push('100% 100%');
        repeats.push('no-repeat');
        positions.push('center');
      } else if (mode === 'center') {
        sizes.push('auto');
        repeats.push('no-repeat');
        positions.push('center');
      } else {
        sizes.push('auto');
        repeats.push('repeat');
        positions.push('0 0');
      }
    }

    return {
      backgroundImage: layers.length ? layers.join(', ') : 'none',
      backgroundSize: sizes.join(', '),
      backgroundRepeat: repeats.join(', '),
      backgroundPosition: positions.join(', '),
    };
  });
  effectiveCanvasWidth = computed(() => {
    if (this.phoneMode()) return this.viewportBounds().width;
    const scale = this.canvasScale();
    const viewportWidth = this.viewportBounds().width;
    const base = this.canvasWidth();
    if (scale < 1 && viewportWidth > 0) {
      return Math.max(base, Math.ceil(viewportWidth / scale));
    }
    return base;
  });
  effectiveCanvasHeight = computed(() => {
    if (this.phoneMode()) return this.viewportBounds().height;
    const scale = this.canvasScale();
    const viewportHeight = this.viewportBounds().height;
    const base = this.canvasHeight();
    if (scale < 1 && viewportHeight > 0) {
      return Math.max(base, Math.ceil(viewportHeight / scale));
    }
    return base;
  });
  effectiveCanvasScale = computed(() => (this.phoneMode() ? 1 : this.canvasScale()));
  forceLoggedOut = signal(false);
  private logoutRedirectInProgress = false;
  private viewportReflowRaf: number | null = null;

  constructor() {
    this.eventOutbox.ensureStarted();
    this.translate.setDefaultLang('en');
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
    this.handleLogoutLocation(currentPath, currentSearch);
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/logout')) {
      this.performLogoutRouteRedirect();
    }
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.handleLogoutLocation(event.urlAfterRedirects, '');
        if (!event.urlAfterRedirects.startsWith('/logout')) return;
        this.performLogoutRouteRedirect();
      });
    effect(() => {
      if (typeof document === 'undefined') return;
      document.title = this.siteTitle();
      this.updateFavicon(this.siteLogoEmoji());
    });
    effect(() => {
      if (this.phoneBootChecked) return;
      if (typeof window === 'undefined') return;
      if (!this.auth.isLoggedIn()) return;
      this.phoneBootChecked = true;
      const prefs = this.auth.preferences();
      const flagged = this.storage.getItemSync(PHONE_MODE_BOOT_KEY);
      if (!flagged) return;
      void this.storage.removeItem(PHONE_MODE_BOOT_KEY);
      if (prefs.phoneMode) {
        this.auth.savePreferences({ ...prefs, phoneMode: false });
        this.auth.setLoginPhoneModePreference(false);
      }
    });
    effect(() => {
      const prefs = this.auth.preferences();
      if (prefs.lockCanvasSize) {
        const { width, height } = this.clampCanvasSize(prefs.canvasWidth, prefs.canvasHeight);
        this.canvasWidth.set(width);
        this.canvasHeight.set(height);
        this.canvasDraftWidth.set(width);
        this.canvasDraftHeight.set(height);
      } else {
        this.syncCanvasToViewport();
      }
    });
    effect(() => {
      this.applyThemeClasses();
    });
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.forceLoggedOut.set(false);
      }
    });
    effect(() => {
      if (!this.phoneMode() && !this.showUniverseBar()) return;
      setTimeout(this.updateCanvasBounds, 0);
    });
    effect(() => {
      const actualUser = this.auth.actualUser();
      if (!actualUser) {
        this.accessibilityPromptOpen.set(false);
        return;
      }
      if (!this.auth.ready()) return;
      const universeId = this.auth.getActiveUniverseId(actualUser.id) ?? null;
      const promptScope = `${actualUser.id}:${universeId ?? ''}`;
      if (this.auth.preferences().accessibilityMode) return;
      if (this.auth.hasSeenAccessibilityPrompt(actualUser.id, universeId)) {
        this.accessibilityPromptSessionScopes.add(promptScope);
        return;
      }
      if (this.accessibilityPromptSessionScopes.has(promptScope)) return;
      this.accessibilityPromptSessionScopes.add(promptScope);
      this.accessibilityPromptEnabled.set(false);
      this.accessibilityPromptOpen.set(true);
    });
    effect(() => {
      const enabled = this.phoneMode();
      if (enabled === this.lastPhoneMode) return;
      this.lastPhoneMode = enabled;
      this.handlePhoneModeChange(enabled);
    });
    effect(() => {
      if (!this.phoneMode()) return;
      const visibleCandidates = this.phoneDialogs().filter(
        (instance) => !this.isPhoneStashed(instance) && !this.isPhoneMinimized(instance),
      );
      if (visibleCandidates.length === 0) {
        const recoverable = this.phoneDialogs()
          .filter((instance) => !this.isPhoneStashed(instance))
          .sort((a, b) => b.z - a.z)[0];
        if (recoverable) {
          this.dialogService.setPhoneMinimized(recoverable.id, false);
        }
      }
      const active = this.phoneActiveInstance();
      if (!active) {
        this.phoneActiveDialogId.set(null);
        this.lastPhoneAppliedId = null;
        return;
      }
      if (this.phoneActiveDialogId() !== active.id) {
        this.phoneActiveDialogId.set(active.id);
      }
      if (this.lastPhoneAppliedId !== active.id) {
        this.lastPhoneAppliedId = active.id;
      }
    });
    effect(() => {
      if (typeof window === 'undefined') return;
      if (!this.auth.ready()) return;
      if (!this.auth.isLoggedIn()) {
        this.loadingVisible.set(false);
        this.loadingFading.set(false);
        this.loginLoadingVisible.set(true);
        this.loginLoadingFading.set(false);
        if (this.loginLoadingTimeout) window.clearTimeout(this.loginLoadingTimeout);
        this.loginLoadingTimeout = window.setTimeout(() => {
          this.loginLoadingFading.set(true);
          this.loginLoadingTimeout = window.setTimeout(() => {
            this.loginLoadingVisible.set(false);
            this.loginLoadingFading.set(false);
          }, 120);
        }, 0);
        return;
      }
      this.loadingVisible.set(true);
      this.loadingFading.set(false);
      this.loginLoadingVisible.set(false);
      this.loginLoadingFading.set(false);
      if (this.loadingTimeout) window.clearTimeout(this.loadingTimeout);
      this.loadingTimeout = window.setTimeout(() => {
        this.loadingFading.set(true);
        this.loadingTimeout = window.setTimeout(() => {
          this.loadingVisible.set(false);
          this.loadingFading.set(false);
        }, 120);
      }, 0);
    });
    effect(() => {
      if (typeof window === 'undefined') return;
      if (!this.auth.ready()) return;
      if (!window.location.pathname.startsWith('/logout')) return;
      this.performLogoutRouteRedirect();
    });
    effect(() => {
      const userId = this.auth.actualUser()?.id ?? null;
      this.settingsOpen.set(false);
      this.settingsCloseConfirmOpen.set(false);
      this.workspaceMenuOpen.set(false);
      this.universeMenuOpen.set(false);
      this.universeSwitchConfirmOpen.set(false);
      this.deleteTargetId.set(null);
      this.cloneTargetId.set(null);
      this.clearUniverseChatConfirmOpen.set(false);
      if (userId) {
        this.editingWorkspaceId.set(null);
        this.editingWorkspaceName.set('');
      }
    });

    effect(() => {
      if (typeof window === 'undefined') return;
      const universeId = this.universeId();
      const enabled = this.multiUserEnabled();
      if (!this.auth.isLoggedIn() || !universeId || !enabled) {
        if (this.universeInterval) {
          window.clearInterval(this.universeInterval);
          this.universeInterval = undefined;
        }
        this.universePresence.set([]);
        this.universeChatMessages.set([]);
        this.universeEditHolder.set(null);
        return;
      }
      this.syncUniverseState();
      if (!this.universeInterval) {
        this.universeInterval = window.setInterval(() => {
          this.syncUniverseState();
        }, 3000);
      }
    });

    effect(() => {
      if (typeof window === 'undefined') return;
      const shouldSync =
        this.auth.isLoggedIn() && this.auth.usesExternalAuth() && !this.isMockMode();
      if (!shouldSync) {
        if (this.remoteSyncInterval) {
          window.clearInterval(this.remoteSyncInterval);
          this.remoteSyncInterval = undefined;
        }
        this.remoteSyncInFlight = false;
        this.remoteSyncApplyPending = false;
        this.clearDeferredRemoteApplyTimers();
        this.remoteConflict.clearPending();
        this.remoteConflictBannerVisible.set(false);
        this.remoteApplyPipeline.clear();
        this.realtimeSync.stop();
        return;
      }
      void this.realtimeSync.start();
      void this.pollRemoteStorageChanges();
      if (!this.remoteSyncInterval) {
        this.remoteSyncInterval = window.setInterval(() => {
          void this.pollRemoteStorageChanges();
        }, 3000);
      }
    });

    effect(() => {
      if (typeof window === 'undefined') return;
      const event = this.realtimeSync.lastEvent();
      if (!event) return;
      if (event.seq <= this.lastRealtimeEventSeq) return;
      this.lastRealtimeEventSeq = event.seq;
      const type = String(event.payload.type || '');
      if (type === 'storage.invalidate' || type === 'storage.changed' || type === 'invalidate') {
        void this.pollRemoteStorageChanges();
        return;
      }
      if (type === 'presence.changed') {
        // Reuse existing presence refresh logic; harmless if current view doesn't use it.
        this.syncUniverseState();
      }
    });

    effect(() => {
      const event = this.storage.lastRemoteChange();
      if (!event) return;
      if (event.seq <= this.lastStorageRemoteChangeSeq) return;
      this.lastStorageRemoteChangeSeq = event.seq;
      const shellKeys = event.keys.filter((key) => this.isShellRemoteRefreshKey(key));
      if (shellKeys.length === 0) return;
      const signature = this.changedKeysSignature(shellKeys);
      if (
        this.suppressRemoteChangeSignature &&
        this.suppressRemoteChangeSignature === signature &&
        Date.now() < this.suppressRemoteChangeUntil
      ) {
        this.suppressRemoteChangeSignature = null;
        this.suppressRemoteChangeUntil = 0;
        return;
      }
      const recentLocalWrite = Date.now() - this.storage.getLastLocalMutationAt() < 5000;
      const dirtyOverlap = this.remoteConflict.hasDirtyOverlap(shellKeys);
      if (dirtyOverlap || recentLocalWrite) {
        this.remoteConflict.queue(shellKeys, dirtyOverlap ? 'dirty' : 'recent-local-write');
        this.scheduleDeferredRemoteApply();
        this.remoteSyncApplyPending = false;
        return;
      }
      this.remoteApplyPipeline.schedule(shellKeys);
    });

    effect(() => {
      if (!this.auth.isLoggedIn()) return;
      const prefs = this.universePrefs();
      if (!prefs) return;
      if (!prefs.multiUserEnabled && this.isLimitedRole()) {
        this.forceLogoutToMain();
      }
      if (!prefs.allowUniverseChat) {
        this.universeChatOpen.set(false);
      }
      const universeId = this.universeId();
      if (universeId && this.isLimitedRole()) {
        if (this.auth.consumeUniverseKick(universeId)) {
          this.forceLogoutToMain();
        }
      }
    });
  }

  ngOnInit() {
    this.debugPerf.markDialogHostInit();
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/logout')) {
      this.performLogoutRouteRedirect();
      return;
    }
    this.handleLogoutRoute();
    const stored = this.storage.getItemSync('op_nav_open');
    if (stored !== null) this.navOpen = stored === 'true';
    const storedTopBar = this.storage.getItemSync('op_topbar_open');
    if (storedTopBar !== null) this.topBarOpen.set(storedTopBar === 'true');
    const storedWorkspaceBar = this.storage.getItemSync('op_workspace_bar_open');
    if (storedWorkspaceBar !== null) this.workspaceMenuOpen.set(storedWorkspaceBar === 'true');
    const storedUniverseBar = this.storage.getItemSync('op_universe_bar_open');
    if (storedUniverseBar !== null) this.universeBarOpen.set(storedUniverseBar === 'true');
    const storedScale = this.storage.getItemSync('op_canvas_scale');
    if (storedScale) {
      this.canvasScale.set(Number(storedScale) || 1);
      setTimeout(this.updateCanvasBounds, 0);
    }

    this.timeInterval = window.setInterval(() => {
      this.now.set(new Date());
      this.applyThemeClasses();
    }, 60_000);
    setTimeout(this.scheduleCanvasBoundsUpdate, 0);
    window.addEventListener('resize', this.scheduleCanvasBoundsUpdate);
    window.addEventListener('orientationchange', this.scheduleCanvasBoundsUpdate);
    window.addEventListener('focus', this.scheduleCanvasBoundsUpdate);
    window.visualViewport?.addEventListener('resize', this.scheduleCanvasBoundsUpdate);
    window.visualViewport?.addEventListener('scroll', this.scheduleCanvasBoundsUpdate);
  }

  ngOnDestroy() {
    this.debugPerf.markDialogHostDestroy();
    if (this.timeInterval) window.clearInterval(this.timeInterval);
    if (this.universeInterval) window.clearInterval(this.universeInterval);
    if (this.loadingTimeout) window.clearTimeout(this.loadingTimeout);
    if (this.loginLoadingTimeout) window.clearTimeout(this.loginLoadingTimeout);
    if (this.remoteSyncInterval) window.clearInterval(this.remoteSyncInterval);
    this.clearDeferredRemoteApplyTimers();
    this.remoteApplyPipeline.destroy();
    this.realtimeSync.stop();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.scheduleCanvasBoundsUpdate);
      window.removeEventListener('orientationchange', this.scheduleCanvasBoundsUpdate);
      window.removeEventListener('focus', this.scheduleCanvasBoundsUpdate);
      window.visualViewport?.removeEventListener('resize', this.scheduleCanvasBoundsUpdate);
      window.visualViewport?.removeEventListener('scroll', this.scheduleCanvasBoundsUpdate);
      if (this.viewportReflowRaf !== null) {
        window.cancelAnimationFrame(this.viewportReflowRaf);
        this.viewportReflowRaf = null;
      }
    }
  }

  private async pollRemoteStorageChanges() {
    if (typeof window === 'undefined') return;
    if (this.remoteSyncInFlight || this.remoteSyncApplyPending) return;
    if (!this.auth.isLoggedIn() || !this.auth.usesExternalAuth()) return;
    this.remoteSyncInFlight = true;
    try {
      const changedKeys = await this.storage.hydrateAndGetChangedKeys();
      if (changedKeys.length === 0) return;
      const shellKeys = changedKeys.filter((key) => this.isShellRemoteRefreshKey(key));
      if (shellKeys.length === 0) return;
      const recentLocalWrite = Date.now() - this.storage.getLastLocalMutationAt() < 5000;
      if (recentLocalWrite) return;
      this.remoteApplyPipeline.schedule(shellKeys);
    } catch (error) {
      // Ignore transient network/auth issues and retry on next interval.
      this.observability.logWarn('remote.poll.failed', {
        message: error instanceof Error ? error.message : 'unknown_error',
      });
    } finally {
      this.remoteSyncInFlight = false;
    }
  }

  private async applyRemoteStorageChange(changedKeys: string[], options?: { force?: boolean }) {
    if (!changedKeys.length) return;
    const recentLocalWrite =
      !options?.force && Date.now() - this.storage.getLastLocalMutationAt() < 5000;
    if (recentLocalWrite) {
      this.remoteSyncApplyPending = false;
      return;
    }
    try {
      const shouldRefreshAuth = changedKeys.some((key) =>
        [
          'op_users',
          'op_session',
          'op_prefs',
          'op_preview_prefs',
          'op_org_settings',
          'op_universes',
          'op_active_universe',
          'op_invitees',
        ].includes(key),
      );
      const shouldRefreshDialogs = changedKeys.some(
        (key) =>
          key.startsWith('op_dialog_state_v1:') || key.startsWith('op_preview_dialog_state_v1:'),
      );
      if (shouldRefreshAuth) {
        await this.auth.hydrate();
      }
      if (shouldRefreshDialogs || shouldRefreshAuth) {
        await this.dialogService.hydrate();
      }
      this.observability.logInfo('remote.apply.completed', {
        keyCount: changedKeys.length,
        force: Boolean(options?.force),
      });
    } catch (error) {
      this.observability.logWarn('remote.apply.failed', {
        keyCount: changedKeys.length,
        force: Boolean(options?.force),
        message: error instanceof Error ? error.message : 'unknown_error',
      });
    } finally {
      this.remoteSyncApplyPending = false;
    }
  }

  dismissRemoteConflict() {
    this.remoteConflict.clearPending();
    this.remoteConflictBannerVisible.set(false);
    this.clearDeferredRemoteApplyTimers();
  }

  async applyPendingRemoteConflict() {
    const pending = this.remoteConflictPending();
    if (!pending?.keys?.length) return;
    this.clearDeferredRemoteApplyTimers();
    this.remoteConflictBannerVisible.set(false);
    this.remoteConflict.clearPending();
    await this.applyRemoteStorageChange(pending.keys, { force: true });
    this.suppressRemoteChangeSignature = this.changedKeysSignature(pending.keys);
    this.suppressRemoteChangeUntil = Date.now() + 2000;
    this.storage.emitRemoteChange(pending.keys);
  }

  private scheduleDeferredRemoteApply() {
    if (typeof window === 'undefined') return;
    if (this.deferredRemoteApplyTimer) return;
    if (!this.deferredRemoteApplyBannerTimer) {
      this.deferredRemoteApplyBannerTimer = window.setTimeout(() => {
        this.deferredRemoteApplyBannerTimer = undefined;
        if (this.remoteConflictPending()) {
          this.remoteConflictBannerVisible.set(true);
        }
      }, 12000);
    }
    this.deferredRemoteApplyTimer = window.setTimeout(() => {
      this.deferredRemoteApplyTimer = undefined;
      void this.tryAutoApplyDeferredRemoteConflict();
    }, 750);
  }

  private async tryAutoApplyDeferredRemoteConflict() {
    const pending = this.remoteConflictPending();
    if (!pending?.keys?.length) return;
    const recentLocalWrite = Date.now() - this.storage.getLastLocalMutationAt() < 2000;
    const dirtyOverlap = this.remoteConflict.hasDirtyOverlap(pending.keys);
    if (recentLocalWrite || dirtyOverlap) {
      this.scheduleDeferredRemoteApply();
      return;
    }
    this.clearDeferredRemoteApplyTimers();
    this.remoteConflictBannerVisible.set(false);
    this.remoteConflict.clearPending();
    await this.applyRemoteStorageChange(pending.keys, { force: true });
    this.suppressRemoteChangeSignature = this.changedKeysSignature(pending.keys);
    this.suppressRemoteChangeUntil = Date.now() + 2000;
    this.storage.emitRemoteChange(pending.keys);
  }

  private clearDeferredRemoteApplyTimers() {
    if (typeof window === 'undefined') return;
    if (this.deferredRemoteApplyTimer) {
      window.clearTimeout(this.deferredRemoteApplyTimer);
      this.deferredRemoteApplyTimer = undefined;
    }
    if (this.deferredRemoteApplyBannerTimer) {
      window.clearTimeout(this.deferredRemoteApplyBannerTimer);
      this.deferredRemoteApplyBannerTimer = undefined;
    }
  }

  private changedKeysSignature(keys: string[]) {
    return [...keys].sort().join('|');
  }

  private isShellRemoteRefreshKey(key: string) {
    return (
      [
        'op_users',
        'op_session',
        'op_prefs',
        'op_preview_prefs',
        'op_org_settings',
        'op_universes',
        'op_active_universe',
        'op_invitees',
      ].includes(key) ||
      key.startsWith('op_dialog_state_v1:') ||
      key.startsWith('op_preview_dialog_state_v1:')
    );
  }

  updateCanvasBounds = () => {
    if (typeof document === 'undefined') return;
    const canvas = document.querySelector('#app-canvas');
    const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
    if (viewport) {
      this.viewportBounds.set(
        createFallbackRect(
          viewport.clientWidth || viewport.offsetWidth,
          viewport.clientHeight || viewport.offsetHeight,
        ),
      );
    }
    if (!this.phoneMode() && !this.isCanvasLocked() && viewport) {
      this.syncCanvasToViewport(viewport);
    }
    if (canvas instanceof HTMLElement) {
      const nextWidth =
        this.phoneMode() && viewport ? viewport.clientWidth : this.effectiveCanvasWidth();
      const nextHeight =
        this.phoneMode() && viewport ? viewport.clientHeight : this.effectiveCanvasHeight();
      this.canvasBounds.set(createFallbackRect(nextWidth, nextHeight));
    }
    if (this.phoneMode()) {
      this.dialogService.clampAllToBounds(this.viewportBounds(), true);
    } else {
      this.dialogService.clampAllToBounds(this.canvasBounds());
    }
  };

  private scheduleCanvasBoundsUpdate = () => {
    if (typeof window === 'undefined') return;
    if (this.viewportReflowRaf !== null) return;
    this.viewportReflowRaf = window.requestAnimationFrame(() => {
      this.viewportReflowRaf = null;
      this.updateCanvasBounds();
    });
  };

  @HostListener('window:pointermove', ['$event'])
  onTilePointerMove(event: PointerEvent) {
    if (this.tileDragState) {
      event.preventDefault();
      const scale = this.phoneMode() ? 1 : this.canvasScale();
      const dx = (event.clientX - this.tileDragState.startX) / scale;
      const dy = (event.clientY - this.tileDragState.startY) / scale;
      if (this.phoneMode()) {
        this.dialogService.movePhoneTile(
          this.tileDragState.id,
          { x: this.tileDragState.origin.x + dx, y: this.tileDragState.origin.y + dy },
          this.viewportBounds(),
        );
      } else {
        this.dialogService.moveTile(
          this.tileDragState.id,
          { x: this.tileDragState.origin.x + dx, y: this.tileDragState.origin.y + dy },
          this.canvasBounds(),
        );
      }
    }
    if (this.panState) {
      const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
      if (!viewport) return;
      event.preventDefault();
      const dx = event.clientX - this.panState.startX;
      const dy = event.clientY - this.panState.startY;
      viewport.scrollLeft = this.panState.scrollLeft - dx;
      viewport.scrollTop = this.panState.scrollTop - dy;
    }

    if (this.workspacePointerState) {
      const dx = event.clientX - this.workspacePointerState.startX;
      const dy = event.clientY - this.workspacePointerState.startY;
      if (!this.workspacePointerState.moved && Math.hypot(dx, dy) > 6) {
        this.workspacePointerState.moved = true;
        this.workspaceDragId.set(this.workspacePointerState.id);
        this.suppressWorkspaceClick = true;
      }
      if (this.workspacePointerState.moved) {
        const rows = Array.from(document.querySelectorAll('[data-workspace-id]')) as HTMLElement[];
        if (!rows.length) return;
        const positions = rows.map((row) => ({
          id: row.dataset['workspaceId'] ?? '',
          rect: row.getBoundingClientRect(),
        }));
        let insertIndex = positions.findIndex(
          (pos) => event.clientX < pos.rect.left + pos.rect.width / 2,
        );
        if (insertIndex === -1) insertIndex = positions.length;
        if (insertIndex >= positions.length) {
          const last = positions[positions.length - 1];
          this.hoverWorkspaceId.set(last.id);
          this.hoverWorkspaceSide.set('right');
        } else {
          const target = positions[insertIndex];
          this.hoverWorkspaceId.set(target.id);
          this.hoverWorkspaceSide.set('left');
        }
      }
    }
  }

  @HostListener('window:pointerup')
  onTilePointerUp() {
    this.tileDragState = null;
    this.panState = null;
    this.isPanning.set(false);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('no-select');
    }
    if (this.workspacePointerState) {
      if (this.workspacePointerState.moved) {
        const fromId = this.workspacePointerState.id;
        const targetId = this.hoverWorkspaceId();
        if (targetId && fromId !== targetId) {
          const workspaces = this.dialogService.getWorkspaces();
          const fromIndex = workspaces.findIndex((ws) => ws.id === fromId);
          const targetIndex = workspaces.findIndex((ws) => ws.id === targetId);
          if (fromIndex >= 0 && targetIndex >= 0) {
            const dropIndex = this.hoverWorkspaceSide() === 'right' ? targetIndex + 1 : targetIndex;
            this.dialogService.reorderWorkspaceToIndex(fromId, dropIndex);
          }
        }
      }
      this.workspacePointerState = null;
      this.workspaceDragId.set(null);
      this.hoverWorkspaceId.set(null);
      this.hoverWorkspaceSide.set(null);
      if (typeof document !== 'undefined') {
        document.body.classList.remove('no-select');
      }
      setTimeout(() => {
        this.suppressWorkspaceClick = false;
      }, 0);
    }
  }

  @HostListener('window:popstate')
  onPopState() {
    this.handleLogoutRoute();
  }

  private handleLogoutRoute() {
    if (typeof window === 'undefined') return;
    if (!window.location.pathname.startsWith('/logout')) return;
    this.performLogoutRouteRedirect();
  }

  toggleNav() {
    this.navOpen = !this.navOpen;
    void this.storage.setItem('op_nav_open', String(this.navOpen));
    setTimeout(this.updateCanvasBounds, 0);
  }

  floatingSidebarToggleTop() {
    if (!this.topBarOpen()) return 12;
    if (typeof document === 'undefined') return 12 + 48 + (this.workspaceMenuOpen() ? 72 : 0);
    const headerHeight = document.getElementById('topbar-header')?.offsetHeight ?? 48;
    const workspaceHeight = this.workspaceMenuOpen()
      ? (document.getElementById('workspace-bar')?.offsetHeight ?? 72)
      : 0;
    return 12 + headerHeight + workspaceHeight;
  }

  floatingTopBarToggleTop() {
    return 12;
  }

  toggleTopBar() {
    if (this.topBarOpen()) {
      this.workspaceMenuOpen.set(false);
      this.topBarOpen.set(false);
    } else {
      this.topBarOpen.set(true);
    }
    void this.storage.setItem('op_topbar_open', String(this.topBarOpen()));
    void this.storage.setItem('op_workspace_bar_open', String(this.workspaceMenuOpen()));
    setTimeout(this.updateCanvasBounds, 0);
  }

  requestPhoneModeToggle(event: Event) {
    const target = event.target as HTMLInputElement;
    const nextValue = Boolean(target.checked);
    target.checked = this.phoneMode();
    this.pendingPhoneMode.set(nextValue);
    this.phoneModeConfirmOpen.set(true);
  }

  confirmPhoneModeToggle() {
    const nextValue = this.pendingPhoneMode();
    this.phoneModeConfirmOpen.set(false);
    this.pendingPhoneMode.set(null);
    if (nextValue === null) return;
    this.phoneModeReloading = true;
    const prefs = this.auth.preferences();
    this.auth.savePreferences({ ...prefs, phoneMode: nextValue });
    this.auth.setLoginPhoneModePreference(nextValue);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => window.location.reload(), 60);
    }
  }

  cancelPhoneModeToggle() {
    this.phoneModeConfirmOpen.set(false);
    this.pendingPhoneMode.set(null);
  }

  private handlePhoneModeChange(enabled: boolean) {
    if (!this.auth.isLoggedIn()) return;
    if (this.phoneModeReloading) return;
    if (this.auth.consumeLoginPhoneModeApplyFlag() && typeof window !== 'undefined') {
      this.phoneModeReloading = true;
      window.setTimeout(() => window.location.reload(), 60);
      return;
    }
    this.runLoadingTransition();
    if (typeof window !== 'undefined') {
      if (enabled) {
        void this.storage.setItem(PHONE_MODE_BOOT_KEY, String(Date.now()));
      } else {
        void this.storage.removeItem(PHONE_MODE_BOOT_KEY);
      }
    }
    if (enabled) {
      this.navOpenBeforePhone = this.navOpen;
      this.navOpen = false;
      const nextActive = this.pickPhoneActiveInstance();
      if (nextActive) {
        this.phoneActiveDialogId.set(nextActive.id);
      }
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          void this.storage.removeItem(PHONE_MODE_BOOT_KEY);
        }, 500);
      }
      setTimeout(this.updateCanvasBounds, 0);
      return;
    }
    this.phoneActiveDialogId.set(null);
    this.navOpen = this.navOpenBeforePhone;
    setTimeout(this.updateCanvasBounds, 0);
  }

  private pickPhoneActiveInstance() {
    const candidates = this.activeDialogs().filter(
      (instance) => !instance.archived && !instance.minimized && !instance.stashed,
    );
    if (candidates.length) {
      return candidates.reduce((top, item) => (item.z > top.z ? item : top));
    }
    const fallback = this.phoneDialogs();
    return fallback[0] ?? null;
  }

  private applyPhoneModeLayout(activeId: string | null) {
    if (!this.phoneMode()) return;
    if (activeId) this.dialogService.bringToFront(activeId);
  }

  private setPhoneActiveInstance(instanceId: string | null, keepNavOpen = false) {
    if (!this.phoneMode()) return;
    this.phoneActiveDialogId.set(instanceId);
    if (this.navOpen && !keepNavOpen) {
      this.navOpen = false;
    }
  }

  toggleWorkspaceMenu() {
    if (typeof document !== 'undefined') {
      document.querySelector('#app-viewport')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.workspaceMenuOpen.set(!this.workspaceMenuOpen());
    void this.storage.setItem('op_workspace_bar_open', String(this.workspaceMenuOpen()));
  }

  toggleUniverseMenu() {
    if (!this.canSwitchUniverse()) return;
    if (this.universeMenuOpen()) {
      this.universeMenuOpen.set(false);
      return;
    }
    if (this.hasUniverseParticipants()) {
      this.universeMenuPendingOpen.set(true);
      this.universeSwitchConfirmOpen.set(true);
      return;
    }
    this.universeMenuOpen.set(true);
  }

  confirmUniverseMenuOpen() {
    if (!this.universeMenuPendingOpen()) return;
    this.universeSwitchConfirmOpen.set(false);
    this.universeMenuPendingOpen.set(false);
    this.universeMenuOpen.set(true);
  }

  cancelUniverseMenuConfirm() {
    this.universeSwitchConfirmOpen.set(false);
    this.universeMenuPendingOpen.set(false);
  }

  confirmPhoneModeUniverseSwitch() {
    const universeId = this.pendingUniverseSwitchId();
    this.phoneModeUniversePromptOpen.set(false);
    this.pendingUniverseSwitchId.set(null);
    if (!universeId) return;
    this.performUniverseSwitch(universeId, true);
  }

  cancelPhoneModeUniverseSwitch() {
    const universeId = this.pendingUniverseSwitchId();
    this.phoneModeUniversePromptOpen.set(false);
    this.pendingUniverseSwitchId.set(null);
    if (!universeId) return;
    this.performUniverseSwitch(universeId, false);
  }

  switchUniverse(universeId: string) {
    if (!this.canSwitchUniverse()) return;
    const userId = this.currentUserId();
    if (!userId) return;
    const activeId = this.auth.getActiveUniverseId(userId);
    if (!activeId || activeId === universeId) {
      this.universeMenuOpen.set(false);
      return;
    }
    const targetPrefs = this.auth.getUniversePreferences(userId, universeId);
    if (targetPrefs && !targetPrefs.universeOpened) {
      this.performUniverseSwitch(universeId, this.phoneMode());
      return;
    }
    if (this.phoneMode() && targetPrefs && targetPrefs.phoneMode === false) {
      this.pendingUniverseSwitchId.set(universeId);
      this.phoneModeUniversePromptOpen.set(true);
      this.universeMenuOpen.set(false);
      return;
    }
    this.performUniverseSwitch(universeId);
  }

  private performUniverseSwitch(universeId: string, forcePhoneMode?: boolean) {
    const userId = this.currentUserId();
    if (!userId) return;
    const fromUniverseId = this.auth.getActiveUniverseId(userId);
    const token = this.debugPerf.startSwitch('UniverseSwitch', this.activeDialogs().length, {
      fromUniverseId,
      toUniverseId: universeId,
      forcedPhoneMode: forcePhoneMode ?? null,
    });
    if (this.hasUniverseParticipants()) {
      const currentUniverseId = this.universeId();
      if (currentUniverseId) {
        this.auth.markUniverseKick(currentUniverseId);
      }
    }
    this.runLoadingTransition();
    this.auth.setActiveUniverseId(userId, universeId);
    if (forcePhoneMode !== undefined) {
      const prefs = this.auth.getUniversePreferences(userId, universeId);
      this.auth.savePreferences({ ...prefs, phoneMode: forcePhoneMode });
      this.auth.setLoginPhoneModePreference(forcePhoneMode);
    }
    this.universeMenuOpen.set(false);
    this.debugPerf.completeSwitch(token, () => this.activeDialogs().length);
  }

  setCanvasMode(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const locked = value === 'locked';
    const prefs = this.auth.preferences();
    this.auth.savePreferences({ ...prefs, lockCanvasSize: locked });
    if (locked) {
      this.canvasDraftWidth.set(this.canvasWidth());
      this.canvasDraftHeight.set(this.canvasHeight());
      this.applyCanvasSize();
    } else {
      this.syncCanvasToViewport();
      this.canvasDraftWidth.set(this.canvasWidth());
      this.canvasDraftHeight.set(this.canvasHeight());
      setTimeout(this.updateCanvasBounds, 0);
    }
  }

  startWorkspaceRename(ws: { id: string; name: string }) {
    if (!this.canEdit()) return;
    this.editingWorkspaceId.set(ws.id);
    this.editingWorkspaceName.set(ws.name);
    setTimeout(() => {
      this.workspaceRenameInput()?.nativeElement?.focus();
      this.workspaceRenameInput()?.nativeElement?.select();
    }, 0);
  }

  finishWorkspaceRename(ws: { id: string }) {
    if (this.editingWorkspaceId() !== ws.id) return;
    const nextName = this.editingWorkspaceName().trim();
    this.editingWorkspaceId.set(null);
    if (!nextName) return;
    this.dialogService.renameWorkspace(ws.id, nextName);
  }

  cancelWorkspaceRename() {
    this.editingWorkspaceId.set(null);
    this.editingWorkspaceName.set('');
  }

  closeWorkspace(ws: { id: string }) {
    if (!this.canEdit()) return;
    if (this.dialogService.getWorkspaces().length <= 1) return;
    this.dialogService.closeWorkspace(ws.id);
  }

  onWorkspacePointerDown = (id: string, event: PointerEvent) => {
    if (!this.canEdit()) return;
    if (event.button !== 0) return;
    if (event.detail > 1) return;
    if (this.editingWorkspaceId() === id) {
      this.finishWorkspaceRename({ id });
    }
    event.preventDefault();
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    this.workspacePointerState = { id, startX: event.clientX, startY: event.clientY, moved: false };
    this.hoverWorkspaceId.set(null);
    this.hoverWorkspaceSide.set(null);
    if (typeof document !== 'undefined') {
      document.body.classList.add('no-select');
    }
  };

  onWorkspaceClick = (id: string) => {
    if (this.suppressWorkspaceClick) return;
    const fromWorkspaceId = this.dialogService.getActiveWorkspaceId();
    const token = this.debugPerf.startSwitch('WorkspaceSwitch', this.activeDialogs().length, {
      fromWorkspaceId,
      toWorkspaceId: id,
      sameWorkspace: fromWorkspaceId === id,
    });
    this.dialogService.switchWorkspace(id);
    this.debugPerf.completeSwitch(token, () => this.activeDialogs().length);
    if (this.phoneMode()) {
      this.cancelWorkspaceRename();
      this.workspaceMenuOpen.set(false);
      void this.storage.setItem('op_workspace_bar_open', 'false');
    }
  };

  private updateFavicon(emoji: string) {
    if (typeof document === 'undefined') return;
    const icon = emoji?.trim();
    const svg = icon
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">${icon}</text></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>`;
    const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }

  openSettings() {
    if (!this.canOpenSettings()) return;
    if (typeof document !== 'undefined') {
      const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
      viewport?.scrollTo({ top: 0, left: 0 });
    }
    this.settingsOpen.set(true);
    this.settingsCloseConfirmOpen.set(false);
    this.settingsDraft.start();
  }

  toggleSettings() {
    if (!this.canOpenSettings()) return;
    if (this.settingsOpen()) {
      this.requestCloseSettings();
    } else {
      this.openSettings();
    }
  }

  requestCloseSettings() {
    if (this.settingsDraft.dirty()) {
      this.settingsCloseConfirmOpen.set(true);
      return;
    }
    this.settingsOpen.set(false);
  }

  openLicense() {
    if (this.licenseOpen()) {
      this.licenseOpen.set(false);
      return;
    }
    if (typeof document !== 'undefined') {
      const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
      viewport?.scrollTo({ top: 0, left: 0 });
    }
    this.licenseOpen.set(true);
  }

  confirmCloseSettings() {
    this.settingsDraft.cancel();
    this.settingsCloseConfirmOpen.set(false);
    this.settingsOpen.set(false);
  }

  cancelCloseSettings() {
    this.settingsCloseConfirmOpen.set(false);
  }

  openApp(appId: AppId) {
    if (!this.canEdit()) return;
    this.updateCanvasBounds();
    const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
    const viewportBounds = this.viewportBounds();
    const result = this.dialogService.createInstance(appId, viewportBounds);
    if (!result.ok) {
      alert(this.translate.instant(result.message ?? 'dialogs.error.generic'));
      return;
    }
    if (result.instance && viewport) {
      if (this.phoneMode()) {
        this.phoneDialogs()
          .filter((instance) => instance.id !== result.instance?.id)
          .forEach((instance) => this.dialogService.setPhoneMinimized(instance.id, true));
      }
      const nextX = result.instance.rect.x + viewport.scrollLeft;
      const nextY = result.instance.rect.y + viewport.scrollTop;
      if (this.phoneMode()) {
        this.dialogService.setPhoneRect(
          result.instance.id,
          { x: 0, y: 0, width: viewportBounds.width, height: viewportBounds.height },
          viewportBounds,
        );
        this.dialogService.setPhoneMinimized(result.instance.id, false);
        this.dialogService.unstashPhoneInstance(result.instance.id);
      } else {
        this.dialogService.moveInstance(
          result.instance.id,
          { x: nextX, y: nextY },
          this.canvasBounds(),
        );
      }
      if (this.phoneMode()) {
        this.setPhoneActiveInstance(result.instance.id, true);
      }
      this.publishFocusContext(result.instance.id, 'inspect');
    }
  }

  onDialogBringToFront(instance: DialogInstance) {
    this.dialogService.bringToFront(instance.id);
    this.publishFocusContext(instance.id, 'inspect');
  }

  restoreInstance(instanceId: string) {
    if (!this.canEdit()) return;
    if (this.phoneMode()) {
      this.phoneDialogs()
        .filter((instance) => instance.id !== instanceId)
        .forEach((instance) => this.dialogService.setPhoneMinimized(instance.id, true));
      this.dialogService.setPhoneMinimized(instanceId, false);
      this.dialogService.unstashPhoneInstance(instanceId);
    } else {
      this.dialogService.restoreInstance(instanceId);
    }
    this.dialogService.bringToFront(instanceId);
    this.publishFocusContext(instanceId, 'inspect');
    if (this.phoneMode()) {
      this.setPhoneActiveInstance(instanceId);
    }
  }

  duplicateInstance(instanceId: string) {
    if (!this.canEdit()) return;
    this.cloneTargetId.set(instanceId);
  }

  async confirmClone() {
    const instanceId = this.cloneTargetId();
    if (!instanceId) return;
    const original = this.dialogService.getActiveDialogs().find((item) => item.id === instanceId);
    if (!original) {
      this.cloneTargetId.set(null);
      return;
    }
    const result = this.dialogService.createInstance(original.appId, this.viewportBounds());
    if (!result.ok || !result.instance) {
      this.cloneTargetId.set(null);
      return;
    }
    const nextId = result.instance.id;
    if (original.titleOverride) {
      this.dialogService.setTitleOverride(nextId, original.titleOverride);
    }
    this.dialogService.moveInstance(
      nextId,
      { x: original.rect.x + 24, y: original.rect.y + 24 },
      this.canvasBounds(),
    );
    if (original.phoneRect) {
      this.dialogService.setPhoneRect(nextId, original.phoneRect, this.viewportBounds());
      this.dialogService.setPhoneMinimized(nextId, false);
      this.dialogService.unstashPhoneInstance(nextId);
    }
    await this.cloneAppData(original.appId, original.id, nextId);
    this.cloneTargetId.set(null);
  }

  cancelClone() {
    this.cloneTargetId.set(null);
  }

  async cloneAppData(appId: AppId, fromId: string, toId: string) {
    if (appId === 'todo') {
      cloneTodoState(this.storage, fromId, toId, this.auth.storageUserKey());
    }
    if (appId === 'calculator') cloneCalculatorState(fromId, toId, this.storage);
    if (appId === 'timer') cloneTimerState(fromId, toId, this.storage);
    if (appId === 'navigator') cloneNavigatorState(fromId, toId, this.storage);
    if (appId === 'notes') cloneNotesState(fromId, toId, this.storage);
    if (appId === 'stickyNotes') cloneStickyNoteState(fromId, toId, this.storage);
    if (appId === 'calendar') cloneCalendarState(fromId, toId, this.storage);
    if (appId === 'clock') cloneClockState(fromId, toId, this.storage);
    if (appId === 'kanban') cloneKanbanState(fromId, toId, this.storage);
    if (appId === 'dataTable') cloneDataTableState(fromId, toId, this.storage);
  }

  transformTodoToKanban(instanceId: string) {
    if (!this.canEdit()) return;
    const original = this.dialogService.getActiveDialogs().find((item) => item.id === instanceId);
    if (!original || original.appId !== 'todo') return;
    const userKey = this.auth.storageUserKey();
    const todoState = loadTodoState(this.storage, instanceId, userKey);
    const nextInstance = this.createTransformedInstance('kanban', original);
    if (!nextInstance) return;
    saveKanbanState(
      this.storage,
      nextInstance.id,
      this.auth.storageUserKey(),
      this.todoToKanbanState(todoState),
    );
    this.dialogService.setTitleOverride(
      nextInstance.id,
      this.buildTransformTitle(original, 'Kanban'),
    );
  }

  transformKanbanToTodo(instanceId: string) {
    if (!this.canEdit()) return;
    const original = this.dialogService.getActiveDialogs().find((item) => item.id === instanceId);
    if (!original || original.appId !== 'kanban') return;
    const kanbanState = loadKanbanState(this.storage, instanceId, this.auth.storageUserKey());
    if (!kanbanState) return;
    const nextInstance = this.createTransformedInstance('todo', original);
    if (!nextInstance) return;
    saveTodoState(
      this.storage,
      nextInstance.id,
      this.auth.storageUserKey(),
      this.kanbanToTodoState(kanbanState),
    );
    this.dialogService.setTitleOverride(
      nextInstance.id,
      this.buildTransformTitle(original, 'Todo'),
    );
  }

  transformKanbanColumnsToTodos(instanceId: string) {
    if (!this.canEdit()) return;
    const original = this.dialogService.getActiveDialogs().find((item) => item.id === instanceId);
    if (!original || original.appId !== 'kanban') return;
    const kanbanState = loadKanbanState(this.storage, instanceId, this.auth.storageUserKey());
    const activeBoard =
      kanbanState?.boards.find((b) => b.id === kanbanState.activeBoardId) ?? kanbanState?.boards[0];
    if (!kanbanState || !activeBoard) return;
    for (const column of activeBoard.columns) {
      const nextInstance = this.createTransformedInstance('todo', original);
      if (!nextInstance) break;
      saveTodoState(
        this.storage,
        nextInstance.id,
        this.auth.storageUserKey(),
        this.kanbanColumnToTodoState(kanbanState, activeBoard.id, column.id),
      );
      this.dialogService.setTitleOverride(
        nextInstance.id,
        `${this.instanceLabel(original)} - ${column.title}`,
      );
    }
  }

  private createTransformedInstance(
    appId: AppId,
    original?: DialogInstance,
  ): DialogInstance | null {
    this.updateCanvasBounds();
    const result = this.dialogService.createInstance(appId, this.viewportBounds());
    if (!result.ok || !result.instance) {
      alert(this.translate.instant(result.message ?? 'dialogs.error.generic'));
      return null;
    }
    const next = result.instance;
    if (this.phoneMode()) {
      this.phoneDialogs()
        .filter((instance) => instance.id !== next.id)
        .forEach((instance) => this.dialogService.setPhoneMinimized(instance.id, true));
      this.dialogService.setPhoneRect(
        next.id,
        { x: 0, y: 0, width: this.viewportBounds().width, height: this.viewportBounds().height },
        this.viewportBounds(),
      );
      this.dialogService.setPhoneMinimized(next.id, false);
      this.dialogService.unstashPhoneInstance(next.id);
      this.setPhoneActiveInstance(next.id, true);
    } else if (original) {
      this.dialogService.moveInstance(
        next.id,
        { x: original.rect.x + 24, y: original.rect.y + 24 },
        this.canvasBounds(),
      );
    }
    this.dialogService.bringToFront(next.id);
    return next;
  }

  private buildTransformTitle(original: DialogInstance, targetLabel: string) {
    return `${this.instanceLabel(original)} (${targetLabel})`;
  }

  private todoToKanbanState(todoState: TodoState): KanbanState {
    const cardId = () =>
      `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const colId = () => `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const chkId = () => `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const boardId = `board_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const cards: NonNullable<KanbanState['boards'][number]>['cards'] = {};
    const columns = todoState.projects.map((project) => {
      const nextColumnId = colId();
      const columnCardIds: string[] = [];
      for (const todo of project.todos) {
        const nextCardId = cardId();
        columnCardIds.push(nextCardId);
        cards[nextCardId] = {
          id: nextCardId,
          title: todo.text,
          description: '',
          dueDate: '',
          labels: todo.completed ? ['completed'] : [],
          checklist: (todo.subtasks ?? []).map((sub) => ({
            id: chkId(),
            text: sub.text,
            done: Boolean(sub.completed),
          })),
        };
      }
      return { id: nextColumnId, title: project.title, cardIds: columnCardIds };
    });
    const ensuredColumns = columns.length
      ? columns
      : [{ id: colId(), title: 'Todo', cardIds: [] as string[] }];
    return {
      boards: [
        {
          id: boardId,
          name: 'Board',
          columns: ensuredColumns,
          cards,
        },
      ],
      activeBoardId: boardId,
      selectedCardId: null,
      selectedColumnId: ensuredColumns[0]?.id ?? null,
    };
  }

  private kanbanToTodoState(kanbanState: KanbanState): TodoState {
    const activeBoard =
      kanbanState.boards.find((b) => b.id === kanbanState.activeBoardId) ?? kanbanState.boards[0];
    if (!activeBoard) {
      const todo = createTodoItem('');
      return {
        version: 2,
        projectsEnabled: false,
        projects: [{ id: `p_${todo.id}`, title: 'Project', todos: [] }],
        activeProjectId: `p_${todo.id}`,
        subtaskCollapsed: {},
      };
    }
    const projects = activeBoard.columns.map((column) => {
      const todos = column.cardIds
        .map((cardId) => activeBoard.cards?.[cardId])
        .filter(Boolean)
        .map((card) => this.kanbanCardToTodo(card!, column.title));
      return {
        id: `proj_${column.id}_${Math.random().toString(36).slice(2, 6)}`,
        title: column.title || 'Project',
        todos,
      };
    });
    const ensuredProjects =
      projects.length > 0
        ? projects
        : [{ id: `proj_${Date.now().toString(36)}`, title: 'Project', todos: [] }];
    return {
      version: 2,
      projectsEnabled: ensuredProjects.length > 1,
      projects: ensuredProjects,
      activeProjectId: ensuredProjects[0].id,
      subtaskCollapsed: {},
    };
  }

  private kanbanColumnToTodoState(
    kanbanState: KanbanState,
    boardId: string,
    columnId: string,
  ): TodoState {
    const board = kanbanState.boards.find((item) => item.id === boardId);
    const column = board?.columns.find((item) => item.id === columnId);
    const todos =
      board && column
        ? column.cardIds
            .map((cardId) => board.cards?.[cardId])
            .filter(Boolean)
            .map((card) => this.kanbanCardToTodo(card!, column.title))
        : [];
    const projectId = `proj_${columnId}_${Date.now().toString(36)}`;
    return {
      version: 2,
      projectsEnabled: false,
      projects: [{ id: projectId, title: column?.title || 'Project', todos }],
      activeProjectId: projectId,
      subtaskCollapsed: {},
    };
  }

  private kanbanCardToTodo(
    card: NonNullable<KanbanState['boards'][number]['cards'][string]>,
    columnTitle: string,
  ) {
    const todo = createTodoItem(card.title ?? '');
    todo.completed =
      this.looksDoneColumn(columnTitle) ||
      card.labels?.some((label) => /done|complete/i.test(label));
    const subtasks: TodoSubtask[] = (card.checklist ?? []).map((item) => ({
      id: createSubtask(item.text ?? '').id,
      text: item.text ?? '',
      completed: Boolean(item.done),
    }));
    if (card.description?.trim()) {
      subtasks.push(createSubtask(`Description: ${card.description.trim()}`));
    }
    if (card.dueDate?.trim()) {
      subtasks.push(createSubtask(`Due: ${card.dueDate.trim()}`));
    }
    if (Array.isArray(card.labels) && card.labels.length) {
      const otherLabels = card.labels.filter((label) => !/done|complete/i.test(label));
      if (otherLabels.length) {
        subtasks.push(createSubtask(`Labels: ${otherLabels.join(', ')}`));
      }
    }
    todo.subtasks = subtasks;
    return todo;
  }

  private looksDoneColumn(title: string) {
    return /(done|complete|completed|finished)/i.test(title || '');
  }

  private effectiveUserId() {
    return this.auth.session().previewUserId ?? this.auth.session().userId ?? 'guest';
  }

  renameInstance(instanceId: string, title: string) {
    this.dialogService.setTitleOverride(instanceId, title);
  }

  toggleDeleteLock(instanceId: string) {
    if (!this.canEdit()) return;
    if (this.deleteTargetId()) return;
    this.dialogService.toggleDeleteLock(instanceId);
  }

  stashInstance(instanceId: string) {
    if (!this.canEdit()) return;
    if (this.phoneMode()) {
      this.dialogService.stashPhoneInstance(instanceId, this.viewportBounds());
      this.setPhoneActiveInstance(null);
      return;
    }
    this.dialogService.stashInstance(instanceId, this.canvasBounds());
  }

  restoreFromStash(instance: { id: string }) {
    if (!this.canEdit()) return;
    if (this.phoneMode()) {
      this.dialogService.unstashPhoneInstance(instance.id);
      this.dialogService.setPhoneMinimized(instance.id, false);
      this.setPhoneActiveInstance(instance.id);
    } else {
      this.dialogService.unstashInstance(instance.id);
      const target = this.activeDialogs().find((dialog) => dialog.id === instance.id);
      if (target) {
        const bounds = this.canvasBounds();
        const nextX = Math.max(0, (bounds.width - target.rect.width) / 2);
        const nextY = Math.max(0, (bounds.height - target.rect.height) / 2);
        this.dialogService.moveInstance(instance.id, { x: nextX, y: nextY }, bounds);
      }
      this.dialogService.bringToFront(instance.id);
    }
  }

  toggleDialogsHidden() {
    if (!this.canEdit()) return;
    this.dialogService.toggleWorkspaceHidden(this.dialogService.getActiveWorkspaceId());
  }

  onDialogMove(instanceId: string, rect: { x: number; y: number }) {
    if (this.phoneMode()) {
      this.dialogService.movePhoneInstance(instanceId, rect, this.viewportBounds());
      return;
    }
    this.dialogService.moveInstance(instanceId, rect, this.canvasBounds());
  }

  onDialogResize(instanceId: string, rect: { width: number; height: number }) {
    if (this.phoneMode()) {
      this.dialogService.resizePhoneInstance(instanceId, rect, this.viewportBounds());
      return;
    }
    this.dialogService.resizeInstance(instanceId, rect, this.canvasBounds());
  }

  minimizeInstance(instanceId: string) {
    if (!this.canEdit()) return;
    if (this.phoneMode()) {
      this.dialogService.setPhoneMinimized(instanceId, true);
      const remaining = this.phoneDialogs().filter(
        (instance) => instance.id !== instanceId && !this.isPhoneMinimized(instance),
      );
      const next = remaining[0] ?? null;
      this.setPhoneActiveInstance(next ? next.id : null);
      return;
    }
    this.dialogService.minimizeInstance(instanceId);
  }

  toggleMaximize(instanceId: string) {
    if (!this.canEdit()) return;
    if (this.phoneMode()) {
      this.phoneDialogs()
        .filter((instance) => instance.id !== instanceId)
        .forEach((instance) => this.dialogService.setPhoneMinimized(instance.id, true));
      this.dialogService.setPhoneMinimized(instanceId, false);
      return;
    }
    this.dialogService.toggleMaximize(instanceId, this.viewportBounds());
  }

  confirmDelete(instanceId: string) {
    if (!this.canEdit()) return;
    this.deleteTargetId.set(instanceId);
  }

  confirmArchive(instanceId: string) {
    if (!this.canEdit()) return;
    this.archiveTargetId.set(instanceId);
  }

  deleteConfirmed() {
    const target = this.deleteTargetId();
    if (target) this.dialogService.deleteInstance(target);
    this.deleteTargetId.set(null);
  }

  archiveConfirmed() {
    const target = this.archiveTargetId();
    if (target) this.dialogService.archiveInstance(target);
    this.archiveTargetId.set(null);
  }

  unarchiveInstance(instanceId: string) {
    if (!this.canEdit()) return;
    this.dialogService.unarchiveInstance(instanceId);
  }

  toggleResetMenu() {
    if (!this.canEdit()) return;
    this.resetMenuOpen.set(!this.resetMenuOpen());
  }

  resetDialogs(mode: 'left' | 'middle') {
    if (!this.canEdit()) return;
    this.dialogService.resetPositions(mode, this.canvasBounds());
    this.resetMenuOpen.set(false);
  }

  instanceIndex(appId: AppId, instanceId: string) {
    const instances = this.dialogService.getAppInstances(appId);
    return instances.findIndex((instance) => instance.id === instanceId) + 1;
  }

  instanceLabel(instance: {
    titleKey: string;
    titleOverride?: string;
    id: string;
    appId: AppId;
    instanceNumber?: number;
  }) {
    if (instance.titleOverride) return instance.titleOverride;
    const base = this.translate.instant(this.instanceNameKey(instance.appId));
    const index = instance.instanceNumber ?? this.instanceIndex(instance.appId, instance.id);
    return `${base} (${index})`;
  }

  instanceNameKey(appId: AppId) {
    return `appNames.${appId}`;
  }

  instanceIcon(appId: AppId) {
    return APP_REGISTRY[appId]?.icon ?? '📦';
  }

  renderInstance(instance: DialogInstance) {
    if (!this.phoneMode()) return instance;
    const bounds = this.viewportBounds();
    const fallbackWidth =
      typeof window !== 'undefined' ? Math.max(1, window.innerWidth) : bounds.width;
    const fallbackHeight =
      typeof window !== 'undefined' ? Math.max(1, window.innerHeight) : bounds.height;
    const width = Math.max(0, (bounds.width || fallbackWidth) - 2);
    const height = this.phoneDialogHeight(bounds.height || fallbackHeight);
    const phoneRect = instance.phoneRect ?? instance.rect;
    const useFull = true;
    return {
      ...instance,
      rect: useFull ? { x: 0, y: 0, width, height } : phoneRect,
      isMaximized: useFull,
    };
  }

  private phoneDialogHeight(viewportHeight: number) {
    const base = Math.max(1, viewportHeight);
    let barOffset = 0;
    if (this.showUniverseBar() && this.universeBarOpen() && typeof document !== 'undefined') {
      const bar = document.querySelector('.universe-bar') as HTMLElement | null;
      if (bar) {
        barOffset = bar.offsetHeight || 0;
      } else {
        barOffset = Math.round(base * 0.18);
      }
    }
    return Math.max(200, base - barOffset - 8);
  }

  isPhoneMinimized(instance: DialogInstance) {
    return Boolean(instance.phoneMinimized);
  }

  isPhoneStashed(instance: DialogInstance) {
    return Boolean(instance.phoneStashed);
  }

  instanceHasSettings(appId: AppId) {
    return (
      appId === 'todo' ||
      appId === 'clock' ||
      appId === 'calculator' ||
      appId === 'kanban' ||
      appId === 'notes' ||
      appId === 'stickyNotes' ||
      appId === 'dataTable'
    );
  }

  toggleInstanceSettings(instanceId: string) {
    this.instanceSettings.toggle(instanceId);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement | null;
    const workspaceBar =
      typeof document !== 'undefined' ? document.getElementById('workspace-bar') : null;
    const clickedWorkspaceToggle = Boolean(target?.closest('[data-workspace-toggle="true"]'));
    const insideWorkspaceBar = Boolean(target && workspaceBar?.contains(target));
    if (this.workspaceMenuOpen() && !insideWorkspaceBar && !clickedWorkspaceToggle) {
      this.workspaceMenuOpen.set(false);
      this.cancelWorkspaceRename();
      void this.storage.setItem('op_workspace_bar_open', 'false');
    }
    const input = this.workspaceRenameInput()?.nativeElement ?? null;
    if (
      this.editingWorkspaceId() &&
      input &&
      target &&
      input !== target &&
      !input.contains(target)
    ) {
      const ws = this.dialogService
        .getWorkspaces()
        .find((item) => item.id === this.editingWorkspaceId());
      if (ws) {
        this.finishWorkspaceRename(ws);
      } else {
        this.cancelWorkspaceRename();
      }
    }
  }

  openMoveWorkspace(instanceId: string) {
    if (!this.canEdit()) return;
    if (this.dialogService.getWorkspaces().length <= 1) return;
    this.moveWorkspaceTargetId.set(instanceId);
  }

  closeMoveWorkspace() {
    this.moveWorkspaceTargetId.set(null);
  }

  moveInstanceToWorkspace(workspaceId: string) {
    const instanceId = this.moveWorkspaceTargetId();
    if (!instanceId) return;
    this.dialogService.moveInstanceToWorkspace(instanceId, workspaceId);
    this.moveWorkspaceTargetId.set(null);
  }

  private syncUniverseState() {
    const universeId = this.universeId();
    if (!universeId) return;
    const session = this.auth.session();
    if (!session.userId) return;
    const focus = this.contextFields.focus(universeId);
    const username =
      this.auth.actualUser()?.username ??
      session.sessionUsername ??
      this.translate.instant('auth.title');
    const entry: UniversePresenceEntry = {
      id: session.userId,
      username,
      role: this.sessionRole(),
      ownerId: this.universeOwnerId() ?? '',
      lastSeen: Date.now(),
      activeInstanceId: focus?.activeInstanceId ?? null,
      activeObjectId: focus?.activeObjectRef?.id ?? null,
      activeMode: focus?.focusMode ?? 'inspect',
    };
    this.auth.touchUniversePresence(universeId, entry);
    this.universePresence.set(this.auth.getUniversePresence(universeId));
    let holder = this.auth.getUniverseEditHolder(universeId);
    if (!holder && this.isUniverseOwner()) {
      const ownerName = this.auth.actualUser()?.username ?? 'Owner';
      holder = { id: session.userId, username: ownerName, role: this.sessionRole() };
      this.auth.setUniverseEditHolder(universeId, holder);
    }
    this.universeEditHolder.set(holder);
    if (this.allowUniverseChat()) {
      const messages = this.auth.getUniverseChat(universeId);
      const prevCount = this.universeChatLastCount();
      this.universeChatMessages.set(messages);
      if (this.universeChatOpen()) {
        this.universeChatUnread.set(0);
        this.scrollUniverseChatToBottom();
      } else if (messages.length > prevCount) {
        this.universeChatUnread.set(this.universeChatUnread() + (messages.length - prevCount));
      }
      this.universeChatLastCount.set(messages.length);
    } else {
      this.universeChatMessages.set([]);
      this.universeChatUnread.set(0);
      this.universeChatLastCount.set(0);
    }
  }

  toggleUniverseBar() {
    this.universeBarOpen.set(!this.universeBarOpen());
    void this.storage.setItem('op_universe_bar_open', String(this.universeBarOpen()));
    setTimeout(this.updateCanvasBounds, 0);
  }

  universeBarLeft() {
    if (this.phoneMode()) return 0;
    return this.navOpen ? RESERVED_SIDEBAR_WIDTH : 0;
  }

  toggleUniverseChat() {
    if (!this.allowUniverseChat()) return;
    this.universeChatOpen.set(!this.universeChatOpen());
    if (this.universeChatOpen()) {
      this.universeChatUnread.set(0);
      this.universeChatLastCount.set(this.universeChatMessages().length);
      this.syncUniverseState();
      this.scrollUniverseChatToBottom();
    }
  }

  sendUniverseChat() {
    const universeId = this.universeId();
    if (!universeId) return;
    const content = this.universeChatDraft().trim();
    if (!content) return;
    const author =
      this.auth.actualUser()?.username ?? this.auth.session().sessionUsername ?? 'User';
    const message: UniverseChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      author,
      role: this.sessionRole(),
      content,
      createdAt: Date.now(),
    };
    const list = this.auth.appendUniverseChat(universeId, message);
    this.universeChatMessages.set(list);
    this.universeChatDraft.set('');
    this.scrollUniverseChatToBottom();
    queueMicrotask(() => {
      this.universeChatInput()?.nativeElement?.focus();
    });
  }

  onUniverseChatKeydown(event: Event) {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.shiftKey) return;
    keyEvent.preventDefault();
    this.sendUniverseChat();
  }

  onUniverseChatScroll(event: Event) {
    const target = event.target as HTMLElement;
    const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 6;
    this.universeChatSticky.set(atBottom);
  }

  private scrollUniverseChatToBottom() {
    if (!this.universeChatSticky()) return;
    setTimeout(() => {
      const el = this.universeChatScroll()?.nativeElement;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    }, 0);
  }

  clearUniverseChat() {
    if (!this.isUniverseOwner()) return;
    const universeId = this.universeId();
    if (!universeId) return;
    this.auth.clearUniverseChat(universeId);
    this.universeChatMessages.set([]);
  }

  requestClearUniverseChat() {
    if (!this.isUniverseOwner()) return;
    if (!this.universeChatMessages().length) return;
    this.clearUniverseChatConfirmOpen.set(true);
  }

  confirmClearUniverseChat() {
    this.clearUniverseChatConfirmOpen.set(false);
    this.clearUniverseChat();
  }

  grantEdit(invitee: UniversePresenceEntry) {
    if (
      !this.auth.canGrantPencil({
        universeOwnerId: this.universeOwnerId(),
        multiUserEnabled: this.multiUserEnabled(),
        universeEditHolderId: this.universeEditHolder()?.id ?? null,
      })
    ) {
      return;
    }
    const universeId = this.universeId();
    if (!universeId) return;
    const holder: UniverseEditHolder = {
      id: invitee.id,
      username: invitee.username,
      role: invitee.role,
    };
    this.auth.setUniverseEditHolder(universeId, holder);
    this.universeEditHolder.set(holder);
  }

  takeBackEditPermissions() {
    if (
      !this.auth.canGrantPencil({
        universeOwnerId: this.universeOwnerId(),
        multiUserEnabled: this.multiUserEnabled(),
        universeEditHolderId: this.universeEditHolder()?.id ?? null,
      })
    ) {
      return;
    }
    const universeId = this.universeId();
    if (!universeId) return;
    const ownerName = this.auth.actualUser()?.username ?? 'Owner';
    const holder: UniverseEditHolder = {
      id: this.auth.session().userId ?? '',
      username: ownerName,
      role: this.sessionRole(),
    };
    this.auth.setUniverseEditHolder(universeId, holder);
    this.universeEditHolder.set(holder);
  }

  private runLoadingTransition() {
    if (typeof window === 'undefined') return;
    this.loadingVisible.set(true);
    this.loadingFading.set(false);
    if (this.loadingTimeout) window.clearTimeout(this.loadingTimeout);
    this.loadingTimeout = window.setTimeout(() => {
      this.loadingFading.set(true);
      this.loadingTimeout = window.setTimeout(() => {
        this.loadingVisible.set(false);
        this.loadingFading.set(false);
      }, 120);
    }, 0);
  }

  forceLogoutToMain() {
    if (typeof window !== 'undefined') {
      window.location.href = '/logout';
      return;
    }
    void this.router.navigateByUrl('/logout');
  }

  startRename(instance: { id: string; titleOverride?: string; titleKey: string; appId: AppId }) {
    if (!this.canEdit()) return;
    this.editingTileId.set(instance.id);
    this.editingTitle.set(this.instanceLabel(instance));
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const input = document.querySelector(
          `[data-tile-input="${instance.id}"]`,
        ) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }, 0);
    }
  }

  finishRename(instance: { id: string; titleOverride?: string; titleKey: string; appId: AppId }) {
    if (!this.canEdit()) return;
    const next = this.editingTitle().trim();
    if (next) {
      this.dialogService.setTitleOverride(instance.id, next);
    }
    this.editingTileId.set(null);
  }

  startTileDrag(
    instance: { id: string; tileRect?: { x: number; y: number } },
    event: PointerEvent,
  ) {
    if (!this.canEdit()) return;
    const activeRect = instance.tileRect;
    if (!activeRect) return;
    if (event.detail > 1) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;
    if (this.editingTileId() === instance.id) return;
    event.preventDefault();
    target?.setPointerCapture?.(event.pointerId);
    this.tileDragState = {
      id: instance.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: activeRect.x, y: activeRect.y },
    };
  }

  startCanvasPan(event: PointerEvent) {
    if (this.phoneMode()) return;
    if (this.isOverlayActive()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.dialog') || target?.closest('[data-tile]')) return;
    if (target?.closest('button, input, textarea, select')) return;
    const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
    if (!viewport) return;
    event.preventDefault();
    this.panState = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    if (typeof document !== 'undefined') {
      document.body.classList.add('no-select');
    }
    this.isPanning.set(true);
  }

  applyCanvasSize() {
    if (!this.isCanvasLocked()) return;
    const { width, height } = this.clampCanvasSize(
      this.canvasDraftWidth(),
      this.canvasDraftHeight(),
    );
    this.canvasWidth.set(width);
    this.canvasHeight.set(height);
    const prefs = this.auth.preferences();
    this.auth.savePreferences({
      ...prefs,
      canvasWidth: width,
      canvasHeight: height,
      lockCanvasSize: true,
    });
    this.dialogService.clampAllToBounds(this.canvasBounds());
    setTimeout(this.updateCanvasBounds, 0);
  }

  zoomIn() {
    this.setCanvasScale(Math.min(2, this.canvasScale() + 0.1));
  }

  zoomOut() {
    this.setCanvasScale(Math.max(0.5, this.canvasScale() - 0.1));
  }

  resetZoom() {
    this.setCanvasScale(1);
  }

  private setCanvasScale(next: number) {
    this.canvasScale.set(Number(next.toFixed(2)));
    void this.storage.setItem('op_canvas_scale', String(this.canvasScale()));
    setTimeout(this.updateCanvasBounds, 0);
  }

  private clampCanvasSize(width: number, height: number) {
    return {
      width: Math.min(20000, Math.max(1024, Math.round(width))),
      height: Math.min(20000, Math.max(768, Math.round(height))),
    };
  }

  private syncCanvasToViewport(viewport?: HTMLElement | null) {
    if (typeof document === 'undefined') return;
    const target = viewport ?? (document.querySelector('#app-viewport') as HTMLElement | null);
    if (!target) return;
    let rawWidth = target.clientWidth || target.offsetWidth;
    let rawHeight = target.clientHeight || target.offsetHeight;
    if (typeof window !== 'undefined') {
      rawWidth = window.innerWidth - RESERVED_SIDEBAR_WIDTH;
      rawHeight = window.innerHeight - RESERVED_TOPBAR_HEIGHT - RESERVED_WORKSPACE_HEIGHT;
    }
    const { width, height } = this.clampCanvasSize(rawWidth, rawHeight);
    this.canvasWidth.set(width);
    this.canvasHeight.set(height);
    if (!this.isCanvasLocked()) {
      this.canvasDraftWidth.set(width);
      this.canvasDraftHeight.set(height);
    }
  }

  applyAccessibilityPrompt() {
    const actual = this.auth.actualUser();
    if (!actual) return;
    const prefs = this.auth.preferences();
    this.auth.savePreferences({ ...prefs, accessibilityMode: this.accessibilityPromptEnabled() });
    const universeId = this.auth.getActiveUniverseId(actual.id) ?? null;
    this.auth.markAccessibilityPromptShown(actual.id, universeId);
    this.accessibilityPromptOpen.set(false);
  }

  toggleAccessibilityPrompt() {
    this.accessibilityPromptEnabled.set(!this.accessibilityPromptEnabled());
  }

  private applyThemeClasses() {
    if (typeof document === 'undefined') return;
    const prefs = this.auth.preferences();
    const body = document.body;
    const accessibilityOn = this.accessibilityPromptOpen()
      ? this.accessibilityPromptEnabled()
      : prefs.accessibilityMode;
    const resolvedTheme = this.resolveTheme(prefs.themeMode);
    const colorTheme = prefs.colorTheme || 'standard';
    body.classList.toggle('theme-light', resolvedTheme === 'light');
    body.classList.toggle('theme-dark', resolvedTheme === 'dark');
    body.classList.toggle('theme-color-standard', colorTheme === 'standard');
    body.classList.toggle('theme-color-notepad', colorTheme === 'notepad');
    body.classList.toggle('theme-color-ice', colorTheme === 'ice');
    body.classList.toggle('theme-color-lava', colorTheme === 'lava');
    body.classList.toggle('theme-color-green', colorTheme === 'green');
    body.classList.toggle('accessibility-on', accessibilityOn);
  }

  private resolveTheme(mode: 'system' | 'light' | 'dark' | 'timeZone') {
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    if (mode === 'timeZone') {
      return this.resolveTimeZoneTheme() ?? this.resolveSystemTheme();
    }
    return this.resolveSystemTheme();
  }

  private resolveSystemTheme() {
    if (typeof window === 'undefined') return 'light';
    if (typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private resolveTimeZoneTheme() {
    const prefs = this.auth.preferences();
    const key = this.buildSunKey(prefs);
    const cached = this.sunCache?.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.isDaytime ? 'light' : 'dark';
    }
    this.fetchSunriseSunset(prefs).catch(() => {
      this.sunCache?.delete(key);
    });
    return null;
  }

  private sunCache = new Map<string, { isDaytime: boolean; expiresAt: number }>();

  private buildSunKey(prefs: { city: string; timeZone: string }) {
    const city = prefs.city?.trim().toLowerCase() || '';
    return `${prefs.timeZone}|${city}`;
  }

  private async fetchSunriseSunset(prefs: { city: string; timeZone: string }) {
    const query =
      prefs.city?.trim() || prefs.timeZone.split('/').slice(-1)[0]?.replace('_', ' ') || 'UTC';
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query,
    )}&count=1&language=en&format=json`;
    const geoResp = await fetch(geoUrl);
    if (!geoResp.ok) return;
    const geo = (await geoResp.json()) as {
      results?: { latitude: number; longitude: number }[];
    };
    const location = geo.results?.[0];
    if (!location) return;
    const sunUrl = `https://api.sunrise-sunset.org/json?lat=${location.latitude}&lng=${location.longitude}&formatted=0`;
    const sunResp = await fetch(sunUrl);
    if (!sunResp.ok) return;
    const data = (await sunResp.json()) as {
      status: string;
      results?: { sunrise: string; sunset: string };
    };
    if (data.status !== 'OK' || !data.results) return;
    const sunrise = Date.parse(data.results.sunrise);
    const sunset = Date.parse(data.results.sunset);
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) return;
    const now = Date.now();
    const isDaytime = now >= sunrise && now < sunset;
    const expiresAt = Math.max(sunset, sunrise) + 60 * 60 * 1000;
    this.sunCache.set(this.buildSunKey(prefs), { isDaytime, expiresAt });
    this.applyThemeClasses();
  }

  logout() {
    this.router.navigateByUrl('/logout');
  }

  private handleLogoutLocation(path: string, search: string) {
    if (typeof window === 'undefined') return;
    const rawPath = path || window.location.pathname;
    const rawSearch = search || window.location.search;
    const hasLoggedOut = rawSearch.includes('loggedOut=1');
    if (rawPath.startsWith('/logout') || hasLoggedOut) {
      if (rawPath.startsWith('/logout')) {
        this.performLogoutRouteRedirect();
        return;
      }
      this.auth.logout();
      void this.storage.removeItem('op_session');
      this.forceLoggedOut.set(true);
      return;
    }
    this.forceLoggedOut.set(false);
    this.logoutRedirectInProgress = false;
  }

  requestSwitchToDesktopMode() {
    if (!this.phoneMode()) return;
    this.pendingPhoneMode.set(false);
    this.phoneModeConfirmOpen.set(true);
  }

  private performLogoutRouteRedirect() {
    if (typeof window === 'undefined') return;
    if (this.logoutRedirectInProgress) return;
    this.logoutRedirectInProgress = true;
    const logoutMode = this.auth.logoutEverywhere();
    void this.storage.removeItem('op_session');
    this.forceLoggedOut.set(true);
    if (logoutMode === 'external') {
      return;
    }
    void this.router.navigateByUrl('/login?loggedOut=1', { replaceUrl: true });
  }

  private currentUniverseId() {
    const key = this.auth.storageUserKey();
    const parts = key.split(':');
    return parts.length >= 2 ? parts[1] : null;
  }

  private publishFocusContext(instanceId: string, mode: 'edit' | 'inspect' | 'search' | 'present') {
    const universeId = this.currentUniverseId();
    if (!universeId) return;
    this.contextFields.setFocus(
      universeId,
      {
        activeInstanceId: instanceId,
      },
      { mode, sourceInstanceId: instanceId },
    );
  }
}
