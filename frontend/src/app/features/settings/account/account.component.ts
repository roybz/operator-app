import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { ModalShellComponent } from '../../../shared/modal-shell/modal-shell.component';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmDialogComponent, ModalShellComponent],
  template: `
    <section>
      <h3>{{ 'account.title' | translate }}</h3>

      <section style="margin-bottom: 24px; padding: 12px; border: 1px solid var(--color-border);">
        <h4 style="margin-top:0;">{{ 'account.updatePasswordTitle' | translate }}</h4>

        @if (!passwordAllowed()) {
          <p style="opacity:0.7;">{{ 'account.passwordDisabled' | translate }}</p>
        } @else {
          <label for="account-password" style="display:block; margin: 8px 0 4px;">
            {{ 'account.password' | translate }}
          </label>
          <input
            id="account-password"
            #accountPasswordInput
            type="password"
            [value]="password()"
            (input)="password.set(accountPasswordInput.value)"
            style="width:100%; padding:8px;"
          />
          <div style="display:flex; gap:8px; margin-top: 12px;">
            <button (click)="updatePassword()">{{ 'account.updatePassword' | translate }}</button>
          </div>
        }
      </section>

      <section style="padding: 12px; border: 1px solid var(--color-border);">
        <h4 style="margin-top:0;">{{ 'account.deleteTitle' | translate }}</h4>
        <p style="opacity:0.7; margin: 6px 0 12px;">{{ 'account.deleteHint' | translate }}</p>
        <button (click)="deleteConfirmOpen.set(true)">
          {{ 'account.deleteButton' | translate }}
        </button>
      </section>

      @if (deleteConfirmOpen()) {
        <app-confirm-dialog
          [message]="'account.deleteConfirm' | translate"
          [confirmLabel]="'dialogs.confirm' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="deleteAccount()"
          (canceled)="deleteConfirmOpen.set(false)"
        >
          @if (error()) {
            <p style="color:#b00020; margin-top:8px;">{{ error() }}</p>
          }
        </app-confirm-dialog>
      }

      @if (successMessage()) {
        <app-modal-shell [zIndex]="3200" ariaLabel="Account success" maxWidth="360px" (closed)="successMessage.set(null)">
          <div style="padding:20px; width:320px;">
            <p>{{ successMessage() }}</p>
            <div style="display:flex; justify-content:flex-end; margin-top:16px;">
              <button (click)="successMessage.set(null)">OK</button>
            </div>
          </div>
        </app-modal-shell>
      }
    </section>
  `,
})
export class AccountSettingsComponent {
  private auth = inject(AuthService);
  private translate = inject(TranslateService);
  password = signal('');
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  deleteConfirmOpen = signal(false);

  passwordAllowed() {
    const role = this.auth.currentUser()?.role;
    return role !== 'guest' && role !== 'observer';
  }

  async updatePassword() {
    if (!this.passwordAllowed()) return;
    const current = this.auth.currentUser();
    if (!current) return;
    const nextPassword = this.password().trim();
    if (!nextPassword) return;
    const result = await this.auth.updateUser(current.id, {
      username: current.username,
      password: nextPassword,
      role: current.role,
    });
    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
      return;
    }
    this.successMessage.set(this.translate.instant('users.passwordUpdated'));
    this.password.set('');
    this.auth.logout();
  }

  deleteAccount() {
    const current = this.auth.currentUser();
    if (!current) return;
    const result = this.auth.deleteUser(current.id);
    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
      return;
    }
    this.deleteConfirmOpen.set(false);
    this.auth.logout();
  }
}
