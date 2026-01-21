import { TestBed } from '@angular/core/testing';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { AppPreferencesService } from '../../dependencies/app-preferences.service';
import { KanbanComponent } from './kanban.component';

describe('KanbanComponent', () => {
  it('renders the board selector', async () => {
    await TestBed.configureTestingModule({
      imports: [
        KanbanComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [
        {
          provide: AppPreferencesService,
          useValue: {
            language: () => 'en',
            timeZone: () => 'UTC',
            timeFormat: () => '12h',
            userId: () => 'test-user',
          },
        },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      kanban: {
        boardLabel: 'Board',
        defaultBoard: 'Main board',
        columnTodo: 'Todo',
        columnInProgress: 'In Progress',
        columnDone: 'Done',
      },
    });
    translate.use('en');

    const fixture = TestBed.createComponent(KanbanComponent);
    fixture.componentInstance.instanceId = 'kanban_test';
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Board');
    expect(compiled.querySelector('select')).toBeTruthy();
  });
});
