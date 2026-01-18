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
      app: { title: 'Operator App' },
      mock: { label: 'Mock mode' },
      nav: { collapse: 'Collapse', expand: 'Expand', todoApp: 'Todo app' },
    });
    translate.use('en');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const heading = compiled.querySelector('h1')?.textContent ?? '';
    expect(heading).toContain('Operator App');
    expect(compiled.textContent).toContain('Mock mode');
    expect(compiled.textContent).toContain('Todo app');
  });
});
