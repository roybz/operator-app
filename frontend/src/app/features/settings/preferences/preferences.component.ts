import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, SavedCredential, UserPreferences } from '../../../core/auth.service';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'uk', label: 'Українська' },
  { code: 'ar', label: 'العربية' },
  { code: 'fa', label: 'فارسی' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ur', label: 'اردو' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ha', label: 'Hausa' },
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
          <input type="text" maxlength="128" [value]="prefs().city" (input)="onCityInput($event)" />
        </label>

        <label>
          {{ 'preferences.timeZone' | translate }}
          <input
            type="text"
            list="timezone-list"
            [value]="prefs().timeZone"
            (input)="onTimeZoneInput($event)"
          />
          <datalist id="timezone-list">
            @for (zone of filteredTimeZones(); track zone) {
              <option [value]="zone">{{ zone }}</option>
            }
          </datalist>
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

        <label>
          {{ 'preferences.maxPersistedApps' | translate }}
          <input
            type="number"
            min="0"
            max="99"
            [value]="prefs().maxPersistedApps"
            (input)="onMaxPersistedChange($event)"
          />
        </label>

        <label>
          {{ 'preferences.backgroundImageUrl' | translate }}
          <input
            type="text"
            [value]="prefs().backgroundImageUrl"
            (input)="onBackgroundUrlChange($event)"
            placeholder="images/background.png"
          />
        </label>

        <label>
          {{ 'preferences.backgroundImageMode' | translate }}
          <select [value]="prefs().backgroundImageMode" (change)="onBackgroundModeChange($event)">
            <option value="repeat">{{ 'preferences.backgroundImageRepeat' | translate }}</option>
            <option value="center">{{ 'preferences.backgroundImageCenter' | translate }}</option>
            <option value="stretch">{{ 'preferences.backgroundImageStretch' | translate }}</option>
          </select>
        </label>

        <label style="display:flex; gap:8px; align-items:center;">
          <input type="checkbox" [checked]="prefs().showGrid" (change)="onToggleGrid($event)" />
          {{ 'preferences.showGrid' | translate }}
        </label>

        <label>
          {{ 'preferences.gridSize' | translate }}
          <input
            type="number"
            min="8"
            max="800"
            [value]="prefs().gridSize"
            (input)="onGridSizeChange($event)"
          />
        </label>
      </div>

      <section style="margin-top: 24px;">
        <h4>{{ 'preferences.credentialsTitle' | translate }}</h4>

        <div style="display:grid; gap:12px; max-width: 520px;">
          @for (credential of prefs().credentials; track $index; let idx = $index) {
            <div style="border:1px solid #ddd; padding:12px;">
              <label
                [attr.for]="'credential-label-' + idx"
                style="display:block; margin-bottom: 6px;"
              >
                {{ 'preferences.credentialLabel' | translate }}
              </label>
              <input
                [id]="'credential-label-' + idx"
                type="text"
                [value]="credential.label"
                (input)="updateCredential(credential, 'label', $event)"
                style="width:100%; padding:8px;"
              />

              <label
                [attr.for]="'credential-username-' + idx"
                style="display:block; margin: 8px 0 6px;"
              >
                {{ 'preferences.credentialUsername' | translate }}
              </label>
              <input
                [id]="'credential-username-' + idx"
                type="text"
                [value]="credential.username ?? ''"
                (input)="updateCredential(credential, 'username', $event)"
                style="width:100%; padding:8px;"
              />

              <label
                [attr.for]="'credential-password-' + idx"
                style="display:block; margin: 8px 0 6px;"
              >
                {{ 'preferences.credentialPassword' | translate }}
              </label>
              <input
                [id]="'credential-password-' + idx"
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
export class PreferencesSettingsComponent implements OnDestroy {
  private auth = inject(AuthService);
  languageOptions = LANGUAGE_OPTIONS;
  timeZoneOptions = signal<string[]>([]);
  private citySaveTimeout?: number;
  prefs = signal<UserPreferences>({
    language: '',
    city: '',
    timeZone: 'UTC',
    showTime: true,
    timeFormat: '12h',
    credentials: [],
    maxPersistedApps: 30,
    backgroundImageUrl: '',
    backgroundImageMode: 'repeat',
    showGrid: true,
    gridSize: 50,
  });

  constructor() {
    this.prefs.set(this.auth.preferences());
    effect(() => {
      this.prefs.set(this.auth.preferences());
    });
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      this.timeZoneOptions.set(Intl.supportedValuesOf('timeZone') as string[]);
    }
  }

  ngOnDestroy() {
    if (this.citySaveTimeout) {
      window.clearTimeout(this.citySaveTimeout);
      this.save(this.prefs());
    }
  }

  onLanguageChange(event: Event) {
    const language = (event.target as HTMLSelectElement).value;
    this.save({ ...this.prefs(), language });
  }

  onCityInput(event: Event) {
    const city = (event.target as HTMLInputElement).value.slice(0, 128);
    this.prefs.set({ ...this.prefs(), city });
    if (this.citySaveTimeout) window.clearTimeout(this.citySaveTimeout);
    this.citySaveTimeout = window.setTimeout(() => this.save(this.prefs()), 2000);
  }

  onTimeZoneInput(event: Event) {
    const timeZone = (event.target as HTMLInputElement).value;
    this.save({ ...this.prefs(), timeZone });
  }

  onToggleTime(event: Event) {
    const showTime = (event.target as HTMLInputElement).checked;
    this.save({ ...this.prefs(), showTime });
  }

  onTimeFormatChange(event: Event) {
    const timeFormat = (event.target as HTMLSelectElement).value as '12h' | '24h';
    this.save({ ...this.prefs(), timeFormat });
  }

  onMaxPersistedChange(event: Event) {
    const raw = Number((event.target as HTMLInputElement).value);
    const maxPersistedApps = Math.min(99, Math.max(0, Number.isFinite(raw) ? raw : 0));
    this.save({ ...this.prefs(), maxPersistedApps });
  }

  onBackgroundUrlChange(event: Event) {
    const backgroundImageUrl = (event.target as HTMLInputElement).value;
    this.save({ ...this.prefs(), backgroundImageUrl });
  }

  onBackgroundModeChange(event: Event) {
    const backgroundImageMode = (event.target as HTMLSelectElement).value as
      | 'repeat'
      | 'center'
      | 'stretch';
    this.save({ ...this.prefs(), backgroundImageMode });
  }

  onToggleGrid(event: Event) {
    const showGrid = (event.target as HTMLInputElement).checked;
    this.save({ ...this.prefs(), showGrid });
  }

  onGridSizeChange(event: Event) {
    const raw = Number((event.target as HTMLInputElement).value);
    const gridSize = Math.min(800, Math.max(8, Number.isFinite(raw) ? raw : 50));
    this.save({ ...this.prefs(), gridSize });
  }

  filteredTimeZones() {
    const query = this.prefs().timeZone.toLowerCase();
    if (!query) return this.timeZoneOptions().slice(0, 200);
    return this.timeZoneOptions()
      .filter((zone) => zone.toLowerCase().includes(query))
      .slice(0, 200);
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

  private save(next: UserPreferences) {
    this.prefs.set(next);
    this.auth.savePreferences(next);
  }
}
