import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { AppComponent } from './app';

type OpWindow = Window & { __OP_CONFIG__?: { mockMode?: boolean } };

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

    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders translated header and mock label', async () => {
    const w = window as OpWindow;
    w.__OP_CONFIG__ = { mockMode: true };

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      mock: { label: 'Test mode' },
      auth: { loggedInAs: 'Logged in as {{user}}' },
      nav: { collapse: 'Collapse', expand: 'Expand', settings: 'Settings', logout: 'Log out' },
      apps: {
        todo: 'Todo',
        todoGroup: 'Todo',
        calculator: 'Calculator',
        calculatorGroup: 'Calculator',
        timer: 'Timer',
        timerGroup: 'Timer',
        navigator: 'Navigator',
        navigatorGroup: 'Navigator',
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
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const heading = compiled.querySelector('strong')?.textContent ?? '';
    expect(heading).toContain("Roy's Planner");
    expect(compiled.textContent).toContain('Test mode');
    expect(compiled.textContent).toContain('Todo');
    expect(compiled.textContent).toContain('Workspaces');
    expect(compiled.textContent).toContain('Settings');
    expect(compiled.textContent).toContain('Logged in as admin');
  });
});
