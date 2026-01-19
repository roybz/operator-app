import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth.service';
import { DialogService } from '../../../core/dialog.service';
import { SettingsDraftService } from '../settings-draft.service';

const LOGO_OPTIONS = ['🌎', '🌍', '🌏', '🧭', '🗺️', '✨', '📌'];

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
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
          <span class="admin-info">
            i
            <span class="admin-info__tooltip">{{ 'admin.testModeInfo' | translate }}</span>
          </span>
        </label>

        <label>
          {{ 'admin.defaultViewport' | translate }}
          <div style="display:flex; gap:8px; align-items:center;">
            <input
              type="number"
              min="1024"
              max="7680"
              [value]="org().defaultViewportWidth"
              (input)="onViewportWidth($event)"
              style="width:120px;"
            />
            <span>×</span>
            <input
              type="number"
              min="768"
              max="4320"
              [value]="org().defaultViewportHeight"
              (input)="onViewportHeight($event)"
              style="width:120px;"
            />
          </div>
        </label>

        <button (click)="applyViewportToAll()">
          {{ 'admin.applyViewportAll' | translate }}
        </button>

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
        </label>
      </div>
    </section>
  `,
  styles: [
    `
      .admin-info {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 1px solid var(--color-border);
        font-size: 12px;
        cursor: help;
      }

      .admin-info__tooltip {
        position: absolute;
        right: 0;
        top: 22px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 11px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 120ms ease;
        z-index: 3001;
      }

      .admin-info:hover .admin-info__tooltip {
        opacity: 1;
      }
    `,
  ],
})
export class AdminSettingsComponent {
  private auth = inject(AuthService);
  private draft = inject(SettingsDraftService);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  logoOptions = LOGO_OPTIONS;
  backendConnected = this.auth.isBackendConnected();

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

  onViewportWidth(event: Event) {
    const raw = Number((event.target as HTMLInputElement).value);
    const defaultViewportWidth = Math.min(7680, Math.max(1024, Number.isFinite(raw) ? raw : 1920));
    this.draft.updateOrgSettings({ ...this.org(), defaultViewportWidth });
  }

  onViewportHeight(event: Event) {
    const raw = Number((event.target as HTMLInputElement).value);
    const defaultViewportHeight = Math.min(4320, Math.max(768, Number.isFinite(raw) ? raw : 1080));
    this.draft.updateOrgSettings({ ...this.org(), defaultViewportHeight });
  }

  applyViewportToAll() {
    this.auth.updateAllUserViewports(
      this.org().defaultViewportWidth,
      this.org().defaultViewportHeight,
    );
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
    const confirmed = window.confirm(this.translate.instant('admin.wipeGuestConfirm'));
    if (!confirmed) return;
    this.auth.resetGuestAccount();
    this.dialogService.resetForUser('u_guest');
  }

  onAllowServerBackground(event: Event) {
    const allowServerBackground = (event.target as HTMLInputElement).checked;
    this.draft.updateOrgSettings({ ...this.org(), allowServerBackground });
  }
}
