import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, TranslateModule],
  template: `
    <section>
      <h2>{{ 'settings.title' | translate }}</h2>

      <nav style="margin-bottom: 16px; display:flex; gap:12px;">
        <a routerLink="/settings/users">{{ 'settings.usersLink' | translate }}</a>
        <a routerLink="/settings/preferences">{{ 'settings.preferencesLink' | translate }}</a>
      </nav>

      @if (auth.isAdmin()) {
        <section style="margin-bottom: 16px; padding: 12px; border: 1px solid #ddd;">
          <h3 style="margin: 0 0 8px;">{{ 'settings.previewTitle' | translate }}</h3>
          <label style="display:block; margin-bottom: 6px;">
            {{ 'settings.previewAs' | translate }}
          </label>
          <select
            [value]="auth.session().previewUserId ?? ''"
            (change)="onPreviewChange($event)"
            style="padding:8px;"
          >
            <option value="">{{ 'settings.previewNone' | translate }}</option>
            @for (user of users(); track user.id) {
              <option [value]="user.id">{{ user.username }}</option>
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

      <router-outlet />
    </section>
  `,
})
export class SettingsComponent {
  constructor(public auth: AuthService) {}

  users() {
    return this.auth.users();
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
