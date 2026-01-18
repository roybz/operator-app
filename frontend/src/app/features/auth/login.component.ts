import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <main style="max-width: 420px; margin: 96px auto;">
      <h1>{{ 'auth.title' | translate }}</h1>

      <form (submit)="onSubmit($event)">
        <label style="display:block; margin: 12px 0 6px;">
          {{ 'auth.username' | translate }}
        </label>
        <input
          #usernameInput
          type="text"
          [value]="username()"
          (input)="username.set(usernameInput.value)"
          style="width:100%; padding:10px;"
        />

        <label style="display:block; margin: 12px 0 6px;">
          {{ 'auth.password' | translate }}
        </label>
        <input
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
      </form>
    </main>
  `,
})
export class LoginComponent {
  username = signal('');
  password = signal('');
  error = signal<string | null>(null);

  constructor(
    private auth: AuthService,
    private router: Router,
    private translate: TranslateService,
  ) {
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl('/');
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();
    this.error.set(null);
    const result = this.auth.login(this.username(), this.password());
    if (!result.ok) {
      const message = result.message ?? 'auth.error.generic';
      this.error.set(this.translate.instant(message));
      return;
    }
    this.router.navigateByUrl('/');
  }
}
