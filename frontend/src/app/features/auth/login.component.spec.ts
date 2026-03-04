import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/auth.service';
import { DialogService } from '../../core/dialog.service';
import { StorageService } from '../../core/storage/storage.service';

describe('LoginComponent visual states', () => {
  let fixture: ComponentFixture<LoginComponent>;
  const queryParamMap$ = new Subject<ReturnType<typeof convertToParamMap>>();

  const authState = {
    guestModeOnly: false,
    allowGuestLogin: true,
    usesExternalAuth: false,
    isLoggedIn: false,
    universeContext: null as { ownerId: string; universeId?: string | null } | null,
  };

  const authStub = {
    updateUniverseContextFromLocation: vi.fn(),
    getLoginPhoneModePreference: vi.fn(() => null),
    getDefaultPhoneMode: vi.fn(() => false),
    guestModeOnly: vi.fn(() => authState.guestModeOnly),
    orgSettings: vi.fn(() => ({ allowGuestLogin: authState.allowGuestLogin })),
    usesExternalAuth: vi.fn(() => authState.usesExternalAuth),
    isPublicSignupPrepared: vi.fn(() => true),
    isPublicSignupEnabled: vi.fn(() => false),
    universeContext: vi.fn(() => authState.universeContext),
    getUniversePreferences: vi.fn(() => ({
      universeName: 'Universe',
      multiUserEnabled: true,
      allowUniverseGuests: true,
      allowUniverseObservers: true,
    })),
    users: vi.fn(() => [{ id: 'u_owner', username: 'owner' }]),
    isLoggedIn: vi.fn(() => authState.isLoggedIn),
    logout: vi.fn(),
    applyLoginPhoneModePreference: vi.fn(),
    setLoginPhoneModePreference: vi.fn(),
    startExternalLogin: vi.fn(),
    startExternalSignup: vi.fn(async () => ({ ok: true })),
    login: vi.fn(async () => ({ ok: true })),
    loginInvitee: vi.fn(async () => ({ ok: true })),
    loginUniverseGuest: vi.fn(async () => ({ ok: true })),
    loginUniverseObserver: vi.fn(async () => ({ ok: true })),
    loginAsGuest: vi.fn(),
    resetGuestAccount: vi.fn(),
  };

  const routerStub = {
    navigateByUrl: vi.fn(),
  };

  const dialogServiceStub = {
    resetForUser: vi.fn(),
  };

  const storageStub = {
    removeItem: vi.fn(async () => undefined),
  };

  const routeStub = {
    snapshot: { queryParamMap: convertToParamMap({}) },
    queryParamMap: queryParamMap$.asObservable(),
  };

  beforeEach(async () => {
    authState.guestModeOnly = false;
    authState.allowGuestLogin = true;
    authState.usesExternalAuth = false;
    authState.isLoggedIn = false;
    authState.universeContext = null;
    routeStub.snapshot.queryParamMap = convertToParamMap({});
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
        { provide: DialogService, useValue: dialogServiceStub },
        { provide: StorageService, useValue: storageStub },
        { provide: ActivatedRoute, useValue: routeStub },
      ],
    }).compileComponents();
  });

  it('renders guest entry when guest-only mode is active', () => {
    authState.guestModeOnly = true;
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.some((button) => button.textContent?.includes('auth.guest'))).toBe(true);
  });

  it('renders secure sign-in path when external auth is enabled', () => {
    authState.usesExternalAuth = true;
    authState.allowGuestLogin = false;
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.some((button) => button.textContent?.includes('auth.signIn'))).toBe(true);
  });

  it('shows logged-out message when route contains loggedOut query param', () => {
    routeStub.snapshot.queryParamMap = convertToParamMap({ loggedOut: '1' });
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    expect(authStub.logout).toHaveBeenCalled();
    const content = fixture.nativeElement.textContent as string;
    expect(content.includes('auth.loggedOut')).toBe(true);
  });
});
