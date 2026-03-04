import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mergeStickyStatesForSync, StickyNotesComponent } from './sticky-notes.component';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { UserPreferences } from '../../../../core/auth.service';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';

class MockPrefsService {
  preferences() {
    return {
      stickyNoteDefaultMode: 'rich',
      accessibilityMode: false,
    } as UserPreferences;
  }
  userId() {
    return 'u_test';
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
      imports: [StickyNotesComponent],
      providers: [
        { provide: AppPreferencesService, useClass: MockPrefsService },
        { provide: InstanceSettingsService, useClass: MockInstanceSettingsService },
        { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
      ],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();

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
});
