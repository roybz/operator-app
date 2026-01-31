import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { AuthService, UserPreferences } from '../../../core/auth.service';
import { DialogService } from '../../../core/dialog.service';
import { ExportGuardService } from '../../../core/export-guard.service';
import { ImportGuardService } from '../../../core/import-guard.service';
import { AppId } from '../../dependencies/app-types';
import { APP_LIST } from '../../dependencies/app-registry';
import { clearCalculatorState } from '../../applications/default-applications/calculator/calculator.component';
import { clearTimerState } from '../../applications/default-applications/timer/timer.component';
import { clearNavigatorState } from '../../applications/default-applications/navigator/navigator.component';
import { clearNotesState } from '../../applications/default-applications/notes/notes.component';
import { clearCalendarState } from '../../applications/default-applications/calendar/calendar.component';
import { clearClockState } from '../../applications/default-applications/clock/clock.component';
import { clearKanbanState } from '../../applications/default-applications/kanban/kanban.component';
import { clearStickyNoteState } from '../../applications/default-applications/sticky-notes/sticky-notes.component';
import { clearDataTableState } from '../../applications/default-applications/data-table/data-table.component';
import { SettingsDraftService } from '../settings-draft.service';

const APPLICATIONS = APP_LIST;

@Component({
  selector: 'app-applications-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmDialogComponent],
  template: `
    <section>
      <h3>{{ 'settings.applicationsTitle' | translate }}</h3>
      @if (showUniverseNotice()) {
        <div
          style="margin: 8px 0 16px; padding:8px 10px; border:1px dashed var(--color-border); font-size:12px; opacity:0.75;"
        >
          {{ 'settings.universeScopeNotice' | translate }}
        </div>
      }

      <div style="display:grid; gap:12px; max-width: 520px;">
        @for (app of apps; track app.id) {
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <label style="display:flex; align-items:center; gap:8px;">
              <input
                type="checkbox"
                [checked]="!isDisabled(app.id)"
                (change)="toggleApp(app.id, $event)"
              />
              <span>{{ 'settings.enableAppLabel' | translate }}</span>
              <span>{{ app.icon }}</span>
              {{
                app.id === 'navigator'
                  ? ('settings.navigatorBeta' | translate)
                  : app.id === 'calendar'
                    ? ('settings.calendarBeta' | translate)
                    : (app.labelKey | translate)
              }}
            </label>
            <button (click)="confirmWipe(app.id)">
              {{ 'settings.wipeApp' | translate }}
            </button>
          </div>
        }
      </div>

      <div style="margin-top: 16px; display:flex; flex-direction:column; gap:8px;">
        <button (click)="openResetAll()">{{ 'settings.resetAllApps' | translate }}</button>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button (click)="exportData('json')">{{ 'settings.exportAppsJson' | translate }}</button>
          <button (click)="exportData('xml')">{{ 'settings.exportAppsXml' | translate }}</button>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <label style="display:flex; gap:8px; align-items:center;">
            {{ 'settings.importAppsJson' | translate }}
            <input type="file" accept="application/json" (change)="onImportFile($event, 'json')" />
          </label>
          <label style="display:flex; gap:8px; align-items:center;">
            {{ 'settings.importAppsXml' | translate }}
            <input
              type="file"
              accept="application/xml,text/xml"
              (change)="onImportFile($event, 'xml')"
            />
          </label>
        </div>
        @if (importStatus() === 'loading') {
          <div style="opacity:0.7;">{{ 'dialogs.importing' | translate }}</div>
        } @else if (importStatus() === 'success') {
          <div style="color:#1b5e20;">{{ 'dialogs.importSuccess' | translate }}</div>
        } @else if (importStatus() === 'error') {
          <div style="color:#b00020;">{{ importMessage() ?? '' | translate }}</div>
        }
      </div>

      @if (confirmAppId()) {
        <app-confirm-dialog
          [message]="'settings.wipeConfirm' | translate"
          [confirmLabel]="'settings.wipeConfirmButton' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="wipeConfirmed()"
          (canceled)="confirmAppId.set(null)"
        />
      }

      @if (resetAllOpen()) {
        <app-confirm-dialog
          [message]="'settings.resetAllConfirm' | translate"
          [confirmLabel]="'settings.resetAllConfirmButton' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="resetAllConfirmed()"
          (canceled)="resetAllOpen.set(false)"
        />
      }
      @if (pendingImport()) {
        <app-confirm-dialog
          [title]="'dialogs.importTitle' | translate"
          [message]="'dialogs.importConfirm' | translate"
          [confirmLabel]="'dialogs.confirm' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="confirmImport()"
          (canceled)="cancelImport()"
        />
      }
      @if (importLimitOpen()) {
        <app-confirm-dialog
          [message]="'dialogs.importLimit' | translate"
          [confirmLabel]="'dialogs.ok' | translate"
          [showCancel]="false"
          (confirmed)="importLimitOpen.set(false)"
        />
      }
      @if (exportLimitOpen()) {
        <app-confirm-dialog
          [message]="'dialogs.exportLimit' | translate"
          [confirmLabel]="'dialogs.ok' | translate"
          [showCancel]="false"
          (confirmed)="exportLimitOpen.set(false)"
        />
      }
    </section>
  `,
})
export class ApplicationsSettingsComponent {
  private draft = inject(SettingsDraftService);
  private dialogService = inject(DialogService);
  private auth = inject(AuthService);
  private importGuard = inject(ImportGuardService);
  private exportGuard = inject(ExportGuardService);

