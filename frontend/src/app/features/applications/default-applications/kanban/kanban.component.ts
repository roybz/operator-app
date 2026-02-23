import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { LongPressDirective } from '../../../../shared/long-press/long-press.directive';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import {
  buildInstanceStorageKey,
  clearInstanceScopedState,
  cloneInstanceScopedState,
  persistInstanceState,
} from '../../../dependencies/instance-state-storage';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { ImportGuardService } from '../../../../core/import-guard.service';
import { ExportGuardService } from '../../../../core/export-guard.service';
import { StorageService } from '../../../../core/storage/storage.service';
import { RemoteConflictService } from '../../../../core/realtime/remote-conflict.service';
import { computeHorizontalScrollShadowState } from '../../../../shared/horizontal-scroll-shadow';

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

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function clearKanbanState(instanceId: string, storage: StorageService) {
  clearInstanceScopedState(stateStore, STORAGE_PREFIX, instanceId, storage);
}

export function cloneKanbanState(fromId: string, toId: string, storage: StorageService) {
  cloneInstanceScopedState(
    stateStore,
    STORAGE_PREFIX,
    fromId,
    toId,
    storage,
    (stored) => JSON.parse(JSON.stringify(stored)) as KanbanState,
  );
}

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmDialogComponent, LongPressDirective],
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .kanban-board {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        overflow-y: hidden;
        min-width: 0;
        max-width: 100%;
        flex: 1;
      }
      .kanban-board--left {
        box-shadow: inset 10px 0 12px -10px color-mix(in srgb, var(--color-accent) 42%, transparent);
      }
      .kanban-board--right {
        box-shadow: inset -10px 0 12px -10px
          color-mix(in srgb, var(--color-accent) 42%, transparent);
      }
      .kanban-board--left.kanban-board--right {
        box-shadow:
          inset 10px 0 12px -10px color-mix(in srgb, var(--color-accent) 42%, transparent),
          inset -10px 0 12px -10px color-mix(in srgb, var(--color-accent) 42%, transparent);
      }

      :host-context(.phone-mode) .kanban-board {
        gap: 8px;
        padding: 4px 0 8px;
      }

      :host-context(.phone-mode) .kanban-board section {
        min-width: 220px !important;
      }

      .kanban-column--target {
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 68%, transparent);
      }

      :host-context(.phone-mode) .kanban-shell {
        padding: 12px;
      }

      :host-context(.phone-mode) .kanban-card {
        touch-action: none;
      }

      .kanban-card {
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 8px;
        background: var(--color-surface);
        cursor: grab;
        position: relative;
      }

      .kanban-card__edit {
        position: absolute;
        top: 6px;
        right: 6px;
        opacity: 0.35;
        transition: opacity 120ms ease;
        padding: 2px 5px;
        border-radius: 4px;
      }

      .kanban-card:hover .kanban-card__edit {
        opacity: 1;
      }

      .kanban-card--ghosted {
        opacity: 0.2;
      }

      .kanban-touch-ghost {
        position: fixed;
        pointer-events: none;
        z-index: 4500;
        max-width: min(260px, 80vw);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: color-mix(in srgb, var(--color-surface) 85%, transparent);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        padding: 8px 10px;
        font-weight: 600;
      }
    `,
  ],
  template: `
    <div class="kanban-shell" style="display:flex; flex-direction:column; gap:12px; height:100%;">
      @if (settingsOpen()) {
        <div
          style="display:flex; flex-direction:column; gap:12px; background:color-mix(in srgb, var(--color-surface) 85%, var(--color-border)); border-radius:8px; padding:10px;"
        >
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

        <div
          #boardScroll
          class="kanban-board"
          [class.kanban-board--left]="scrollShadows().left"
          [class.kanban-board--right]="scrollShadows().right"
          [style.overflowX]="touchDragState() ? 'hidden' : 'auto'"
          [style.touchAction]="touchDragState() ? 'none' : null"
          (scroll)="updateScrollShadows($event)"
        >
          @for (column of activeBoard().columns; track column.id) {
            <section
              [attr.data-column-id]="column.id"
              [class.kanban-column--target]="touchDropColumnId() === column.id"
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
                    &#8722;
                  </button>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                @for (cardId of column.cardIds; track cardId) {
                  <div
                    class="kanban-card"
                    [class.kanban-card--ghosted]="touchDragState()?.cardId === cardId"
                    [style.touchAction]="shouldUseTouchDrag() ? 'none' : null"
                    [draggable]="!shouldUseTouchDrag()"
                    (pointerdown)="onCardPointerDown($event)"
                    (pointermove)="onCardPointerMove($event)"
                    (pointerup)="onCardPointerEnd($event)"
                    (pointercancel)="onCardPointerEnd($event)"
                    (dragstart)="onDragStart(column.id, cardId, $event)"
                    (dragend)="onDragEnd()"
                    appLongPress
                    [longPressEnabled]="shouldUseTouchDrag()"
                    [longPressDelay]="180"
                    [longPressMoveTolerance]="28"
                    (longPress)="onCardLongPress(column.id, cardId, $event)"
                    (click)="selectCard(column.id, cardId)"
                    (keydown.enter)="selectCard(column.id, cardId)"
                    (keydown.space)="$event.preventDefault(); selectCard(column.id, cardId)"
                    tabindex="0"
                    role="button"
                  >
                    <button
                      class="kanban-card__edit"
                      (click)="openCardDetails(column.id, cardId); $event.stopPropagation()"
                      title="{{ 'kanban.cardDetails' | translate }}"
                    >
                      &#9998;
                    </button>
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

        @if (touchDragState()) {
          <div
            class="kanban-touch-ghost"
            [style.left.px]="touchDragState()!.x - touchDragState()!.offsetX"
            [style.top.px]="touchDragState()!.y - touchDragState()!.offsetY"
          >
            {{ card(touchDragState()!.cardId).title }}
          </div>
        }

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
                      <button (click)="removeChecklist(item.id)">&#215;</button>
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
export class KanbanComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) instanceId!: string;
  @ViewChild('boardScroll') boardScroll?: ElementRef<HTMLDivElement>;
  private host = inject(ElementRef);

  private prefs = inject(AppPreferencesService);
  private translate = inject(TranslateService);
  private instanceSettings = inject(InstanceSettingsService);
  private importGuard = inject(ImportGuardService);
  private exportGuard = inject(ExportGuardService);
  private storage = inject(StorageService);
  private remoteConflict = inject(RemoteConflictService);
  state = signal<KanbanState>({
    boards: [],
    activeBoardId: '',
    selectedCardId: null,
    selectedColumnId: null,
  });
  settingsOpen = computed(() => this.instanceSettings.isOpen(this.instanceId));
  dragState: { cardId: string; fromColumnId: string } | null = null;
  touchDragState = signal<{
    cardId: string;
    fromColumnId: string;
    pointerId: number;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  touchDropColumnId = signal<string | null>(null);
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
  scrollShadows = signal({ left: false, right: false });
  private suppressNextCardClick = false;
  private cardPanState: {
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null = null;
  private lastRemoteStorageChangeSeq = 0;
  private editFocusCount = 0;

  constructor() {
    effect(() => {
      const event = this.storage.lastRemoteChange();
      if (!event) return;
      if (event.seq <= this.lastRemoteStorageChangeSeq) return;
      this.lastRemoteStorageChangeSeq = event.seq;
      const key = this.instanceStorageKey();
      if (!this.instanceId || !event.keys.includes(key)) return;
      if (this.isLocallyEditing()) {
        this.remoteConflict.queue([key], 'dirty');
        return;
      }
      this.reloadFromStorage();
    });
  }

  ngOnInit() {
    if (this.reloadFromStorage()) return;

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

  @HostListener('focusin', ['$event'])
  onFocusIn(event: FocusEvent) {
    const target = event.target as HTMLElement | null;
    if (!target || !this.host.nativeElement.contains(target)) return;
    if (!this.isEditableTarget(target)) return;
    this.editFocusCount += 1;
    this.remoteConflict.markDirty(this.instanceStorageKey());
  }

  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent) {
    const target = event.target as HTMLElement | null;
    if (!target || !this.host.nativeElement.contains(target)) return;
    if (!this.isEditableTarget(target)) return;
    this.editFocusCount = Math.max(0, this.editFocusCount - 1);
    if (!this.isLocallyEditing()) {
      this.remoteConflict.clearDirty(this.instanceStorageKey());
    }
  }

  ngAfterViewInit() {
    if (this.boardScroll?.nativeElement) {
      const el = this.boardScroll.nativeElement;
      this.updateScrollShadows(el);
      requestAnimationFrame(() => this.updateScrollShadows(el));
      setTimeout(() => this.updateScrollShadows(el), 0);
    }
  }

  ngOnDestroy() {
    this.cleanupTouchDrag();
  }

  closeSettings() {
    this.instanceSettings.close(this.instanceId);
  }

  activeBoard() {
    return (
      this.state().boards.find((b) => b.id === this.state().activeBoardId) ?? this.state().boards[0]
    );
  }

  updateScrollShadows(eventOrTarget: Event | HTMLDivElement) {
    const target =
      this.boardScroll?.nativeElement ??
      (eventOrTarget instanceof Event
        ? (eventOrTarget.target as HTMLDivElement | null)
        : eventOrTarget);
    if (!target) return;
    const { showLeft, showRight } = computeHorizontalScrollShadowState(target);
    this.scrollShadows.set({ left: showLeft, right: showRight });
    const dialogBody = this.host.nativeElement
      .closest('.dialog')
      ?.querySelector('.dialog__body--phone, .dialog__body') as HTMLElement | null;
    if (!dialogBody) return;
    dialogBody.style.setProperty('--phone-scroll-shadow-left', 'none');
    dialogBody.style.setProperty('--phone-scroll-shadow-right', 'none');
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
    this.updateBoard(nextBoard, null, null);
  }

  selectCard(columnId: string, cardId: string) {
    if (this.touchDragState()) return;
    if (this.suppressNextCardClick) {
      this.suppressNextCardClick = false;
      return;
    }
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
    this.moveDraggedCard(targetColumnId);
  }

  onDragEnd() {
    this.dragState = null;
  }

  private moveDraggedCard(targetColumnId: string) {
    if (!this.dragState) return;
    const { cardId } = this.dragState;
    const board = this.activeBoard();
    const fromColumnId =
      board.columns.find((column) => column.cardIds.includes(cardId))?.id ??
      this.dragState.fromColumnId;
    if (fromColumnId === targetColumnId) return;
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
    this.updateBoard(nextBoard);
    this.dragState = null;
  }

  onCardLongPress(columnId: string, cardId: string, event: PointerEvent) {
    if (!this.shouldUseTouchDrag()) return;
    const target = event.target as HTMLElement | null;
    const cardEl = target?.closest('.kanban-card') as HTMLElement | null;
    if (!cardEl) return;
    this.dragState = { cardId, fromColumnId: columnId };
    this.touchDragState.set({
      cardId,
      fromColumnId: columnId,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: 18,
      offsetY: 18,
    });
    this.touchDropColumnId.set(columnId);
    this.suppressNextCardClick = true;
    window.addEventListener('pointermove', this.onTouchDragMove, { passive: false });
    window.addEventListener('pointerup', this.onTouchDragEnd);
    window.addEventListener('pointercancel', this.onTouchDragEnd);
    event.preventDefault();
  }

  private onTouchDragMove = (event: PointerEvent) => {
    const state = this.touchDragState();
    if (!state || event.pointerId !== state.pointerId) return;
    event.preventDefault();
    this.touchDragState.set({
      ...state,
      x: event.clientX,
      y: event.clientY,
    });
    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const column = target?.closest('[data-column-id]') as HTMLElement | null;
    this.touchDropColumnId.set(column?.getAttribute('data-column-id') ?? null);
    this.autoScrollWhileDragging(event.clientX);
  };

  private onTouchDragEnd = (event: PointerEvent) => {
    const state = this.touchDragState();
    if (!state || event.pointerId !== state.pointerId) return;
    const targetColumnId = this.touchDropColumnId();
    if (targetColumnId && this.dragState) {
      this.moveDraggedCard(targetColumnId);
    } else {
      this.dragState = null;
    }
    this.cleanupTouchDrag();
  };

  private cleanupTouchDrag() {
    this.touchDragState.set(null);
    this.touchDropColumnId.set(null);
    window.removeEventListener('pointermove', this.onTouchDragMove);
    window.removeEventListener('pointerup', this.onTouchDragEnd);
    window.removeEventListener('pointercancel', this.onTouchDragEnd);
  }

  onCardPointerDown(event: PointerEvent) {
    if (!this.shouldUseTouchDrag()) return;
    if (event.pointerType === 'mouse') return;
    this.cardPanState = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
  }

  onCardPointerMove(event: PointerEvent) {
    if (!this.shouldUseTouchDrag()) return;
    if (event.pointerType === 'mouse') return;
    if (!this.cardPanState || this.cardPanState.pointerId !== event.pointerId) return;
    if (this.touchDragState()) return;
    const board = this.boardScroll?.nativeElement;
    if (!board) return;
    const dx = event.clientX - this.cardPanState.lastX;
    const dy = event.clientY - this.cardPanState.lastY;
    this.cardPanState.lastX = event.clientX;
    this.cardPanState.lastY = event.clientY;
    if (Math.abs(dx) < 0.5 || Math.abs(dx) < Math.abs(dy)) return;
    const maxLeft = Math.max(0, board.scrollWidth - board.clientWidth);
    const next = Math.max(0, Math.min(maxLeft, board.scrollLeft - dx));
    if (next === board.scrollLeft) return;
    board.scrollLeft = next;
    this.updateScrollShadows(board);
    event.preventDefault();
  }

  onCardPointerEnd(event: PointerEvent) {
    if (!this.cardPanState || this.cardPanState.pointerId !== event.pointerId) return;
    this.cardPanState = null;
  }

  private autoScrollWhileDragging(pointerX: number) {
    const board = this.boardScroll?.nativeElement;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const edge = 52;
    let delta = 0;
    if (pointerX < rect.left + edge) {
      delta = -Math.ceil((rect.left + edge - pointerX) / 7);
    } else if (pointerX > rect.right - edge) {
      delta = Math.ceil((pointerX - (rect.right - edge)) / 7);
    }
    if (!delta) return;
    const maxLeft = Math.max(0, board.scrollWidth - board.clientWidth);
    const next = Math.max(0, Math.min(maxLeft, board.scrollLeft + delta * 3));
    if (next === board.scrollLeft) return;
    board.scrollLeft = next;
    this.updateScrollShadows(board);
  }

  shouldUseTouchDrag() {
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const hasTouchPoints = (navigator.maxTouchPoints ?? 0) > 0;
    return this.isPhoneMode() || coarse || hasTouchPoints;
  }

  closeCardDetails() {
    this.state.set({ ...this.state(), selectedCardId: null, selectedColumnId: null });
    this.persistState();
  }

  openCardDetails(columnId: string, cardId: string) {
    this.selectCard(columnId, cardId);
  }

  isPhoneMode() {
    if (typeof document === 'undefined') return false;
    const hostEl = this.host.nativeElement as HTMLElement;
    return Boolean(hostEl.closest('.phone-mode') || document.body.classList.contains('phone-mode'));
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
      selectedCardId: selectedCardId === undefined ? this.state().selectedCardId : selectedCardId,
      selectedColumnId:
        selectedColumnId === undefined ? this.state().selectedColumnId : selectedColumnId,
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
    const userId = this.prefs.userId();
    persistInstanceState(STORAGE_PREFIX, userId, this.instanceId, this.state(), this.storage);
  }

  private reloadFromStorage() {
    const raw = this.storage.getItemSync(this.instanceStorageKey());
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as KanbanState;
      this.state.set(parsed);
      stateStore.set(this.instanceId, parsed);
      return true;
    } catch {
      return false;
    }
  }

  private instanceStorageKey() {
    return buildInstanceStorageKey(STORAGE_PREFIX, this.prefs.userId(), this.instanceId || '');
  }

  private isLocallyEditing() {
    return Boolean(
      this.editFocusCount > 0 ||
      this.editingBoard() ||
      this.editingColumnId() ||
      this.touchDragState(),
    );
  }

  private isEditableTarget(target: HTMLElement) {
    if (target.isContentEditable) return true;
    if (target instanceof HTMLTextAreaElement) return true;
    if (target instanceof HTMLInputElement) {
      const type = (target.type || 'text').toLowerCase();
      return !['checkbox', 'radio', 'button', 'submit', 'file', 'color', 'date'].includes(type);
    }
    return false;
  }
}
