import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { UsersSettingsComponent } from './users/users.component';
import { PreferencesSettingsComponent } from './preferences/preferences.component';
import { ApplicationsSettingsComponent } from './applications/applications.component';
import { AdminSettingsComponent } from './admin/admin.component';
import { SettingsDraftService } from './settings-draft.service';
import { AboutComponent } from '../about/about.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    UsersSettingsComponent,
    PreferencesSettingsComponent,
    ApplicationsSettingsComponent,
    AdminSettingsComponent,
    AboutComponent,
  ],
  template: `
    <section>
      <div
        style="position:sticky; top:0; display:flex; justify-content:flex-end; gap:8px; padding:0 48px 8px 0; background:var(--color-surface); z-index:2;"
      >
        <button (click)="apply()" [disabled]="!draft.dirty()">
          {{ 'settings.apply' | translate }}
        </button>
        @if (draft.dirty()) {
          <button (click)="cancel()">{{ 'settings.cancelChanges' | translate }}</button>
        }
      </div>

      <h2 style="margin:0 0 8px;">{{ 'settings.title' | translate }}</h2>

      <nav style="margin: 16px 0; display:flex; gap:12px;">
        @if (auth.isAdmin()) {
          <button (click)="selectTab('admin')">{{ 'settings.adminLink' | translate }}</button>
        }
        <button (click)="selectTab('preferences')">
          {{ 'settings.preferencesLink' | translate }}
        </button>
        <button (click)="selectTab('applications')">
          {{ 'settings.applicationsLink' | translate }}
        </button>
        <button (click)="selectTab('users')">{{ 'settings.usersLink' | translate }}</button>
      </nav>

      @if (auth.isAdmin() && previewCandidates().length) {
        <section style="margin-bottom: 16px; padding: 12px; border: 1px solid var(--color-border);">
          <h3 style="margin: 0 0 8px;">{{ 'settings.previewTitle' | translate }}</h3>
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

      @if (tab() === 'admin') {
        <app-admin-settings />
      }
      @if (tab() === 'preferences') {
        <app-preferences-settings />
      }
      @if (tab() === 'applications') {
        <app-applications-settings />
      }
      @if (tab() === 'users') {
        <app-users-settings />
      }

      <div style="margin-top: 24px; border-top:1px solid var(--color-border); padding-top:12px;">
        <button (click)="aboutOpen.set(!aboutOpen())">{{ 'nav.about' | translate }}</button>
        <div
          [style.maxHeight]="aboutOpen() ? '240px' : '0'"
          [style.opacity]="aboutOpen() ? 1 : 0"
          style="overflow:hidden; transition:max-height 180ms ease, opacity 180ms ease; margin-top:8px;"
        >
          <app-about />
        </div>
      </div>
    </section>
  `,
})
export class SettingsComponent {
  readonly auth = inject(AuthService);
  readonly draft = inject(SettingsDraftService);
  aboutOpen = signal(false);
  tab = signal<'users' | 'preferences' | 'applications' | 'admin'>(
    this.auth.isAdmin() ? 'admin' : 'preferences',
  );

  constructor() {
    this.draft.start();
  }

  users() {
    return this.auth.users();
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

  apply() {
    if (!this.draft.dirty()) return;
    this.draft.apply();
  }

  cancel() {
    if (!this.draft.dirty() && !this.draft.applied()) return;
    this.draft.cancel();
  }

  selectTab(next: 'users' | 'preferences' | 'applications' | 'admin') {
    this.tab.set(next);
    this.aboutOpen.set(false);
  }
}
