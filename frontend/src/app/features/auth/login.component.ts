import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { DialogService } from '../../core/dialog.service';
import { LicenseComponent } from '../license/license.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { StorageService } from '../../core/storage/storage.service';
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
      <div style="font-size: 14px; margin-top: -14px;">
        {{ 'auth.tagline' | translate }}
      </div>
      <div style="font-size: 12px; opacity: 0.7; margin-top: 10px;">v{{ appVersion }}</div>

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
          <input
            type="password"
            [value]="guestPassword()"
            (input)="guestPassword.set($any($event.target).value)"
            style="width:100%; padding:10px; margin-top:8px;"
            [placeholder]="'universe.guestPassword' | translate"
          />
          <button
            type="button"
            style="margin-top: 12px; padding: 8px 12px; font-size:16px;"
            (click)="continueAsUniverseGuest()"
          >
            {{ 'universe.continueGuest' | translate }}
          </button>
          <label style="display:flex; gap:8px; align-items:center; margin-top: 13px;">
            <input type="checkbox" [checked]="phoneMode()" (change)="togglePhoneMode($event)" />
            <span>{{ 'phone.modeLabel' | translate }}</span>
          </label>
          <label
            style="display:flex; gap:8px; align-items:center; margin-top: 11px; margin-bottom:28px; font-size:14px;"
          >
            <span style="padding-left:5px;">{{ 'auth.resetGuest' | translate }}</span>
            <input type="checkbox" [checked]="resetGuest()" (change)="toggleResetGuest($event)" />
          </label>
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
          <button
            type="button"
            style="margin-top: 58px; padding: 8px 12px; font-size:16px;"
            (click)="continueAsGuest()"
          >
            {{ 'auth.guest' | translate }}
          </button>
          <label style="display:flex; gap:8px; align-items:center; margin-top: 13px;">
            <input type="checkbox" [checked]="phoneMode()" (change)="togglePhoneMode($event)" />
            <span>{{ 'phone.modeLabel' | translate }}</span>
          </label>
          <label
            style="display:flex; gap:8px; align-items:center; margin-top: 11px; margin-bottom:28px; font-size:14px;"
          >
            <span style="padding-left:5px;">{{ 'auth.resetGuest' | translate }}</span>
            <input type="checkbox" [checked]="resetGuest()" (change)="toggleResetGuest($event)" />
          </label>
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
          <label style="display:flex; gap:8px; align-items:center; margin-top: 13px;">
            <input type="checkbox" [checked]="phoneMode()" (change)="togglePhoneMode($event)" />
            <span>{{ 'phone.modeLabel' | translate }}</span>
          </label>
          <label style="display:flex; gap:8px; align-items:center; margin-top: 12px;">
            <input type="checkbox" [checked]="resetGuest()" (change)="toggleResetGuest($event)" />
            <span style="padding-left:5px;">{{ 'auth.resetGuest' | translate }}</span>
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

      @if (loggedOutMessage()) {
        <div style="margin-top: 8px; color: var(--color-accent); font-size:13px;">
          {{ loggedOutMessage() }}
        </div>
      }

      <div style="display:flex; gap:8px; margin-top: 16px; flex-wrap:wrap;">
        <button type="button" (click)="licenseOpen.set(true)">
          {{ 'nav.license' | translate }}
        </button>
        <a
          href="https://github.com/roybz/operator-app"
          target="_blank"
          rel="noreferrer"
          style="padding: 8px 12px; border:1px solid var(--color-border); border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; font-size:15px;"
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
          (confirmed)="confirmGuestReset()"
          (canceled)="confirmResetOpen.set(false)"
        />
      }

      @if (licenseOpen()) {
        <div
          style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:2000;"
          (pointerdown)="licenseOpen.set(false)"
          role="button"
          tabindex="0"
          (keydown.enter)="licenseOpen.set(false)"
          (keydown.space)="licenseOpen.set(false)"
        >
          <div
            style="background:var(--color-surface); padding:20px; border-radius:12px;"
            (pointerdown)="$event.stopPropagation()"
          >
            <app-license (closed)="licenseOpen.set(false)" />
          </div>
        </div>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      @media (max-width: 1024px) {
        :host {
          display: block;
          padding-left: 44px;
        }
      }
    `,
  ],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  username = signal('');
  password = signal('');
  error = signal<string | null>(null);
  guestPassword = signal('');
  observerPassword = signal('');
  resetGuest = signal(false);
  confirmResetOpen = signal(false);
  phoneMode = signal(false);
  guestModeOnlyFlag = packageJson.guestModeOnly === true;
  allowGuest = computed(() => this.guestModeOnlyFlag || this.auth.orgSettings().allowGuestLogin);
  universeLogin = computed(() => Boolean(this.auth.universeContext()));
  universeName = computed(() => {
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return '';
    const universeId = this.auth.universeContext()?.universeId;
    return this.auth.getUniversePreferences(ownerId, universeId).universeName;
  });
  universeOwnerName = computed(() => {
    const ownerId = this.auth.universeContext()?.ownerId;
    return this.auth.users().find((u) => u.id === ownerId)?.username ?? '';
  });
  allowUniverseGuest = computed(() => {
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return false;
    const universeId = this.auth.universeContext()?.universeId;
    const prefs = this.auth.getUniversePreferences(ownerId, universeId);
    return prefs.multiUserEnabled && prefs.allowUniverseGuests;
  });
  allowUniverseObserver = computed(() => {
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return false;
    const universeId = this.auth.universeContext()?.universeId;
    const prefs = this.auth.getUniversePreferences(ownerId, universeId);
    return prefs.multiUserEnabled && prefs.allowUniverseObservers;
  });
  licenseOpen = signal(false);
  appVersion = packageJson.version ?? '0.0.0';
  loggedOutMessage = signal('');
  private storage = inject(StorageService);

  constructor() {
    this.auth.updateUniverseContextFromLocation();
    const storedPhone = this.auth.getLoginPhoneModePreference();
    this.phoneMode.set(storedPhone ?? this.auth.getDefaultPhoneMode());
    const loggedOut = this.route.snapshot.queryParamMap.get('loggedOut');
    if (loggedOut) {
      this.auth.logout();
      void this.storage.removeItem('op_session');
      this.loggedOutMessage.set(this.translate.instant('auth.loggedOut'));
    }
    if (this.auth.isLoggedIn() && !this.universeLogin() && !loggedOut) {
      this.router.navigateByUrl('/');
    }
    const universeOwner = this.auth.universeContext()?.ownerId;
    if (universeOwner) {
      const universeId = this.auth.universeContext()?.universeId;
      const prefs = this.auth.getUniversePreferences(universeOwner, universeId);
      if (!prefs.multiUserEnabled) {
        this.router.navigateByUrl('/');
      }
    }
    this.route.queryParamMap.subscribe((params) => {
      const loggedOutParam = params.get('loggedOut');
      if (loggedOutParam) {
        this.auth.logout();
        void this.storage.removeItem('op_session');
      }
      this.loggedOutMessage.set(loggedOutParam ? this.translate.instant('auth.loggedOut') : '');
    });
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
    this.auth.applyLoginPhoneModePreference();
    this.router.navigateByUrl('/');
  }

  async onInviteeSubmit(event: Event) {
    event.preventDefault();
    this.error.set(null);
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return;
    const universeId = this.auth.universeContext()?.universeId ?? null;
    const result = await this.auth.loginInvitee(
      ownerId,
      universeId,
      this.username(),
      this.password(),
    );
    if (!result.ok) {
      const message = result.message ?? 'auth.error.generic';
      this.error.set(this.translate.instant(message));
      return;
    }
    this.auth.applyLoginPhoneModePreference();
    this.router.navigateByUrl('/');
  }

  continueAsGuest() {
    if (this.resetGuest()) {
      this.confirmResetOpen.set(true);
      return;
    }
    this.auth.loginAsGuest();
    this.auth.applyLoginPhoneModePreference();
    this.router.navigateByUrl('/');
  }

  confirmGuestReset() {
    this.confirmResetOpen.set(false);
    this.auth.resetGuestAccount();
    this.dialogService.resetForUser('u_guest');
    this.auth.loginAsGuest();
    this.auth.applyLoginPhoneModePreference();
    this.router.navigateByUrl('/');
  }

  async continueAsUniverseGuest() {
    if (this.resetGuest()) {
      this.confirmResetOpen.set(true);
      return;
    }
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return;
    const universeId = this.auth.universeContext()?.universeId ?? null;
    const result = await this.auth.loginUniverseGuest(ownerId, universeId, this.guestPassword());
    if (!result.ok) {
      const message = result.message ?? 'auth.error.generic';
      this.error.set(this.translate.instant(message));
      return;
    }
    this.auth.applyLoginPhoneModePreference();
    this.router.navigateByUrl('/');
  }

  async continueAsUniverseObserver() {
    const ownerId = this.auth.universeContext()?.ownerId;
    if (!ownerId) return;
    const universeId = this.auth.universeContext()?.universeId ?? null;
    const result = await this.auth.loginUniverseObserver(
      ownerId,
      universeId,
      this.observerPassword(),
    );
    if (!result.ok) {
      const message = result.message ?? 'auth.error.generic';
      this.error.set(this.translate.instant(message));
      return;
    }
    this.auth.applyLoginPhoneModePreference();
    this.router.navigateByUrl('/');
  }

  toggleResetGuest(event: Event) {
    this.resetGuest.set((event.target as HTMLInputElement).checked);
  }

  togglePhoneMode(event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    this.phoneMode.set(enabled);
    this.auth.setLoginPhoneModePreference(enabled);
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
