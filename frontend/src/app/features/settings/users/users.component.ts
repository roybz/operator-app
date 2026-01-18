import { Component, signal } from '@angular/core';
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

      @if (!auth.isAdmin()) {
        <p>{{ 'users.adminOnly' | translate }}</p>
      }

      @if (auth.isAdmin()) {
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

            <label style="display:block; margin: 8px 0 4px;">
              {{ 'users.username' | translate }}
            </label>
            <input
              #usernameInput
              type="text"
              [value]="username()"
              (input)="username.set(usernameInput.value)"
              style="width:100%; padding:8px;"
            />

            <label style="display:block; margin: 8px 0 4px;">
              {{ 'users.password' | translate }}
            </label>
            <input
              #passwordInput
              type="password"
              [value]="password()"
              (input)="password.set(passwordInput.value)"
              style="width:100%; padding:8px;"
            />

            <label style="display:block; margin: 8px 0 4px;">
              {{ 'users.role' | translate }}
            </label>
            <select
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

  constructor(
    public auth: AuthService,
    private translate: TranslateService,
  ) {}

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
    this.password.set(user.password ?? '');
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

    this.reset();
  }

  onRoleChange(value: string) {
    this.role.set(value === 'admin' ? 'admin' : 'user');
  }

  remove(user: UserRecord) {
    const result = this.auth.deleteUser(user.id);
    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
    }
  }
}
