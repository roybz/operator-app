import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { UsersSettingsComponent } from './users/users.component';
import { PreferencesSettingsComponent } from './preferences/preferences.component';
import { ApplicationsSettingsComponent } from './applications/applications.component';
import { AdminSettingsComponent } from './admin/admin.component';
import { SettingsDraftService } from './settings-draft.service';
import { AboutComponent } from '../about/about.component';
import { CredentialsSettingsComponent } from './credentials/credentials.component';
import { AccountSettingsComponent } from './account/account.component';
import { UniverseSettingsComponent } from './universe/universe.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    UsersSettingsComponent,
    PreferencesSettingsComponent,
    ApplicationsSettingsComponent,
    AdminSettingsComponent,
    CredentialsSettingsComponent,
    AccountSettingsComponent,
    UniverseSettingsComponent,
    AboutComponent,
  ],
  template: `
    <section>
      <div
        style="position:sticky; top:0; display:flex; justify-content:flex-end; gap:8px; padding:0 48px 8px 0; background:var(--color-surface); z-index:2;"
      >
        <button
          (click)="apply()"
          [disabled]="!draft.dirty()"
          [style.opacity]="draft.dirty() ? 1 : 0.6"
        >
          {{ 'settings.apply' | translate }}
        </button>
        @if (draft.dirty()) {
          <button (click)="cancel()">{{ 'settings.cancelChanges' | translate }}</button>
        }
      </div>

      <h2 style="margin:0 0 8px;">{{ 'settings.title' | translate }}</h2>

      <nav style="margin: 16px 0; display:flex; gap:12px; flex-wrap:wrap;">
        @if (auth.isAdmin() && !auth.guestModeOnly() && !isGuestUser()) {
          <button (click)="selectTab('admin')">{{ 'settings.adminLink' | translate }}</button>
        }
        @if (!auth.guestModeOnly() && !isGuestUser()) {
          <button (click)="selectTab('users')">{{ 'settings.usersLink' | translate }}</button>
        }
        <button (click)="selectTab('interface')">
          {{ 'settings.preferencesLink' | translate }}
        </button>
        <button (click)="selectTab('applications')">
          {{ 'settings.applicationsLink' | translate }}
        </button>
        @if (!isGuestUser()) {
          <button (click)="selectTab('credentials')">
            {{ 'settings.credentialsLink' | translate }}
          </button>
          <span
            aria-hidden="true"
            style="align-self:center; width:1px; height:24px; background:var(--color-border);"
          ></span>
          <button (click)="selectTab('universe')">{{ 'settings.universeLink' | translate }}</button>
          <button (click)="selectTab('account')">{{ 'settings.accountLink' | translate }}</button>
        }
      </nav>

      @if (tab() === 'admin' && auth.isAdmin() && !auth.guestModeOnly() && !isGuestUser()) {
        <app-admin-settings />
      }
      @if (tab() === 'interface') {
        <app-preferences-settings />
      }
      @if (tab() === 'applications') {
        <app-applications-settings />
      }
      @if (tab() === 'users' && !auth.guestModeOnly() && !isGuestUser()) {
        <app-users-settings />
      }
      @if (tab() === 'credentials' && !isGuestUser()) {
        <app-credentials-settings />
      }
      @if (tab() === 'account' && !isGuestUser()) {
        <app-account-settings />
      }
      @if (tab() === 'universe' && !isGuestUser()) {
        <app-universe-settings />
      }

      <div style="margin-top: 24px; border-top:1px solid var(--color-border); padding-top:12px;">
        <button (click)="aboutOpen.set(!aboutOpen())">{{ 'nav.about' | translate }}</button>
        <div
          [style.maxHeight]="aboutOpen() ? '240px' : '0'"
          [style.opacity]="aboutOpen() ? 1 : 0"
          style="overflow:hidden; transition:max-height 180ms ease, opacity 180ms ease; margin-top:8px;"
        >
          <app-about />
        </div>
      </div>
    </section>
  `,
})
export class SettingsComponent {
  readonly auth = inject(AuthService);
  readonly draft = inject(SettingsDraftService);
  isGuestUser = signal(this.auth.actualUser()?.id === 'u_guest');
  aboutOpen = signal(false);
  tab = signal<
    'users' | 'interface' | 'applications' | 'admin' | 'credentials' | 'account' | 'universe'
  >(this.auth.isAdmin() && !this.isGuestUser() ? 'admin' : 'interface');

  constructor() {
    this.draft.start();
  }

  users() {
    return this.auth.users();
  }

  apply() {
    if (!this.draft.dirty()) return;
    this.draft.apply();
  }

  cancel() {
    if (!this.draft.dirty() && !this.draft.applied()) return;
    this.draft.cancel();
  }

  selectTab(
    next: 'users' | 'interface' | 'applications' | 'admin' | 'credentials' | 'account' | 'universe',
  ) {
    if (this.isGuestUser() && next !== 'interface' && next !== 'applications') return;
    this.tab.set(next);
    this.aboutOpen.set(false);
  }
}
