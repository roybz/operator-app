import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { ImportGuardService } from '../../../../core/import-guard.service';
import { ExportGuardService } from '../../../../core/export-guard.service';

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
  imports: [CommonModule, TranslateModule, ConfirmDialogComponent],
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
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button (click)="exportInstance()">{{ 'kanban.exportInstance' | translate }}</button>
              <label style="display:inline-flex; align-items:center; gap:8px;">
                <span>{{ 'kanban.importInstance' | translate }}</span>
                <input type="file" accept=".json" (change)="queueImport($event)" />
              </label>
              <button (click)="confirmWipeInstance()">
                {{ 'kanban.wipeInstance' | translate }}
              </button>
            </div>
            @if (importStatus() === 'loading') {
              <div style="opacity:0.7;">{{ 'dialogs.importing' | translate }}</div>
            } @else if (importStatus() === 'success') {
              <div style="color:#1b5e20;">{{ 'dialogs.importSuccess' | translate }}</div>
            } @else if (importStatus() === 'error') {
              <div style="color:#b00020;">{{ importMessage() ?? '' | translate }}</div>
            }
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
      <app-confirm-dialog
        [message]="'kanban.confirmRemoveColumn' | translate"
        [confirmLabel]="'dialogs.confirm' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmRemoveColumn()"
        (canceled)="confirmColumnId.set(null)"
      >
        @if (columnHasLeft(confirmColumnId()!)) {
          <label style="display:flex; gap:8px; align-items:center; margin-top:8px;">
            <input
              type="checkbox"
              [checked]="confirmMoveLeft()"
              (change)="confirmMoveLeft.set($any($event.target).checked)"
            />
            {{ 'kanban.moveItemsLeft' | translate }}
          </label>
        } @else {
          <div style="opacity:0.7; margin-top:8px;">{{ 'kanban.deleteItems' | translate }}</div>
        }
      </app-confirm-dialog>
    }
    @if (confirmWipeOpen()) {
      <app-confirm-dialog
        [message]="'kanban.confirmWipeInstance' | translate"
        [confirmLabel]="'kanban.wipeInstance' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="wipeInstance()"
        (canceled)="confirmWipeOpen.set(false)"
      />
    }
    @if (pendingImport()) {
      <app-confirm-dialog
        [title]="'dialogs.importTitle' | translate"
        [message]="'dialogs.importConfirm' | translate"
        [confirmLabel]="'dialogs.confirm' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmImport()"
        (canceled)="cancelImport()"
      />
    }
    @if (importLimitOpen()) {
      <app-confirm-dialog
        [message]="'dialogs.importLimit' | translate"
        [confirmLabel]="'dialogs.ok' | translate"
        [showCancel]="false"
        (confirmed)="importLimitOpen.set(false)"
      />
    }
    @if (exportLimitOpen()) {
      <app-confirm-dialog
        [message]="'dialogs.exportLimit' | translate"
        [confirmLabel]="'dialogs.ok' | translate"
        [showCancel]="false"
        (confirmed)="exportLimitOpen.set(false)"
      />
    }
  `,
})
export class KanbanComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  private translate = inject(TranslateService);
  private instanceSettings = inject(InstanceSettingsService);
  private importGuard = inject(ImportGuardService);
  private exportGuard = inject(ExportGuardService);
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
  confirmWipeOpen = signal(false);
  pendingImport = signal<{ file: File; input: HTMLInputElement } | null>(null);
  importStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  importMessage = signal<string | null>(null);
  importLimitOpen = signal(false);
  exportLimitOpen = signal(false);

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

  exportInstance() {
    if (!this.exportGuard.start()) {
      this.exportLimitOpen.set(true);
      return;
    }
    const data = JSON.stringify(this.state(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kanban-${this.instanceId}.json`;
    link.click();
    URL.revokeObjectURL(url);
    window.setTimeout(() => this.exportGuard.finish(), 500);
  }

  queueImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importStatus.set('idle');
    this.importMessage.set(null);
    this.pendingImport.set({ file, input });
  }

  cancelImport() {
    const pending = this.pendingImport();
    if (pending) pending.input.value = '';
    this.pendingImport.set(null);
    this.importStatus.set('idle');
    this.importMessage.set(null);
  }

  confirmImport() {
    const pending = this.pendingImport();
    if (!pending) return;
    if (!this.importGuard.start()) {
      this.importLimitOpen.set(true);
      return;
    }
    this.importStatus.set('loading');
    this.importMessage.set('dialogs.importing');
    this.pendingImport.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}')) as KanbanState;
        this.mergeImported(parsed);
        this.importStatus.set('success');
        this.importMessage.set('dialogs.importSuccess');
      } catch {
        this.importStatus.set('error');
        this.importMessage.set('dialogs.importFailed');
      } finally {
        pending.input.value = '';
        this.importGuard.finish();
      }
    };
    reader.onerror = () => {
      this.importStatus.set('error');
      this.importMessage.set('dialogs.importFailed');
      pending.input.value = '';
      this.importGuard.finish();
    };
    reader.readAsText(pending.file);
  }

  confirmWipeInstance() {
    this.confirmWipeOpen.set(true);
  }

  wipeInstance() {
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
    this.confirmWipeOpen.set(false);
  }

  private mergeImported(imported: KanbanState) {
    if (!imported || !Array.isArray(imported.boards)) return;
    const boards = imported.boards.map((board) => this.cloneBoard(board));
    const nextBoards = [...this.state().boards, ...boards];
    this.state.set({
      ...this.state(),
      boards: nextBoards,
      activeBoardId: this.state().activeBoardId || nextBoards[0]?.id,
    });
    this.persistState();
  }

  private cloneBoard(board: KanbanBoard): KanbanBoard {
    const cardMap = new Map<string, string>();
    const cards: Record<string, KanbanCard> = {};
    Object.values(board.cards ?? {}).forEach((card) => {
      const nextId = uid('card');
      cardMap.set(card.id, nextId);
      cards[nextId] = {
        ...card,
        id: nextId,
        checklist: (card.checklist ?? []).map((item) => ({ ...item, id: uid('chk') })),
      };
    });
    const columns = (board.columns ?? []).map((col) => {
      const nextId = uid('col');
      return {
        ...col,
        id: nextId,
        cardIds: (col.cardIds ?? []).map((id) => cardMap.get(id)).filter(Boolean) as string[],
      };
    });
    return {
      id: uid('board'),
      name: board.name || this.translate.instant('kanban.defaultBoard'),
      columns,
      cards,
    };
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
