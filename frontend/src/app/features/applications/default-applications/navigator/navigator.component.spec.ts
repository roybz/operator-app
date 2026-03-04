import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { mergeNavigatorStatesForSync, NavigatorComponent } from './navigator.component';
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

  it('merges navigator conflicts by preserving local active tab and history growth', () => {
    const merged = mergeNavigatorStatesForSync(
      {
        tabs: [
          {
            id: 't1',
            url: 'https://example.com',
            title: 'example.com',
            history: ['https://example.com'],
            historyIndex: 0,
          },
        ],
        activeTabId: 't1',
      },
      {
        tabs: [
          {
            id: 't1',
            url: 'https://httpbin.org',
            title: 'httpbin.org',
            history: ['https://example.com', 'https://httpbin.org'],
            historyIndex: 1,
          },
          {
            id: 't2',
            url: 'https://player.vimeo.com/video/76979871',
            title: 'player.vimeo.com',
            history: ['https://player.vimeo.com/video/76979871'],
            historyIndex: 0,
          },
        ],
        activeTabId: 't2',
      },
    );

    expect(merged.activeTabId).toBe('t2');
    expect(merged.tabs.length).toBe(2);
    const t1 = merged.tabs.find((tab) => tab.id === 't1');
    expect(t1?.history).toEqual(['https://example.com', 'https://httpbin.org']);
    expect(t1?.url).toBe('https://httpbin.org');
  });
});
