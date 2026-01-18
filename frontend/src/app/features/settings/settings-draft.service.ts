import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService, OrgSettings, UserPreferences } from '../../core/auth.service';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

@Injectable({ providedIn: 'root' })
export class SettingsDraftService {
  private auth = inject(AuthService);

  private initialPrefs = signal<UserPreferences>(clone(this.auth.preferences()));
  private draftPrefs = signal<UserPreferences>(clone(this.auth.preferences()));
  private initialOrg = signal<OrgSettings>(clone(this.auth.orgSettings()));
  private draftOrg = signal<OrgSettings>(clone(this.auth.orgSettings()));
  private appliedSignal = signal(false);

  readonly preferences = this.draftPrefs.asReadonly();
  readonly orgSettings = this.draftOrg.asReadonly();
  readonly applied = this.appliedSignal.asReadonly();
  readonly dirty = computed(
    () =>
      JSON.stringify(this.draftPrefs()) !== JSON.stringify(this.initialPrefs()) ||
      JSON.stringify(this.draftOrg()) !== JSON.stringify(this.initialOrg()),
  );

  start() {
    this.initialPrefs.set(clone(this.auth.preferences()));
    this.draftPrefs.set(clone(this.auth.preferences()));
    this.initialOrg.set(clone(this.auth.orgSettings()));
    this.draftOrg.set(clone(this.auth.orgSettings()));
    this.appliedSignal.set(false);
  }

  updatePreferences(next: UserPreferences) {
    this.draftPrefs.set(clone(next));
    this.appliedSignal.set(false);
  }

  updateOrgSettings(next: OrgSettings) {
    this.draftOrg.set(clone(next));
    this.appliedSignal.set(false);
  }

  apply() {
    this.auth.savePreferences(this.draftPrefs());
    this.auth.saveOrgSettings(this.draftOrg());
    this.initialPrefs.set(clone(this.draftPrefs()));
    this.initialOrg.set(clone(this.draftOrg()));
    this.appliedSignal.set(true);
  }

  cancel() {
    this.draftPrefs.set(clone(this.initialPrefs()));
    this.draftOrg.set(clone(this.initialOrg()));
    this.appliedSignal.set(false);
  }
}
