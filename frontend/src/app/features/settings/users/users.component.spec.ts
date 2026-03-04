import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { UsersSettingsComponent } from './users.component';
import { AuthService } from '../../../core/auth.service';
import { DialogService } from '../../../core/dialog.service';
import { STORAGE_ADAPTER } from '../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../core/storage/storage.service';
import { vi } from 'vitest';

describe('UsersSettingsComponent visual states', () => {
  let fixture: ComponentFixture<UsersSettingsComponent>;
  let component: UsersSettingsComponent;
  let auth: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        UsersSettingsComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();
    fixture = TestBed.createComponent(UsersSettingsComponent);
    component = fixture.componentInstance;
    auth = TestBed.inject(AuthService);
    await auth.hydrate();
  });

  it('shows admin-only notice for non-admin user', () => {
    auth.loginAsGuest();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('users.adminOnly');
  });

  it('renders validation error state when password is missing for new user', async () => {
    vi.spyOn(auth, 'actualUser').mockReturnValue({
      id: 'u_admin',
      username: 'admin',
      role: 'admin',
      password: '',
    });
    component.username.set('new-user');
    component.role.set('user');
    component.password.set('');

    await component.save();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('.users-form__error');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('users.error.passwordRequired');
  });

  it('disables password input when editing guest user', async () => {
    vi.spyOn(auth, 'actualUser').mockReturnValue({
      id: 'u_admin',
      username: 'admin',
      role: 'admin',
      password: '',
    });
    component.startEdit({ id: 'u_guest', username: 'guest', role: 'user', password: '' });
    fixture.detectChanges();

    const passwordInput = fixture.nativeElement.querySelector(
      '#user-password',
    ) as HTMLInputElement | null;
    expect(passwordInput).toBeTruthy();
    expect(passwordInput?.disabled).toBe(true);
  });

  it('shows success modal after password update on edited user', async () => {
    vi.spyOn(auth, 'actualUser').mockReturnValue({
      id: 'u_admin',
      username: 'admin',
      role: 'admin',
      password: '',
    });
    vi.spyOn(auth, 'updateUser').mockResolvedValue({ ok: true });
    component.startEdit({ id: 'u_member', username: 'member-a', role: 'user', password: '' });
    component.password.set('updated-secret');
    await component.save();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('users.passwordUpdated');
  });

  it('calls dialog reset when wipe succeeds', async () => {
    vi.spyOn(auth, 'actualUser').mockReturnValue({
      id: 'u_admin',
      username: 'admin',
      role: 'admin',
      password: '',
    });
    vi.spyOn(auth, 'wipeUserData').mockReturnValue({ ok: true });
    const dialogService = TestBed.inject(DialogService);
    const resetSpy = vi.spyOn(dialogService, 'resetForUser');
    const target = { id: 'u_member_b', username: 'member-b', role: 'user', password: '' } as const;

    component.wipeUser(target);
    component.confirmWipeUser();

    expect(resetSpy).toHaveBeenCalledWith(target.id);
  });
});
