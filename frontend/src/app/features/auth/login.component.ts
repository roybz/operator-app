import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { DialogService } from '../../core/dialog.service';
import { LicenseComponent } from '../license/license.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { StorageService } from '../../core/storage/storage.service';
import { DeviceModeToggleComponent } from '../../shared/device-mode-toggle/device-mode-toggle.component';
import { ModalShellComponent } from '../../shared/modal-shell/modal-shell.component';
import packageJson from '../../../../package.json';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LicenseComponent,
    ConfirmDialogComponent,
    DeviceModeToggleComponent,
    ModalShellComponent,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
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
  guestModeOnlyFlag = computed(() => this.auth.guestModeOnly());
  allowGuest = computed(() => this.guestModeOnlyFlag() || this.auth.orgSettings().allowGuestLogin);
  externalAuthEnabled = computed(() => this.auth.usesExternalAuth() && !this.universeLogin());
  publicSignupPrepared = computed(() => this.auth.isPublicSignupPrepared());
  publicSignupEnabled = computed(() => this.auth.isPublicSignupEnabled());
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

  async startSecureSignIn() {
    this.error.set(null);
    await this.auth.startExternalLogin();
  }

  async startSecureSignup() {
    this.error.set(null);
    const result = await this.auth.startExternalSignup();
    if (!result.ok) {
      this.error.set(
        result.message ? this.translate.instant(result.message) : 'Unable to sign up.',
      );
    }
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
