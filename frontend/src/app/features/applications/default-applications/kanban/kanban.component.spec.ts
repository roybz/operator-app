import { TestBed } from '@angular/core/testing';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { KanbanComponent } from './kanban.component';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';

interface TestKanbanColumn {
  id: string;
  cardIds: string[];
}

interface TestKanbanBoard {
  id: string;
  columns: TestKanbanColumn[];
  cards: Record<string, unknown>;
}

interface TestKanbanComponent {
  boardScroll?: { nativeElement: HTMLDivElement };
  dragState: { cardId: string; fromColumnId: string } | null;
  state: {
    (): { boards: TestKanbanBoard[] };
    set(value: { boards: TestKanbanBoard[] }): void;
  };
  activeBoard(): TestKanbanBoard;
  updateScrollShadows(target: HTMLDivElement): void;
  scrollShadows(): { left: boolean; right: boolean };
  requestRemoveColumn(columnId: string): void;
  confirmColumnId(): string | null;
  onDrop(targetColumnId: string, event: DragEvent): void;
}

describe('KanbanComponent', () => {
  const create = async () => {
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
        { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
      ],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      kanban: {
        boardLabel: 'Board',
        defaultBoard: 'Main board',
        columnTodo: 'Todo',
        columnInProgress: 'In Progress',
        columnDone: 'Done',
        defaultColumn: 'New column',
      },
      dialogs: { confirm: 'Confirm', cancel: 'Cancel' },
    });
    translate.use('en');

    const fixture = TestBed.createComponent(KanbanComponent);
    fixture.componentInstance.instanceId = 'kanban_test';
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  it('renders the board selector', async () => {
    const fixture = await create();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Board');
    expect(compiled.querySelector('select')).toBeTruthy();
  });

  it('shows right-only shadow at hard left and left-only shadow at hard right', async () => {
    const fixture = await create();
    const component = fixture.componentInstance as unknown as TestKanbanComponent;
    const target = { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 } as HTMLDivElement;
    component.boardScroll = { nativeElement: target };
    component.updateScrollShadows(target);
    expect(component.scrollShadows()).toEqual({ left: false, right: true });

    target.scrollLeft = 600;
    component.updateScrollShadows(target);
    expect(component.scrollShadows()).toEqual({ left: true, right: false });
  });

  it('keeps column deletion behind confirmation when the column has cards', async () => {
    const fixture = await create();
    const component = fixture.componentInstance as unknown as TestKanbanComponent;
    const board = component.activeBoard();
    const columnId = board.columns[0].id;
    const cardId = 'card_test';
    component.state.set({
      ...component.state(),
      boards: [
        {
          ...board,
          columns: board.columns.map((col, idx: number) =>
            idx === 0 ? { ...col, cardIds: [cardId] } : col,
          ),
          cards: {
            ...board.cards,
            [cardId]: {
              id: cardId,
              title: 'Card',
              description: '',
              dueDate: '',
              labels: [],
              checklist: [],
            },
          },
        },
      ],
    });

    component.requestRemoveColumn(columnId);
    expect(component.confirmColumnId()).toBe(columnId);
  });

  it('can move the same card multiple times across columns', async () => {
    const fixture = await create();
    const component = fixture.componentInstance as unknown as TestKanbanComponent;
    const board = component.activeBoard();
    const [c1, c2, c3] = board.columns.map((col) => col.id);
    const cardId = 'card_repeat';

    component.state.set({
      ...component.state(),
      boards: [
        {
          ...board,
          columns: board.columns.map((col, idx: number) => ({
            ...col,
            cardIds: idx === 0 ? [cardId] : [],
          })),
          cards: {
            ...board.cards,
            [cardId]: {
              id: cardId,
              title: 'Card repeat',
              description: '',
              dueDate: '',
              labels: [],
              checklist: [],
            },
          },
        },
      ],
    });

    component.dragState = { cardId, fromColumnId: c1 };
    component.onDrop(c2, new Event('drop') as DragEvent);
    expect(component.activeBoard().columns.find((col) => col.id === c2)?.cardIds).toContain(cardId);

    component.dragState = { cardId, fromColumnId: c2 };
    component.onDrop(c3, new Event('drop') as DragEvent);
    expect(component.activeBoard().columns.find((col) => col.id === c3)?.cardIds).toContain(cardId);
  });
});
