import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from './core/auth.service';
import { DialogService } from './core/dialog.service';
import { DialogComponent } from './shared/dialog/dialog.component';
import { TodoPageComponent } from './features/applications/todo/todo.component';
import { SettingsComponent } from './features/settings/settings.component';
import { AboutComponent } from './features/about/about.component';

type OpWindow = Window & { __OP_CONFIG__?: { apiBaseUrl?: string; mockMode?: boolean } };
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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    TranslateModule,
    DialogComponent,
    TodoPageComponent,
    SettingsComponent,
    AboutComponent,
  ],
  template: `
    @if (!auth.isLoggedIn()) {
      <router-outlet />
    } @else {
      <div style="position:relative;">
        @if (topBarOpen()) {
          <div
            [style.maxHeight.px]="workspaceMenuOpen() ? 72 : 0"
            [style.opacity]="workspaceMenuOpen() ? 1 : 0"
            [style.borderBottom]="workspaceMenuOpen() ? '1px solid #ddd' : 'none'"
            style="overflow:hidden; background:#f5f5f5; transition:max-height 200ms ease, opacity 200ms ease;"
          >
            <div
              style="display:flex; justify-content:center; gap:12px; align-items:center; padding:12px 16px;"
            >
              @for (ws of dialogService.getWorkspaces(); track ws.id) {
                <button
                  (click)="dialogService.switchWorkspace(ws.id)"
                  [style.boxShadow]="
                    dialogService.getActiveWorkspaceId() === ws.id ? '0 0 0 2px #00c2d1' : 'none'
                  "
                  style="padding:10px 18px; border:1px solid #ccc; border-radius:8px; background:#fff;"
                >
                  {{ ws.name }}
                </button>
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
            style="background:#fff; border-bottom:1px solid #ddd; padding: 12px 16px; display:flex; justify-content:space-between; align-items:center;"
          >
            <div>
              <strong>{{ 'app.title' | translate }}</strong>
              @if (isMockMode) {
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
          [style.borderRight]="navOpen ? '1px solid #ddd' : 'none'"
          [style.overflow]="navOpen ? 'visible' : 'hidden'"
          style="display:flex; flex-direction:column; gap:16px; transition:width 180ms ease; box-sizing:border-box;"
        >
          @if (navOpen) {
            <div>
              <button (click)="toggleNav()" style="margin-bottom: 8px;">
                {{ navOpen ? ('nav.collapse' | translate) : ('nav.expand' | translate) }}
              </button>
              <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom: 8px;">
                  <button (click)="toggleDialogsHidden()">
                    {{
                      dialogsHidden()
                        ? ('dialogs.showAll' | translate)
                        : ('dialogs.hideAll' | translate)
                    }}
                  </button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>{{ 'apps.todoGroup' | translate }}</span>
                  <button (click)="openApp('todo')">+</button>
                </div>
                <ul style="margin: 6px 0 0 16px; padding:0;">
                  @for (instance of dialogService.getAppInstances('todo'); track instance.id) {
                    <li>
                      <button
                        (click)="restoreInstance(instance.id)"
                        [style.fontStyle]="instance.minimized ? 'normal' : 'italic'"
                      >
                        {{ instanceLabel(instance) }}
                      </button>
                    </li>
                  }
                </ul>
              </div>
            </div>

            <div>
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

            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
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
                  (change)="canvasHeight.set($any($event.target).valueAsNumber); applyCanvasSize()"
                  min="768"
                  max="4320"
                  style="width:90px; padding:4px;"
                />
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <button (click)="resetZoom()">{{ 'canvas.originalScale' | translate }}</button>
                <button (click)="zoomOut()">{{ 'canvas.zoomOut' | translate }}</button>
                <button (click)="zoomIn()">{{ 'canvas.zoomIn' | translate }}</button>
              </div>
              <button (click)="openAbout()">{{ 'nav.about' | translate }}</button>
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
              style="position:absolute; top:12px; right:12px; z-index:80;"
            >
              {{ 'topbar.expand' | translate }}
            </button>
          }
          @if (!navOpen) {
            <button
              (click)="toggleNav()"
              style="position:absolute; top:12px; left:12px; z-index:80;"
            >
              {{ 'nav.expand' | translate }}
            </button>
            <button
              (click)="toggleDialogsHidden()"
              style="position:absolute; top:12px; left:92px; z-index:80;"
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
            style="position:relative; min-width:1024px; min-height:768px; max-width:7680px; max-height:4320px; margin:0 auto; background-color:#f0f0f0; transform-origin: top left; cursor: all-scroll;"
            [style.transform]="'scale(' + canvasScale() + ')'"
            (pointerdown)="startCanvasPan($event)"
          >
            @for (instance of stashedDialogs(); track instance.id) {
              @if (instance.tileRect) {
                <div
                  data-tile="true"
                  style="position:absolute; background:#dcdcdc; border:1px solid #b3b3b3; border-radius:8px; padding:8px; display:flex; align-items:center; justify-content:space-between; gap:8px; box-shadow:0 2px 6px rgba(0,0,0,0.15);"
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
                      <button
                        style="background:transparent; border:none; text-align:left; padding:0; font-size:13px; width:100%;"
                        (click)="startRename(instance)"
                      >
                        {{ instanceLabel(instance) }}
                      </button>
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
                  (moved)="onDialogMove(instance.id, $event)"
                  (resized)="onDialogResize(instance.id, $event)"
                  (stash)="stashInstance(instance.id)"
                  (minimize)="minimizeInstance(instance.id)"
                  (maximize)="toggleMaximize(instance.id)"
                  (closed)="minimizeInstance(instance.id)"
                  (trash)="confirmDelete(instance.id)"
                  (bringToFront)="dialogService.bringToFront(instance.id)"
                >
                  @if (instance.appId === 'todo') {
                    <app-todo-page [instanceId]="instance.id" />
                  }
                </app-dialog>
              }
            }
          </div>

          @if (settingsOpen()) {
            <div
              style="position:absolute; inset:0; background:rgba(255,255,255,0.98); padding:24px; z-index:2000; overflow:auto;"
            >
              <app-settings (closed)="settingsOpen.set(false)" />
            </div>
          }
          @if (aboutOpen()) {
            <div
              style="position:absolute; inset:0; background:rgba(255,255,255,0.98); z-index:2000; overflow:auto;"
            >
              <div style="position:relative; min-height:100%; padding:24px;">
                <button
                  style="position:absolute; top:16px; right:16px;"
                  (click)="aboutOpen.set(false)"
                >
                  ✕
                </button>
                <app-about (closed)="aboutOpen.set(false)" />
              </div>
            </div>
          }
        </section>
      </main>

      @if (deleteTargetId()) {
        <div
          style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index:1000;"
        >
          <div style="background:#fff; padding:20px; border-radius:8px; width:320px;">
            <p>{{ 'dialogs.confirmDelete' | translate }}</p>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
              <button (click)="deleteTargetId.set(null)">{{ 'dialogs.cancel' | translate }}</button>
              <button (click)="deleteConfirmed()">{{ 'dialogs.confirm' | translate }}</button>
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
  isMockMode =
    typeof window !== 'undefined' &&
    ((window as OpWindow).__OP_CONFIG__?.mockMode === true ||
      !(window as OpWindow).__OP_CONFIG__?.apiBaseUrl);
  navOpen = true;
  private readonly translate = inject(TranslateService);
  private timeInterval?: number;
  private now = signal(new Date());
  workspaceMenuOpen = signal(false);
  topBarOpen = signal(true);
  settingsOpen = signal(false);
  aboutOpen = signal(false);
  resetMenuOpen = signal(false);
  deleteTargetId = signal<string | null>(null);
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
    () => this.settingsOpen() || this.aboutOpen() || Boolean(this.deleteTargetId()),
  );

  timeLabel = computed(() => {
    const prefs = this.auth.preferences();
    const timeZone = prefs.timeZone;
    const hour12 = prefs.timeFormat === '12h';
    return new Intl.DateTimeFormat(prefs.language || 'en', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    }).format(this.now());
  });

  showTime = computed(() => this.auth.preferences().showTime);

  previewUserLabel = computed(() => this.auth.currentUser()?.username ?? '');
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
      layers.push('linear-gradient(#bdbdbd 1px, transparent 1px)');
      layers.push('linear-gradient(90deg, #bdbdbd 1px, transparent 1px)');
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
  }

  ngOnInit() {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('op_nav_open');
    if (stored !== null) this.navOpen = stored === 'true';
    const storedScale = window.localStorage.getItem('op_canvas_scale');
    if (storedScale) this.canvasScale.set(Number(storedScale) || 1);
    const storedWidth = window.localStorage.getItem('op_canvas_width');
    const storedHeight = window.localStorage.getItem('op_canvas_height');
    if (storedWidth) this.canvasWidth.set(Number(storedWidth) || 1920);
    if (storedHeight) this.canvasHeight.set(Number(storedHeight) || 1080);

    this.timeInterval = window.setInterval(() => this.now.set(new Date()), 60_000);
    setTimeout(this.updateCanvasBounds, 0);
    window.addEventListener('resize', this.updateCanvasBounds);
  }

  ngOnDestroy() {
    if (this.timeInterval) window.clearInterval(this.timeInterval);
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

  openSettings() {
    this.aboutOpen.set(false);
    this.settingsOpen.set(true);
  }

  openAbout() {
    this.settingsOpen.set(false);
    this.aboutOpen.set(true);
  }

  openApp(appId: 'todo') {
    const bounds = this.canvasBounds();
    const result = this.dialogService.createInstance(appId, bounds);
    if (!result.ok) {
      alert(this.translate.instant(result.message ?? 'dialogs.error.generic'));
    }
  }

  restoreInstance(instanceId: string) {
    this.dialogService.restoreInstance(instanceId);
    this.dialogService.bringToFront(instanceId);
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

  instanceIndex(instanceId: string) {
    const instances = this.dialogService.getAppInstances('todo');
    return instances.findIndex((instance) => instance.id === instanceId) + 1;
  }

  instanceLabel(instance: { titleKey: string; titleOverride?: string; id: string }) {
    if (instance.titleOverride) return instance.titleOverride;
    return `${this.translate.instant(instance.titleKey)} (${this.instanceIndex(instance.id)})`;
  }

  startRename(instance: { id: string; titleOverride?: string; titleKey: string }) {
    this.editingTileId.set(instance.id);
    this.editingTitle.set(this.instanceLabel(instance));
  }

  finishRename(instance: { id: string; titleOverride?: string; titleKey: string }) {
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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('op_canvas_width', String(width));
      window.localStorage.setItem('op_canvas_height', String(height));
    }
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

  logout() {
    this.auth.logout();
  }
}
