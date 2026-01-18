import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { UsersSettingsComponent } from './users/users.component';
import { PreferencesSettingsComponent } from './preferences/preferences.component';
import { ApplicationsSettingsComponent } from './applications/applications.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    UsersSettingsComponent,
    PreferencesSettingsComponent,
    ApplicationsSettingsComponent,
  ],
  template: `
    <section>
      <h2 style="margin:0 0 8px;">{{ 'settings.title' | translate }}</h2>

      <nav style="margin: 16px 0; display:flex; gap:12px;">
        <button (click)="tab.set('preferences')">
          {{ 'settings.preferencesLink' | translate }}
        </button>
        <button (click)="tab.set('applications')">
          {{ 'settings.applicationsLink' | translate }}
        </button>
        <button (click)="tab.set('users')">{{ 'settings.usersLink' | translate }}</button>
      </nav>

      @if (auth.isAdmin() && previewCandidates().length) {
        <section style="margin-bottom: 16px; padding: 12px; border: 1px solid #ddd;">
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

      @if (tab() === 'preferences') {
        <app-preferences-settings />
      }
      @if (tab() === 'applications') {
        <app-applications-settings />
      }
      @if (tab() === 'users') {
        <app-users-settings />
      }
    </section>
  `,
})
export class SettingsComponent {
  readonly auth = inject(AuthService);
  tab = signal<'users' | 'preferences' | 'applications'>('preferences');

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
}
