import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from './core/auth.service';
import { AppId, DialogService } from './core/dialog.service';
import { DialogComponent } from './shared/dialog/dialog.component';
import { AppListComponent, AppGroup } from './shared/app-list/app-list.component';
import { OverlayComponent } from './shared/overlay/overlay.component';
import { TodoPageComponent } from './features/applications/todo/todo.component';
import { CalculatorComponent } from './features/applications/calculator/calculator.component';
import { TimerComponent } from './features/applications/timer/timer.component';
import { NavigatorComponent } from './features/applications/navigator/navigator.component';
import { NotesComponent } from './features/applications/notes/notes.component';
import { SettingsComponent } from './features/settings/settings.component';
import { SettingsDraftService } from './features/settings/settings-draft.service';

type CanvasMode = 'repeat' | 'center' | 'stretch';

const createFallbackRect = (width: number, height: number): DOMRect => {
  if (typeof DOMRect !== 'undefined') return new DOMRect(0, 0, width, height);
  return {
    x: 0,
    y: 0,
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  } as DOMRect;
};

const APP_GROUPS: AppGroup[] = [
  { id: 'todo', labelKey: 'apps.todo' },
  { id: 'calculator', labelKey: 'apps.calculator' },
  { id: 'timer', labelKey: 'apps.timer' },
  { id: 'navigator', labelKey: 'apps.navigator' },
  { id: 'notes', labelKey: 'apps.notes' },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    TranslateModule,
    DialogComponent,
    AppListComponent,
    OverlayComponent,
    TodoPageComponent,
    CalculatorComponent,
    TimerComponent,
    NavigatorComponent,
    NotesComponent,
    SettingsComponent,
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
    `,
  ],
  template: `
    @if (loadingVisible()) {
      <div
        style="position:fixed; inset:0; background:var(--color-bg); display:flex; align-items:center; justify-content:center; z-index:4000; transition:opacity 120ms ease;"
        [style.opacity]="loadingFading() ? 0 : 1"
      >
        <div style="font-size:18px; letter-spacing:0.04em;">{{ 'loading' | translate }}</div>
      </div>
    }

    @if (auth.ready() && !auth.isLoggedIn()) {
      <router-outlet />
    } @else if (auth.isLoggedIn()) {
      <div style="position:relative;">
        @if (topBarOpen()) {
          <div
            [style.maxHeight.px]="workspaceMenuOpen() ? 72 : 0"
            [style.opacity]="workspaceMenuOpen() ? 1 : 0"
            [style.borderBottom]="workspaceMenuOpen() ? '1px solid var(--color-border)' : 'none'"
            style="overflow:hidden; background:var(--color-bg); transition:max-height 200ms ease, opacity 200ms ease;"
          >
            <div
              style="display:flex; justify-content:center; gap:12px; align-items:center; padding:12px 16px;"
            >
              @for (ws of dialogService.getWorkspaces(); track ws.id) {
                <div style="position:relative;">
                  @if (editingWorkspaceId() !== ws.id) {
                    <button
                      (click)="dialogService.switchWorkspace(ws.id)"
                      [style.boxShadow]="
                        dialogService.getActiveWorkspaceId() === ws.id
                          ? '0 0 0 2px #00c2d1'
                          : 'none'
                      "
                      style="padding:10px 18px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-surface);"
                    >
                      <span (dblclick)="startWorkspaceRename(ws)">{{ ws.name }}</span>
                    </button>
                  } @else {
                    <input
                      [value]="editingWorkspaceName()"
                      (input)="editingWorkspaceName.set($any($event.target).value)"
                      (blur)="finishWorkspaceRename(ws)"
                      (keydown.enter)="finishWorkspaceRename(ws)"
                      style="padding:10px 18px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-surface); width:140px;"
                    />
                  }
                  <button
                    (click)="closeWorkspace(ws)"
                    [disabled]="dialogService.getWorkspaces().length <= 1"
                    style="position:absolute; top:-6px; left:-6px; width:18px; height:18px; border-radius:999px; border:1px solid var(--color-border); background:var(--color-surface); display:flex; align-items:center; justify-content:center; font-size:11px; cursor:pointer;"
                    title="Close workspace"
                  >
                    ✕
                  </button>
                </div>
              }
              <button
                (click)="dialogService.addWorkspace()"
                [disabled]="dialogService.getWorkspaces().length >= 5"
                style="padding:8px 12px;"
              >
                +
              </button>
            </div>
          </div>

          <header
            style="background:var(--color-surface); border-bottom:1px solid var(--color-border); padding: 12px 16px; display:flex; justify-content:space-between; align-items:center;"
          >
            <div>
              @if (siteLogoEmoji()) {
                <span style="margin-right:6px;">{{ siteLogoEmoji() }}</span>
              }
              <strong>{{ siteTitle() }}</strong>
              @if (auth.currentUser()) {
                <span
                  style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:12px; background:#f3f4f6; color:#334155; border:1px solid #e2e8f0; vertical-align:middle;"
                >
                  {{ 'auth.loggedInAs' | translate: { user: auth.currentUser()?.username ?? '' } }}
                </span>
              }
              @if (isMockMode()) {
                <span
                  style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:12px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; vertical-align:middle;"
                >
                  {{ 'mock.label' | translate }}
                </span>
              }
              @if (auth.isPreviewing()) {
                <span
                  style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:12px; background:#e8f2ff; color:#1f5fa7; border:1px solid #cfe2ff; vertical-align:middle;"
                >
                  {{ 'preview.label' | translate: { user: previewUserLabel() } }}
                </span>
              }
              @if (auth.previewPersist()) {
                <span
                  style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:12px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; vertical-align:middle;"
                >
                  {{ 'preview.persist' | translate }}
                </span>
              }
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
              @if (auth.preferences().city) {
                <div style="font-size:14px; opacity:0.8;">{{ auth.preferences().city }}</div>
              }
              @if (showTime()) {
                <div style="font-size:14px; opacity:0.8;">{{ timeLabel() }}</div>
              }
              <button (click)="toggleWorkspaceMenu()">
                {{ 'workspaces.button' | translate }}
              </button>
              <button (click)="toggleTopBar()">{{ 'topbar.collapse' | translate }}</button>
            </div>
          </header>
        }
      </div>

      <main [style.height]="topBarOpen() ? 'calc(100vh - 48px)' : '100vh'" style="display:flex;">
        <aside
          [style.width]="navOpen ? '240px' : '0'"
          [style.padding]="navOpen ? '16px' : '0'"
          [style.borderRight]="navOpen ? '1px solid var(--color-border)' : 'none'"
          [style.overflow]="navOpen ? 'visible' : 'hidden'"
          style="display:flex; flex-direction:column; gap:16px; transition:width 180ms ease; box-sizing:border-box;"
        >
          @if (navOpen) {
            <div>
              <button (click)="toggleNav()" style="margin-bottom: 8px;">
                {{ navOpen ? ('nav.collapse' | translate) : ('nav.expand' | translate) }}
              </button>
              <button (click)="toggleDialogsHidden()" style="margin-bottom: 8px;">
                {{
                  dialogsHidden()
                    ? ('dialogs.showAll' | translate)
                    : ('dialogs.hideAll' | translate)
                }}
              </button>
              <div style="margin-bottom: 12px;">
                <button (click)="toggleResetMenu()">{{ 'dialogs.reset' | translate }}</button>
                @if (resetMenuOpen()) {
                  <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                    <button (click)="resetDialogs('left')">
                      {{ 'dialogs.resetLeft' | translate }}
                    </button>
                    <button (click)="resetDialogs('middle')">
                      {{ 'dialogs.resetMiddle' | translate }}
                    </button>
                  </div>
                }
              </div>
              <app-app-list
                [apps]="visibleAppGroups()"
                [instancesByApp]="instancesByApp()"
                [deleteTargetActive]="!!deleteTargetId()"
                (openApp)="openApp($event)"
                (restore)="restoreInstance($event)"
                (toggleLock)="toggleDeleteLock($event)"
              />
            </div>

            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              @if (showViewportSizingControls()) {
                <div style="display:flex; align-items:center; gap:8px;">
                  <input
                    type="number"
                    [value]="canvasWidth()"
                    (change)="canvasWidth.set($any($event.target).valueAsNumber); applyCanvasSize()"
                    min="1024"
                    max="7680"
                    style="width:90px; padding:4px;"
                  />
                  <span>×</span>
                  <input
                    type="number"
                    [value]="canvasHeight()"
                    (change)="
                      canvasHeight.set($any($event.target).valueAsNumber); applyCanvasSize()
                    "
                    min="768"
                    max="4320"
                    style="width:90px; padding:4px;"
                  />
                </div>
              }
              @if (showZoomControls()) {
                <div style="display:flex; align-items:center; gap:8px;">
                  <button (click)="resetZoom()">{{ 'canvas.originalScale' | translate }}</button>
                  <button (click)="zoomOut()">{{ 'canvas.zoomOut' | translate }}</button>
                  <button (click)="zoomIn()">{{ 'canvas.zoomIn' | translate }}</button>
                </div>
              }
              <button (click)="openSettings()">{{ 'nav.settings' | translate }}</button>
              <button (click)="logout()">{{ 'nav.logout' | translate }}</button>
            </div>
          }
        </aside>

        <section
          id="app-viewport"
          style="flex:1; position:relative;"
          [style.overflow]="isOverlayActive() ? 'hidden' : 'auto'"
        >
          @if (!topBarOpen()) {
            <button
              (click)="toggleTopBar()"
              class="floating-control"
              style="right:12px;"
              [style.top.px]="floatingTopBarToggleTop()"
            >
              {{ 'topbar.expand' | translate }}
            </button>
          }
          @if (!navOpen) {
            <button
              (click)="toggleNav()"
              class="floating-control"
              style="left:12px;"
              [style.top.px]="floatingSidebarToggleTop()"
            >
              {{ 'nav.expand' | translate }}
            </button>
            <button
              (click)="toggleDialogsHidden()"
              class="floating-control"
              style="left:92px;"
              [style.top.px]="floatingSidebarToggleTop()"
            >
              {{
                dialogsHidden() ? ('dialogs.showAll' | translate) : ('dialogs.hideAll' | translate)
              }}
            </button>
          }
          <div
            id="app-canvas"
            [ngStyle]="canvasStyle()"
            [style.pointerEvents]="isOverlayActive() ? 'none' : 'auto'"
            [style.width.px]="canvasWidth()"
            [style.height.px]="canvasHeight()"
            style="position:relative; min-width:1024px; min-height:768px; max-width:7680px; max-height:4320px; margin:0 auto; background-color:var(--color-bg); transform-origin: top left; cursor: all-scroll;"
            [style.transform]="'scale(' + canvasScale() + ')'"
            (pointerdown)="startCanvasPan($event)"
          >
            @for (instance of stashedDialogs(); track instance.id) {
              @if (instance.tileRect) {
                <div
                  data-tile="true"
                  style="position:absolute; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; padding:8px; display:flex; align-items:center; justify-content:space-between; gap:8px; box-shadow:0 2px 6px rgba(0,0,0,0.15);"
                  [style.left.px]="instance.tileRect.x"
                  [style.top.px]="instance.tileRect.y"
                  [style.width.px]="instance.tileRect.width"
                  [style.height.px]="instance.tileRect.height"
                  [style.zIndex]="1"
                  [style.pointerEvents]="isOverlayActive() ? 'none' : 'auto'"
                  (pointerdown)="$event.stopPropagation(); startTileDrag(instance, $event)"
                >
                  <div style="flex:1; min-width:0;">
                    @if (editingTileId() === instance.id) {
                      <input
                        [value]="editingTitle()"
                        (input)="editingTitle.set($any($event.target).value)"
                        (blur)="finishRename(instance)"
                        (keydown.enter)="finishRename(instance)"
                        style="width:100%; padding:4px;"
                      />
                    } @else {
                      <div
                        style="text-align:left; font-size:13px; width:100%; cursor:text;"
                        (dblclick)="startRename(instance)"
                      >
                        {{ instanceLabel(instance) }}
                      </div>
                    }
                  </div>
                  <button
                    (click)="restoreFromStash(instance)"
                    title="{{ 'dialogs.unstash' | translate }}"
                  >
                    📤
                  </button>
                </div>
              }
            }

            @for (instance of visibleDialogs(); track instance.id) {
              @if (!instance.minimized) {
                <app-dialog
                  [instance]="instance"
                  [bounds]="canvasBounds()"
                  [disabled]="isOverlayActive()"
                  [title]="instanceLabel(instance)"
                  [trashDisabled]="!!instance.deleteLocked"
                  (moved)="onDialogMove(instance.id, $event)"
                  (resized)="onDialogResize(instance.id, $event)"
                  (stash)="stashInstance(instance.id)"
                  (minimize)="minimizeInstance(instance.id)"
                  (maximize)="toggleMaximize(instance.id)"
                  (closed)="minimizeInstance(instance.id)"
                  (trash)="confirmDelete(instance.id)"
                  (titleEdited)="renameInstance(instance.id, $event)"
                  (bringToFront)="dialogService.bringToFront(instance.id)"
                >
                  @if (instance.appId === 'todo') {
                    <app-todo-page [instanceId]="instance.id" />
                  }
                  @if (instance.appId === 'calculator') {
                    <app-calculator [instanceId]="instance.id" />
                  }
                  @if (instance.appId === 'timer') {
                    <app-timer [instanceId]="instance.id" />
                  }
                  @if (instance.appId === 'navigator') {
                    <app-navigator [instanceId]="instance.id" />
                  }
                  @if (instance.appId === 'notes') {
                    <app-notes [instanceId]="instance.id" />
                  }
                </app-dialog>
              }
            }
          </div>

          @if (settingsOpen()) {
            <app-overlay (closed)="requestCloseSettings()">
              <app-settings />
            </app-overlay>
          }
        </section>
      </main>

      @if (deleteTargetId()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:1000;"
        >
          <div
            style="background:var(--color-surface); padding:20px; border-radius:8px; width:320px;"
          >
            <p>{{ 'dialogs.confirmDelete' | translate }}</p>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
              <button (click)="deleteTargetId.set(null)">{{ 'dialogs.cancel' | translate }}</button>
              <button (click)="deleteConfirmed()">{{ 'dialogs.confirm' | translate }}</button>
            </div>
          </div>
        </div>
      }

      @if (settingsCloseConfirmOpen()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:3100;"
        >
          <div
            style="background:var(--color-surface); padding:20px; border-radius:8px; width:340px;"
          >
            <p>{{ 'settings.closeConfirm' | translate }}</p>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
              <button (click)="cancelCloseSettings()">{{ 'dialogs.cancel' | translate }}</button>
              <button (click)="confirmCloseSettings()">{{ 'settings.discard' | translate }}</button>
            </div>
          </div>
        </div>
      }

      @if (guestBlocked()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:3200;"
        >
          <div
            style="background:var(--color-surface); padding:24px; border-radius:12px; width:360px; text-align:center;"
          >
            <p>{{ 'auth.guestDisabled' | translate }}</p>
            <div style="display:flex; gap:8px; justify-content:center; margin-top:16px;">
              <button (click)="logout()">{{ 'auth.signIn' | translate }}</button>
            </div>
          </div>
        </div>
      }

      @if (accessibilityPromptOpen()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:1200;"
        >
          <div
            style="background:var(--color-surface); padding:20px; border-radius:8px; width:360px;"
          >
            <h3 style="margin-top:0;">{{ 'accessibility.title' | translate }}</h3>
            <p>{{ 'accessibility.body' | translate }}</p>
            <label style="display:flex; gap:8px; align-items:center; margin-top: 12px;">
              <input
                type="checkbox"
                [checked]="accessibilityPromptEnabled()"
                (change)="toggleAccessibilityPrompt()"
              />
              {{ 'accessibility.toggle' | translate }}
            </label>
            <div style="display:flex; justify-content:flex-end; margin-top:16px;">
              <button (click)="applyAccessibilityPrompt()">
                {{ 'accessibility.confirm' | translate }}
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly dialogService = inject(DialogService);
  readonly settingsDraft = inject(SettingsDraftService);
  isMockMode = computed(() => {
    const backendConnected = this.auth.isBackendConnected();
    return !backendConnected || this.auth.orgSettings().testModeEnabled;
  });
  navOpen = true;
  editingWorkspaceId = signal<string | null>(null);
  editingWorkspaceName = signal('');
  private readonly translate = inject(TranslateService);
  private timeInterval?: number;
  private loadingTimeout?: number;
  private now = signal(new Date());
  workspaceMenuOpen = signal(false);
  topBarOpen = signal(true);
  settingsOpen = signal(false);
  settingsCloseConfirmOpen = signal(false);
  resetMenuOpen = signal(false);
  deleteTargetId = signal<string | null>(null);
  accessibilityPromptOpen = signal(false);
  accessibilityPromptEnabled = signal(true);
  loadingVisible = signal(true);
  loadingFading = signal(false);
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

  activeDialogs = computed(() => this.dialogService.getActiveDialogs());
  dialogsHidden = computed(() => this.dialogService.isActiveWorkspaceHidden());
  visibleDialogs = computed(() =>
    this.activeDialogs().filter(
      (instance) => !this.dialogsHidden() && !instance.stashed && !instance.minimized,
    ),
  );
  stashedDialogs = computed(() => this.activeDialogs().filter((instance) => instance.stashed));
  isOverlayActive = computed(
    () =>
      this.settingsOpen() ||
      Boolean(this.deleteTargetId()) ||
      this.settingsCloseConfirmOpen() ||
      this.accessibilityPromptOpen() ||
      this.guestBlocked() ||
      this.loadingVisible(),
  );

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

  guestBlocked = computed(
    () => !this.auth.orgSettings().allowGuestLogin && this.auth.actualUser()?.id === 'u_guest',
  );

  previewUserLabel = computed(() => this.auth.currentUser()?.username ?? '');
  siteTitle = computed(() => this.auth.orgSettings().siteTitle || "Roy's Planner");
  siteLogoEmoji = computed(() => this.auth.orgSettings().siteLogoEmoji ?? '🌎');
  disabledApps = computed(() => new Set(this.auth.preferences().disabledApps ?? []));
  visibleAppGroups = computed(() => APP_GROUPS.filter((app) => !this.disabledApps().has(app.id)));
  instancesByApp = computed(() => ({
    todo: this.dialogService.getAppInstances('todo'),
    calculator: this.dialogService.getAppInstances('calculator'),
    timer: this.dialogService.getAppInstances('timer'),
    navigator: this.dialogService.getAppInstances('navigator'),
    notes: this.dialogService.getAppInstances('notes'),
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

  constructor() {
    this.translate.setDefaultLang('en');
    effect(() => {
      if (typeof document === 'undefined') return;
      document.title = this.siteTitle();
      this.updateFavicon(this.siteLogoEmoji());
    });
    effect(() => {
      const prefs = this.auth.preferences();
      this.canvasWidth.set(prefs.canvasWidth);
      this.canvasHeight.set(prefs.canvasHeight);
    });
    effect(() => {
      this.applyThemeClasses();
    });
    effect(() => {
      const actualUser = this.auth.actualUser();
      if (!actualUser) {
        this.accessibilityPromptOpen.set(false);
        return;
      }
      if (this.auth.hasSeenAccessibilityPrompt(actualUser.id)) return;
      this.accessibilityPromptEnabled.set(true);
      this.accessibilityPromptOpen.set(true);
    });
    effect(() => {
      if (!this.auth.ready()) return;
      if (!this.auth.isLoggedIn()) {
        this.loadingVisible.set(false);
        this.loadingFading.set(false);
        return;
      }
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
    });
  }

  ngOnInit() {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('op_nav_open');
    if (stored !== null) this.navOpen = stored === 'true';
    const storedScale = window.localStorage.getItem('op_canvas_scale');
    if (storedScale) this.canvasScale.set(Number(storedScale) || 1);

    this.timeInterval = window.setInterval(() => {
      this.now.set(new Date());
      this.applyThemeClasses();
    }, 60_000);
    setTimeout(this.updateCanvasBounds, 0);
    window.addEventListener('resize', this.updateCanvasBounds);
  }

  ngOnDestroy() {
    if (this.timeInterval) window.clearInterval(this.timeInterval);
    if (this.loadingTimeout) window.clearTimeout(this.loadingTimeout);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.updateCanvasBounds);
    }
  }

  updateCanvasBounds = () => {
    if (typeof document === 'undefined') return;
    const canvas = document.querySelector('#app-canvas');
    const viewport = document.querySelector('#app-viewport');
    if (canvas instanceof HTMLElement) {
      this.canvasBounds.set(createFallbackRect(this.canvasWidth(), this.canvasHeight()));
    }
    if (viewport instanceof HTMLElement) {
      this.viewportBounds.set(
        createFallbackRect(
          viewport.clientWidth || viewport.offsetWidth,
          viewport.clientHeight || viewport.offsetHeight,
        ),
      );
    }
  };

  @HostListener('window:pointermove', ['$event'])
  onTilePointerMove(event: PointerEvent) {
    if (this.tileDragState) {
      const dx = event.clientX - this.tileDragState.startX;
      const dy = event.clientY - this.tileDragState.startY;
      this.dialogService.moveTile(
        this.tileDragState.id,
        { x: this.tileDragState.origin.x + dx, y: this.tileDragState.origin.y + dy },
        this.canvasBounds(),
      );
    }
    if (this.panState) {
      const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
      if (!viewport) return;
      const dx = event.clientX - this.panState.startX;
      const dy = event.clientY - this.panState.startY;
      viewport.scrollLeft = this.panState.scrollLeft - dx;
      viewport.scrollTop = this.panState.scrollTop - dy;
    }
  }

  @HostListener('window:pointerup')
  onTilePointerUp() {
    this.tileDragState = null;
    this.panState = null;
    this.isPanning.set(false);
  }

  toggleNav() {
    this.navOpen = !this.navOpen;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('op_nav_open', String(this.navOpen));
    }
    setTimeout(this.updateCanvasBounds, 0);
  }

  floatingSidebarToggleTop() {
    if (!this.topBarOpen()) return 12;
    const headerHeight = 48;
    const workspaceHeight = this.workspaceMenuOpen() ? 72 : 0;
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
    setTimeout(this.updateCanvasBounds, 0);
  }

  toggleWorkspaceMenu() {
    if (typeof document !== 'undefined') {
      document.querySelector('#app-viewport')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.workspaceMenuOpen.set(!this.workspaceMenuOpen());
  }

  startWorkspaceRename(ws: { id: string; name: string }) {
    this.editingWorkspaceId.set(ws.id);
    this.editingWorkspaceName.set(ws.name);
  }

  finishWorkspaceRename(ws: { id: string }) {
    if (this.editingWorkspaceId() !== ws.id) return;
    const nextName = this.editingWorkspaceName().trim();
    this.editingWorkspaceId.set(null);
    if (!nextName) return;
    this.dialogService.renameWorkspace(ws.id, nextName);
  }

  closeWorkspace(ws: { id: string }) {
    if (this.dialogService.getWorkspaces().length <= 1) return;
    this.dialogService.closeWorkspace(ws.id);
  }

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
    this.settingsOpen.set(true);
    this.settingsCloseConfirmOpen.set(false);
    this.settingsDraft.start();
  }

  requestCloseSettings() {
    if (this.settingsDraft.dirty()) {
      this.settingsCloseConfirmOpen.set(true);
      return;
    }
    this.settingsOpen.set(false);
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
    const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
    const viewportBounds = this.viewportBounds();
    const result = this.dialogService.createInstance(appId, viewportBounds);
    if (!result.ok) {
      alert(this.translate.instant(result.message ?? 'dialogs.error.generic'));
      return;
    }
    if (result.instance && viewport) {
      const nextX = result.instance.rect.x + viewport.scrollLeft;
      const nextY = result.instance.rect.y + viewport.scrollTop;
      this.dialogService.moveInstance(
        result.instance.id,
        { x: nextX, y: nextY },
        this.canvasBounds(),
      );
    }
  }

  restoreInstance(instanceId: string) {
    this.dialogService.restoreInstance(instanceId);
    this.dialogService.bringToFront(instanceId);
  }

  renameInstance(instanceId: string, title: string) {
    this.dialogService.setTitleOverride(instanceId, title);
  }

  toggleDeleteLock(instanceId: string) {
    if (this.deleteTargetId()) return;
    this.dialogService.toggleDeleteLock(instanceId);
  }

  stashInstance(instanceId: string) {
    this.dialogService.stashInstance(instanceId, this.canvasBounds());
  }

  restoreFromStash(instance: { id: string }) {
    this.dialogService.unstashInstance(instance.id);
    this.dialogService.bringToFront(instance.id);
  }

  toggleDialogsHidden() {
    this.dialogService.toggleWorkspaceHidden(this.dialogService.getActiveWorkspaceId());
  }

  onDialogMove(instanceId: string, rect: { x: number; y: number }) {
    this.dialogService.moveInstance(instanceId, rect, this.canvasBounds());
  }

  onDialogResize(instanceId: string, rect: { width: number; height: number }) {
    this.dialogService.resizeInstance(instanceId, rect, this.canvasBounds());
  }

  minimizeInstance(instanceId: string) {
    this.dialogService.minimizeInstance(instanceId);
  }

  toggleMaximize(instanceId: string) {
    this.dialogService.toggleMaximize(instanceId, this.viewportBounds());
  }

  confirmDelete(instanceId: string) {
    this.deleteTargetId.set(instanceId);
  }

  deleteConfirmed() {
    const target = this.deleteTargetId();
    if (target) this.dialogService.deleteInstance(target);
    this.deleteTargetId.set(null);
  }

  toggleResetMenu() {
    this.resetMenuOpen.set(!this.resetMenuOpen());
  }

  resetDialogs(mode: 'left' | 'middle') {
    this.dialogService.resetPositions(mode, this.canvasBounds());
    this.resetMenuOpen.set(false);
  }

  instanceIndex(appId: AppId, instanceId: string) {
    const instances = this.dialogService.getAppInstances(appId);
    return instances.findIndex((instance) => instance.id === instanceId) + 1;
  }

  instanceLabel(instance: { titleKey: string; titleOverride?: string; id: string; appId: AppId }) {
    if (instance.titleOverride) return instance.titleOverride;
    return `${this.translate.instant(instance.titleKey)} (${this.instanceIndex(instance.appId, instance.id)})`;
  }

  startRename(instance: { id: string; titleOverride?: string; titleKey: string; appId: AppId }) {
    this.editingTileId.set(instance.id);
    this.editingTitle.set(this.instanceLabel(instance));
  }

  finishRename(instance: { id: string; titleOverride?: string; titleKey: string; appId: AppId }) {
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
    if (!instance.tileRect) return;
    if (event.detail > 1) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;
    if (this.editingTileId() === instance.id) return;
    target?.setPointerCapture?.(event.pointerId);
    this.tileDragState = {
      id: instance.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: instance.tileRect.x, y: instance.tileRect.y },
    };
  }

  startCanvasPan(event: PointerEvent) {
    if (this.isOverlayActive()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.dialog') || target?.closest('[data-tile]')) return;
    if (target?.closest('button, input, textarea, select')) return;
    const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
    if (!viewport) return;
    this.panState = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    this.isPanning.set(true);
  }

  applyCanvasSize() {
    const width = Math.min(7680, Math.max(1024, this.canvasWidth()));
    const height = Math.min(4320, Math.max(768, this.canvasHeight()));
    this.canvasWidth.set(width);
    this.canvasHeight.set(height);
    const prefs = this.auth.preferences();
    this.auth.savePreferences({ ...prefs, canvasWidth: width, canvasHeight: height });
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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('op_canvas_scale', String(this.canvasScale()));
    }
    setTimeout(this.updateCanvasBounds, 0);
  }

  applyAccessibilityPrompt() {
    const actual = this.auth.actualUser();
    if (!actual) return;
    const prefs = this.auth.preferences();
    this.auth.savePreferences({ ...prefs, accessibilityMode: this.accessibilityPromptEnabled() });
    this.auth.markAccessibilityPromptShown(actual.id);
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
    body.classList.toggle('theme-light', resolvedTheme === 'light');
    body.classList.toggle('theme-dark', resolvedTheme === 'dark');
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
    this.auth.logout();
  }
}
