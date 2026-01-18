import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, UserPreferences } from '../../../core/auth.service';
import { AppId, DialogService } from '../../../core/dialog.service';
import { clearCalculatorState } from '../../applications/calculator/calculator.component';
import { clearTimerState } from '../../applications/timer/timer.component';
import { clearNavigatorState } from '../../applications/navigator/navigator.component';
import { clearNotesState } from '../../applications/notes/notes.component';

const APPLICATIONS: { id: AppId; labelKey: string }[] = [
  { id: 'todo', labelKey: 'apps.todo' },
  { id: 'calculator', labelKey: 'apps.calculator' },
  { id: 'timer', labelKey: 'apps.timer' },
  { id: 'navigator', labelKey: 'apps.navigator' },
  { id: 'notes', labelKey: 'apps.notes' },
];

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
              {{
                app.id === 'navigator'
                  ? ('settings.navigatorBeta' | translate)
                  : app.id === 'notes'
                    ? ('settings.notesBeta' | translate)
                    : (app.labelKey | translate)
              }}
            </label>
            <button (click)="confirmWipe(app.id)">
              {{ 'settings.wipeApp' | translate }}
            </button>
          </div>
        }
      </div>

      @if (confirmAppId()) {
        <div
          style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index:3000;"
        >
          <div style="background:#fff; padding:20px; border-radius:8px; width:320px;">
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
    </section>
  `,
})
export class ApplicationsSettingsComponent {
  private auth = inject(AuthService);
  private dialogService = inject(DialogService);

  apps = APPLICATIONS;
  prefs = signal(this.auth.preferences());
  confirmAppId = signal<AppId | null>(null);

  constructor() {
    effect(() => {
      this.prefs.set(this.auth.preferences());
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
    });
    this.confirmAppId.set(null);
  }

  private save(next: UserPreferences) {
    this.prefs.set(next);
    this.auth.savePreferences(next);
  }
}
