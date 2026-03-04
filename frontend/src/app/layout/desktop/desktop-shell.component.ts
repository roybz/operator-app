import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppListComponent, AppGroup } from '../shared/app-list/app-list.component';
import { DialogInstance } from '../../core/dialog.service';
import { AppId } from '../../features/dependencies/app-types';
import { StorageService } from '../../core/storage/storage.service';
import { DeviceModeToggleComponent } from '../../shared/device-mode-toggle/device-mode-toggle.component';

@Component({
  selector: 'app-desktop-shell',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppListComponent, DeviceModeToggleComponent],
  template: `
    <aside
      [style.width]="navOpen ? '267px' : '0'"
      [style.padding]="navOpen ? '16px' : '0'"
      [style.borderRight]="navOpen ? 'none' : 'none'"
      [style.overflowX]="'hidden'"
      [style.overflowY]="navOpen ? 'auto' : 'hidden'"
      style="display:flex; flex-direction:column; gap:16px; transition:width 180ms ease; box-sizing:border-box; height:100%; max-height:100%;"
    >
      @if (navOpen) {
        <div style="display:flex; flex-direction:column; flex:1; min-height:0;">
          <button
            (click)="toggleNav.emit()"
            style="margin-bottom: 8px; padding:5px 6px; border-radius:3px;"
          >
            {{ navOpen ? ('nav.collapse' | translate) : ('nav.expand' | translate) }}
          </button>
          <button
            (click)="toggleDialogsHidden.emit()"
            style="margin-bottom: 8px; padding:5px 6px; border-radius:3px;"
            [disabled]="settingsOpen || !canEdit"
            [style.opacity]="settingsOpen || !canEdit ? 0.5 : 1"
          >
            {{ dialogsHidden ? ('dialogs.showAll' | translate) : ('dialogs.hideAll' | translate) }}
          </button>
          <div style="margin-bottom: 12px;">
            <button
              (click)="toggleResetMenu.emit()"
              [disabled]="settingsOpen || !canEdit"
              [style.opacity]="settingsOpen || !canEdit ? 0.5 : 1"
              style="width:100%; padding:5px 6px; border-radius:3px;"
            >
              {{ 'dialogs.reset' | translate }}
            </button>
            @if (resetMenuOpen) {
              <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                <button
                  (click)="resetLeft.emit()"
                  [disabled]="settingsOpen || !canEdit"
                  [style.opacity]="settingsOpen || !canEdit ? 0.5 : 1"
                  style="padding:5px 6px; border-radius:3px;"
                >
                  {{ 'dialogs.resetLeft' | translate }}
                </button>
                <button
                  (click)="resetMiddle.emit()"
                  [disabled]="settingsOpen || !canEdit"
                  [style.opacity]="settingsOpen || !canEdit ? 0.5 : 1"
                  style="padding:5px 6px; border-radius:3px;"
                >
                  {{ 'dialogs.resetMiddle' | translate }}
                </button>
              </div>
            }
          </div>
          <div style="border-top:1px solid var(--color-border); margin:12px 0; opacity:0.6;"></div>
          <div style="flex:1; min-height:0; overflow:auto;">
            <app-app-list
              [apps]="apps"
              [instancesByApp]="instancesByApp"
              [deleteTargetActive]="deleteTargetActive"
              [actionsDisabled]="settingsOpen || !canEdit"
              [phoneMode]="false"
              (openApp)="openApp.emit($event)"
              (restore)="restore.emit($event)"
              (duplicate)="duplicate.emit($event)"
              (toggleLock)="toggleLock.emit($event)"
              (archive)="archive.emit($event)"
              (unarchive)="unarchive.emit($event)"
            />
          </div>
          <div
            style="margin-top:12px; width:100%; display:flex; flex-direction:column; gap:8px; padding-top:8px; border-top:1px solid var(--color-border);"
          >
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-size:14px;">{{ 'canvas.display' | translate }}</span>
              <button
                (click)="toggleDisplayOptions()"
                [style.opacity]="displayOptionsOpen ? 1 : 0.6"
                (mouseenter)="displayOptionsHovered = true"
                (mouseleave)="displayOptionsHovered = false"
                [style.background]="displayOptionsOpen ? 'var(--color-bg)' : 'transparent'"
                style="width:28px; height:28px; border-radius:999px; border:1px solid var(--color-border); display:flex; align-items:center; justify-content:center;"
                [style.opacity]="displayOptionsHovered || displayOptionsOpen ? 1 : 0.6"
                title="Display settings"
              >
                ⚙️
              </button>
            </div>
            @if (displayOptionsOpen) {
              <app-device-mode-toggle
                [checked]="phoneMode"
                (changed)="phoneModeToggle.emit($event)"
              />
              @if (!phoneMode && showViewportSizingControls) {
                <label style="display:flex; flex-direction:column; gap:6px;">
                  <span style="margin-left:4px; font-size:14px;">
                    {{ 'canvas.mode' | translate }}
                  </span>
                  <select [value]="canvasMode" (change)="canvasModeChange.emit($event)">
                    <option value="follow">{{ 'canvas.modeFollow' | translate }}</option>
                    <option value="locked">{{ 'canvas.modeLocked' | translate }}</option>
                  </select>
                </label>
                @if (isCanvasLocked) {
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input
                      type="number"
                      [value]="canvasDraftWidth"
                      (input)="canvasDraftWidthChange.emit($any($event.target).valueAsNumber)"
                      min="1024"
                      max="20000"
                      style="width:90px; padding:4px;"
                    />
                    <span>×</span>
                    <input
                      type="number"
                      [value]="canvasDraftHeight"
                      (input)="canvasDraftHeightChange.emit($any($event.target).valueAsNumber)"
                      min="768"
                      max="20000"
                      style="width:90px; padding:4px;"
                    />
                    <button (click)="applyCanvasSize.emit()" [disabled]="!canvasDraftDirty">
                      {{ 'canvas.updateSize' | translate }}
                    </button>
                  </div>
                }
              }
              @if (!phoneMode && showZoomControls) {
                <div
                  style="display:flex; align-items:center; gap:8px;"
                  [style.borderTop]="showCanvasDivider ? '1px solid var(--color-border)' : 'none'"
                  [style.paddingTop]="showCanvasDivider ? '8px' : '0'"
                  [style.marginTop]="showCanvasDivider ? '8px' : '0'"
                >
                  <button
                    (click)="resetZoom.emit()"
                    [disabled]="settingsOpen"
                    [style.opacity]="settingsOpen ? 0.5 : 1"
                    style="padding:5px 6px; border-radius:3px;"
                  >
                    {{ 'canvas.originalScale' | translate }}
                  </button>
                  <button
                    (click)="zoomOut.emit()"
                    [disabled]="settingsOpen"
                    [style.opacity]="settingsOpen ? 0.5 : 1"
                    style="padding:5px 6px; border-radius:3px;"
                  >
                    {{ 'canvas.zoomOut' | translate }}
                  </button>
                  <button
                    (click)="zoomIn.emit()"
                    [disabled]="settingsOpen"
                    [style.opacity]="settingsOpen ? 0.5 : 1"
                    style="padding:5px 6px; border-radius:3px;"
                  >
                    {{ 'canvas.zoomIn' | translate }}
                  </button>
                </div>
              }
            }
            <button
              (click)="toggleSettings.emit()"
              [disabled]="!canOpenSettings"
              [style.opacity]="!canOpenSettings ? 0.5 : 1"
              [style.cursor]="!canOpenSettings ? 'not-allowed' : 'pointer'"
              style="padding:5px 6px; border-radius:3px;"
            >
              {{ 'nav.settings' | translate }}
            </button>
            <button (click)="openLicense.emit()" style="padding:5px 6px; border-radius:3px;">
              {{ 'nav.license' | translate }}
            </button>
            <button (click)="logout.emit()" style="padding:5px 6px; border-radius:3px;">
              {{ 'nav.logout' | translate }}
            </button>
          </div>
        </div>
      }
    </aside>
  `,
})
export class DesktopShellComponent implements OnInit {
  @Input() navOpen = false;
  @Input() dialogsHidden = false;
  @Input() resetMenuOpen = false;
  @Input() settingsOpen = false;
  @Input() canEdit = false;
  @Input() deleteTargetActive = false;
  @Input() apps: AppGroup[] = [];
  @Input() instancesByApp: Record<AppId, DialogInstance[]> = {} as Record<AppId, DialogInstance[]>;
  @Input() phoneMode = false;
  @Input() showViewportSizingControls = false;
  @Input() isCanvasLocked = false;
  @Input() canvasMode: 'follow' | 'locked' = 'follow';
  @Input() canvasDraftWidth = 0;
  @Input() canvasDraftHeight = 0;
  @Input() canvasDraftDirty = false;
  @Input() showZoomControls = false;
  @Input() showCanvasDivider = false;
  @Input() canOpenSettings = true;
  displayOptionsOpen = false;
  displayOptionsHovered = false;
  private storage = inject(StorageService);

