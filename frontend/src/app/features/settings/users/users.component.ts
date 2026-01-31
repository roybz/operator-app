import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { AuthService, UserRecord, UserRole } from '../../../core/auth.service';
import { SharedTableComponent, TableColumn } from '../../../shared/table/table.component';
import { DialogService } from '../../../core/dialog.service';

@Component({
  selector: 'app-users-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, SharedTableComponent, ConfirmDialogComponent],
  template: `
    <section>
      <h3>{{ 'users.title' | translate }}</h3>

      @if (!isAdminUser()) {
        <p>{{ 'users.adminOnly' | translate }}</p>
      }

      @if (isAdminUser()) {
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="flex: 1; min-width: 320px;">
            <app-shared-table
              [columns]="columns"
              [rows]="auth.users()"
              [actionsTemplate]="actionsTpl"
              [searchPlaceholder]="'users.search' | translate"
              [emptyMessage]="'users.empty'"
            />
            <ng-template #actionsTpl let-row>
              <button (click)="startEdit(row)">{{ 'users.edit' | translate }}</button>
              <button (click)="remove(row)">{{ 'users.delete' | translate }}</button>
              <button (click)="wipeUser(row)">{{ 'users.wipe' | translate }}</button>
            </ng-template>
          </div>

          <div style="flex: 1; min-width: 280px;">
            <h4 style="margin-top:0;">{{ formTitle() }}</h4>

            <label for="user-username" style="display:block; margin: 8px 0 4px;">
              {{ 'users.username' | translate }}
            </label>
            <input
              id="user-username"
              #usernameInput
              type="text"
              [value]="username()"
              (input)="username.set(usernameInput.value)"
              style="width:100%; padding:8px;"
            />

            <label for="user-password" style="display:block; margin: 8px 0 4px;">
              {{ 'users.password' | translate }}
            </label>
            <input
              id="user-password"
              #passwordInput
              type="password"
              [value]="password()"
              (input)="password.set(passwordInput.value)"
              style="width:100%; padding:8px;"
              [disabled]="passwordDisabled()"
            />

            <label for="user-role" style="display:block; margin: 8px 0 4px;">
              {{ 'users.role' | translate }}
            </label>
            <select
              id="user-role"
              #roleSelect
              [value]="role()"
              (change)="onRoleChange(roleSelect.value)"
              style="width:100%; padding:8px;"
            >
              <option value="admin">{{ 'users.roleAdmin' | translate }}</option>
              <option value="user">{{ 'users.roleUser' | translate }}</option>
            </select>

            @if (error()) {
              <p style="color:#b00020; margin-top: 8px;">{{ error() }}</p>
            }

            <div style="display:flex; gap:8px; margin-top: 12px;">
              <button (click)="save()">{{ saveLabel() }}</button>
              <button (click)="reset()">{{ 'users.reset' | translate }}</button>
            </div>
          </div>
        </div>
      }

      @if (successMessage()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:3000;"
        >
          <div
            style="background:var(--color-surface); padding:20px; border-radius:8px; width:320px;"
          >
            <p>{{ successMessage() }}</p>
            <div style="display:flex; justify-content:flex-end; margin-top:16px;">
              <button (click)="successMessage.set(null)">OK</button>
            </div>
          </div>
        </div>
      }

      @if (confirmWipeUserId()) {
        <app-confirm-dialog
          [message]="'users.wipeConfirm' | translate"
          [confirmLabel]="'dialogs.confirm' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirm)="confirmWipeUser()"
          (cancel)="confirmWipeUserId.set(null)"
        />
      }
    </section>
  `,
})
export class UsersSettingsComponent {
  columns: TableColumn<UserRecord>[] = [
    { header: 'users.username', cell: (row) => row.username },
    { header: 'users.role', cell: (row) => row.role },
  ];

  editingId = signal<string | null>(null);
  username = signal('');
  password = signal('');
  role = signal<UserRole>('user');
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  confirmWipeUserId = signal<string | null>(null);
  readonly auth = inject(AuthService);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);

  isAdminUser() {
    return this.auth.actualUser()?.role === 'admin';
  }

  formTitle() {
    return this.editingId()
      ? this.translate.instant('users.editTitle')
      : this.translate.instant('users.createTitle');
  }

  saveLabel() {
    return this.editingId()
      ? this.translate.instant('users.save')
      : this.translate.instant('users.create');
  }

  startEdit(user: UserRecord) {
    this.editingId.set(user.id);
    this.username.set(user.username);
    this.password.set('');
    this.role.set(user.role);
    this.error.set(null);
  }

  reset() {
    this.editingId.set(null);
    this.username.set('');
    this.password.set('');
    this.role.set('user');
    this.error.set(null);
  }

  async save() {
    this.error.set(null);
    const payload = {
      username: this.username(),
      password: this.password(),
      role: this.role(),
    };

    if (!this.editingId() && !payload.password.trim()) {
      if (payload.role !== 'guest' && payload.role !== 'observer') {
        this.error.set(this.translate.instant('users.error.passwordRequired'));
        return;
      }
    }

    const result = this.editingId()
      ? await this.auth.updateUser(this.editingId()!, payload)
      : await this.auth.createUser(payload);

    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
      return;
    }

    if (this.editingId() && this.password().trim()) {
      this.successMessage.set(this.translate.instant('users.passwordUpdated'));
      if (this.editingId() === this.auth.currentUser()?.id) {
        this.auth.logout();
      }
    }

    this.reset();
  }

  onRoleChange(value: string) {
    const allowed: UserRole[] = ['admin', 'user'];
    this.role.set(allowed.includes(value as UserRole) ? (value as UserRole) : 'user');
  }

  editingUserIsGuest() {
    return this.editingId() === 'u_guest';
  }

  passwordDisabled() {
    return this.editingUserIsGuest();
  }

  remove(user: UserRecord) {
    const result = this.auth.deleteUser(user.id);
    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
    }
  }

  wipeUser(user: UserRecord) {
    this.confirmWipeUserId.set(user.id);
  }

  confirmWipeUser() {
    const userId = this.confirmWipeUserId();
    if (!userId) return;
    this.confirmWipeUserId.set(null);
    const result = this.auth.wipeUserData(userId);
    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
      return;
    }
    this.dialogService.resetForUser(userId);
  }
}
