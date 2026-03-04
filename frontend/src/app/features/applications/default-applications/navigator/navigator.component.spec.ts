import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NavigatorComponent } from './navigator.component';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';

describe('NavigatorComponent', () => {
  const originalConfig = (window as typeof window & { __OP_CONFIG__?: unknown }).__OP_CONFIG__;

  beforeEach(() => {
    localStorage.clear();
    (window as typeof window & { __OP_CONFIG__?: unknown }).__OP_CONFIG__ = {
      ...(typeof originalConfig === 'object' && originalConfig ? (originalConfig as object) : {}),
      navigatorEnabled: true,
      capabilities: {
        ...(typeof originalConfig === 'object' &&
        originalConfig &&
        'capabilities' in (originalConfig as Record<string, unknown>) &&
        typeof (originalConfig as Record<string, unknown>)['capabilities'] === 'object'
          ? ((originalConfig as Record<string, unknown>)['capabilities'] as object)
          : {}),
        navigatorApp: true,
      },
      navigatorAllowedOrigins: [],
    };
  });

  afterAll(() => {
    (window as typeof window & { __OP_CONFIG__?: unknown }).__OP_CONFIG__ = originalConfig;
  });

  it('renders navigator tabs', async () => {
    await TestBed.configureTestingModule({
      imports: [
        NavigatorComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();

    const fixture = TestBed.createComponent(NavigatorComponent);
    fixture.componentInstance.instanceId = 'nav_test';
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('iframe')).toBeTruthy();
  });

  it('shows bookmark shortcuts and blocks non-bookmarked URLs', async () => {
    await TestBed.configureTestingModule({
      imports: [
        NavigatorComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();

    const fixture = TestBed.createComponent(NavigatorComponent);
    fixture.componentInstance.instanceId = 'nav_test_blocked';
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    expect(component.bookmarks.length).toBe(5);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'https://not-allowlisted.example';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('navigator.blockedTitle');
    expect(compiled.textContent).toContain('https://not-allowlisted.example');
  });
});
