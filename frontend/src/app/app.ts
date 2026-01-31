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
import { RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AuthService,
  UniverseChatMessage,
  UniverseEditHolder,
  UniversePresenceEntry,
  UserRole,
} from './core/auth.service';
import { DialogService } from './core/dialog.service';
import { DialogComponent } from './shared/dialog/dialog.component';
import { AppListComponent, AppGroup } from './shared/app-list/app-list.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { TodoPageComponent } from './features/applications/todo/todo.component';
import { CalculatorComponent } from './features/applications/calculator/calculator.component';
import { TimerComponent } from './features/applications/timer/timer.component';
import { NavigatorComponent } from './features/applications/navigator/navigator.component';
import { NotesComponent } from './features/applications/notes/notes.component';
import { CalendarComponent } from './features/applications/calendar/calendar.component';
import { ClockComponent } from './features/applications/clock/clock.component';
import { KanbanComponent } from './features/applications/kanban/kanban.component';
import { StickyNotesComponent } from './features/applications/sticky-notes/sticky-notes.component';
import { DataTableComponent } from './features/applications/data-table/data-table.component';
import { SettingsComponent } from './features/settings/settings.component';
import { LicenseComponent } from './features/license/license.component';
import { SettingsDraftService } from './features/settings/settings-draft.service';
import { APP_LIST, APP_REGISTRY } from './features/dependencies/app-registry';
import { AppId } from './features/dependencies/app-types';
import { cloneCalculatorState } from './features/applications/calculator/calculator.component';
import { cloneNavigatorState } from './features/applications/navigator/navigator.component';
import { cloneNotesState } from './features/applications/notes/notes.component';
import { cloneTimerState } from './features/applications/timer/timer.component';
import { cloneCalendarState } from './features/applications/calendar/calendar.component';
import { cloneClockState } from './features/applications/clock/clock.component';
import { cloneKanbanState } from './features/applications/kanban/kanban.component';
import { cloneStickyNoteState } from './features/applications/sticky-notes/sticky-notes.component';
import { cloneDataTableState } from './features/applications/data-table/data-table.component';
import { cloneTodos } from './features/applications/todo/todo-api';
import { InstanceSettingsService } from './core/instance-settings.service';

type CanvasMode = 'repeat' | 'center' | 'stretch';

const RESERVED_SIDEBAR_WIDTH = 240;
const RESERVED_TOPBAR_HEIGHT = 48;
const RESERVED_WORKSPACE_HEIGHT = 72;

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

