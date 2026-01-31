import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { InfoTooltipComponent } from '../../../shared/info-tooltip/info-tooltip.component';
import { AuthService, UserPreferences } from '../../../core/auth.service';
import { DialogService } from '../../../core/dialog.service';
import { SettingsDraftService } from '../settings-draft.service';

const LOGO_OPTIONS = ['🌎', '🌍', '🌏', '🧭', '🗺️', '✨', '📌'];

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmDialogComponent, InfoTooltipComponent],
  template: `
    <section>
      <h3>{{ 'admin.title' | translate }}</h3>

      <div style="display:grid; gap:12px; max-width: 520px;">
        <label>
          {{ 'admin.siteTitle' | translate }}
          <input type="text" [value]="org().siteTitle" (input)="onTitleInput($event)" />
        </label>

        <label>
          {{ 'admin.siteLogo' | translate }}
          <select [value]="org().siteLogoEmoji" (change)="onLogoChange($event)">
            <option value="">{{ 'admin.siteLogoNone' | translate }}</option>
            @for (emoji of logoOptions; track emoji) {
              <option [value]="emoji">{{ emoji }}</option>
            }
          </select>
        </label>

        <label style="display:flex; gap:8px; align-items:center;">
          <input
            type="checkbox"
            [checked]="org().testModeEnabled"
            [disabled]="!backendConnected"
            (change)="onTestModeToggle($event)"
          />
          {{ 'admin.testMode' | translate }}
          <app-info-tooltip [text]="'admin.testModeInfo' | translate" />
        </label>

        @if (auth.isAdmin() && previewCandidates().length) {
          <section style="padding: 12px; border: 1px solid var(--color-border);">
            <h4 style="margin: 0 0 8px;">{{ 'settings.previewTitle' | translate }}</h4>
            <label for="preview-user" style="display:block; margin-bottom: 6px;">
              {{ 'settings.previewAs' | translate }}
            </label>
            <select
              id="preview-user"
              [value]="auth.session().previewUserId ?? ''"
              (change)="onPreviewChange($event)"
              style="padding:8px;"
            >
              <option value="" [selected]="!auth.session().previewUserId">
                {{ 'settings.previewNone' | translate }}
              </option>
              @for (user of previewCandidates(); track user.id) {
                <option [value]="user.id" [selected]="auth.session().previewUserId === user.id">
                  {{ user.username }}
                </option>
              }
            </select>

            @if (auth.isPreviewing()) {
              <label style="display:flex; gap:8px; align-items:center; margin-top: 10px;">
                <input
                  type="checkbox"
                  [checked]="auth.previewPersist()"
                  (change)="onPersistChange($event)"
                />
                {{ 'settings.previewPersist' | translate }}
              </label>
            }
          </section>
        }

        <label style="display:flex; gap:8px; align-items:center;">
          <input
            type="checkbox"
            [checked]="org().disableViewportSizing"
            (change)="onDisableViewportSizing($event)"
          />
          {{ 'admin.disableViewportSizing' | translate }}
        </label>

        <label style="display:flex; gap:8px; align-items:center;">
          <input
            type="checkbox"
            [checked]="org().disableZoomControls"
            (change)="onDisableZoomControls($event)"
          />
          {{ 'admin.disableZoomControls' | translate }}
        </label>

        <label style="display:flex; gap:8px; align-items:center;">
          <input
            type="checkbox"
            [checked]="org().allowGuestLogin"
            (change)="onAllowGuestLogin($event)"
          />
          {{ 'admin.allowGuestLogin' | translate }}
        </label>

        <button (click)="wipeGuestData()">
          {{ 'admin.wipeGuest' | translate }}
        </button>

        <label style="display:flex; gap:8px; align-items:center;">
          <input
            type="checkbox"
            [checked]="org().allowServerBackground"
            [disabled]="!backendConnected"
            (change)="onAllowServerBackground($event)"
          />
          {{ 'admin.allowServerBackground' | translate }}
          <app-info-tooltip [text]="'admin.allowServerBackgroundInfo' | translate" />
        </label>

        <label>
          {{ 'preferences.maxPersistedApps' | translate }}
          <input
            type="number"
            min="0"
            max="255"
            [value]="prefs().maxPersistedApps"
            (input)="onMaxPersistedChange($event)"
          />
        </label>
      </div>
      @if (confirmWipeGuest()) {
        <app-confirm-dialog
          [message]="'admin.wipeGuestConfirm' | translate"
          [confirmLabel]="'dialogs.confirm' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="confirmWipeGuestAction()"
          (canceled)="confirmWipeGuest.set(false)"
        />
      }
    </section>
  `,
  styles: [],
})
export class AdminSettingsComponent {
  auth = inject(AuthService);
  private draft = inject(SettingsDraftService);
  private dialogService = inject(DialogService);
  logoOptions = LOGO_OPTIONS;
  backendConnected = this.auth.isBackendConnected();
  prefs = signal<UserPreferences>(this.draft.preferences());
  confirmWipeGuest = signal(false);

  constructor() {
    effect(() => {
      this.prefs.set(this.draft.preferences());
    });
  }

  org() {
    return this.draft.orgSettings();
  }

  onTitleInput(event: Event) {
    const siteTitle = (event.target as HTMLInputElement).value.trim();
    this.draft.updateOrgSettings({ ...this.org(), siteTitle });
  }

  onLogoChange(event: Event) {
    const siteLogoEmoji = (event.target as HTMLSelectElement).value;
    this.draft.updateOrgSettings({ ...this.org(), siteLogoEmoji });
  }

  onTestModeToggle(event: Event) {
    const testModeEnabled = (event.target as HTMLInputElement).checked;
    this.draft.updateOrgSettings({ ...this.org(), testModeEnabled });
  }

  onDisableViewportSizing(event: Event) {
    const disableViewportSizing = (event.target as HTMLInputElement).checked;
    this.draft.updateOrgSettings({ ...this.org(), disableViewportSizing });
  }

  onDisableZoomControls(event: Event) {
    const disableZoomControls = (event.target as HTMLInputElement).checked;
    this.draft.updateOrgSettings({ ...this.org(), disableZoomControls });
  }

  onAllowGuestLogin(event: Event) {
    const allowGuestLogin = (event.target as HTMLInputElement).checked;
    this.draft.updateOrgSettings({ ...this.org(), allowGuestLogin });
  }

  wipeGuestData() {
    this.confirmWipeGuest.set(true);
  }

  confirmWipeGuestAction() {
    this.confirmWipeGuest.set(false);
    this.auth.resetGuestAccount();
    this.dialogService.resetForUser('u_guest');
  }

  onAllowServerBackground(event: Event) {
    const allowServerBackground = (event.target as HTMLInputElement).checked;
    this.draft.updateOrgSettings({ ...this.org(), allowServerBackground });
  }

  onMaxPersistedChange(event: Event) {
    const raw = Number((event.target as HTMLInputElement).value);
    const maxPersistedApps = Math.min(255, Math.max(0, Number.isFinite(raw) ? raw : 0));
    this.draft.updatePreferences({ ...this.prefs(), maxPersistedApps });
  }

  previewCandidates() {
    const actual = this.auth.actualUser()?.id;
    return this.auth.users().filter((user) => user.id !== actual);
  }

  onPreviewChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.auth.setPreviewUser(value || null);
  }

  onPersistChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.auth.setPreviewPersist(checked);
  }
}
