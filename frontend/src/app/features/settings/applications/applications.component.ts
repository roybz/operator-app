import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, UserPreferences } from '../../../core/auth.service';
import { DialogService } from '../../../core/dialog.service';
import { AppId } from '../../dependencies/app-types';
import { APP_LIST } from '../../dependencies/app-registry';
import { clearCalculatorState } from '../../applications/calculator/calculator.component';
import { clearTimerState } from '../../applications/timer/timer.component';
import { clearNavigatorState } from '../../applications/navigator/navigator.component';
import { clearNotesState } from '../../applications/notes/notes.component';
import { clearCalendarState } from '../../applications/calendar/calendar.component';
import { clearClockState } from '../../applications/clock/clock.component';
import { clearKanbanState } from '../../applications/kanban/kanban.component';
import { SettingsDraftService } from '../settings-draft.service';

const APPLICATIONS = APP_LIST;

@Component({
  selector: 'app-applications-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <section>
      <h3>{{ 'settings.applicationsTitle' | translate }}</h3>

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
        @if (importError()) {
          <div style="color:#b00020;">{{ importError() ?? '' | translate }}</div>
        }
      </div>

      @if (confirmAppId()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:3000;"
        >
          <div
            style="background:var(--color-surface); padding:20px; border-radius:8px; width:320px;"
          >
            <p>{{ 'settings.wipeConfirm' | translate }}</p>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
              <button (click)="confirmAppId.set(null)">{{ 'dialogs.cancel' | translate }}</button>
              <button (click)="wipeConfirmed()">
                {{ 'settings.wipeConfirmButton' | translate }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (resetAllOpen()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:3000;"
        >
          <div
            style="background:var(--color-surface); padding:20px; border-radius:8px; width:360px;"
          >
            <p>{{ 'settings.resetAllConfirm' | translate }}</p>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
              <button (click)="resetAllOpen.set(false)">{{ 'dialogs.cancel' | translate }}</button>
              <button (click)="resetAllConfirmed()">
                {{ 'settings.resetAllConfirmButton' | translate }}
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class ApplicationsSettingsComponent {
  private draft = inject(SettingsDraftService);
  private dialogService = inject(DialogService);
  private auth = inject(AuthService);

  apps = APPLICATIONS;
  prefs = signal(this.draft.preferences());
  confirmAppId = signal<AppId | null>(null);
  resetAllOpen = signal(false);
  importError = signal<string | null>(null);

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
      if (appId === 'calendar') clearCalendarState(id);
      if (appId === 'clock') clearClockState(id);
      if (appId === 'kanban') clearKanbanState(id);
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
  }

  onImportFile(event: Event, format: 'json' | 'xml') {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importError.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const payload = format === 'xml' ? this.fromXml(text) : JSON.parse(text);
        this.applyImportedData(payload);
      } catch {
        this.importError.set('settings.importFailed');
      }
    };
    reader.readAsText(file);
  }

  private effectiveUserId() {
    return this.auth.session().previewUserId ?? this.auth.session().userId ?? 'guest';
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
      this.importError.set('settings.importFailed');
      return;
    }
    const userId = this.effectiveUserId();
    payload.entries.forEach((entry) => {
      if (!entry?.key || typeof entry.value !== 'string') return;
      const key = this.rewriteKey(entry.key, payload.userId, userId);
      if (!this.isAllowedKey(key, userId)) return;
      window.localStorage.setItem(key, entry.value);
    });
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
