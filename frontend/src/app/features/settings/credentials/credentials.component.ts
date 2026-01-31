import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SavedCredential, UserPreferences } from '../../../core/auth.service';
import { SettingsDraftService } from '../settings-draft.service';

@Component({
  selector: 'app-credentials-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <section>
      <h3>{{ 'settings.credentialsLink' | translate }}</h3>

      <section style="margin-top: 12px;">
        <h4 style="display:flex; align-items:center; gap:8px; margin:0 0 8px;">
          {{ 'preferences.credentialsTitle' | translate }}
          <span class="credentials-info">
            i
            <span class="credentials-info__tooltip">
              {{ 'settings.credentialsInfo' | translate }}
            </span>
          </span>
        </h4>

        <fieldset disabled style="border:none; padding:0; margin:0; opacity:0.6;">
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
        </fieldset>
      </section>
    </section>
  `,
  styles: [
    `
      .credentials-info {
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

      .credentials-info__tooltip {
        position: absolute;
        left: 22px;
        top: -4px;
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

      .credentials-info:hover .credentials-info__tooltip {
        opacity: 1;
      }
    `,
  ],
})
export class CredentialsSettingsComponent {
  private draft = inject(SettingsDraftService);
  prefs = signal<UserPreferences>(this.draft.preferences());

  constructor() {
    effect(() => {
      this.prefs.set(this.draft.preferences());
    });
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
    this.draft.updatePreferences(next);
  }
}
