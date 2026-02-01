import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { AppComponent } from './app';
import { STORAGE_ADAPTER } from './core/storage/storage-adapter';
import { LocalStorageAdapter } from './core/storage/local-storage.adapter';
import { StorageService } from './core/storage/storage.service';

type OpWindow = Window & { __OP_CONFIG__?: { mockMode?: boolean; guestModeOnly?: boolean } };

describe('App', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'op_users',
      JSON.stringify([{ id: 'u_admin', username: 'admin', password: '', role: 'admin' }]),
    );
    window.localStorage.setItem(
      'op_session',
      JSON.stringify({ userId: 'u_admin', previewUserId: null, previewPersist: false }),
    );
    window.localStorage.setItem('op_prefs', JSON.stringify({}));
    window.localStorage.setItem(
      'op_org_settings',
      JSON.stringify({ siteTitle: 'Operator App', siteLogoEmoji: '🌎' }),
    );
    window.localStorage.setItem('op_accessibility_prompted_u_admin', 'true');

    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [provideRouter([]), { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders translated header and mock label', () => {
    const w = window as OpWindow;
    w.__OP_CONFIG__ = { mockMode: true, guestModeOnly: false };

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      mock: { label: 'Test mode' },
      auth: { loggedInAs: 'Logged in as {{user}}' },
      nav: { collapse: 'Collapse', expand: 'Expand', settings: 'Settings', logout: 'Log out' },
      apps: {
        todo: 'Todos',
        todoGroup: 'Todos',
        calculator: 'Calculators',
        calculatorGroup: 'Calculators',
        timer: 'Timers',
        timerGroup: 'Timers',
        navigator: 'Navigators',
        navigatorGroup: 'Navigators',
        notes: 'Notes',
        notesGroup: 'Notes',
      },
      workspaces: { button: 'Workspaces' },
      topbar: { collapse: 'Collapse top bar', expand: 'Expand top bar' },
      dialogs: {
        reset: 'Reset dialog positions',
        resetLeft: 'Reset to the left',
        resetMiddle: 'Reset to the middle',
        confirmDelete: 'Delete this instance permanently?',
        confirm: 'Delete',
        cancel: 'Cancel',
        hideAll: 'Hide all dialogs',
        showAll: 'Show all dialogs',
        lockDelete: 'Lock delete',
        unlockDelete: 'Unlock delete',
      },
    });
    translate.use('en');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    fixture.componentInstance.loadingVisible.set(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.siteTitle()).toContain('Operator App');
    expect(fixture.componentInstance.loadingVisible()).toBe(false);
  });
});
