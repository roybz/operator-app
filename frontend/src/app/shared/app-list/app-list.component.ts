import { Component, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';
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
    <div class="app-list" (pointerdown)="closeActions()">
      <div class="app-list__scroll">
        @for (app of apps; track app.id) {
          <div class="app-row">
            <button
              class="app-list__toggle"
              (click)="toggleCollapsed(app.id); $event.stopPropagation()"
              [disabled]="actionsDisabled"
              [title]="
                isCollapsed(app.id)
                  ? ('dialogs.expandList' | translate)
                  : ('dialogs.collapseList' | translate)
              "
            >
              {{ isCollapsed(app.id) ? '▶' : '▼' }}
            </button>
            <span class="app-list__app-icon">{{ app.icon }}</span>
            <span class="app-list__name">{{ app.labelKey | translate }}</span>
            <button
              class="app-list__icon app-list__icon--add"
              (click)="openApp.emit(app.id); $event.stopPropagation()"
              [disabled]="actionsDisabled"
              title="{{ 'dialogs.add' | translate }}"
            >
              +
            </button>
          </div>
          @if (!isCollapsed(app.id) && visibleInstances(app.id).length) {
            <div class="app-list__instances">
              @for (instance of visibleInstances(app.id); track instance.id) {
                <div class="app-instance">
                  <button
                    class="app-instance__name"
                    (click)="restore.emit(instance.id); $event.stopPropagation()"
                    [style.fontStyle]="instance.minimized ? 'normal' : 'italic'"
                    [disabled]="actionsDisabled"
                    [style.opacity]="instance.archived ? 0.6 : 1"
                  >
                    {{ instanceLabel(instance) }}
                  </button>
                  @if (instance.archived) {
                    @if (showArchived()) {
                      <button
                        class="app-instance__unarchive"
                        (click)="onUnarchive(instance.id); $event.stopPropagation()"
                        [disabled]="actionsDisabled"
                        title="{{ 'dialogs.unarchive' | translate }}"
                      >
                        <span class="app-list__action-icon app-list__action-icon--unarchive"
                          >⤴︎</span
                        >
                      </button>
                    }
                  } @else {
                    <button
                      class="app-instance__kebab"
                      (click)="toggleActions(instance.id, $event)"
                      [disabled]="actionsDisabled"
                      title="{{ 'dialogs.actions' | translate }}"
                    >
                      ⋯
                    </button>
                    @if (openActionsId() === instance.id) {
                      <div class="app-instance__actions" (pointerdown)="$event.stopPropagation()">
                        <button
                          class="app-instance__action"
                          (click)="onDuplicate(instance.id)"
                          [disabled]="actionsDisabled"
                        >
                          <span class="app-list__action-icon app-list__action-icon--duplicate"
                            >⧉</span
                          >
                          <span>{{ 'dialogs.duplicate' | translate }}</span>
                        </button>
                        <button
                          class="app-instance__action"
                          (click)="onToggleLock(instance.id)"
                          [disabled]="deleteTargetActive || actionsDisabled"
                        >
                          <span class="app-list__action-icon app-list__action-icon--lock">
                            {{ instance.deleteLocked ? '🔒' : '🔓' }}
                          </span>
                          <span>
                            {{
                              instance.deleteLocked
                                ? ('dialogs.unlockDelete' | translate)
                                : ('dialogs.lockDelete' | translate)
                            }}
                          </span>
                        </button>
                        <button
                          class="app-instance__action"
                          (click)="onArchive(instance.id)"
                          [disabled]="actionsDisabled"
                        >
                          <span class="app-list__action-icon">📥</span>
                          <span>{{ 'dialogs.archive' | translate }}</span>
                        </button>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          }
        }
      </div>
      <button class="app-list__archived-toggle" (click)="toggleArchivedList()">
        {{ showArchived() ? ('apps.hideArchived' | translate) : ('apps.viewArchived' | translate) }}
      </button>
      @if (showArchived() && !hasArchivedInstances()) {
        <div class="app-list__archived-empty">{{ 'apps.noArchived' | translate }}</div>
      }
    </div>
  `,
  styles: [
    `
      .app-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .app-list__scroll {
        max-height: 50vh;
        overflow: auto;
        padding-right: 4px;
      }

      .app-row {
        display: grid;
        grid-template-columns: 18px 18px 1fr 24px;
        align-items: center;
        column-gap: 6px;
      }

      .app-list__name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .app-list__app-icon {
        width: 18px;
        height: 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }

      .app-list__toggle,
      .app-list__icon--add,
      .app-instance__kebab {
        opacity: 0.6;
        transition: opacity 0.15s ease;
      }

      .app-list__toggle:hover,
      .app-list__icon--add:hover,
      .app-instance__kebab:hover {
        opacity: 1;
      }

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
      .app-list__toggle:disabled,
      .app-instance__kebab:disabled {
        opacity: 0.4;
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
        width: 18px;
        height: 18px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 12px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .app-list__instances {
        margin: 0 0 0 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .app-instance {
        position: relative;
        display: grid;
        grid-template-columns: 1fr 24px;
        align-items: center;
        column-gap: 6px;
      }

      .app-instance__name {
        text-align: left;
        width: 100%;
      }

      .app-instance__kebab {
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 16px;
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .app-instance__actions {
        position: absolute;
        right: 0;
        top: 100%;
        margin-top: 6px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 160px;
        z-index: 10;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.14);
      }

      .app-instance__action,
      .app-instance__unarchive {
        display: flex;
        align-items: center;
        gap: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        padding: 4px 6px;
        border-radius: 6px;
        font-size: 12px;
      }

      .app-instance__action:hover,
      .app-instance__unarchive:hover {
        background: rgba(0, 0, 0, 0.04);
      }

      .app-list__action-icon {
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }

      .app-list__action-icon--duplicate {
        font-size: 14px;
      }

      .app-list__action-icon--lock {
        font-size: 10px;
      }

      .app-list__action-icon--unarchive {
        font-size: 12px;
        color: #6b7280;
      }

      .app-list__archived-toggle {
        align-self: flex-start;
        opacity: 0.6;
        transition: opacity 0.15s ease;
      }

      .app-list__archived-toggle:hover {
        opacity: 1;
      }

      .app-list__archived-empty {
        font-size: 11px;
        font-style: italic;
        opacity: 0.7;
        margin-top: 4px;
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
  @Output() archive = new EventEmitter<string>();
  @Output() unarchive = new EventEmitter<string>();

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
  showArchived = signal(false);
  openActionsId = signal<string | null>(null);

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

  toggleArchivedList() {
    this.showArchived.set(!this.showArchived());
  }

  visibleInstances(appId: AppId) {
    const instances = this.instancesByApp[appId] ?? [];
    const active = instances.filter((instance) => !instance.archived);
    if (!this.showArchived()) return active;
    const archived = instances.filter((instance) => instance.archived);
    return [...active, ...archived];
  }

  hasArchivedInstances() {
    return Object.values(this.instancesByApp).some((instances) =>
      instances.some((instance) => instance.archived),
    );
  }

  toggleActions(instanceId: string, event: Event) {
    event.stopPropagation();
    this.openActionsId.set(this.openActionsId() === instanceId ? null : instanceId);
  }

  closeActions() {
    this.openActionsId.set(null);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.app-instance__actions') || target.closest('.app-instance__kebab')) return;
    this.closeActions();
  }

  onDuplicate(instanceId: string) {
    this.duplicate.emit(instanceId);
    this.closeActions();
  }

  onToggleLock(instanceId: string) {
    this.toggleLock.emit(instanceId);
    this.closeActions();
  }

  onArchive(instanceId: string) {
    this.archive.emit(instanceId);
    this.closeActions();
  }

  onUnarchive(instanceId: string) {
    this.unarchive.emit(instanceId);
  }
}
