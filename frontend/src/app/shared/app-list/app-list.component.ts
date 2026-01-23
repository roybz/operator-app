import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogInstance } from '../../core/dialog.service';
import { AppId } from '../../features/dependencies/app-types';

export interface AppGroup {
  id: AppId;
  labelKey: string;
  icon: string;
}

@Component({
  selector: 'app-app-list',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div style="max-height: 50vh; overflow:auto; padding-right:4px;">
        @for (app of apps; track app.id) {
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="display:flex; align-items:center; gap:6px;">
              <button
                class="app-list__toggle"
                (click)="toggleCollapsed(app.id)"
                [disabled]="actionsDisabled"
                [title]="
                  isCollapsed(app.id)
                    ? ('dialogs.expandList' | translate)
                    : ('dialogs.collapseList' | translate)
                "
              >
                {{ isCollapsed(app.id) ? '▶' : '▼' }}
              </button>
              <span>{{ app.icon }}</span>
              {{ app.labelKey | translate }}
            </span>
            <button
              class="app-list__icon app-list__icon--add"
              (click)="openApp.emit(app.id)"
              [disabled]="actionsDisabled"
            >
              +
            </button>
          </div>
          @if (!isCollapsed(app.id) && instancesByApp[app.id]?.length) {
            <ul style="margin: 6px 0 0 16px; padding:0;">
              @for (instance of instancesByApp[app.id]; track instance.id) {
                <li style="display:flex; align-items:center; gap:6px;">
                  <button
                    (click)="restore.emit(instance.id)"
                    [style.fontStyle]="instance.minimized ? 'normal' : 'italic'"
                    style="flex:1; text-align:left;"
                    [disabled]="actionsDisabled"
                  >
                    {{ instanceLabel(instance) }}
                  </button>
                  <button
                    class="app-list__icon"
                    (click)="duplicate.emit(instance.id)"
                    title="{{ 'dialogs.duplicate' | translate }}"
                    [disabled]="actionsDisabled"
                  >
                    ⧉
                  </button>
                  <button
                    class="app-list__icon"
                    (click)="toggleLock.emit(instance.id)"
                    [disabled]="deleteTargetActive || actionsDisabled"
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

      .app-list__icon:disabled,
      .app-list__toggle:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .app-list__icon--add:hover {
        border: 1px solid var(--color-border);
        border-radius: 6px;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .app-list__toggle {
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 12px;
        padding: 0;
      }
    `,
  ],
})
export class AppListComponent {
  @Input({ required: true }) apps: AppGroup[] = [];
  @Input({ required: true }) instancesByApp: Record<AppId, DialogInstance[]> = {
    kanban: [],
    todo: [],
    calculator: [],
    timer: [],
    navigator: [],
    notes: [],
    stickyNotes: [],
    calendar: [],
    clock: [],
    dataTable: [],
  };
  @Input() deleteTargetActive = false;
  @Input() actionsDisabled = false;

  @Output() openApp = new EventEmitter<AppId>();
  @Output() restore = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();
  @Output() toggleLock = new EventEmitter<string>();

  private translate = inject(TranslateService);
  private collapsed = signal<Record<AppId, boolean>>({
    kanban: false,
    todo: false,
    calculator: false,
    timer: false,
    navigator: false,
    notes: false,
    stickyNotes: false,
    calendar: false,
    clock: false,
    dataTable: false,
  });

  instanceLabel(instance: DialogInstance) {
    if (instance.titleOverride) return instance.titleOverride;
    const instances = this.instancesByApp[instance.appId] ?? [];
    const idx = instances.findIndex((item) => item.id === instance.id) + 1;
    return `${this.translate.instant(instance.titleKey)} (${idx})`;
  }

  isCollapsed(id: AppId) {
    return this.collapsed()[id];
  }

  toggleCollapsed(id: AppId) {
    const next = { ...this.collapsed(), [id]: !this.collapsed()[id] };
    this.collapsed.set(next);
  }
}
