import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { DialogService } from '../../core/dialog.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <main style="max-width: 420px; margin: 96px auto;">
      <h1>{{ 'auth.title' | translate }}</h1>

      <form (submit)="onSubmit($event)">
        <label for="login-username" style="display:block; margin: 12px 0 6px;">
          {{ 'auth.username' | translate }}
        </label>
        <input
          id="login-username"
          #usernameInput
          type="text"
          [value]="username()"
          (input)="username.set(usernameInput.value)"
          style="width:100%; padding:10px;"
        />

        <label for="login-password" style="display:block; margin: 12px 0 6px;">
          {{ 'auth.password' | translate }}
        </label>
        <input
          id="login-password"
          #passwordInput
          type="password"
          [value]="password()"
          (input)="password.set(passwordInput.value)"
          style="width:100%; padding:10px;"
        />

        @if (error()) {
          <p style="color:#b00020; margin-top: 8px;">{{ error() }}</p>
        }

        <button type="submit" style="margin-top: 16px; padding: 10px 14px;">
          {{ 'auth.signIn' | translate }}
        </button>
        @if (allowGuest()) {
          <label style="display:flex; gap:8px; align-items:center; margin-top: 12px;">
            <input type="checkbox" [checked]="resetGuest()" (change)="toggleResetGuest($event)" />
            {{ 'auth.resetGuest' | translate }}
          </label>
          <button
            type="button"
            style="margin-top: 12px; padding: 8px 12px;"
            (click)="continueAsGuest()"
          >
            {{ 'auth.guest' | translate }}
          </button>
        }
      </form>

      @if (confirmResetOpen()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:2000;"
        >
          <div
            style="background:var(--color-surface); padding:20px; border-radius:8px; width:340px;"
          >
            <p>{{ 'auth.resetGuestConfirm' | translate }}</p>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
              <button (click)="confirmResetOpen.set(false)">
                {{ 'dialogs.cancel' | translate }}
              </button>
              <button (click)="confirmGuestReset()">
                {{ 'auth.resetGuestConfirmButton' | translate }}
              </button>
            </div>
          </div>
        </div>
      }
    </main>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  username = signal('');
  password = signal('');
  error = signal<string | null>(null);
  resetGuest = signal(false);
  confirmResetOpen = signal(false);
  allowGuest = computed(() => this.auth.orgSettings().allowGuestLogin);

  constructor() {
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl('/');
    }
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    this.error.set(null);
    const result = await this.auth.login(this.username(), this.password());
    if (!result.ok) {
      const message = result.message ?? 'auth.error.generic';
      this.error.set(this.translate.instant(message));
      return;
    }
    this.router.navigateByUrl('/');
  }

  continueAsGuest() {
    if (this.resetGuest()) {
      this.confirmResetOpen.set(true);
      return;
    }
    this.auth.loginAsGuest();
    this.router.navigateByUrl('/');
  }

  confirmGuestReset() {
    this.confirmResetOpen.set(false);
    this.auth.resetGuestAccount();
    this.dialogService.resetForUser('u_guest');
    this.auth.loginAsGuest();
    this.router.navigateByUrl('/');
  }

  toggleResetGuest(event: Event) {
    this.resetGuest.set((event.target as HTMLInputElement).checked);
  }
}
