import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppId, DialogInstance } from '../../core/dialog.service';

export interface AppGroup {
  id: AppId;
  labelKey: string;
}

@Component({
  selector: 'app-app-list',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 8px;">
        <button (click)="toggleDialogs.emit()">
          {{ hideDialogs ? ('dialogs.showAll' | translate) : ('dialogs.hideAll' | translate) }}
        </button>
      </div>

      <div style="max-height: 50vh; overflow:auto; padding-right:4px;">
        @for (app of apps; track app.id) {
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>{{ app.labelKey | translate }}</span>
            <button class="app-list__icon" (click)="openApp.emit(app.id)">+</button>
          </div>
          <ul style="margin: 6px 0 0 16px; padding:0;">
            @for (instance of instancesByApp[app.id]; track instance.id) {
              <li style="display:flex; align-items:center; gap:6px;">
                <button
                  (click)="restore.emit(instance.id)"
                  [style.fontStyle]="instance.minimized ? 'normal' : 'italic'"
                  style="flex:1; text-align:left;"
                >
                  {{ instanceLabel(instance) }}
                </button>
                <button
                  class="app-list__icon"
                  (click)="toggleLock.emit(instance.id)"
                  [disabled]="deleteTargetActive"
                  title="{{
                    instance.deleteLocked
                      ? ('dialogs.unlockDelete' | translate)
                      : ('dialogs.lockDelete' | translate)
                  }}"
                >
                  {{ instance.deleteLocked ? '🔒' : '🔓' }}
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .app-list__icon {
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
      }
    `,
  ],
})
export class AppListComponent {
  @Input({ required: true }) apps: AppGroup[] = [];
  @Input({ required: true }) instancesByApp: Record<AppId, DialogInstance[]> = {
    todo: [],
    calculator: [],
    timer: [],
    navigator: [],
    notes: [],
  };
  @Input() deleteTargetActive = false;
  @Input() hideDialogs = false;

  @Output() openApp = new EventEmitter<AppId>();
  @Output() restore = new EventEmitter<string>();
  @Output() toggleLock = new EventEmitter<string>();
  @Output() toggleDialogs = new EventEmitter<void>();

  private translate = inject(TranslateService);

  instanceLabel(instance: DialogInstance) {
    if (instance.titleOverride) return instance.titleOverride;
    const instances = this.instancesByApp[instance.appId] ?? [];
    const idx = instances.findIndex((item) => item.id === instance.id) + 1;
    return `${this.translate.instant(instance.titleKey)} (${idx})`;
  }
}
