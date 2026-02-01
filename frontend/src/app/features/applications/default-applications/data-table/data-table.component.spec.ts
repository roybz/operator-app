import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { UserPreferences } from '../../../../core/auth.service';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';

class MockPrefsService {
  preferences() {
    return {} as UserPreferences;
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

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<DataTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DataTableComponent,
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

    fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentInstance.instanceId = 'table-test';
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
