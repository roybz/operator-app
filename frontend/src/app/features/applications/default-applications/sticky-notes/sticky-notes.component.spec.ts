import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { mergeStickyStatesForSync, StickyNotesComponent } from './sticky-notes.component';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { UserPreferences } from '../../../../core/auth.service';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';
import { vi } from 'vitest';

class MockPrefsService {
  preferences() {
    return {
      stickyNoteDefaultMode: 'rich',
      accessibilityMode: false,
    } as UserPreferences;
  }
  userId() {
    return 'u_test:u1';
  }
}

class MockInstanceSettingsService {
  isOpen() {
    return false;
  }
  close() {
    // no-op for tests
  }
}

describe('StickyNotesComponent', () => {
  let fixture: ComponentFixture<StickyNotesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        StickyNotesComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [
        { provide: AppPreferencesService, useClass: MockPrefsService },
        { provide: InstanceSettingsService, useClass: MockInstanceSettingsService },
        { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
      ],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      appNames: { stickyNotes: 'Sticky Note' },
      sticky: { contextCreateLabel: 'From source' },
    });
    translate.use('en');

    fixture = TestBed.createComponent(StickyNotesComponent);
    fixture.componentInstance.instanceId = 'sticky-test';
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('merges remote/local sticky content without dropping local edits', () => {
    const merged = mergeStickyStatesForSync(
      {
        content: 'Remote text',
        mode: 'rich',
        visualMode: false,
        locked: false,
        fontSize: 16,
        colorEnabled: false,
        bgColor: '',
        textColor: '',
      },
      {
        content: 'Local text',
        mode: 'markdown',
        visualMode: true,
        locked: true,
        fontSize: 22,
        colorEnabled: true,
        bgColor: '#111111',
        textColor: '#ffffff',
      },
      {
        content: '',
        mode: 'rich',
        visualMode: false,
        locked: false,
        fontSize: 16,
        colorEnabled: false,
        bgColor: '',
        textColor: '',
      },
    );

    expect(merged.content).toContain('Local text');
    expect(merged.content).toContain('Remote text');
    expect(merged.mode).toBe('markdown');
    expect(merged.visualMode).toBe(true);
    expect(merged.locked).toBe(true);
    expect(merged.fontSize).toBe(22);
  });

  it('keeps local content when remote conflict payload is blank/default', () => {
    const merged = mergeStickyStatesForSync(
      {
        content: '',
        mode: 'rich',
        visualMode: false,
        locked: false,
        fontSize: 16,
        colorEnabled: false,
        bgColor: '',
        textColor: '',
      },
      {
        content: 'Keep me',
        mode: 'rich',
        visualMode: false,
        locked: false,
        fontSize: 16,
        colorEnabled: false,
        bgColor: '',
        textColor: '',
      },
      {
        content: '',
        mode: 'rich',
        visualMode: false,
        locked: false,
        fontSize: 16,
        colorEnabled: false,
        bgColor: '',
        textColor: '',
      },
    );

    expect(merged.content).toBe('Keep me');
  });

  it('appends external context content instead of label-only fallback', () => {
    const component = fixture.componentInstance;
    component.state.set({ ...component.state(), content: 'Existing text' });
    component.externalContextRef.set({
      universeId: 'u_ctx',
      instanceId: 'other',
      kind: 'note',
      id: 'n1',
      title: 'Note title',
      content: 'Note body content',
    });

    component.appendExternalContext();

    expect(component.state().content).toContain('Existing text');
    expect(component.state().content).toContain('Note body content');
  });

  it('throttles sticky context publishing during rapid input', () => {
    vi.useFakeTimers();
    try {
      const component = fixture.componentInstance;
      const contextStore = component as unknown as {
        contextFields: { setSelection: (...args: unknown[]) => void };
      };
      const setSelectionSpy = vi.spyOn(contextStore.contextFields, 'setSelection');
      setSelectionSpy.mockClear();

      component.onRichInput({ target: { innerHTML: 'one' } } as unknown as Event);
      component.onRichInput({ target: { innerHTML: 'two' } } as unknown as Event);
      component.onRichInput({ target: { innerHTML: 'three' } } as unknown as Event);
      expect(setSelectionSpy).toHaveBeenCalledTimes(0);
      vi.advanceTimersByTime(149);
      expect(setSelectionSpy).toHaveBeenCalledTimes(0);
      vi.advanceTimersByTime(1);
      expect(setSelectionSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
