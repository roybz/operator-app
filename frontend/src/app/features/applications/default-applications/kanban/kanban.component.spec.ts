import { TestBed } from '@angular/core/testing';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import {
  KanbanBoard,
  KanbanComponent,
  KanbanState,
  mergeKanbanStatesForSync,
  normalizeKanbanStateForSync,
} from './kanban.component';
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
  const defaultBoardFactory = (): KanbanBoard => ({
    id: 'board_default',
    name: 'Default',
    columns: [{ id: 'col_default', title: 'Todo', cardIds: [] }],
    cards: {},
  });

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

  it('normalizes duplicate/phantom card references in columns', () => {
    const state: KanbanState = {
      boards: [
        {
          id: 'b1',
          name: 'Board',
          columns: [
            { id: 'c1', title: 'Todo', cardIds: ['card1', 'card1', 'ghost'] },
            { id: 'c2', title: 'Done', cardIds: ['card1'] },
          ],
          cards: {
            card1: {
              id: 'card1',
              title: 'Card 1',
              description: '',
              dueDate: '',
              labels: [],
              checklist: [],
            },
            card2: {
              id: 'card2',
              title: 'Card 2',
              description: '',
              dueDate: '',
              labels: [],
              checklist: [],
            },
          },
        },
      ],
      activeBoardId: 'b1',
      selectedCardId: 'ghost',
      selectedColumnId: 'missing',
    };

    const normalized = normalizeKanbanStateForSync(state, defaultBoardFactory);
    const board = normalized.boards[0];
    expect(board.columns[0].cardIds).toContain('card1');
    expect(board.columns[0].cardIds).toContain('card2');
    expect(board.columns[0].cardIds).not.toContain('ghost');
    expect(board.columns[1].cardIds).not.toContain('card1');
    expect(normalized.selectedCardId).toBeNull();
    expect(normalized.selectedColumnId).toBeNull();
  });

  it('merges local and remote board state without dropping cards during conflicts', () => {
    const remote: KanbanState = {
      boards: [
        {
          id: 'b1',
          name: 'Remote Board',
          columns: [
            { id: 'c1', title: 'Todo', cardIds: ['card_shared'] },
            { id: 'c2', title: 'Done', cardIds: ['card_remote'] },
          ],
          cards: {
            card_shared: {
              id: 'card_shared',
              title: 'Remote Shared',
              description: '',
              dueDate: '',
              labels: [],
              checklist: [],
            },
            card_remote: {
              id: 'card_remote',
              title: 'Remote only',
              description: '',
              dueDate: '',
              labels: [],
              checklist: [],
            },
          },
        },
      ],
      activeBoardId: 'b1',
      selectedCardId: null,
      selectedColumnId: null,
    };
    const local: KanbanState = {
      boards: [
        {
          id: 'b1',
          name: 'Local Rename',
          columns: [
            { id: 'c1', title: 'Todo', cardIds: ['card_local', 'card_shared'] },
            { id: 'c2', title: 'Done', cardIds: [] },
          ],
          cards: {
            card_shared: {
              id: 'card_shared',
              title: 'Local Shared',
              description: '',
              dueDate: '',
              labels: [],
              checklist: [],
            },
            card_local: {
              id: 'card_local',
              title: 'Local only',
              description: '',
              dueDate: '',
              labels: [],
              checklist: [],
            },
          },
        },
      ],
      activeBoardId: 'b1',
      selectedCardId: 'card_local',
      selectedColumnId: 'c1',
    };

    const merged = mergeKanbanStatesForSync(remote, local, defaultBoardFactory);
    const board = merged.boards[0];
    expect(board.name).toBe('Local Rename');
    expect(board.cards['card_remote']).toBeTruthy();
    expect(board.cards['card_local']).toBeTruthy();
    expect(board.cards['card_shared']?.title).toBe('Local Shared');
    const c1 = board.columns.find((column) => column.id === 'c1');
    const c2 = board.columns.find((column) => column.id === 'c2');
    expect(c1?.cardIds).toContain('card_shared');
    expect(c1?.cardIds).toContain('card_local');
    expect(c2?.cardIds).toContain('card_remote');
  });

  it('creates card from external context using source title/content', async () => {
    const fixture = await create();
    const component = fixture.componentInstance;

    component.externalContextRef.set({
      universeId: 'u_ctx',
      instanceId: 'other',
      kind: 'note',
      id: 'n1',
      title: 'From note title',
      content: 'From note content',
    });

    component.createCardFromExternalContext();

    const board = component.activeBoard();
    const selected = component.state().selectedCardId;
    expect(selected).toBeTruthy();
    const created = selected ? board.cards[selected] : null;
    expect(created?.title).toBe('From note title');
    expect(created?.description).toBe('From note content');
  });
});
