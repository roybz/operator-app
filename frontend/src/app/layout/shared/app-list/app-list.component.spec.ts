import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { AppListComponent } from './app-list.component';

describe('AppListComponent visual states', () => {
  let fixture: ComponentFixture<AppListComponent>;
  let component: AppListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppListComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppListComponent);
    component = fixture.componentInstance;
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
  });

  it('shows archived-empty state after toggling archived list', () => {
    component.showArchived.set(true);
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.app-list__archived-empty');
    expect(empty).toBeTruthy();
  });

  it('applies phone-mode control class for action buttons', () => {
    component.phoneMode = true;
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('.app-list__toggle');
    const add = fixture.nativeElement.querySelector('.app-list__icon--add');
    expect(toggle.classList.contains('app-list__control--phone')).toBe(true);
    expect(add.classList.contains('app-list__control--phone')).toBe(true);
  });

  it('renders active and archived instance visual state classes', () => {
    component.instancesByApp.todo = [
      {
        id: 'inst-1',
        appId: 'todo',
        titleKey: 'apps.todo',
        titleOverride: 'Todo 1',
        minimized: false,
        phoneMinimized: false,
        stashed: false,
        archived: true,
        z: 1,
        rect: { x: 0, y: 0, width: 200, height: 180 },
        isMaximized: false,
      },
    ];
    component.showArchived.set(true);
    fixture.detectChanges();

    const nameButton = fixture.nativeElement.querySelector('.app-instance__name');
    expect(nameButton.classList.contains('app-instance__name--active')).toBe(true);
    expect(nameButton.classList.contains('app-instance__name--archived')).toBe(true);
  });
});