const APP_GROUPS: AppGroup[] = APP_LIST.map(({ id, labelKey, icon }) => ({
  id,
  labelKey,
  icon,
}));

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    TranslateModule,
    DialogComponent,
    AppListComponent,
    ConfirmDialogComponent,
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
    `,
  ],
  template: `
    @if (loadingVisible()) {
      <div
        id="loading-screen"
        style="position:fixed; inset:0; background:var(--color-bg); display:flex; align-items:center; justify-content:center; z-index:4000; transition:opacity 120ms ease;"
        [style.opacity]="loadingFading() ? 0 : 1"
      >
        <div style="font-size:18px; letter-spacing:0.04em;">{{ 'loading' | translate }}</div>
      </div>
    }

    @if (auth.ready() && !auth.isLoggedIn()) {
      @if (loginLoadingVisible()) {
        <div
          style="position:fixed; inset:0; background:var(--color-bg); display:flex; align-items:center; justify-content:center; z-index:3500; transition:opacity 120ms ease;"
          [style.opacity]="loginLoadingFading() ? 0 : 1"
        >
          <div style="font-size:18px; letter-spacing:0.04em;">{{ 'loading' | translate }}</div>
        </div>
      }
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
                <div
                  style="position:relative;"
                  [class.workspace-shell]="true"
                  [attr.data-workspace-id]="ws.id"
                >
                  @if (editingWorkspaceId() !== ws.id) {
                    <button
                      draggable="false"
                      (pointerdown)="onWorkspacePointerDown(ws.id, $event)"
                      (dblclick)="startWorkspaceRename(ws); $event.stopPropagation()"
                      (click)="onWorkspaceClick(ws.id)"
                      [class.workspace-chip]="true"
                      [class.dragging]="workspaceDragId() === ws.id"
                      [style.boxShadow]="
                        dialogService.getActiveWorkspaceId() === ws.id
                          ? '0 0 0 2px #00c2d1'
                          : 'none'
                      "
                      style="position:relative; padding:10px 18px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-surface);"
                    >
                      @if (hoverWorkspaceId() === ws.id && hoverWorkspaceSide() === 'left') {
                        <span class="workspace-drop-line left"></span>
                      }
                      @if (hoverWorkspaceId() === ws.id && hoverWorkspaceSide() === 'right') {
                        <span class="workspace-drop-line right"></span>
                      }
                      <span draggable="false">
                        {{ ws.name }}
                      </span>
                    </button>
                  } @else {
                    <input
                      #workspaceRenameInput
                      [value]="editingWorkspaceName()"
                      (input)="editingWorkspaceName.set($any($event.target).value)"
                      (blur)="finishWorkspaceRename(ws)"
                      (keydown.enter)="finishWorkspaceRename(ws)"
                      (keydown.escape)="cancelWorkspaceRename()"
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
                [disabled]="dialogService.getWorkspaces().length >= 8 || !canEdit()"
                style="padding:8px 12px;"
              >
                +
              </button>
            </div>
          </div>

          <header
            style="background:var(--color-surface); border-bottom:1px solid var(--color-border); padding: 12px 16px; display:flex; justify-content:space-between; align-items:center;"
          >
            <div style="position:relative;">
              @if (siteLogoEmoji()) {
                <span style="margin-right:6px;">{{ siteLogoEmoji() }}</span>
              }
              <div style="display:inline-flex; align-items:center; gap:24px;">
                <strong>{{ siteTitle() }}</strong>
                <div style="display:inline-flex; align-items:center; gap:9px;">
                  @if (auth.currentUser()) {
                    <span
                      style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; background:#f3f4f6; color:#334155; border:1px solid #e2e8f0; vertical-align:middle;"
                    >
                      {{ 'auth.loggedInAs' | translate: { user: loggedInAsLabel() } }}
                    </span>
                  }
                  @if (isMockMode()) {
                    <span
                      style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; vertical-align:middle;"
                    >
                      {{ 'mock.label' | translate }}
                    </span>
                  }
                  @if (auth.isPreviewing()) {
                    <span
                      style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; background:#e8f2ff; color:#1f5fa7; border:1px solid #cfe2ff; vertical-align:middle;"
                    >
                      {{ 'preview.label' | translate: { user: previewUserLabel() } }}
                    </span>
                  }
                  @if (auth.previewPersist()) {
                    <span
                      style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; vertical-align:middle;"
                    >
                      {{ 'preview.persist' | translate }}
                    </span>
                  }
                </div>
              </div>
              @if (canSwitchUniverse()) {
                <div
                  style="margin-top:2px; font-size:12px; font-style:italic; position:relative;"
                  [style.paddingLeft.px]="siteLogoEmoji() ? 22 : 0"
                >
                  {{ currentUniverseName() }}
                  <button
                    (click)="toggleUniverseMenu()"
                    style="margin-left:6px; font-size:10px; padding:2px 6px;"
                  >
                    ▼
                  </button>
                  @if (universeMenuOpen()) {
                    <div
                      style="position:fixed; inset:0; background:var(--color-overlay); z-index:1400;"
                      role="button"
                      tabindex="0"
                      (click)="universeMenuOpen.set(false)"
                      (keydown.enter)="universeMenuOpen.set(false)"
                      (keydown.space)="universeMenuOpen.set(false)"
                    ></div>
                    <div
                      style="position:absolute; top:100%; left:0; margin-top:6px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:6px; min-width:180px; z-index:1401; box-shadow:0 12px 24px rgba(0,0,0,0.18);"
                      (pointerdown)="$event.stopPropagation()"
                    >
                      @for (u of universesList(); track u.id) {
                        <button
                          (click)="switchUniverse(u.id)"
                          [disabled]="u.id === auth.getActiveUniverseId(currentUserId() || '')"
                          style="text-align:left; padding:6px 8px; border-radius:6px;"
                        >
                          {{ u.name }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
              @if (auth.preferences().city) {
                <div style="font-size:14px; opacity:0.8;">{{ auth.preferences().city }}</div>
              }
              @if (showTime()) {
                <div style="font-size:14px; opacity:0.8;">{{ timeLabel() }}</div>
              }
              <button
                (click)="toggleWorkspaceMenu()"
                [style.boxShadow]="
                  workspaceMenuOpen() ? '0 0 8px rgba(255, 228, 154, 0.9)' : 'none'
                "
              >
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
              <button
                (click)="toggleDialogsHidden()"
                style="margin-bottom: 8px;"
                [disabled]="settingsOpen() || !canEdit()"
                [style.opacity]="settingsOpen() || !canEdit() ? 0.5 : 1"
              >
                {{
                  dialogsHidden()
                    ? ('dialogs.showAll' | translate)
                    : ('dialogs.hideAll' | translate)
                }}
              </button>
              <div style="margin-bottom: 12px;">
                <button
                  (click)="toggleResetMenu()"
                  [disabled]="settingsOpen() || !canEdit()"
                  [style.opacity]="settingsOpen() || !canEdit() ? 0.5 : 1"
                >
                  {{ 'dialogs.reset' | translate }}
                </button>
                @if (resetMenuOpen()) {
                  <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                    <button
                      (click)="resetDialogs('left')"
                      [disabled]="settingsOpen() || !canEdit()"
                      [style.opacity]="settingsOpen() || !canEdit() ? 0.5 : 1"
                    >
                      {{ 'dialogs.resetLeft' | translate }}
                    </button>
                    <button
                      (click)="resetDialogs('middle')"
                      [disabled]="settingsOpen() || !canEdit()"
                      [style.opacity]="settingsOpen() || !canEdit() ? 0.5 : 1"
                    >
                      {{ 'dialogs.resetMiddle' | translate }}
                    </button>
                  </div>
                }
              </div>
              <app-app-list
                [apps]="visibleAppGroups()"
                [instancesByApp]="instancesByApp()"
                [deleteTargetActive]="!!deleteTargetId()"
                [actionsDisabled]="settingsOpen() || !canEdit()"
                (openApp)="openApp($event)"
                (restore)="restoreInstance($event)"
                (duplicate)="duplicateInstance($event)"
                (toggleLock)="toggleDeleteLock($event)"
              />
            </div>

            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              @if (showViewportSizingControls()) {
                <label style="display:flex; flex-direction:column; gap:6px;">
                  {{ 'canvas.mode' | translate }}
                  <select
                    [value]="isCanvasLocked() ? 'locked' : 'follow'"
                    (change)="setCanvasMode($event)"
                  >
                    <option value="follow">{{ 'canvas.modeFollow' | translate }}</option>
                    <option value="locked">{{ 'canvas.modeLocked' | translate }}</option>
                  </select>
                </label>
                @if (isCanvasLocked()) {
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input
                      type="number"
                      [value]="canvasDraftWidth()"
                      (input)="canvasDraftWidth.set($any($event.target).valueAsNumber)"
                      min="1024"
                      max="20000"
                      style="width:90px; padding:4px;"
                    />
                    <span>×</span>
                    <input
                      type="number"
                      [value]="canvasDraftHeight()"
                      (input)="canvasDraftHeight.set($any($event.target).valueAsNumber)"
                      min="768"
                      max="20000"
                      style="width:90px; padding:4px;"
                    />
                    <button (click)="applyCanvasSize()" [disabled]="!canvasDraftDirty()">
                      {{ 'canvas.updateSize' | translate }}
                    </button>
                  </div>
                }
              }
              @if (showZoomControls()) {
                <div
                  style="display:flex; align-items:center; gap:8px;"
                  [style.borderTop]="showCanvasDivider() ? '1px solid var(--color-border)' : 'none'"
                  [style.paddingTop]="showCanvasDivider() ? '8px' : '0'"
                  [style.marginTop]="showCanvasDivider() ? '8px' : '0'"
                >
                  <button
                    (click)="resetZoom()"
                    [disabled]="settingsOpen()"
                    [style.opacity]="settingsOpen() ? 0.5 : 1"
                  >
                    {{ 'canvas.originalScale' | translate }}
                  </button>
                  <button
                    (click)="zoomOut()"
                    [disabled]="settingsOpen()"
                    [style.opacity]="settingsOpen() ? 0.5 : 1"
                  >
                    {{ 'canvas.zoomOut' | translate }}
                  </button>
                  <button
                    (click)="zoomIn()"
                    [disabled]="settingsOpen()"
                    [style.opacity]="settingsOpen() ? 0.5 : 1"
                  >
                    {{ 'canvas.zoomIn' | translate }}
                  </button>
                </div>
              }
              <button
                (click)="toggleSettings()"
                [disabled]="!canOpenSettings()"
                [style.opacity]="!canOpenSettings() ? 0.5 : 1"
                [style.cursor]="!canOpenSettings() ? 'not-allowed' : 'pointer'"
              >
                {{ 'nav.settings' | translate }}
              </button>
              <button (click)="openLicense()">{{ 'nav.license' | translate }}</button>
              <button (click)="logout()">{{ 'nav.logout' | translate }}</button>
            </div>
          }
        </aside>

        <section
          id="app-viewport"
          style="flex:1; position:relative; display:flex; align-items:center; justify-content:center;"
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
              [disabled]="settingsOpen() || !canEdit()"
              [style.opacity]="settingsOpen() || !canEdit() ? 0.5 : 1"
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
            style="position:relative; flex:0 0 auto; min-width:1024px; min-height:768px; max-width:20000px; max-height:20000px; margin:0 auto; background-color:var(--color-bg); transform-origin: top left;"
            [style.transform]="'scale(' + canvasScale() + ')'"
            [style.cursor]="isPanning() ? 'grabbing' : 'default'"
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
                  [disabled]="isOverlayActive() || !canEdit()"
                  [title]="instanceLabel(instance)"
                  [icon]="instanceIcon(instance.appId)"
                  [trashDisabled]="!!instance.deleteLocked"
                  [hasSettings]="instanceHasSettings(instance.appId)"
                  [canMoveWorkspace]="dialogService.getWorkspaces().length > 1"
                  (moved)="onDialogMove(instance.id, $event)"
                  (resized)="onDialogResize(instance.id, $event)"
                  (stash)="stashInstance(instance.id)"
                  (minimize)="minimizeInstance(instance.id)"
                  (maximize)="toggleMaximize(instance.id)"
                  (closed)="minimizeInstance(instance.id)"
                  (trash)="confirmDelete(instance.id)"
                  (titleEdited)="renameInstance(instance.id, $event)"
                  (bringToFront)="dialogService.bringToFront(instance.id)"
                  (settings)="toggleInstanceSettings(instance.id)"
                  (moveWorkspace)="openMoveWorkspace(instance.id)"
                >
                  @if (instance.appId === 'todo') {
                    <app-todo-page [instanceId]="instance.id" />
                  }
                  @if (instance.appId === 'kanban') {
                    <app-kanban [instanceId]="instance.id" />
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
                  @if (instance.appId === 'stickyNotes') {
                    <app-sticky-notes [instanceId]="instance.id" />
                  }
                  @if (instance.appId === 'calendar') {
                    <app-calendar [instanceId]="instance.id" />
                  }
                  @if (instance.appId === 'clock') {
                    <app-clock [instanceId]="instance.id" />
                  }
                  @if (instance.appId === 'dataTable') {
                    <app-data-table [instanceId]="instance.id" />
                  }
                </app-dialog>
              }
            }
          </div>

          @if (settingsOpen()) {
            <div
              style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:2000;"
              (pointerdown)="requestCloseSettings()"
              role="button"
              tabindex="0"
              (keydown.enter)="requestCloseSettings()"
              (keydown.space)="requestCloseSettings()"
            >
              <div
                style="background:var(--color-surface); padding:20px; border-radius:12px; height:85vh; overflow:auto; width:min(920px, 92vw);"
                (pointerdown)="$event.stopPropagation()"
              >
                <div style="display:flex; justify-content:flex-end;">
                  <button (click)="requestCloseSettings()">✕</button>
                </div>
                <app-settings />
              </div>
            </div>
          }
          @if (licenseOpen()) {
            <div
              style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:2000;"
              (pointerdown)="licenseOpen.set(false)"
              role="button"
              tabindex="0"
              (keydown.enter)="licenseOpen.set(false)"
              (keydown.space)="licenseOpen.set(false)"
            >
              <div
                style="background:var(--color-surface); padding:20px; border-radius:12px; max-height:85vh; overflow:auto; width:min(920px, 92vw);"
                (pointerdown)="$event.stopPropagation()"
              >
                <app-license (closed)="licenseOpen.set(false)" />
              </div>
            </div>
          }
          @if (moveWorkspaceTargetId()) {
            <div
              style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:2100;"
              (pointerdown)="closeMoveWorkspace()"
              role="button"
              tabindex="0"
              (keydown.enter)="closeMoveWorkspace()"
              (keydown.space)="closeMoveWorkspace()"
            >
              <div
                style="background:var(--color-surface); padding:24px; border-radius:12px; width:min(640px, 92vw);"
                (pointerdown)="$event.stopPropagation()"
              >
                <h3 style="margin:0 0 16px;">
                  {{ 'dialogs.moveWorkspaceTitle' | translate: { name: moveWorkspaceLabel() } }}
                </h3>
                <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                  @for (ws of dialogService.getWorkspaces(); track ws.id) {
                    <button
                      (click)="moveInstanceToWorkspace(ws.id)"
                      [disabled]="ws.id === moveWorkspaceCurrentId()"
                      style="padding:10px 18px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-surface);"
                      [style.opacity]="ws.id === moveWorkspaceCurrentId() ? 0.5 : 1"
                      [style.boxShadow]="
                        ws.id === moveWorkspaceCurrentId() ? 'none' : '0 0 0 rgba(0,0,0,0)'
                      "
                      (mouseenter)="
                        $any($event.target).style.boxShadow = '0 0 8px rgba(0, 194, 209, 0.6)'
                      "
                      (mouseleave)="$any($event.target).style.boxShadow = 'none'"
                    >
                      {{ ws.name }}
                    </button>
                  }
                </div>
                <div style="display:flex; justify-content:flex-end; margin-top:16px;">
                  <button (click)="closeMoveWorkspace()">{{ 'dialogs.cancel' | translate }}</button>
                </div>
              </div>
            </div>
          }
          @if (universeSwitchConfirmOpen()) {
            <app-confirm-dialog
              [message]="'universe.switchWarning' | translate"
              [confirmLabel]="'universe.switchConfirm' | translate"
              [cancelLabel]="'dialogs.cancel' | translate"
              (confirmed)="confirmUniverseMenuOpen()"
              (canceled)="cancelUniverseMenuConfirm()"
            />
          }
        </section>
      </main>

      @if (showUniverseBar()) {
        @if (universeBarOpen()) {
          <div class="universe-bar" [style.left.px]="universeBarLeft()">
            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
              @if (inviteesOnline().length) {
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  @for (invitee of inviteesOnline(); track invitee.id) {
                    <div
                      class="universe-chip"
                      [class.universe-chip--active]="universeEditHolder()?.id === invitee.id"
                    >
                      <span>{{ invitee.username }}</span>
                      @if (isUniverseOwner()) {
                        <button
                          (click)="grantEdit(invitee)"
                          title="{{ 'universe.grantEdit' | translate }}"
                        >
                          ✏️
                        </button>
                      }
                    </div>
                  }
                </div>
              } @else {
                <div style="flex:1; text-align:center; font-size:12px; opacity:0.7;">
                  {{ 'universe.noInvitees' | translate }}
                </div>
              }
            </div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <div class="universe-chip">
                {{
                  (isMainGuest() ? 'universe.guestsCountOwned' : 'universe.guestsCount')
                    | translate: { count: guestCount() }
                }}
              </div>
              <div class="universe-chip">
                {{
                  (isMainGuest() ? 'universe.observersCountOwned' : 'universe.observersCount')
                    | translate: { count: observerCount() }
                }}
              </div>
              @if (universeEditHolder()) {
                <div class="universe-chip universe-chip--active">
                  {{ 'universe.editingAs' | translate: { name: universeEditHolder()?.username } }}
                </div>
              }
              @if (isUniverseOwner() && universeEditHolder()?.id !== auth.session().userId) {
                <button (click)="takeBackEditPermissions()">
                  {{ 'universe.takeBackEdit' | translate }}
                </button>
              }
              @if (allowUniverseChat()) {
                <button (click)="toggleUniverseChat()">
                  {{ 'universe.openChat' | translate }}
                  @if (universeChatUnread() > 0) {
                    <span>({{ universeChatUnread() }})</span>
                  }
                </button>
              }
              <button (click)="toggleUniverseBar()">
                {{ 'universe.collapseBar' | translate }}
              </button>
            </div>
          </div>
        } @else {
          <button
            class="floating-control"
            style="right:12px; bottom:12px;"
            (click)="toggleUniverseBar()"
          >
            {{ 'universe.expandBar' | translate }}
          </button>
        }
      }

      @if (universeChatOpen() && !settingsOpen()) {
        <div class="universe-chat" [style.bottom.px]="universeBarOpen() ? 64 : 16">
          <div
            style="display:flex; justify-content:space-between; align-items:center; padding:12px 12px 0;"
          >
            <h4 style="margin:0;">{{ 'universe.chatTitle' | translate }}</h4>
            <button (click)="universeChatOpen.set(false)">✕</button>
          </div>
          <div
            class="universe-chat__messages"
            #universeChatScroll
            (scroll)="onUniverseChatScroll($event)"
          >
            @for (msg of universeChatMessages(); track msg.id) {
              <div style="border:1px solid var(--color-border); border-radius:8px; padding:8px;">
                <div style="font-size:12px; opacity:0.7; margin-bottom:4px;">
                  {{ msg.author }}
                </div>
                <div style="white-space:pre-wrap;">{{ msg.content }}</div>
              </div>
            }
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; padding:12px;">
            <textarea
              class="universe-chat__input"
              [value]="universeChatDraft()"
              (input)="universeChatDraft.set($any($event.target)?.value || '')"
              [placeholder]="'universe.chatPlaceholder' | translate"
            ></textarea>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              @if (isUniverseOwner()) {
                <button (click)="clearUniverseChat()">
                  {{ 'universe.chatClear' | translate }}
                </button>
              }
              <button (click)="sendUniverseChat()">{{ 'universe.chatSend' | translate }}</button>
            </div>
          </div>
        </div>
      }

      @if (deleteTargetId()) {
        <app-confirm-dialog
          [message]="'dialogs.confirmDelete' | translate"
          [confirmLabel]="'dialogs.confirm' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="deleteConfirmed()"
          (canceled)="deleteTargetId.set(null)"
        />
      }

      @if (cloneTargetId()) {
        <app-confirm-dialog
          [message]="'dialogs.cloneConfirm' | translate"
          [confirmLabel]="'dialogs.confirm' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="confirmClone()"
          (canceled)="cancelClone()"
        />
      }

      @if (settingsCloseConfirmOpen()) {
        <app-confirm-dialog
          [message]="'settings.closeConfirm' | translate"
          [confirmLabel]="'settings.discard' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="confirmCloseSettings()"
          (canceled)="cancelCloseSettings()"
        />
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
  readonly instanceSettings = inject(InstanceSettingsService);
  isMockMode = computed(() => {
    const backendConnected = this.auth.isBackendConnected();
    return !backendConnected || this.auth.orgSettings().testModeEnabled;
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
  resetMenuOpen = signal(false);
  deleteTargetId = signal<string | null>(null);
  cloneTargetId = signal<string | null>(null);
  moveWorkspaceTargetId = signal<string | null>(null);
  universeMenuOpen = signal(false);
  universeSwitchConfirmOpen = signal(false);
  universeMenuPendingOpen = signal(false);
  universeBarOpen = signal(true);
  universeChatOpen = signal(false);
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
  workspaceRenameInput = viewChild<ElementRef<HTMLInputElement>>('workspaceRenameInput');
  universeChatScroll = viewChild<ElementRef<HTMLDivElement>>('universeChatScroll');

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
      this.licenseOpen() ||
      this.accessibilityPromptOpen() ||
      this.guestBlocked() ||
      this.loadingVisible() ||
      Boolean(this.cloneTargetId()) ||
      Boolean(this.moveWorkspaceTargetId()) ||
      this.universeSwitchConfirmOpen(),
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
  universesList = computed(() =>
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
    if (!this.multiUserEnabled()) return true;
    const holder = this.universeEditHolder();
    if (!holder) return this.isUniverseOwner();
    return holder.id === this.auth.session().userId;
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
  visibleAppGroups = computed(() => APP_GROUPS.filter((app) => !this.disabledApps().has(app.id)));
  instancesByApp = computed(() => ({
    kanban: this.dialogService.getAppInstances('kanban'),
    todo: this.dialogService.getAppInstances('todo'),
    calculator: this.dialogService.getAppInstances('calculator'),
    timer: this.dialogService.getAppInstances('timer'),
    navigator: this.dialogService.getAppInstances('navigator'),
    notes: this.dialogService.getAppInstances('notes'),
    stickyNotes: this.dialogService.getAppInstances('stickyNotes'),
    calendar: this.dialogService.getAppInstances('calendar'),
    clock: this.dialogService.getAppInstances('clock'),
    dataTable: this.dialogService.getAppInstances('dataTable'),
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
      const actualUser = this.auth.actualUser();
      if (!actualUser) {
        this.accessibilityPromptOpen.set(false);
        return;
      }
      if (this.auth.hasSeenAccessibilityPrompt(actualUser.id)) return;
      this.accessibilityPromptEnabled.set(false);
      this.accessibilityPromptOpen.set(true);
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
      const userId = this.auth.actualUser()?.id ?? null;
      this.settingsOpen.set(false);
      this.settingsCloseConfirmOpen.set(false);
      this.workspaceMenuOpen.set(false);
      this.universeMenuOpen.set(false);
      this.universeSwitchConfirmOpen.set(false);
      this.deleteTargetId.set(null);
      this.cloneTargetId.set(null);
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
    if (this.universeInterval) window.clearInterval(this.universeInterval);
    if (this.loadingTimeout) window.clearTimeout(this.loadingTimeout);
    if (this.loginLoadingTimeout) window.clearTimeout(this.loginLoadingTimeout);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.updateCanvasBounds);
    }
  }

  updateCanvasBounds = () => {
    if (typeof document === 'undefined') return;
    const canvas = document.querySelector('#app-canvas');
    const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
    if (!this.isCanvasLocked() && viewport) {
      this.syncCanvasToViewport(viewport);
    }
    if (canvas instanceof HTMLElement) {
      this.canvasBounds.set(createFallbackRect(this.canvasWidth(), this.canvasHeight()));
    }
    if (viewport) {
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
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest('[data-workspace-id]') as HTMLElement | null;
        if (!target) return;
        const targetId = target.dataset['workspaceId'] ?? null;
        if (!targetId) return;
        const rect = target.getBoundingClientRect();
        const isLeft = event.clientX < rect.left + rect.width / 2;
        this.hoverWorkspaceId.set(targetId);
        this.hoverWorkspaceSide.set(isLeft ? 'left' : 'right');
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

  switchUniverse(universeId: string) {
    if (!this.canSwitchUniverse()) return;
    const userId = this.currentUserId();
    if (!userId) return;
    const activeId = this.auth.getActiveUniverseId(userId);
    if (!activeId || activeId === universeId) {
      this.universeMenuOpen.set(false);
      return;
    }
    if (this.hasUniverseParticipants()) {
      const currentUniverseId = this.universeId();
      if (currentUniverseId) {
        this.auth.markUniverseKick(currentUniverseId);
      }
    }
    this.runLoadingTransition();
    this.auth.setActiveUniverseId(userId, universeId);
    this.universeMenuOpen.set(false);
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
    this.dialogService.switchWorkspace(id);
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
    if (!this.canEdit()) return;
    this.dialogService.restoreInstance(instanceId);
    this.dialogService.bringToFront(instanceId);
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
    await this.cloneAppData(original.appId, original.id, nextId);
    this.cloneTargetId.set(null);
  }

  cancelClone() {
    this.cloneTargetId.set(null);
  }

  async cloneAppData(appId: AppId, fromId: string, toId: string) {
    if (appId === 'todo') {
      await cloneTodos(fromId, toId, this.effectiveUserId());
    }
    if (appId === 'calculator') cloneCalculatorState(fromId, toId);
    if (appId === 'timer') cloneTimerState(fromId, toId);
    if (appId === 'navigator') cloneNavigatorState(fromId, toId);
    if (appId === 'notes') cloneNotesState(fromId, toId);
    if (appId === 'stickyNotes') cloneStickyNoteState(fromId, toId);
    if (appId === 'calendar') cloneCalendarState(fromId, toId);
    if (appId === 'clock') cloneClockState(fromId, toId);
    if (appId === 'kanban') cloneKanbanState(fromId, toId);
    if (appId === 'dataTable') cloneDataTableState(fromId, toId);
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
    this.dialogService.stashInstance(instanceId, this.canvasBounds());
  }

  restoreFromStash(instance: { id: string }) {
    if (!this.canEdit()) return;
    this.dialogService.unstashInstance(instance.id);
    this.dialogService.bringToFront(instance.id);
  }

  toggleDialogsHidden() {
    if (!this.canEdit()) return;
    this.dialogService.toggleWorkspaceHidden(this.dialogService.getActiveWorkspaceId());
  }

  onDialogMove(instanceId: string, rect: { x: number; y: number }) {
    this.dialogService.moveInstance(instanceId, rect, this.canvasBounds());
  }

  onDialogResize(instanceId: string, rect: { width: number; height: number }) {
    this.dialogService.resizeInstance(instanceId, rect, this.canvasBounds());
  }

  minimizeInstance(instanceId: string) {
    if (!this.canEdit()) return;
    this.dialogService.minimizeInstance(instanceId);
  }

  toggleMaximize(instanceId: string) {
    if (!this.canEdit()) return;
    this.dialogService.toggleMaximize(instanceId, this.viewportBounds());
  }

  confirmDelete(instanceId: string) {
    if (!this.canEdit()) return;
    this.deleteTargetId.set(instanceId);
  }

  deleteConfirmed() {
    const target = this.deleteTargetId();
    if (target) this.dialogService.deleteInstance(target);
    this.deleteTargetId.set(null);
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

  instanceLabel(instance: { titleKey: string; titleOverride?: string; id: string; appId: AppId }) {
    if (instance.titleOverride) return instance.titleOverride;
    return `${this.translate.instant(instance.titleKey)} (${this.instanceIndex(instance.appId, instance.id)})`;
  }

  instanceIcon(appId: AppId) {
    return APP_REGISTRY[appId]?.icon ?? '📦';
  }

  instanceHasSettings(appId: AppId) {
    return (
      appId === 'clock' ||
      appId === 'calculator' ||
      appId === 'kanban' ||
      appId === 'stickyNotes' ||
      appId === 'dataTable'
    );
  }

  toggleInstanceSettings(instanceId: string) {
    this.instanceSettings.toggle(instanceId);
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
  }

  universeBarLeft() {
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

  grantEdit(invitee: UniversePresenceEntry) {
    if (!this.isUniverseOwner()) return;
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
    if (!this.isUniverseOwner()) return;
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
    this.auth.logout();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }

  startRename(instance: { id: string; titleOverride?: string; titleKey: string; appId: AppId }) {
    if (!this.canEdit()) return;
    this.editingTileId.set(instance.id);
    this.editingTitle.set(this.instanceLabel(instance));
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
    const colorTheme = prefs.colorTheme || 'standard';
    body.classList.toggle('theme-light', resolvedTheme === 'light');
    body.classList.toggle('theme-dark', resolvedTheme === 'dark');
    body.classList.toggle('theme-color-standard', colorTheme === 'standard');
    body.classList.toggle('theme-color-notepad', colorTheme === 'notepad');
    body.classList.toggle('theme-color-ice', colorTheme === 'ice');
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
