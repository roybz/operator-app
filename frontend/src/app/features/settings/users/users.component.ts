import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { AuthService, UserRecord, UserRole } from '../../../core/auth.service';
import { SharedTableComponent, TableColumn } from '../../../shared/table/table.component';
import { DialogService } from '../../../core/dialog.service';
import { ModalShellComponent } from '../../../shared/modal-shell/modal-shell.component';

@Component({
  selector: 'app-users-settings',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    SharedTableComponent,
    ConfirmDialogComponent,
    ModalShellComponent,
  ],
  styles: [
    `
      .users-layout {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }

      .users-table {
        flex: 1;
        min-width: 320px;
      }

      .users-form {
        flex: 1;
        min-width: 280px;
      }

      .users-form__title {
        margin-top: 0;
      }

      .users-form__label {
        display: block;
        margin: 8px 0 4px;
      }

      .users-form__input {
        width: 100%;
        padding: 8px;
      }

      .users-form__error {
        color: #b00020;
        margin-top: 8px;
      }

      .users-form__actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .users-success {
        padding: 20px;
        width: 320px;
      }

      .users-success__actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 16px;
      }
    `,
  ],
  template: `
    <section>
      <h3>{{ 'users.title' | translate }}</h3>

      @if (!isAdminUser()) {
        <p>{{ 'users.adminOnly' | translate }}</p>
      }

      @if (isAdminUser()) {
        <div class="users-layout">
          <div class="users-table">
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

          <div class="users-form">
            <h4 class="users-form__title">{{ formTitle() }}</h4>

            <label for="user-username" class="users-form__label">
              {{ 'users.username' | translate }}
            </label>
            <input
              id="user-username"
              #usernameInput
              type="text"
              [value]="username()"
              (input)="username.set(usernameInput.value)"
              class="users-form__input"
            />

            <label for="user-password" class="users-form__label">
              {{ 'users.password' | translate }}
            </label>
            <input
              id="user-password"
              #passwordInput
              type="password"
              [value]="password()"
              (input)="password.set(passwordInput.value)"
              class="users-form__input"
              [disabled]="passwordDisabled()"
            />

            <label for="user-role" class="users-form__label">
              {{ 'users.role' | translate }}
            </label>
            <select
              id="user-role"
              #roleSelect
              [value]="role()"
              (change)="onRoleChange(roleSelect.value)"
              class="users-form__input"
            >
              <option value="admin">{{ 'users.roleAdmin' | translate }}</option>
              <option value="user">{{ 'users.roleUser' | translate }}</option>
            </select>

            @if (error()) {
              <p class="users-form__error">{{ error() }}</p>
            }

            <div class="users-form__actions">
              <button (click)="save()">{{ saveLabel() }}</button>
              <button (click)="reset()">{{ 'users.reset' | translate }}</button>
            </div>
          </div>
        </div>
      }

      @if (successMessage()) {
        <app-modal-shell
          [zIndex]="3000"
          ariaLabel="Users success"
          maxWidth="360px"
          (closed)="successMessage.set(null)"
        >
          <div class="users-success">
            <p>{{ successMessage() }}</p>
            <div class="users-success__actions">
              <button (click)="successMessage.set(null)">OK</button>
            </div>
          </div>
        </app-modal-shell>
      }

      @if (confirmWipeUserId()) {
        <app-confirm-dialog
          [message]="'users.wipeConfirm' | translate"
          [confirmLabel]="'dialogs.confirm' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="confirmWipeUser()"
          (canceled)="confirmWipeUserId.set(null)"
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
