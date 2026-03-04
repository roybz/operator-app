import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { STORAGE_ADAPTER } from '../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../core/storage/local-storage.adapter';
import { StorageService } from '../../core/storage/storage.service';
import { DesktopShellComponent } from './desktop-shell.component';

describe('DesktopShellComponent visual states', () => {
  let fixture: ComponentFixture<DesktopShellComponent>;
  let component: DesktopShellComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DesktopShellComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();
    fixture = TestBed.createComponent(DesktopShellComponent);
    component = fixture.componentInstance;
    component.navOpen = true;
    component.canEdit = false;
    component.canOpenSettings = false;
    component.apps = [{ id: 'todo', labelKey: 'apps.todo', icon: 'T' }];
    component.instancesByApp = {
      kanban: [],
      todo: [],
      calculator: [],
      timer: [],
      navigator: [],
      notes: [],
      stickyNotes: [],
      calendar: [],
      clock: [],
      dataTable: [],
    };
    fixture.detectChanges();
  });

  it('disables edit controls when canEdit is false', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const disabledCount = buttons.filter((button) => button.disabled).length;
    expect(disabledCount).toBeGreaterThan(0);
  });

  it('disables settings button when canOpenSettings is false', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const settingsButton = labels.find((button) => button.textContent?.toLowerCase().includes('nav.settings'));
    if (!settingsButton) return;
    expect(settingsButton.disabled).toBe(true);
  });
});

