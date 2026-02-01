import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StickyNotesComponent } from './sticky-notes.component';
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
});
