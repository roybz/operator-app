import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, InviteeRecord, UserPreferences } from '../../../core/auth.service';
import { SettingsDraftService } from '../settings-draft.service';
import { SharedTableComponent, TableColumn } from '../../../shared/table/table.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-universe-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, SharedTableComponent, ConfirmDialogComponent],
  template: `
    <section>
      <h3>{{ 'universe.title' | translate }}</h3>

      <div style="display:grid; gap:12px; max-width: 560px;">
        <label>
          {{ 'universe.name' | translate }}
          <input type="text" [value]="prefs().universeName" (input)="onNameInput($event)" />
        </label>

        <label style="display:flex; gap:8px; align-items:center;">
          <input
            type="checkbox"
            [checked]="prefs().multiUserEnabled"
            (change)="onMultiUserToggle($event)"
          />
          {{ 'universe.multiUser' | translate }}
        </label>

        <div style="display:flex; flex-direction:column; gap:6px;">
          <span>{{ 'universe.linkLabel' | translate }}</span>
          <code>{{ universeLink() }}</code>
          <button (click)="openLinkConfirm()" [disabled]="!prefs().multiUserEnabled">
            {{ 'universe.changeLink' | translate }}
          </button>
        </div>

        <label style="display:flex; gap:8px; align-items:center;">
          <input
            type="checkbox"
            [checked]="prefs().allowUniverseGuests"
            (change)="onGuestToggle($event)"
            [disabled]="!prefs().multiUserEnabled"
          />
          {{ 'universe.allowGuests' | translate }}
        </label>

        @if (prefs().allowUniverseGuests) {
          <label>
            {{ 'universe.guestPassword' | translate }}
            <input
              type="password"
              [value]="guestPassword()"
              (input)="guestPassword.set($any($event.target).value)"
            />
            <button style="margin-left:8px;" (click)="applyGuestPassword()">
              {{ 'universe.savePassword' | translate }}
            </button>
          </label>
        }

        <label style="display:flex; gap:8px; align-items:center;">
          <input
            type="checkbox"
            [checked]="prefs().allowUniverseObservers"
            (change)="onObserverToggle($event)"
            [disabled]="!prefs().multiUserEnabled"
          />
          {{ 'universe.allowObservers' | translate }}
        </label>

        @if (prefs().allowUniverseObservers) {
          <label>
            {{ 'universe.observerPassword' | translate }}
            <input
              type="password"
              [value]="observerPassword()"
              (input)="observerPassword.set($any($event.target).value)"
            />
            <button style="margin-left:8px;" (click)="applyObserverPassword()">
              {{ 'universe.savePassword' | translate }}
            </button>
          </label>
        }

        <label style="display:flex; gap:8px; align-items:center;">
          <input
            type="checkbox"
            [checked]="prefs().allowUniverseChat"
            (change)="onChatToggle($event)"
            [disabled]="!prefs().multiUserEnabled"
          />
          {{ 'universe.allowChat' | translate }}
        </label>
      </div>

      <section style="margin-top: 24px;">
        <h4>{{ 'universe.inviteesTitle' | translate }}</h4>

        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width: 320px;">
            <app-shared-table
              [columns]="columns"
              [rows]="invitees()"
              [actionsTemplate]="actionsTpl"
              [searchPlaceholder]="'users.search' | translate"
              [emptyMessage]="'users.empty'"
            />
            <ng-template #actionsTpl let-row>
              <button (click)="startEdit(row)">{{ 'users.edit' | translate }}</button>
              <button (click)="remove(row)">{{ 'users.delete' | translate }}</button>
            </ng-template>
          </div>

          <div style="flex:1; min-width: 280px;">
            <h4 style="margin-top:0;">{{ formTitle() }}</h4>

            <label for="invitee-username" style="display:block; margin: 8px 0 4px;">
              {{ 'users.username' | translate }}
            </label>
            <input
              id="invitee-username"
              #inviteeUsernameInput
              type="text"
              [value]="username()"
              (input)="username.set(inviteeUsernameInput.value)"
              style="width:100%; padding:8px;"
            />

            <label for="invitee-password" style="display:block; margin: 8px 0 4px;">
              {{ 'users.password' | translate }}
            </label>
            <input
              id="invitee-password"
              #inviteePasswordInput
              type="password"
              [value]="password()"
              (input)="password.set(inviteePasswordInput.value)"
              style="width:100%; padding:8px;"
            />

            @if (error()) {
              <p style="color:#b00020; margin-top: 8px;">{{ error() }}</p>
            }

            <div style="display:flex; gap:8px; margin-top: 12px;">
              <button (click)="save()">{{ saveLabel() }}</button>
              <button (click)="reset()">{{ 'users.reset' | translate }}</button>
            </div>
          </div>
        </div>
      </section>

        @if (confirmLinkChange()) {
          <app-confirm-dialog
            [message]="'universe.changeLinkConfirm' | translate"
            [confirmLabel]="'universe.updateLink' | translate"
            [cancelLabel]="'dialogs.cancel' | translate"
            (confirm)="changeLink()"
            (cancel)="confirmLinkChange.set(false)"
          />
        }
    </section>
  `,
})
export class UniverseSettingsComponent {
  private auth = inject(AuthService);
  private draft = inject(SettingsDraftService);
  private translate = inject(TranslateService);
  prefs = signal<UserPreferences>(this.draft.preferences());
  confirmLinkChange = signal(false);
  guestPassword = signal('');
  observerPassword = signal('');