  apps = APPLICATIONS;
  prefs = signal(this.draft.preferences());
  confirmAppId = signal<AppId | null>(null);
  resetAllOpen = signal(false);
  pendingImport = signal<{
    file: File;
    format: 'json' | 'xml';
    input: HTMLInputElement;
  } | null>(null);
  importStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  importMessage = signal<string | null>(null);
  importLimitOpen = signal(false);
  exportLimitOpen = signal(false);
  showUniverseNotice = computed(() => {
    const ownerId = this.auth.actualUser()?.id ?? null;
    if (!ownerId) return false;
    return this.auth.getUniversesForUser(ownerId).length > 1;
  });

  constructor() {
    effect(() => {
      this.prefs.set(this.draft.preferences());
    });
  }

  isDisabled(appId: AppId) {
    return this.prefs().disabledApps?.includes(appId) ?? false;
  }

  toggleApp(appId: AppId, event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    const disabled = new Set(this.prefs().disabledApps ?? []);
    if (enabled) {
      disabled.delete(appId);
    } else {
      disabled.add(appId);
    }
    this.save({ ...this.prefs(), disabledApps: Array.from(disabled) });
  }

  confirmWipe(appId: AppId) {
    this.confirmAppId.set(appId);
  }

  wipeConfirmed() {
    const appId = this.confirmAppId();
    if (!appId) return;
    const removedIds = this.dialogService.wipeAppData(appId);
    removedIds.forEach((id) => {
      if (appId === 'calculator') clearCalculatorState(id);
      if (appId === 'timer') clearTimerState(id);
      if (appId === 'navigator') clearNavigatorState(id);
      if (appId === 'notes') clearNotesState(id);
      if (appId === 'stickyNotes') clearStickyNoteState(id);
      if (appId === 'calendar') clearCalendarState(id);
      if (appId === 'clock') clearClockState(id);
      if (appId === 'kanban') clearKanbanState(id);
      if (appId === 'dataTable') clearDataTableState(id);
    });
    this.confirmAppId.set(null);
  }

  openResetAll() {
    this.resetAllOpen.set(true);
  }

  resetAllConfirmed() {
    const userId = this.effectiveUserId();
    this.dialogService.resetForUser(userId);
    this.clearAppStorage(userId);
    this.resetAllOpen.set(false);
  }

