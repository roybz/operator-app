import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { InfoTooltipComponent } from '../../../shared/info-tooltip/info-tooltip.component';
import { SavedCredential, UserPreferences } from '../../../core/auth.service';
import { SettingsDraftService } from '../settings-draft.service';
import { LlmCredentialRefService } from '../../../core/llm/llm-credential-ref.service';
import { LlmCredentialMode, LlmProvider } from '../../../core/llm/llm-types';

@Component({
  selector: 'app-credentials-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, InfoTooltipComponent],
  template: `
    <section>
      <h3>{{ 'settings.credentialsLink' | translate }}</h3>

      <section style="margin-top: 12px;">
        <h4 style="display:flex; align-items:center; gap:8px; margin:0 0 8px;">
          {{ 'preferences.credentialsTitle' | translate }}
          <app-info-tooltip [text]="'settings.credentialsInfo' | translate" />
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

      <section style="margin-top: 20px; max-width: 640px;">
        <h4 style="margin:0 0 8px;">LLM resident credentials (beta)</h4>
        <p style="margin:0 0 12px; opacity:0.75;">
          Secrets are kept in-session only. Stored records are metadata-only.
        </p>

        @if (error()) {
          <p style="color:#b00020; margin:0 0 10px;">{{ error() }}</p>
        }
        @if (notice()) {
          <p style="color:#00695c; margin:0 0 10px;">{{ notice() }}</p>
        }

        <div style="display:grid; gap:8px; grid-template-columns: repeat(2, minmax(180px, 1fr));">
          <label>
            Alias
            <input
              type="text"
              [value]="draftAlias()"
              (input)="draftAlias.set($any($event.target).value)"
              style="width:100%; padding:8px;"
            />
          </label>
          <label>
            Provider
            <select
              [value]="draftProvider()"
              (change)="draftProvider.set($any($event.target).value)"
              style="width:100%; padding:8px;"
            >
              @for (provider of providers; track provider) {
                <option [value]="provider">{{ provider }}</option>
              }
            </select>
          </label>
          <label>
            Mode
            <select
              [value]="draftMode()"
              (change)="draftMode.set($any($event.target).value)"
              style="width:100%; padding:8px;"
            >
              <option value="clientHeld">Client-held (session secret)</option>
              <option value="serverHeld">Server-held broker (beta)</option>
            </select>
          </label>
          <label style="grid-column: 1 / -1;">
            Model (optional)
            <input
              type="text"
              [value]="draftModel()"
              (input)="draftModel.set($any($event.target).value)"
              style="width:100%; padding:8px;"
            />
          </label>
          @if (draftMode() === 'clientHeld') {
            <label style="grid-column: 1 / -1;">
              Session secret
              <input
                type="password"
                [value]="draftSecret()"
                (input)="draftSecret.set($any($event.target).value)"
                style="width:100%; padding:8px;"
              />
            </label>
          }
        </div>

        <button style="margin-top:12px;" (click)="addLlmCredential()">
          Save LLM credential ref
        </button>

        <div style="display:grid; gap:10px; margin-top:12px;">
          @for (item of llmRefs(); track item.id) {
            <div style="border:1px solid #ddd; border-radius:8px; padding:10px;">
              <div
                style="display:flex; align-items:center; justify-content:space-between; gap:8px;"
              >
                <strong>{{ item.alias }}</strong>
                <small>{{ item.provider }} | {{ item.status }}</small>
              </div>
              @if (item.model) {
                <div style="margin-top:4px; opacity:0.8;">Model: {{ item.model }}</div>
              }
              <div style="display:flex; gap:8px; margin-top:10px;">
                <button (click)="setSessionSecret(item.id)">Set session secret</button>
                <button (click)="removeRef(item.id)">Delete</button>
              </div>
            </div>
          }
        </div>
      </section>
    </section>
  `,
  styles: [],
})
export class CredentialsSettingsComponent {
  private readonly draft = inject(SettingsDraftService);
  private readonly llmCredentialRefs = inject(LlmCredentialRefService);

  readonly prefs = signal<UserPreferences>(this.draft.preferences());
  readonly providers: LlmProvider[] = ['openai', 'anthropic', 'ollama', 'custom'];

  readonly llmRefs = signal<Awaited<ReturnType<LlmCredentialRefService['listForCurrentUser']>>>([]);
  readonly draftAlias = signal('');
  readonly draftProvider = signal<LlmProvider>('openai');
  readonly draftMode = signal<LlmCredentialMode>('clientHeld');
  readonly draftModel = signal('');
  readonly draftSecret = signal('');
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.prefs.set(this.draft.preferences());
    });
    void this.reloadLlmRefs();
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

  async addLlmCredential() {
    this.error.set(null);
    this.notice.set(null);
    const alias = this.draftAlias().trim();
    if (!alias) {
      this.error.set('Alias is required.');
      return;
    }

    const result = await this.llmCredentialRefs.upsertRef({
      alias,
      provider: this.draftProvider(),
      mode: this.draftMode(),
      model: this.draftModel().trim() || undefined,
    });
    if (!result.ok || !result.ref) {
      this.error.set(result.message ?? 'Failed to save credential ref.');
      return;
    }

    const secret = this.draftSecret().trim();
    if (this.draftMode() === 'clientHeld' && secret) {
      const secretResult = this.llmCredentialRefs.setSessionSecret(result.ref.id, secret);
      if (!secretResult.ok) {
        this.error.set(secretResult.message ?? 'Failed to set session secret.');
        return;
      }
    }

    this.draftAlias.set('');
    this.draftMode.set('clientHeld');
    this.draftModel.set('');
    this.draftSecret.set('');
    this.notice.set('Credential reference saved.');
    await this.reloadLlmRefs();
  }

  async setSessionSecret(credentialRefId: string) {
    this.error.set(null);
    this.notice.set(null);
    const secret = this.draftSecret().trim();
    if (!secret) {
      this.error.set('Enter a session secret first.');
      return;
    }
    const result = this.llmCredentialRefs.setSessionSecret(credentialRefId, secret);
    if (!result.ok) {
      this.error.set(result.message ?? 'Failed to set session secret.');
      return;
    }
    this.notice.set('Session secret updated.');
    this.draftSecret.set('');
  }

  async removeRef(credentialRefId: string) {
    await this.llmCredentialRefs.removeRef(credentialRefId);
    await this.reloadLlmRefs();
  }

  private save(next: UserPreferences) {
    this.prefs.set(next);
    this.draft.updatePreferences(next);
  }

  private async reloadLlmRefs() {
    this.llmRefs.set(await this.llmCredentialRefs.listForCurrentUser());
  }
}