  columns: TableColumn<InviteeRecord>[] = [
    { header: 'users.username', cell: (row) => row.username },
    { header: 'users.role', cell: () => 'invitee' },
  ];

  editingId = signal<string | null>(null);
  username = signal('');
  password = signal('');
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.prefs.set(this.draft.preferences());
    });
  }

  invitees() {
    const ownerId = this.auth.actualUser()?.id ?? '';
    return ownerId ? this.auth.getInviteesForOwner(ownerId) : [];
  }

  universeLink() {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin;
    return `${base}/${this.prefs().universeId}/`;
  }

  onNameInput(event: Event) {
    const universeName = (event.target as HTMLInputElement).value.trim();
    this.draft.updatePreferences({ ...this.prefs(), universeName });
  }

  onMultiUserToggle(event: Event) {
    const multiUserEnabled = (event.target as HTMLInputElement).checked;
    this.draft.updatePreferences({ ...this.prefs(), multiUserEnabled });
  }

  onGuestToggle(event: Event) {
    const allowUniverseGuests = (event.target as HTMLInputElement).checked;
    this.draft.updatePreferences({ ...this.prefs(), allowUniverseGuests });
  }

  onObserverToggle(event: Event) {
    const allowUniverseObservers = (event.target as HTMLInputElement).checked;
    this.draft.updatePreferences({ ...this.prefs(), allowUniverseObservers });
  }

  onChatToggle(event: Event) {
    const allowUniverseChat = (event.target as HTMLInputElement).checked;
    this.draft.updatePreferences({ ...this.prefs(), allowUniverseChat });
  }

  openLinkConfirm() {
    this.confirmLinkChange.set(true);
  }

  changeLink() {
    const ownerId = this.auth.actualUser()?.id;
    if (!ownerId) return;
    const nextId = Math.random().toString(36).slice(2, 10);
    this.auth.setUniverseId(ownerId, nextId);
    this.draft.updatePreferences({ ...this.prefs(), universeId: nextId });
    this.confirmLinkChange.set(false);
  }

  async applyGuestPassword() {
    const raw = this.guestPassword().trim();
    const hashed = raw ? await this.auth.hashPassword(raw) : '';
    this.draft.updatePreferences({ ...this.prefs(), universeGuestPassword: hashed });
    this.guestPassword.set('');
  }

  async applyObserverPassword() {
    const raw = this.observerPassword().trim();
    const hashed = raw ? await this.auth.hashPassword(raw) : '';
    this.draft.updatePreferences({ ...this.prefs(), universeObserverPassword: hashed });
    this.observerPassword.set('');
  }

  formTitle() {
    return this.editingId()
      ? this.translate.instant('universe.editInviteeTitle')
      : this.translate.instant('universe.createInviteeTitle');
  }

  saveLabel() {
    return this.editingId()
      ? this.translate.instant('universe.saveInvitee')
      : this.translate.instant('universe.createInvitee');
  }

  startEdit(user: InviteeRecord) {
    this.editingId.set(user.id);
    this.username.set(user.username);
    this.password.set('');
    this.error.set(null);
  }

  reset() {
    this.editingId.set(null);
    this.username.set('');
    this.password.set('');
    this.error.set(null);
  }

  async save() {
    this.error.set(null);
    const ownerId = this.auth.actualUser()?.id;
    if (!ownerId) return;
    const payload = {
      username: this.username(),
      password: this.password(),
    };

    const result = this.editingId()
      ? await this.auth.updateInvitee(ownerId, this.editingId()!, payload)
      : await this.auth.createInvitee(ownerId, payload.username, payload.password);

    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
      return;
    }
    this.reset();
  }

  remove(user: InviteeRecord) {
    const ownerId = this.auth.actualUser()?.id;
    if (!ownerId) return;
    this.auth.deleteInvitee(ownerId, user.id);
  }
}
