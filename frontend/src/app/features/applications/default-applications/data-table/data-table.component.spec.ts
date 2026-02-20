import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
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

interface TestDataTableColumn {
  id: string;
}

interface TestDataTableRow {
  id: string;
}

interface TestDataTable {
  columns: TestDataTableColumn[];
  rows: TestDataTableRow[];
}

interface TestDataTableComponent {
  scrollEl?: { nativeElement: HTMLDivElement };
  updateScrollShadows(target: HTMLDivElement): void;
  scrollShadows(): { left: boolean; right: boolean };
  addRow(): void;
  activeTable(): TestDataTable;
  requestDeleteRow(rowId: string): void;
  pendingDeleteRowId(): string | null;
  confirmDeleteRow(): void;
  requestDeleteColumn(columnId: string): void;
  pendingDeleteColumnId(): string | null;
  confirmDeleteColumn(): void;
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
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      dataTable: {
        defaultTable: 'Table',
        defaultColumn: 'New column',
        tableLabel: 'Table',
        search: 'Search',
        addRow: 'Add row',
        addColumn: 'Add column',
      },
      dialogs: { confirm: 'Confirm', cancel: 'Cancel' },
    });
    translate.use('en');

    fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentInstance.instanceId = 'table-test';
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows right-only shadow at hard left and left-only shadow at hard right', () => {
    const component = fixture.componentInstance as unknown as TestDataTableComponent;
    const target = { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 } as HTMLDivElement;
    component.scrollEl = { nativeElement: target };
    component.updateScrollShadows(target);
    expect(component.scrollShadows()).toEqual({ left: false, right: true });

    target.scrollLeft = 600;
    component.updateScrollShadows(target);
    expect(component.scrollShadows()).toEqual({ left: true, right: false });
  });

  it('deletes a row only after confirmation path', () => {
    const component = fixture.componentInstance as unknown as TestDataTableComponent;
    component.addRow();
    const rowId = component.activeTable().rows[0].id;
    component.requestDeleteRow(rowId);
    expect(component.pendingDeleteRowId()).toBe(rowId);
    component.confirmDeleteRow();
    expect(component.activeTable().rows.length).toBe(0);
  });

  it('deletes a column only after confirmation path', () => {
    const component = fixture.componentInstance as unknown as TestDataTableComponent;
    const firstColumnId = component.activeTable().columns[0].id;
    component.requestDeleteColumn(firstColumnId);
    expect(component.pendingDeleteColumnId()).toBe(firstColumnId);
    component.confirmDeleteColumn();
    expect(component.activeTable().columns.some((col) => col.id === firstColumnId)).toBe(false);
  });
});
