import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, UserRecord, UserRole } from '../../../core/auth.service';
import { SharedTableComponent, TableColumn } from '../../../shared/table/table.component';

@Component({
  selector: 'app-users-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, SharedTableComponent],
  template: `
    <section>
      <h3>{{ 'users.title' | translate }}</h3>

      @if (!isAdminUser()) {
        <p>{{ 'users.adminOnly' | translate }}</p>
      }

      @if (auth.currentUser() && auth.currentUser()?.id !== 'u_guest') {
        <section style="margin-bottom: 24px; padding: 12px; border: 1px solid #ddd;">
          <h4 style="margin-top:0;">{{ 'users.selfTitle' | translate }}</h4>
          <label for="self-password" style="display:block; margin: 8px 0 4px;">
            {{ 'users.password' | translate }}
          </label>
          <input
            id="self-password"
            #selfPasswordInput
            type="password"
            [value]="selfPassword()"
            (input)="selfPassword.set(selfPasswordInput.value)"
            style="width:100%; padding:8px;"
          />
          <div style="display:flex; gap:8px; margin-top: 12px;">
            <button (click)="updateSelfPassword()">{{ 'users.updatePassword' | translate }}</button>
          </div>
        </section>
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
              [disabled]="editingUserIsGuest()"
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
          style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index:3000;"
        >
          <div style="background:#fff; padding:20px; border-radius:8px; width:320px;">
            <p>{{ successMessage() }}</p>
            <div style="display:flex; justify-content:flex-end; margin-top:16px;">
              <button (click)="successMessage.set(null)">OK</button>
            </div>
          </div>
        </div>
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
  selfPassword = signal('');
  successMessage = signal<string | null>(null);
  readonly auth = inject(AuthService);
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

  save() {
    this.error.set(null);
    const payload = {
      username: this.username(),
      password: this.password(),
      role: this.role(),
    };

    const result = this.editingId()
      ? this.auth.updateUser(this.editingId()!, payload)
      : this.auth.createUser(payload);

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
    this.role.set(value === 'admin' ? 'admin' : 'user');
  }

  editingUserIsGuest() {
    return this.editingId() === 'u_guest';
  }

  updateSelfPassword() {
    const current = this.auth.currentUser();
    if (!current) return;
    const nextPassword = this.selfPassword().trim();
    if (!nextPassword) return;
    const result = this.auth.updateUser(current.id, {
      username: current.username,
      password: nextPassword,
      role: current.role,
    });
    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
      return;
    }
    this.successMessage.set(this.translate.instant('users.passwordUpdated'));
    this.selfPassword.set('');
    this.auth.logout();
  }

  remove(user: UserRecord) {
    const result = this.auth.deleteUser(user.id);
    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
    }
  }
}
