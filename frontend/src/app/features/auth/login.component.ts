import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { DialogService } from '../../core/dialog.service';
import { LicenseComponent } from '../license/license.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import packageJson from '../../../../package.json';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, TranslateModule, LicenseComponent, ConfirmDialogComponent],
  template: `
    <main style="max-width: 420px; margin: 96px auto;">
      <h1>
        {{ universeLogin() ? ('universe.loginTitle' | translate) : ('auth.title' | translate) }}
      </h1>
      <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">v{{ appVersion }}</div>

      @if (universeLogin()) {
        <p style="margin: 8px 0; opacity:0.8;">
          {{
            'universe.loginSubtitle'
              | translate: { name: universeName(), owner: universeOwnerName() }
          }}
        </p>
        <form (submit)="onInviteeSubmit($event)">
          <label for="invitee-username" style="display:block; margin: 12px 0 6px;">
            {{ 'universe.inviteeUsername' | translate }}
          </label>
          <input
            id="invitee-username"
            #inviteeUsernameInput
            type="text"
            [value]="username()"
            (input)="username.set(inviteeUsernameInput.value)"
            style="width:100%; padding:10px;"
          />

          <label for="invitee-password" style="display:block; margin: 12px 0 6px;">
            {{ 'universe.inviteePassword' | translate }}
          </label>
          <input
            id="invitee-password"
            #inviteePasswordInput
            type="password"
            [value]="password()"
            (input)="password.set(inviteePasswordInput.value)"
            style="width:100%; padding:10px;"
          />

          @if (error()) {
            <p style="color:#b00020; margin-top: 8px;">{{ error() }}</p>
          }

          <button type="submit" style="margin-top: 16px; padding: 10px 14px;">
            {{ 'auth.signIn' | translate }}
          </button>
          <p style="margin-top: 10px; font-size:12px; opacity:0.7;">
            {{ 'auth.lockoutWarning' | translate }}
          </p>
        </form>

        @if (allowUniverseGuest()) {
          <label style="display:flex; gap:8px; align-items:center; margin-top: 12px;">
            <input type="checkbox" [checked]="resetGuest()" (change)="toggleResetGuest($event)" />
            {{ 'auth.resetGuest' | translate }}
          </label>
          <input
            type="password"
            [value]="guestPassword()"
            (input)="guestPassword.set($any($event.target).value)"
            style="width:100%; padding:10px; margin-top:8px;"
            [placeholder]="'universe.guestPassword' | translate"
          />
          <button
            type="button"
            style="margin-top: 12px; padding: 8px 12px;"
            (click)="continueAsUniverseGuest()"
          >
            {{ 'universe.continueGuest' | translate }}
          </button>
        }

        @if (allowUniverseObserver()) {
          <input
            type="password"
            [value]="observerPassword()"
            (input)="observerPassword.set($any($event.target).value)"
            style="width:100%; padding:10px; margin-top:12px;"
            [placeholder]="'universe.observerPassword' | translate"
          />
          <button
            type="button"
            style="margin-top: 12px; padding: 8px 12px;"
            (click)="continueAsUniverseObserver()"
          >
            {{ 'universe.continueObserver' | translate }}
          </button>
        }

        <button
          type="button"
          style="margin-top: 16px; padding: 8px 12px;"
          (click)="returnToMainLogin()"
        >
          {{ 'universe.returnToMainLogin' | translate }}
        </button>
      } @else if (guestModeOnlyFlag) {
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
      } @else {
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
          <p style="margin-top: 10px; font-size:12px; opacity:0.7;">
            {{ 'auth.lockoutWarning' | translate }}
          </p>
        </form>

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
      }

      <div style="display:flex; gap:8px; margin-top: 16px; flex-wrap:wrap;">
        <button type="button" (click)="licenseOpen.set(true)">
          {{ 'nav.license' | translate }}
        </button>
        <a
          href="https://github.com/roybz/operator-app"
          target="_blank"
          rel="noreferrer"
          style="padding: 8px 12px; border:1px solid var(--color-border); border-radius:6px; text-decoration:none; display:inline-flex; align-items:center;"
          (click)="openGithub($event)"
        >
          {{ 'auth.github' | translate }}
        </a>
      </div>

      @if (confirmResetOpen()) {
        <app-confirm-dialog
          [message]="'auth.resetGuestConfirm' | translate"
          [confirmLabel]="'auth.resetGuestConfirmButton' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirm)="confirmGuestReset()"
          (cancel)="confirmResetOpen.set(false)"
        />
      }

      @if (licenseOpen()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:2000;"
        >
          <div style="background:var(--color-surface); padding:20px; border-radius:12px;">
            <app-license (closed)="licenseOpen.set(false)" />
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
  guestPassword = signal('');
  observerPassword = signal('');
  resetGuest = signal(false);
  confirmResetOpen = signal(false);
  guestModeOnlyFlag = packageJson.guestModeOnly === true;
  allowGuest = computed(() => this.guestModeOnlyFlag || this.auth.orgSettings().allowGuestLogin);
  universeLogin = computed(() => Boolean(this.auth.universeContext()));
  universeName = computed(() => {
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return '';
    return this.auth.getUniversePreferences(ownerId).universeName;
  });
  universeOwnerName = computed(() => {
    const ownerId = this.auth.universeContext()?.ownerId;
    return this.auth.users().find((u) => u.id === ownerId)?.username ?? '';
  });
  allowUniverseGuest = computed(() => {
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return false;
    const prefs = this.auth.getUniversePreferences(ownerId);
    return prefs.multiUserEnabled && prefs.allowUniverseGuests;
  });
  allowUniverseObserver = computed(() => {
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return false;
    const prefs = this.auth.getUniversePreferences(ownerId);
    return prefs.multiUserEnabled && prefs.allowUniverseObservers;
  });
  licenseOpen = signal(false);
  appVersion = packageJson.version ?? '0.0.0';

  constructor() {
    this.auth.updateUniverseContextFromLocation();
    if (this.auth.isLoggedIn() && !this.universeLogin()) {
      this.router.navigateByUrl('/');
    }
    const universeOwner = this.auth.universeContext()?.ownerId;
    if (universeOwner) {
      const prefs = this.auth.getUniversePreferences(universeOwner);
      if (!prefs.multiUserEnabled) {
        this.router.navigateByUrl('/');
      }
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

  async onInviteeSubmit(event: Event) {
    event.preventDefault();
    this.error.set(null);
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return;
    const result = await this.auth.loginInvitee(ownerId, this.username(), this.password());
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

  async continueAsUniverseGuest() {
    if (this.resetGuest()) {
      this.confirmResetOpen.set(true);
      return;
    }
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return;
    const result = await this.auth.loginUniverseGuest(ownerId, this.guestPassword());
    if (!result.ok) {
      const message = result.message ?? 'auth.error.generic';
      this.error.set(this.translate.instant(message));
      return;
    }
    this.router.navigateByUrl('/');
  }

  async continueAsUniverseObserver() {
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return;
    const result = await this.auth.loginUniverseObserver(ownerId, this.observerPassword());
    if (!result.ok) {
      const message = result.message ?? 'auth.error.generic';
      this.error.set(this.translate.instant(message));
      return;
    }
    this.router.navigateByUrl('/');
  }

  toggleResetGuest(event: Event) {
    this.resetGuest.set((event.target as HTMLInputElement).checked);
  }

  openGithub(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof window !== 'undefined') {
      window.open('https://github.com/roybz/operator-app', '_blank', 'noopener,noreferrer');
    }
  }

  returnToMainLogin() {
    this.router.navigateByUrl('/');
  }
}
