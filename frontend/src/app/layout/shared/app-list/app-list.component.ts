import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogInstance } from '../../../core/dialog.service';
import { AppId } from '../../../features/dependencies/app-types';

export interface AppGroup {
  id: AppId;
  labelKey: string;
  icon: string;
}

@Component({
  selector: 'app-app-list',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './app-list.component.html',
  styleUrls: ['./app-list.component.scss'],
})
export class AppListComponent implements AfterViewInit {
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
  @Input() phoneMode = false;
  @Input() activeInstanceId: string | null = null;

  @Output() openApp = new EventEmitter<AppId>();
  @Output() restore = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();
  @Output() toggleLock = new EventEmitter<string>();
  @Output() archive = new EventEmitter<string>();
  @Output() unarchive = new EventEmitter<string>();

  private host = inject(ElementRef<HTMLElement>);
  private scrollEl = signal<HTMLElement | null>(null);
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
  openActionsDirection = signal<'up' | 'down'>('down');

  ngAfterViewInit() {
    queueMicrotask(() => {
      this.scrollEl.set(this.host.nativeElement.querySelector('.app-list__scroll'));
      const el = this.scrollEl();
      if (!el) return;
      el.addEventListener(
        'wheel',
        (event) => {
          if (event.ctrlKey) return;
          if (Math.abs(event.deltaY) > 0) {
            el.scrollTop += event.deltaY;
            event.preventDefault();
          }
        },
        { passive: false },
      );
    });
  }

  instanceLabel(instance: DialogInstance) {
    if (instance.titleOverride) return instance.titleOverride;
    const instances = this.instancesByApp[instance.appId] ?? [];
    const idx =
      instance.instanceNumber ?? instances.findIndex((item) => item.id === instance.id) + 1;
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

  isInstanceActive(instance: DialogInstance) {
    if (this.phoneMode) {
      if (this.activeInstanceId !== instance.id) return false;
      return !instance.phoneMinimized;
    }
    return !instance.minimized;
  }

  hasArchivedInstances() {
    return Object.values(this.instancesByApp).some((instances) =>
      instances.some((instance) => instance.archived),
    );
  }

  toggleActions(instanceId: string, event: Event) {
    event.stopPropagation();
    if (this.openActionsId() === instanceId) {
      this.openActionsId.set(null);
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    const menuHeight = 140;
    if (target) {
      const scrollRoot = target.closest('.app-list__scroll') as HTMLElement | null;
      const rect = target.getBoundingClientRect();
      const scrollRect = scrollRoot?.getBoundingClientRect();
      if (scrollRect) {
        const spaceBelow = scrollRect.bottom - rect.bottom;
        this.openActionsDirection.set(spaceBelow < menuHeight ? 'up' : 'down');
      } else {
        this.openActionsDirection.set('down');
      }
    } else {
      this.openActionsDirection.set('down');
    }
    this.openActionsId.set(instanceId);
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