  @Output() toggleNav = new EventEmitter<void>();
  @Output() toggleDialogsHidden = new EventEmitter<void>();
  @Output() toggleResetMenu = new EventEmitter<void>();
  @Output() resetLeft = new EventEmitter<void>();
  @Output() resetMiddle = new EventEmitter<void>();
  @Output() openApp = new EventEmitter<AppId>();
  @Output() restore = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();
  @Output() toggleLock = new EventEmitter<string>();
  @Output() archive = new EventEmitter<string>();
  @Output() unarchive = new EventEmitter<string>();
  @Output() phoneModeToggle = new EventEmitter<Event>();
  @Output() canvasModeChange = new EventEmitter<Event>();
  @Output() canvasDraftWidthChange = new EventEmitter<number>();
  @Output() canvasDraftHeightChange = new EventEmitter<number>();
  @Output() applyCanvasSize = new EventEmitter<void>();
  @Output() resetZoom = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();
  @Output() zoomIn = new EventEmitter<void>();
  @Output() toggleSettings = new EventEmitter<void>();
  @Output() openLicense = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  ngOnInit() {
    this.displayOptionsOpen = this.readDisplayOptions();
  }

  toggleDisplayOptions() {
    this.displayOptionsOpen = !this.displayOptionsOpen;
    void this.storage.setItem('op_display_options_open', this.displayOptionsOpen ? '1' : '0');
  }

  private readDisplayOptions() {
    const raw = this.storage.getItemSync('op_display_options_open');
    if (raw === null) return false;
    return raw === '1';
  }
}
