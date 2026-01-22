import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppPreferencesService } from '../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../core/instance-settings.service';

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  labels: string[];
  checklist: ChecklistItem[];
}

interface KanbanColumn {
  id: string;
  title: string;
  cardIds: string[];
}

interface KanbanBoard {
  id: string;
  name: string;
  columns: KanbanColumn[];
  cards: Record<string, KanbanCard>;
}

interface KanbanState {
  boards: KanbanBoard[];
  activeBoardId: string;
  selectedCardId: string | null;
  selectedColumnId: string | null;
}

const stateStore = new Map<string, KanbanState>();
const STORAGE_PREFIX = 'op_app_state:kanban';

const storageKey = (userId: string, instanceId: string) =>
  `${STORAGE_PREFIX}:${userId}:${instanceId}`;

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function clearKanbanState(instanceId: string) {
  stateStore.delete(instanceId);
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function cloneKanbanState(fromId: string, toId: string) {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, JSON.parse(JSON.stringify(stored)) as KanbanState);
}

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div style="display:flex; flex-direction:column; gap:12px; height:100%;">
      @if (settingsOpen()) {
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0;">{{ 'kanban.settingsTitle' | translate }}</h3>
            <button (click)="closeSettings()">{{ 'kanban.closeSettings' | translate }}</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            @for (board of state().boards; track board.id) {
              <div style="display:flex; gap:8px; align-items:center;">
                <input
                  [value]="board.name"
                  (input)="renameBoard(board.id, $event)"
                  style="flex:1;"
                />
                <button (click)="removeBoard(board.id)" [disabled]="state().boards.length <= 1">
                  {{ 'kanban.removeBoard' | translate }}
                </button>
              </div>
            }
            <button (click)="addBoard()">{{ 'kanban.addBoard' | translate }}</button>
          </div>
        </div>
      } @else {
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <label>
            {{ 'kanban.boardLabel' | translate }}
            <select [value]="state().activeBoardId" (change)="selectBoard($event)">
              @for (board of state().boards; track board.id) {
                <option [value]="board.id" [selected]="board.id === state().activeBoardId">
                  {{ board.name }}
                </option>
              }
            </select>
          </label>
          @if (editingBoard()) {
            <input
              [value]="boardNameDraft()"
              (input)="boardNameDraft.set($any($event.target).value)"
              (blur)="finishBoardRename()"
              (keydown.enter)="finishBoardRename()"
            />
          } @else {
            <button (dblclick)="startBoardRename()">
              {{ activeBoard().name }}
            </button>
          }
        </div>

        <div style="display:flex; gap:12px; overflow:auto; flex:1;">
          @for (column of activeBoard().columns; track column.id) {
            <section
              style="flex:1; min-width:220px; border:1px solid var(--color-border); border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:8px;"
              (dragover)="onColumnDragOver($event)"
              (drop)="onDrop(column.id, $event)"
            >
              <div
                style="display:flex; align-items:center; justify-content:space-between; gap:6px;"
              >
                @if (editingColumnId() === column.id) {
                  <input
                    [value]="editingColumnName()"
                    (input)="editingColumnName.set($any($event.target).value)"
                    (blur)="finishColumnRename()"
                    (keydown.enter)="finishColumnRename()"
                    style="flex:1;"
                  />
                } @else {
                  <h4 style="margin:0;" (dblclick)="startColumnRename(column)">
                    {{ column.title }}
                  </h4>
                }
                <div style="display:flex; gap:4px; align-items:center;">
                  <button
                    (click)="addColumn(column.id)"
                    title="{{ 'kanban.addColumn' | translate }}"
                  >
                    +
                  </button>
                  <button
                    (click)="requestRemoveColumn(column.id)"
                    title="{{ 'kanban.removeColumn' | translate }}"
                  >
                    −
                  </button>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                @for (cardId of column.cardIds; track cardId) {
                  <div
                    draggable="true"
                    (dragstart)="onDragStart(column.id, cardId, $event)"
                    (click)="selectCard(column.id, cardId)"
                    (keydown.enter)="selectCard(column.id, cardId)"
                    (keydown.space)="$event.preventDefault(); selectCard(column.id, cardId)"
                    tabindex="0"
                    role="button"
                    style="border:1px solid var(--color-border); border-radius:6px; padding:8px; background:var(--color-surface); cursor:grab;"
                  >
                    <div style="font-weight:600;">{{ card(cardId).title }}</div>
                    @if (card(cardId).labels.length) {
                      <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
                        @for (label of card(cardId).labels; track label) {
                          <span
                            style="font-size:10px; padding:2px 6px; border-radius:10px; background:#e0f2fe;"
                          >
                            {{ label }}
                          </span>
                        }
                      </div>
                    }
                    @if (card(cardId).dueDate) {
                      <div style="font-size:11px; opacity:0.7; margin-top:4px;">
                        {{ 'kanban.due' | translate }}: {{ card(cardId).dueDate }}
                      </div>
                    }
                  </div>
                }
              </div>
              <button (click)="addCard(column.id)">{{ 'kanban.addCard' | translate }}</button>
            </section>
          }
        </div>

        @if (selectedCard()) {
          <div style="border-top:1px solid var(--color-border); padding-top:12px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <h4 style="margin:0 0 8px;">{{ 'kanban.cardDetails' | translate }}</h4>
              <button (click)="closeCardDetails()">{{ 'kanban.closeDetails' | translate }}</button>
            </div>
            <div style="display:grid; gap:8px; max-width:520px;">
              <label>
                {{ 'kanban.cardTitle' | translate }}
                <input [value]="selectedCard()?.title" (input)="updateCardTitle($event)" />
              </label>
              <label>
                {{ 'kanban.cardDescription' | translate }}
                <textarea
                  rows="3"
                  [value]="selectedCard()?.description"
                  (input)="updateCardDescription($event)"
                ></textarea>
              </label>
              <label>
                {{ 'kanban.cardDue' | translate }}
                <input
                  type="date"
                  [value]="selectedCard()?.dueDate"
                  (change)="updateCardDue($event)"
                />
              </label>
              <label>
                {{ 'kanban.cardLabels' | translate }}
                <input
                  [value]="(selectedCard()?.labels ?? []).join(', ')"
                  (input)="updateCardLabels($event)"
                />
              </label>

              <div>
                <div style="font-weight:600; margin-bottom:4px;">
                  {{ 'kanban.cardChecklist' | translate }}
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  @for (item of selectedCard()?.checklist ?? []; track item.id) {
                    <label style="display:flex; gap:6px; align-items:center;">
                      <input
                        type="checkbox"
                        [checked]="item.done"
                        (change)="toggleChecklist(item.id, $event)"
                      />
                      <input
                        [value]="item.text"
                        (input)="updateChecklistText(item.id, $event)"
                        style="flex:1;"
                      />
                      <button (click)="removeChecklist(item.id)">×</button>
                    </label>
                  }
                </div>
                <button (click)="addChecklistItem()" style="margin-top:6px;">
                  {{ 'kanban.addChecklist' | translate }}
                </button>
              </div>
            </div>
          </div>
        }
      }
    </div>

    @if (confirmColumnId()) {
      <div
        style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:3000;"
      >
        <div style="background:var(--color-surface); padding:20px; border-radius:8px; width:360px;">
          <p>{{ 'kanban.confirmRemoveColumn' | translate }}</p>
          @if (columnHasLeft(confirmColumnId()!)) {
            <label style="display:flex; gap:8px; align-items:center;">
              <input
                type="checkbox"
                [checked]="confirmMoveLeft()"
                (change)="confirmMoveLeft.set($any($event.target).checked)"
              />
              {{ 'kanban.moveItemsLeft' | translate }}
            </label>
          } @else {
            <div style="opacity:0.7;">{{ 'kanban.deleteItems' | translate }}</div>
          }
          <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
            <button (click)="confirmColumnId.set(null)">{{ 'dialogs.cancel' | translate }}</button>
            <button (click)="confirmRemoveColumn()">{{ 'dialogs.confirm' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class KanbanComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  private translate = inject(TranslateService);
  private instanceSettings = inject(InstanceSettingsService);
  state = signal<KanbanState>({
    boards: [],
    activeBoardId: '',
    selectedCardId: null,
    selectedColumnId: null,
  });
  settingsOpen = computed(() => this.instanceSettings.isOpen(this.instanceId));
  dragState: { cardId: string; fromColumnId: string } | null = null;
  editingBoard = signal(false);
  boardNameDraft = signal('');
  editingColumnId = signal<string | null>(null);
  editingColumnName = signal('');
  confirmColumnId = signal<string | null>(null);
  confirmMoveLeft = signal(false);

  ngOnInit() {
    const userId = this.prefs.userId();
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(storageKey(userId, this.instanceId));
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as KanbanState;
          this.state.set(parsed);
          stateStore.set(this.instanceId, parsed);
          return;
        } catch {
          // ignore malformed stored data
        }
      }
    }

    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.state.set(stored);
      return;
    }

    const defaultBoard = this.createDefaultBoard();
    const next: KanbanState = {
      boards: [defaultBoard],
      activeBoardId: defaultBoard.id,
      selectedCardId: null,
      selectedColumnId: null,
    };
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  closeSettings() {
    this.instanceSettings.close(this.instanceId);
  }

  activeBoard() {
    return (
      this.state().boards.find((b) => b.id === this.state().activeBoardId) ?? this.state().boards[0]
    );
  }

  card(cardId: string) {
    const board = this.activeBoard();
    return (
      board?.cards[cardId] ?? {
        id: cardId,
        title: '',
        description: '',
        dueDate: '',
        labels: [],
        checklist: [],
      }
    );
  }

  selectedCard() {
    const board = this.activeBoard();
    const id = this.state().selectedCardId;
    if (!id) return null;
    return board?.cards[id] ?? null;
  }

  selectBoard(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    this.state.set({
      ...this.state(),
      activeBoardId: id,
      selectedCardId: null,
      selectedColumnId: null,
    });
    this.persistState();
  }

  addBoard() {
    const board: KanbanBoard = {
      id: uid('board'),
      name: this.translate.instant('kanban.defaultBoard'),
      columns: this.defaultColumns(),
      cards: {},
    };
    const next = {
      ...this.state(),
      boards: [...this.state().boards, board],
      activeBoardId: board.id,
    };
    this.state.set(next);
    this.persistState();
  }

  removeBoard(boardId: string) {
    if (this.state().boards.length <= 1) return;
    const boards = this.state().boards.filter((b) => b.id !== boardId);
    const activeBoardId = boards[0]?.id ?? '';
    this.state.set({ ...this.state(), boards, activeBoardId });
    this.persistState();
  }

  renameBoard(boardId: string, event: Event) {
    const name = (event.target as HTMLInputElement).value;
    const boards = this.state().boards.map((board) =>
      board.id === boardId ? { ...board, name } : board,
    );
    this.state.set({ ...this.state(), boards });
    this.persistState();
  }

  startBoardRename() {
    this.editingBoard.set(true);
    this.boardNameDraft.set(this.activeBoard().name);
  }

  finishBoardRename() {
    const name = this.boardNameDraft().trim();
    if (name) {
      const boardId = this.state().activeBoardId;
      const boards = this.state().boards.map((board) =>
        board.id === boardId ? { ...board, name } : board,
      );
      this.state.set({ ...this.state(), boards });
      this.persistState();
    }
    this.editingBoard.set(false);
  }

  addCard(columnId: string) {
    const board = this.activeBoard();
    const cardId = uid('card');
    const card: KanbanCard = {
      id: cardId,
      title: this.translate.instant('kanban.defaultCardTitle'),
      description: '',
      dueDate: '',
      labels: [],
      checklist: [],
    };
    const columns = board.columns.map((column) =>
      column.id === columnId ? { ...column, cardIds: [...column.cardIds, cardId] } : column,
    );
    const nextBoard = { ...board, columns, cards: { ...board.cards, [cardId]: card } };
    this.updateBoard(nextBoard, cardId, columnId);
  }

  selectCard(columnId: string, cardId: string) {
    this.state.set({ ...this.state(), selectedCardId: cardId, selectedColumnId: columnId });
    this.persistState();
  }

  updateCardTitle(event: Event) {
    const card = this.selectedCard();
    if (!card) return;
    const title = (event.target as HTMLInputElement).value;
    this.updateCard({ ...card, title });
  }

  updateCardDescription(event: Event) {
    const card = this.selectedCard();
    if (!card) return;
    const description = (event.target as HTMLTextAreaElement).value;
    this.updateCard({ ...card, description });
  }

  updateCardDue(event: Event) {
    const card = this.selectedCard();
    if (!card) return;
    const dueDate = (event.target as HTMLInputElement).value;
    this.updateCard({ ...card, dueDate });
  }

  updateCardLabels(event: Event) {
    const card = this.selectedCard();
    if (!card) return;
    const labels = (event.target as HTMLInputElement).value
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);
    this.updateCard({ ...card, labels });
  }

  addChecklistItem() {
    const card = this.selectedCard();
    if (!card) return;
    const nextItem: ChecklistItem = { id: uid('chk'), text: '', done: false };
    this.updateCard({ ...card, checklist: [...card.checklist, nextItem] });
  }

  toggleChecklist(itemId: string, event: Event) {
    const card = this.selectedCard();
    if (!card) return;
    const checked = (event.target as HTMLInputElement).checked;
    const checklist = card.checklist.map((item) =>
      item.id === itemId ? { ...item, done: checked } : item,
    );
    this.updateCard({ ...card, checklist });
  }

  updateChecklistText(itemId: string, event: Event) {
    const card = this.selectedCard();
    if (!card) return;
    const text = (event.target as HTMLInputElement).value;
    const checklist = card.checklist.map((item) => (item.id === itemId ? { ...item, text } : item));
    this.updateCard({ ...card, checklist });
  }

  removeChecklist(itemId: string) {
    const card = this.selectedCard();
    if (!card) return;
    const checklist = card.checklist.filter((item) => item.id !== itemId);
    this.updateCard({ ...card, checklist });
  }

  onDragStart(columnId: string, cardId: string, event: DragEvent) {
    this.dragState = { cardId, fromColumnId: columnId };
    event.dataTransfer?.setData('text/plain', cardId);
  }

  onColumnDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(targetColumnId: string, event: DragEvent) {
    event.preventDefault();
    if (!this.dragState) return;
    const { cardId, fromColumnId } = this.dragState;
    if (fromColumnId === targetColumnId) return;
    const board = this.activeBoard();
    const columns = board.columns.map((column) => {
      if (column.id === fromColumnId) {
        return { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) };
      }
      if (column.id === targetColumnId) {
        return { ...column, cardIds: [...column.cardIds, cardId] };
      }
      return column;
    });
    const nextBoard = { ...board, columns };
    this.updateBoard(nextBoard, cardId, targetColumnId);
    this.dragState = null;
  }

  closeCardDetails() {
    this.state.set({ ...this.state(), selectedCardId: null, selectedColumnId: null });
    this.persistState();
  }

  startColumnRename(column: KanbanColumn) {
    this.editingColumnId.set(column.id);
    this.editingColumnName.set(column.title);
  }

  finishColumnRename() {
    const columnId = this.editingColumnId();
    if (!columnId) return;
    const name = this.editingColumnName().trim();
    if (name) {
      const board = this.activeBoard();
      const columns = board.columns.map((column) =>
        column.id === columnId ? { ...column, title: name } : column,
      );
      this.updateBoard({ ...board, columns });
    }
    this.editingColumnId.set(null);
  }

  addColumn(afterColumnId?: string) {
    const board = this.activeBoard();
    const nextColumn: KanbanColumn = {
      id: uid('col'),
      title: this.translate.instant('kanban.defaultColumn'),
      cardIds: [],
    };
    const columns = [...board.columns];
    if (afterColumnId) {
      const idx = columns.findIndex((column) => column.id === afterColumnId);
      if (idx >= 0) {
        columns.splice(idx + 1, 0, nextColumn);
      } else {
        columns.push(nextColumn);
      }
    } else {
      columns.push(nextColumn);
    }
    this.updateBoard({ ...board, columns });
  }

  requestRemoveColumn(columnId: string) {
    const board = this.activeBoard();
    const column = board.columns.find((item) => item.id === columnId);
    if (!column) return;
    if (column.cardIds.length === 0) {
      this.removeColumn(columnId, false);
      return;
    }
    const hasLeft = this.columnHasLeft(columnId);
    this.confirmMoveLeft.set(hasLeft);
    this.confirmColumnId.set(columnId);
  }

  confirmRemoveColumn() {
    const columnId = this.confirmColumnId();
    if (!columnId) return;
    this.removeColumn(columnId, this.confirmMoveLeft());
    this.confirmColumnId.set(null);
  }

  columnHasLeft(columnId: string) {
    const columns = this.activeBoard().columns;
    const idx = columns.findIndex((column) => column.id === columnId);
    return idx > 0;
  }

  private removeColumn(columnId: string, moveLeft: boolean) {
    const board = this.activeBoard();
    const columns = board.columns;
    const idx = columns.findIndex((column) => column.id === columnId);
    if (idx === -1) return;
    const leftColumn = idx > 0 ? columns[idx - 1] : null;
    const target = columns[idx];
    const shouldMoveLeft = moveLeft && !!leftColumn;
    const nextColumns = columns.filter((column) => column.id !== columnId);
    const nextCards = { ...board.cards };

    if (shouldMoveLeft && leftColumn) {
      const updatedLeft = {
        ...leftColumn,
        cardIds: [...leftColumn.cardIds, ...target.cardIds],
      };
      nextColumns[idx - 1] = updatedLeft;
    } else {
      target.cardIds.forEach((cardId) => {
        delete nextCards[cardId];
      });
    }

    const selectedCardId = this.state().selectedCardId;
    const selectedColumnId = this.state().selectedColumnId;
    const nextSelectedCardId =
      selectedCardId && target.cardIds.includes(selectedCardId) ? null : selectedCardId;
    const nextSelectedColumnId = selectedColumnId === columnId ? null : selectedColumnId;

    this.state.set({
      ...this.state(),
      boards: this.state().boards.map((b) =>
        b.id === board.id ? { ...board, columns: nextColumns, cards: nextCards } : b,
      ),
      selectedCardId: nextSelectedCardId,
      selectedColumnId: nextSelectedColumnId,
    });
    this.persistState();
  }

  private updateCard(card: KanbanCard) {
    const board = this.activeBoard();
    const nextBoard = { ...board, cards: { ...board.cards, [card.id]: card } };
    this.updateBoard(nextBoard, card.id, this.state().selectedColumnId);
  }

  private updateBoard(
    nextBoard: KanbanBoard,
    selectedCardId?: string | null,
    selectedColumnId?: string | null,
  ) {
    const boards = this.state().boards.map((board) =>
      board.id === nextBoard.id ? nextBoard : board,
    );
    this.state.set({
      ...this.state(),
      boards,
      selectedCardId: selectedCardId ?? this.state().selectedCardId,
      selectedColumnId: selectedColumnId ?? this.state().selectedColumnId,
    });
    this.persistState();
  }

  private defaultColumns() {
    return [
      { id: uid('col'), title: this.translate.instant('kanban.columnTodo'), cardIds: [] },
      { id: uid('col'), title: this.translate.instant('kanban.columnInProgress'), cardIds: [] },
      { id: uid('col'), title: this.translate.instant('kanban.columnDone'), cardIds: [] },
    ];
  }

  private createDefaultBoard(): KanbanBoard {
    return {
      id: uid('board'),
      name: this.translate.instant('kanban.defaultBoard'),
      columns: this.defaultColumns(),
      cards: {},
    };
  }

  private persistState() {
    if (typeof window === 'undefined') return;
    const userId = this.prefs.userId();
    window.localStorage.setItem(storageKey(userId, this.instanceId), JSON.stringify(this.state()));
  }
}
