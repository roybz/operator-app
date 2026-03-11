import { Component, Input, inject, signal } from '@angular/core';
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
import { MultiUserSettingsComponent } from './multi-user/multi-user.component';

type SettingsTab =
  | 'users'
  | 'interface'
  | 'applications'
  | 'admin'
  | 'credentials'
  | 'llm'
  | 'account'
  | 'universe'
  | 'multiUser';

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
    MultiUserSettingsComponent,
    AboutComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent {
  readonly auth = inject(AuthService);
  readonly draft = inject(SettingsDraftService);

  @Input() showControls = true;

  isGuestUser = signal(this.auth.actualUser()?.id === 'u_guest');
  aboutOpen = signal(false);
  tab = signal<SettingsTab>(this.auth.isAdmin() && !this.isGuestUser() ? 'admin' : 'interface');

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

  selectTab(next: SettingsTab) {
    if (this.isGuestUser() && next !== 'interface' && next !== 'applications') return;
    this.tab.set(next);
    this.aboutOpen.set(false);
  }
}
