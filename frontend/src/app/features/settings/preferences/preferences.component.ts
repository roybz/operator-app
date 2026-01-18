import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, SavedCredential, UserPreferences } from '../../../core/auth.service';

const CITY_OPTIONS = [
  { city: 'New York', timeZone: 'America/New_York' },
  { city: 'London', timeZone: 'Europe/London' },
  { city: 'Paris', timeZone: 'Europe/Paris' },
  { city: 'Madrid', timeZone: 'Europe/Madrid' },
  { city: 'Tokyo', timeZone: 'Asia/Tokyo' },
  { city: 'Singapore', timeZone: 'Asia/Singapore' },
  { city: 'Sydney', timeZone: 'Australia/Sydney' },
];

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
];

@Component({
  selector: 'app-preferences-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <section>
      <h3>{{ 'preferences.title' | translate }}</h3>

      <div style="display:grid; gap:12px; max-width: 520px;">
        <label>
          {{ 'preferences.language' | translate }}
          <select [value]="prefs().language" (change)="onLanguageChange($event)">
            @for (option of languageOptions; track option.code) {
              <option [value]="option.code">{{ option.label }}</option>
            }
          </select>
        </label>

        <label>
          {{ 'preferences.city' | translate }}
          <select [value]="prefs().city" (change)="onCityChange($event)">
            @for (option of cityOptions; track option.city) {
              <option [value]="option.city">
                {{ option.city }} ({{ offsetLabel(option.timeZone) }})
              </option>
            }
          </select>
        </label>

        <label>
          {{ 'preferences.timeZone' | translate }}
          <input type="text" [value]="prefs().timeZone" readonly />
        </label>

        <label style="display:flex; gap:8px; align-items:center;">
          <input type="checkbox" [checked]="prefs().showTime" (change)="onToggleTime($event)" />
          {{ 'preferences.showTime' | translate }}
        </label>

        @if (prefs().showTime) {
          <label>
            {{ 'preferences.timeFormat' | translate }}
            <select [value]="prefs().timeFormat" (change)="onTimeFormatChange($event)">
              <option value="12h">{{ 'preferences.timeFormat12' | translate }}</option>
              <option value="24h">{{ 'preferences.timeFormat24' | translate }}</option>
            </select>
          </label>
        }
      </div>

      <section style="margin-top: 24px;">
        <h4>{{ 'preferences.credentialsTitle' | translate }}</h4>

        <div style="display:grid; gap:12px; max-width: 520px;">
          @for (credential of prefs().credentials; track $index) {
            <div style="border:1px solid #ddd; padding:12px;">
              <label style="display:block; margin-bottom: 6px;">
                {{ 'preferences.credentialLabel' | translate }}
              </label>
              <input
                type="text"
                [value]="credential.label"
                (input)="updateCredential(credential, 'label', $event)"
                style="width:100%; padding:8px;"
              />

              <label style="display:block; margin: 8px 0 6px;">
                {{ 'preferences.credentialUsername' | translate }}
              </label>
              <input
                type="text"
                [value]="credential.username ?? ''"
                (input)="updateCredential(credential, 'username', $event)"
                style="width:100%; padding:8px;"
              />

              <label style="display:block; margin: 8px 0 6px;">
                {{ 'preferences.credentialPassword' | translate }}
              </label>
              <input
                type="password"
                [value]="credential.password ?? ''"
                (input)="updateCredential(credential, 'password', $event)"
                style="width:100%; padding:8px;"
              />

              <button style="margin-top: 10px;" (click)="removeCredential(credential)">
                {{ 'preferences.credentialDelete' | translate }}
              </button>
            </div>
          }
        </div>

        <button style="margin-top: 12px;" (click)="addCredential()">
          {{ 'preferences.credentialAdd' | translate }}
        </button>
      </section>
    </section>
  `,
})
export class PreferencesSettingsComponent {
  languageOptions = LANGUAGE_OPTIONS;
  cityOptions = CITY_OPTIONS;
  prefs = signal<UserPreferences>({
    language: 'en',
    city: '',
    timeZone: 'UTC',
    showTime: true,
    timeFormat: '12h',
    credentials: [],
  });

  constructor(private auth: AuthService) {
    this.prefs.set(this.auth.preferences());
    effect(() => {
      this.prefs.set(this.auth.preferences());
    });
  }

  onLanguageChange(event: Event) {
    const language = (event.target as HTMLSelectElement).value;
    this.save({ ...this.prefs(), language });
  }

  onCityChange(event: Event) {
    const city = (event.target as HTMLSelectElement).value;
    const match = CITY_OPTIONS.find((option) => option.city === city);
    if (!match) return;
    this.save({ ...this.prefs(), city: match.city, timeZone: match.timeZone });
  }

  onToggleTime(event: Event) {
    const showTime = (event.target as HTMLInputElement).checked;
    this.save({ ...this.prefs(), showTime });
  }

  onTimeFormatChange(event: Event) {
    const timeFormat = (event.target as HTMLSelectElement).value as '12h' | '24h';
    this.save({ ...this.prefs(), timeFormat });
  }

  addCredential() {
    const next = [...this.prefs().credentials, { label: '' }];
    this.save({ ...this.prefs(), credentials: next });
  }

  updateCredential(credential: SavedCredential, key: keyof SavedCredential, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const next = this.prefs().credentials.map((item) =>
      item === credential ? { ...item, [key]: value } : item,
    );
    this.save({ ...this.prefs(), credentials: next });
  }

  removeCredential(credential: SavedCredential) {
    const next = this.prefs().credentials.filter((item) => item !== credential);
    this.save({ ...this.prefs(), credentials: next });
  }

  offsetLabel(timeZone: string) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
      }).formatToParts(new Date());
      return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private save(next: UserPreferences) {
    this.prefs.set(next);
    this.auth.savePreferences(next);
  }
}