  exportData(format: 'json' | 'xml') {
    if (!this.exportGuard.start()) {
      this.exportLimitOpen.set(true);
      return;
    }
    const userId = this.effectiveUserId();
    const payload = this.collectAppData(userId);
    const text = format === 'xml' ? this.toXml(payload) : JSON.stringify(payload, null, 2);
    const blob = new Blob([text], {
      type: format === 'xml' ? 'application/xml' : 'application/json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `operator-app-data.${format}`;
    link.click();
    URL.revokeObjectURL(link.href);
    window.setTimeout(() => this.exportGuard.finish(), 500);
  }

  onImportFile(event: Event, format: 'json' | 'xml') {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const input = event.target as HTMLInputElement;
    this.importStatus.set('idle');
    this.importMessage.set(null);
    this.pendingImport.set({ file, format, input });
  }

  cancelImport() {
    const pending = this.pendingImport();
    if (pending) pending.input.value = '';
    this.pendingImport.set(null);
    this.importStatus.set('idle');
    this.importMessage.set(null);
  }

  confirmImport() {
    const pending = this.pendingImport();
    if (!pending) return;
    if (!this.importGuard.start()) {
      this.importLimitOpen.set(true);
      return;
    }
    this.importStatus.set('loading');
    this.importMessage.set('dialogs.importing');
    this.pendingImport.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const payload = pending.format === 'xml' ? this.fromXml(text) : JSON.parse(text || '{}');
        const ok = this.applyImportedData(payload);
        if (!ok) {
          this.importStatus.set('error');
          this.importMessage.set('dialogs.importFailed');
        } else {
          this.importStatus.set('success');
          this.importMessage.set('dialogs.importSuccess');
        }
      } catch {
        this.importStatus.set('error');
        this.importMessage.set('dialogs.importFailed');
      } finally {
        pending.input.value = '';
        this.importGuard.finish();
      }
    };
    reader.onerror = () => {
      this.importStatus.set('error');
      this.importMessage.set('dialogs.importFailed');
      pending.input.value = '';
      this.importGuard.finish();
    };
    reader.readAsText(pending.file);
  }

  private effectiveUserId() {
    return this.auth.storageUserKey();
  }

  private clearAppStorage(userId: string) {
    if (typeof window === 'undefined') return;
    Object.keys(window.localStorage)
      .filter(
        (key) =>
          key.startsWith('op_app_state:') ||
          key.startsWith('op_mock_todos:') ||
          key.startsWith('op_dialog_state_v1:') ||
          key.startsWith('op_preview_dialog_state_v1:'),
      )
      .filter((key) => key.includes(`:${userId}`))
      .forEach((key) => window.localStorage.removeItem(key));
  }

  private collectAppData(userId: string) {
    if (typeof window === 'undefined') return { version: 1, userId, entries: [] };
    const entries = Object.keys(window.localStorage)
      .filter(
        (key) =>
          key.startsWith('op_app_state:') ||
          key.startsWith('op_mock_todos:') ||
          key.startsWith('op_dialog_state_v1:') ||
          key.startsWith('op_preview_dialog_state_v1:'),
      )
      .filter((key) => key.includes(`:${userId}`))
      .map((key) => ({ key, value: window.localStorage.getItem(key) ?? '' }));
    return { version: 1, userId, entries };
  }

  private applyImportedData(payload: {
    version?: number;
    userId?: string;
    entries?: { key?: string; value?: string }[];
  }) {
    if (!payload?.entries || !Array.isArray(payload.entries)) {
      return false;
    }
    const userId = this.effectiveUserId();
    payload.entries.forEach((entry) => {
      if (!entry?.key || typeof entry.value !== 'string') return;
      const key = this.rewriteKey(entry.key, payload.userId, userId);
      if (!this.isAllowedKey(key, userId)) return;
      window.localStorage.setItem(key, entry.value);
    });
    return true;
  }

  private rewriteKey(key: string, sourceUserId: string | undefined, targetUserId: string) {
    if (!sourceUserId) return key;
    return key.replace(`:${sourceUserId}`, `:${targetUserId}`);
  }

  private isAllowedKey(key: string, userId: string) {
    if (!key.includes(`:${userId}`)) return false;
    return (
      key.startsWith('op_app_state:') ||
      key.startsWith('op_mock_todos:') ||
      key.startsWith('op_dialog_state_v1:') ||
      key.startsWith('op_preview_dialog_state_v1:')
    );
  }

  private toXml(payload: {
    version: number;
    userId: string;
    entries: { key: string; value: string }[];
  }) {
    const entries = payload.entries
      .map(
        (entry) => `<entry key="${this.escapeXml(entry.key)}"><![CDATA[${entry.value}]]></entry>`,
      )
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<appData version="${payload.version}" userId="${this.escapeXml(payload.userId)}"><entries>${entries}</entries></appData>`;
  }

  private fromXml(text: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const root = doc.querySelector('appData');
    const userId = root?.getAttribute('userId') ?? undefined;
    const entries = Array.from(doc.querySelectorAll('entry')).map((entry) => ({
      key: entry.getAttribute('key') ?? '',
      value: entry.textContent ?? '',
    }));
    return { version: 1, userId, entries };
  }

  private escapeXml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  private save(next: UserPreferences) {
    this.prefs.set(next);
    this.draft.updatePreferences(next);
  }
}
