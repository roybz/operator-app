import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { UserPreferences } from '../../../core/auth.service';
import { SettingsDraftService } from '../settings-draft.service';
import { PreferencesSettingsComponent } from './preferences.component';
import { vi } from 'vitest';

const basePreferences = (): UserPreferences => ({
  language: 'en',
  city: '',
  timeZone: 'UTC',
  showTime: true,
  timeFormat: '12h',
  stickyNoteDefaultMode: 'rich',
  themeMode: 'system',
  colorTheme: 'standard',
  accessibilityMode: false,
  contextSuggestionsEnabled: true,
  phoneMode: false,
  credentials: [],
  maxPersistedApps: 255,
  canvasWidth: 1920,
  canvasHeight: 1080,
  lockCanvasSize: false,
  hideViewportSizingControls: false,
  hideZoomControls: false,
  backgroundImageUrl: '',
  backgroundImageMode: 'repeat',
  disabledApps: [],
  showGrid: true,
  gridSize: 50,
  universeId: 'u1',
  universeName: 'Universe',
  multiUserEnabled: true,
  allowUniverseGuests: false,
  allowUniverseObservers: false,
  allowUniverseChat: true,
  universeGuestPassword: '',
  universeObserverPassword: '',
  universeOpened: false,
});

class MockSettingsDraftService {
  private readonly prefs = signal<UserPreferences>(basePreferences());

  preferences() {
    return this.prefs();
  }

  updatePreferences = vi.fn((next: UserPreferences) => {
    this.prefs.set(next);
  });
}

describe('PreferencesSettingsComponent', () => {
  it('updates draft when contextual suggestions toggle changes', async () => {
    await TestBed.configureTestingModule({
      imports: [
        PreferencesSettingsComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: SettingsDraftService, useClass: MockSettingsDraftService }],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      preferences: { contextSuggestionsEnabled: 'Show contextual suggestions' },
    });
    translate.use('en');

    const fixture = TestBed.createComponent(PreferencesSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.onContextSuggestionsToggle({
      target: { checked: false },
    } as unknown as Event);

    expect(component.prefs().contextSuggestionsEnabled).toBe(false);
    const draft = TestBed.inject(SettingsDraftService) as unknown as MockSettingsDraftService;
    expect(draft.updatePreferences).toHaveBeenCalled();
  });
});
