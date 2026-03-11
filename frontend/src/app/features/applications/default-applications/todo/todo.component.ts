import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  Todo,
  TodoProject,
  TodoState,
  TodoSubtask,
  createSubtask,
  createTodoItem,
  loadTodoState,
  mergeTodoStates,
  parseTodoState,
  serializeTodoState,
} from './todo-api';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { ImportGuardService } from '../../../../core/import-guard.service';
import { ExportGuardService } from '../../../../core/export-guard.service';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { StorageService } from '../../../../core/storage/storage.service';
import { RemoteConflictService } from '../../../../core/realtime/remote-conflict.service';
import {
  InstancePersistQueue,
  isRemoteStorageTooManyRequests,
  isRemoteStorageVersionConflict,
} from '../../../../core/realtime/instance-persist-queue';
import { UniverseEventHubService } from '../../../../core/events/universe-event-hub.service';
import { ContextFieldStoreService } from '../../../../core/events/context-field-store.service';
import { ObjectRef } from '../../../../core/events/context-fields.types';

const TODO_STATE_STORAGE_KEY = 'op_todo_state_v2';

@Component({
  selector: 'app-todo-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmDialogComponent],
  template: `
    <main
      class="todo-shell"
      style="max-width: 760px; margin: 24px auto; display:flex; flex-direction:column; gap:12px;"
    >
      @if (settingsOpen()) {
        <section style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0;">{{ 'todo.settingsTitle' | translate }}</h3>
            <button (click)="closeSettings()">{{ 'todo.closeSettings' | translate }}</button>
          </div>
          <label style="display:flex; align-items:center; gap:8px;">
            <input
              type="checkbox"
              [checked]="state().projectsEnabled"
              (change)="toggleProjects($event)"
            />
            {{ 'todo.projectsEnabled' | translate }}
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input
              type="checkbox"
              [checked]="state().showSubtaskDelete !== false"
              (change)="toggleSubtaskDeleteVisibility($event)"
            />
            {{ 'todo.showSubtaskDelete' | translate }}
          </label>
          @if (state().projectsEnabled) {
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <input
                  #projectName
                  type="text"
                  [placeholder]="'todo.projectName' | translate"
                  style="flex:1; padding:8px;"
                />
                <button (click)="addProject(projectName.value); projectName.value = ''">
                  {{ 'todo.addProject' | translate }}
                </button>
              </div>
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="text-align:left; padding:6px 0;">
                      {{ 'todo.projectsTitle' | translate }}
                    </th>
                    <th style="text-align:left; padding:6px 0;">
                      {{ 'todo.actions' | translate }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (project of state().projects; track project.id) {
                    <tr>
                      <td style="padding:6px 0;">
                        <input
                          [value]="project.title"
                          (blur)="renameProject(project.id, $any($event.target).value)"
                          (keydown.enter)="renameProject(project.id, $any($event.target).value)"
                          style="width:100%; padding:6px;"
                        />
                      </td>
                      <td style="padding:6px 0;">
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                          <button (click)="moveProject(project.id, -1)" [disabled]="$index === 0">
                            ↑
                          </button>
                          <button
                            (click)="moveProject(project.id, 1)"
                            [disabled]="$index === state().projects.length - 1"
                          >
                            ↓
                          </button>
                          <button (click)="promptWipeProject(project.id)">
                            {{ 'todo.wipeProject' | translate }}
                          </button>
                          <button
                            (click)="promptDeleteProject(project.id)"
                            [disabled]="state().projects.length <= 1"
                          >
                            {{ 'todo.deleteProject' | translate }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" (click)="transformToKanbanRequest.emit()">Todo → Kanban</button>
              <button (click)="exportInstance()">{{ 'todo.exportInstance' | translate }}</button>
              <label style="display:inline-flex; align-items:center; gap:8px;">
                <span>{{ 'todo.importInstance' | translate }}</span>
                <input type="file" accept=".json" (change)="queueImport($event)" />
              </label>
              <button (click)="confirmWipeInstance()">{{ 'todo.wipeInstance' | translate }}</button>
            </div>
            @if (importStatus() === 'loading') {
              <div style="opacity:0.7;">{{ 'dialogs.importing' | translate }}</div>
            } @else if (importStatus() === 'success') {
              <div style="color:#1b5e20;">{{ 'dialogs.importSuccess' | translate }}</div>
            } @else if (importStatus() === 'error') {
              <div style="color:#b00020;">{{ importMessage() ?? '' | translate }}</div>
            }
          </div>
        </section>
      } @else {
        <header style="display:flex; align-items:center; justify-content:space-between;">
          <h2 style="margin:0;">{{ 'todo.title' | translate }}</h2>
          <button class="todo__clear" (click)="promptClearCompleted()" [disabled]="!hasCompleted()">
            {{ 'todo.clearCompleted' | translate }}
          </button>
        </header>
        @if (contextSuggestionsEnabled() && externalContextRef()) {
          <div
            style="border:1px solid var(--color-border); border-radius:8px; padding:8px; display:flex; justify-content:space-between; gap:8px; align-items:center;"
          >
            <span style="font-size:12px; opacity:0.8; font-style:italic;">
              {{ externalContextPrompt() }}
            </span>
            <button type="button" (click)="createTodoFromExternalContext()">
              {{ 'todo.add' | translate }}
            </button>
          </div>
        }

        @if (state().projectsEnabled) {
          <label style="display:flex; align-items:center; gap:8px; max-width:260px;">
            {{ 'todo.activeProject' | translate }}
            <select [value]="state().activeProjectId" (change)="selectProject($event)">
              @for (project of state().projects; track project.id) {
                <option [value]="project.id">{{ project.title }}</option>
              }
            </select>
          </label>
        }

        <section class="todo-entry" style="display:flex; gap:8px; margin: 4px 0 0;">
          <input
            #txt
            [placeholder]="'todo.placeholder' | translate"
            style="flex:1; padding:10px;"
            (keydown.enter)="onAdd(txt.value); txt.value = ''"
          />
          <button style="padding:10px 14px;" (click)="onAdd(txt.value); txt.value = ''">
            {{ 'todo.add' | translate }}
          </button>
        </section>
      }

      @if (err()) {
        <p style="color:#b00020;">{{ err() }}</p>
      }
      @if (loading()) {
        <p>{{ 'todo.loading' | translate }}</p>
      }

      @if (!settingsOpen()) {
        <div style="display:grid; gap:10px;">
          @for (t of todos(); track t.id) {
            <article
              style="border:1px solid #ddd; border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:10px; position:relative;"
              [attr.data-todo-id]="t.id"
            >
              @if (hoverTodoId() === t.id) {
                <span
                  class="todo__drop-line"
                  [class.todo__drop-line--above]="hoverTodoSide() === 'above'"
                  [class.todo__drop-line--below]="hoverTodoSide() === 'below'"
                ></span>
              }
              <div style="display:flex; justify-content:space-between; gap:12px;">
                <div style="min-width:0; flex:1;">
                  <label style="display:flex; align-items:center; gap:8px;">
                    <span
                      class="todo__drag"
                      (pointerdown)="startTodoDrag(t, $event)"
                      title="{{ 'todo.drag' | translate }}"
                    >
                      ≡
                    </span>
                    <input
                      type="checkbox"
                      [checked]="t.completed"
                      (change)="toggleComplete(t, $event)"
                    />
                    @if (editingId() === t.id) {
                      <input
                        [attr.data-edit-id]="t.id"
                        [value]="editingText()"
                        (input)="editingText.set($any($event.target).value)"
                        (blur)="finishEdit(t)"
                        (keydown.enter)="finishEdit(t)"
                        style="flex:1; padding:6px;"
                      />
                    } @else {
                      <button
                        type="button"
                        style="font-weight:600; white-space:normal; overflow-wrap:anywhere; word-break:break-word; cursor:text; background:transparent; border:none; padding:0; text-align:left;"
                        [style.textDecoration]="t.completed ? 'line-through' : 'none'"
                        [style.opacity]="t.completed ? 0.6 : 1"
                        (click)="selectTodoContext(t); startEdit(t)"
                      >
                        {{ t.text }}
                      </button>
                    }
                  </label>
                </div>

                <div style="display:flex; gap:8px; align-items:center;">
                  <button (click)="onDuplicate(t)" [title]="'todo.duplicateTitle' | translate">
                    {{ 'todo.duplicate' | translate }}
                  </button>
                  <button (click)="requestDeleteTodo(t)" [title]="'todo.deleteTitle' | translate">
                    {{ 'todo.delete' | translate }}
                  </button>
                </div>
              </div>

              @if (state().projectsEnabled) {
                <div style="margin-left:26px; display:flex; flex-direction:column; gap:6px;">
                  <button
                    type="button"
                    class="todo__subtasks-toggle"
                    (click)="toggleSubtasks(t.id)"
                  >
                    <span>{{ isSubtasksCollapsed(t.id) ? '▶' : '▼' }}</span>
                    <span>{{ 'todo.subtasks' | translate }}</span>
                  </button>
                  @if (!isSubtasksCollapsed(t.id)) {
                    @for (sub of t.subtasks ?? []; track sub.id) {
                      <label
                        style="display:flex; align-items:center; gap:8px; position:relative;"
                        [attr.data-subtask-id]="sub.id"
                        [attr.data-subtask-todo-id]="t.id"
                      >
                        @if (hoverSubtask()?.subtaskId === sub.id) {
                          <span
                            class="todo__drop-line todo__drop-line--sub"
                            [class.todo__drop-line--above]="hoverSubtask()?.side === 'above'"
                            [class.todo__drop-line--below]="hoverSubtask()?.side === 'below'"
                          ></span>
                        }
                        <span
                          class="todo__drag todo__drag--sub"
                          (pointerdown)="startSubtaskDrag(t.id, sub, $event)"
                          title="{{ 'todo.drag' | translate }}"
                        >
                          ≡
                        </span>
                        <input
                          type="checkbox"
                          [checked]="sub.completed"
                          (change)="toggleSubtask(t.id, sub, $event)"
                        />
                        @if (editingSubtaskId() === sub.id) {
                          <input
                            [attr.data-sub-edit-id]="sub.id"
                            [value]="editingSubtaskText()"
                            (input)="editingSubtaskText.set($any($event.target).value)"
                            (blur)="finishSubtaskEdit(t.id, sub)"
                            (keydown.enter)="finishSubtaskEdit(t.id, sub)"
                            style="flex:1; padding:4px;"
                          />
                        } @else {
                          <button
                            type="button"
                            style="background:transparent; border:none; padding:0; text-align:left; cursor:text;"
                            [style.textDecoration]="sub.completed ? 'line-through' : 'none'"
                            (click)="startSubtaskEdit(sub)"
                          >
                            {{ sub.text }}
                          </button>
                        }
                        @if (state().showSubtaskDelete !== false) {
                          <button
                            type="button"
                            style="margin-left:auto;"
                            (click)="requestDeleteSubtask(t.id, sub.id)"
                            [title]="'todo.confirmDeleteSubtask' | translate"
                          >
                            ✕
                          </button>
                        }
                      </label>
                    }
                    <div style="display:flex; gap:8px; align-items:center;">
                      <input
                        [value]="subtaskDraft(t.id)"
                        (input)="updateSubtaskDraft(t.id, $any($event.target).value)"
                        (keydown.enter)="addSubtask(t.id)"
                        style="flex:1; padding:6px;"
                        [placeholder]="'todo.subtaskPlaceholder' | translate"
                      />
                      <button (click)="addSubtask(t.id)">
                        {{ 'todo.addSubtask' | translate }}
                      </button>
                    </div>
                  }
                </div>
              }
            </article>
          }
        </div>
      }
    </main>

    @if (clearConfirmOpen()) {
      <app-confirm-dialog
        [message]="'todo.clearCompletedConfirm' | translate"
        [confirmLabel]="'todo.clearCompleted' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmClearCompleted()"
        (canceled)="clearConfirmOpen.set(false)"
      />
    }

    @if (projectWipeTarget()) {
      <app-confirm-dialog
        [message]="'todo.confirmWipeProject' | translate"
        [confirmLabel]="'todo.wipeProject' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmWipeProject()"
        (canceled)="projectWipeTarget.set(null)"
      />
    }

    @if (projectDeleteTarget()) {
      <app-confirm-dialog
        [message]="'todo.confirmDeleteProject' | translate"
        [confirmLabel]="'todo.deleteProject' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmDeleteProject()"
        (canceled)="projectDeleteTarget.set(null)"
      />
    }

    @if (instanceWipeOpen()) {
      <app-confirm-dialog
        [message]="'todo.confirmWipeInstance' | translate"
        [confirmLabel]="'todo.wipeInstance' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="wipeInstance()"
        (canceled)="instanceWipeOpen.set(false)"
      />
    }
    @if (todoDeleteTarget()) {
      <app-confirm-dialog
        [message]="'todo.confirmDeleteTodo' | translate"
        [confirmLabel]="'todo.delete' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmDeleteTodo()"
        (canceled)="todoDeleteTarget.set(null)"
      />
    }
    @if (subtaskDeleteTarget()) {
      <app-confirm-dialog
        [message]="'todo.confirmDeleteSubtask' | translate"
        [confirmLabel]="'todo.delete' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmDeleteSubtask()"
        (canceled)="subtaskDeleteTarget.set(null)"
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
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      :host-context(.phone-mode) .todo-shell {
        max-width: none;
        margin: 12px;
      }

      :host-context(.phone-mode) table {
        display: block;
        overflow-x: auto;
      }

      :host-context(.phone-mode) .todo-entry {
        flex-direction: column;
        align-items: stretch;
      }

      :host-context(.phone-mode) .todo-entry button {
        width: 100%;
      }

      .todo__clear {
        opacity: 0.6;
        transition: opacity 120ms ease;
      }
      .todo__clear:hover {
        opacity: 1;
      }
      .todo__clear:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .todo__drag {
        font-size: 13px;
        color: #9aa1ad;
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      .todo__drag:active {
        cursor: grabbing;
      }
      .todo__drag--sub {
        font-size: 12px;
      }
      .todo__subtasks-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 12px;
        opacity: 0.8;
        padding: 0;
      }
      .todo__drop-line {
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background: #00c2d1;
      }
      .todo__drop-line--above {
        top: -1px;
      }
      .todo__drop-line--below {
        bottom: -1px;
      }
      .todo__drop-line--sub {
        left: 24px;
        right: 0;
      }
    `,
  ],
})
export class TodoPageComponent implements OnInit, OnDestroy {
  @Input({ required: true }) instanceId!: string;
  @Output() transformToKanbanRequest = new EventEmitter<void>();
  state = signal<TodoState>({
    version: 2,
    projectsEnabled: false,
    projects: [],
    activeProjectId: '',
    showSubtaskDelete: true,
    subtaskCollapsed: {},
  });
  todos = signal<Todo[]>([]);
  loading = signal(false);
  err = signal<string | null>(null);
  editingId = signal<string | null>(null);
  editingText = signal('');
  editingSubtaskId = signal<string | null>(null);
  editingSubtaskText = signal('');
  clearConfirmOpen = signal(false);
  todoDeleteTarget = signal<Todo | null>(null);
  subtaskDeleteTarget = signal<{ todoId: string; subtaskId: string } | null>(null);
  projectWipeTarget = signal<string | null>(null);
  projectDeleteTarget = signal<string | null>(null);
  instanceWipeOpen = signal(false);
  pendingImport = signal<{ file: File; input: HTMLInputElement } | null>(null);
  importStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  importMessage = signal<string | null>(null);
  importLimitOpen = signal(false);
  exportLimitOpen = signal(false);
  subtaskDrafts = signal<Record<string, string>>({});
  subtaskCollapsed = signal<Record<string, boolean>>({});
  draggingTodoId = signal<string | null>(null);
  hoverTodoId = signal<string | null>(null);
  hoverTodoSide = signal<'above' | 'below' | null>(null);
  externalContextRef = signal<ObjectRef | null>(null);
  draggingSubtask = signal<{ todoId: string; subtaskId: string } | null>(null);
  hoverSubtask = signal<{ todoId: string; subtaskId: string; side: 'above' | 'below' } | null>(
    null,
  );
  contextSuggestionsEnabled = computed(
    () => this.prefs.preferences().contextSuggestionsEnabled ?? true,
  );
  private readonly translate = inject(TranslateService);
  private readonly prefs = inject(AppPreferencesService);
  private readonly instanceSettings = inject(InstanceSettingsService);
  private readonly importGuard = inject(ImportGuardService);
  private readonly exportGuard = inject(ExportGuardService);
  private readonly storage = inject(StorageService);
  private readonly remoteConflict = inject(RemoteConflictService);
  private readonly eventHub = inject(UniverseEventHubService);
  private readonly contextFields = inject(ContextFieldStoreService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private lastRemoteStorageChangeSeq = 0;
  private editFocusCount = 0;
  private contextPublishTimer: ReturnType<typeof setTimeout> | null = null;
  private queuedContextTodo: Todo | null = null;
  private readonly persistQueue = new InstancePersistQueue({
    flush: async () => {
      await this.storage.setItem(this.instanceStorageKey(), serializeTodoState(this.state()));
    },
    onError: async (error) => this.handlePersistError(error),
    isTooManyRequests: isRemoteStorageTooManyRequests,
  });

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
      void this.reload({ suppressNormalizationPersist: true });
    });
    effect(() => {
      const universeId = this.currentUniverseId();
      if (!universeId) {
        this.externalContextRef.set(null);
        return;
      }
      const selection = this.contextFields.selection(universeId);
      const primary = selection?.primaryRef ?? null;
      if (!primary || primary.instanceId === this.instanceId) {
        this.externalContextRef.set(null);
        return;
      }
      if (primary.kind === 'note' || primary.kind === 'kanbanCard' || primary.kind === 'sticky') {
        this.externalContextRef.set(primary);
        return;
      }
      this.externalContextRef.set(null);
    });
  }

  async ngOnInit() {
    await this.reload();
  }

  ngOnDestroy() {
    this.cancelQueuedContextPublish();
    this.persistQueue.destroy();
  }

  async reload(options?: { suppressNormalizationPersist?: boolean }) {
    this.err.set(null);
    this.loading.set(true);
    try {
      const nextState = loadTodoState(this.storage, this.instanceId, this.prefs.userId());
      this.state.set(nextState);
      this.todos.set(this.activeProject(nextState)?.todos ?? []);
      const collapsed = nextState.subtaskCollapsed ?? {};
      this.subtaskCollapsed.set(collapsed);
      this.syncSubtaskCollapse(this.activeProject(nextState)?.todos ?? [], options);
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    } finally {
      this.loading.set(false);
    }
  }

  async onAdd(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.err.set(null);
    try {
      const nextState = this.state();
      const project = this.activeProject(nextState);
      if (!project) return;
      const created = createTodoItem(trimmed);
      const nextProjects = nextState.projects.map((p) =>
        p.id === project.id ? { ...p, todos: [created, ...p.todos] } : p,
      );
      this.updateState({ ...nextState, projects: nextProjects });
      this.selectTodoContext(created);
      const universeId = this.currentUniverseId();
      if (universeId) {
        this.eventHub.publishDomain(
          universeId,
          'TodoCreated',
          {
            instanceId: this.instanceId,
            projectId: project.id,
            todoId: created.id,
          },
          { source: { instanceId: this.instanceId, agent: 'todo-app' }, durable: true },
        );
      }
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    }
  }

  async onDuplicate(t: Todo) {
    await this.onAdd(t.text);
  }

  async createTodoFromExternalContext() {
    const ref = this.externalContextRef();
    if (!ref) return;
    const text = this.externalContextTodoText(ref);
    await this.onAdd(text);
  }

  async onDelete(t: Todo) {
    this.err.set(null);
    try {
      const nextState = this.state();
      const project = this.activeProject(nextState);
      if (!project) return;
      const nextProjects = nextState.projects.map((p) =>
        p.id === project.id ? { ...p, todos: p.todos.filter((x) => x.id !== t.id) } : p,
      );
      this.updateState({ ...nextState, projects: nextProjects });
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    }
  }

  requestDeleteTodo(todo: Todo) {
    this.todoDeleteTarget.set(todo);
  }

  async confirmDeleteTodo() {
    const target = this.todoDeleteTarget();
    this.todoDeleteTarget.set(null);
    if (!target) return;
    await this.onDelete(target);
  }

  startEdit(t: Todo) {
    this.editingId.set(t.id);
    this.editingText.set(t.text);
    setTimeout(() => {
      const input = document.querySelector(
        `input[data-edit-id="${t.id}"]`,
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }, 0);
  }

  async finishEdit(t: Todo) {
    if (this.editingId() !== t.id) return;
    const nextText = this.editingText().trim();
    this.editingId.set(null);
    if (!nextText || nextText === t.text) return;
    try {
      const nextState = this.state();
      const project = this.activeProject(nextState);
      if (!project) return;
      const nextProjects = nextState.projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              todos: p.todos.map((todo) => (todo.id === t.id ? { ...todo, text: nextText } : todo)),
            }
          : p,
      );
      this.updateState({ ...nextState, projects: nextProjects });
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    }
  }

  startSubtaskEdit(sub: TodoSubtask) {
    this.editingSubtaskId.set(sub.id);
    this.editingSubtaskText.set(sub.text);
    setTimeout(() => {
      const input = document.querySelector(
        `input[data-sub-edit-id="${sub.id}"]`,
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }, 0);
  }

  finishSubtaskEdit(todoId: string, sub: TodoSubtask) {
    if (this.editingSubtaskId() !== sub.id) return;
    const nextText = this.editingSubtaskText().trim();
    this.editingSubtaskId.set(null);
    if (!nextText || nextText === sub.text) return;
    const nextState = this.state();
    const project = this.activeProject(nextState);
    if (!project) return;
    const nextProjects = nextState.projects.map((p) =>
      p.id === project.id
        ? {
            ...p,
            todos: p.todos.map((todo) =>
              todo.id === todoId
                ? {
                    ...todo,
                    subtasks: (todo.subtasks ?? []).map((item) =>
                      item.id === sub.id ? { ...item, text: nextText } : item,
                    ),
                  }
                : todo,
            ),
          }
        : p,
    );
    this.updateState({ ...nextState, projects: nextProjects });
  }

  async toggleComplete(t: Todo, event: Event) {
    const completed = (event.target as HTMLInputElement).checked;
    try {
      const nextState = this.state();
      const project = this.activeProject(nextState);
      if (!project) return;
      const nextProjects = nextState.projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              todos: p.todos.map((todo) => (todo.id === t.id ? { ...todo, completed } : todo)),
            }
          : p,
      );
      this.updateState({ ...nextState, projects: nextProjects });
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    }
  }

  promptClearCompleted() {
    if (!this.hasCompleted()) return;
    this.clearConfirmOpen.set(true);
  }

  confirmClearCompleted() {
    const nextState = this.state();
    const project = this.activeProject(nextState);
    if (!project) return;
    const nextProjects = nextState.projects.map((p) =>
      p.id === project.id ? { ...p, todos: p.todos.filter((todo) => !todo.completed) } : p,
    );
    this.updateState({ ...nextState, projects: nextProjects });
    this.clearConfirmOpen.set(false);
  }

  hasCompleted() {
    return this.todos().some((todo) => todo.completed);
  }

  settingsOpen() {
    return this.instanceSettings.isOpen(this.instanceId);
  }

  closeSettings() {
    this.instanceSettings.close(this.instanceId);
  }

  toggleProjects(event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    const nextState = { ...this.state(), projectsEnabled: enabled };
    this.updateState(nextState);
  }

  toggleSubtaskDeleteVisibility(event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    this.updateState({ ...this.state(), showSubtaskDelete: enabled });
  }

  addProject(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const nextState = this.state();
    const nextProject: TodoProject = { id: this.newProjectId(), title: trimmed, todos: [] };
    const nextProjects = [...nextState.projects, nextProject];
    this.updateState({
      ...nextState,
      projects: nextProjects,
      activeProjectId: nextState.activeProjectId || nextProject.id,
    });
  }

  renameProject(projectId: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const nextState = this.state();
    const nextProjects = nextState.projects.map((p) =>
      p.id === projectId ? { ...p, title: trimmed } : p,
    );
    this.updateState({ ...nextState, projects: nextProjects });
  }

  moveProject(projectId: string, direction: -1 | 1) {
    const nextState = this.state();
    const currentIndex = nextState.projects.findIndex((p) => p.id === projectId);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= nextState.projects.length) return;
    const nextProjects = [...nextState.projects];
    const [moved] = nextProjects.splice(currentIndex, 1);
    nextProjects.splice(nextIndex, 0, moved);
    this.updateState({ ...nextState, projects: nextProjects });
  }

  promptWipeProject(projectId: string) {
    this.projectWipeTarget.set(projectId);
  }

  confirmWipeProject() {
    const target = this.projectWipeTarget();
    if (!target) return;
    const nextState = this.state();
    const nextProjects = nextState.projects.map((p) => (p.id === target ? { ...p, todos: [] } : p));
    this.updateState({ ...nextState, projects: nextProjects });
    this.projectWipeTarget.set(null);
  }

  promptDeleteProject(projectId: string) {
    if (this.state().projects.length <= 1) return;
    this.projectDeleteTarget.set(projectId);
  }

  confirmDeleteProject() {
    const target = this.projectDeleteTarget();
    if (!target) return;
    const nextState = this.state();
    const nextProjects = nextState.projects.filter((p) => p.id !== target);
    const nextActive =
      nextState.activeProjectId === target
        ? (nextProjects[0]?.id ?? '')
        : nextState.activeProjectId;
    this.updateState({ ...nextState, projects: nextProjects, activeProjectId: nextActive });
    this.projectDeleteTarget.set(null);
  }

  selectProject(event: Event) {
    const nextId = (event.target as HTMLSelectElement).value;
    const nextState = this.state();
    this.updateState({ ...nextState, activeProjectId: nextId });
  }

  addSubtask(todoId: string) {
    const draft = (this.subtaskDrafts()[todoId] ?? '').trim();
    if (!draft) return;
    const nextState = this.state();
    const project = this.activeProject(nextState);
    if (!project) return;
    const nextProjects = nextState.projects.map((p) =>
      p.id === project.id
        ? {
            ...p,
            todos: p.todos.map((todo) =>
              todo.id === todoId
                ? { ...todo, subtasks: [...(todo.subtasks ?? []), createSubtask(draft)] }
                : todo,
            ),
          }
        : p,
    );
    this.subtaskDrafts.set({ ...this.subtaskDrafts(), [todoId]: '' });
    this.updateState({ ...nextState, projects: nextProjects });
  }

  updateSubtaskDraft(todoId: string, value: string) {
    this.subtaskDrafts.set({ ...this.subtaskDrafts(), [todoId]: value });
  }

  subtaskDraft(todoId: string) {
    return this.subtaskDrafts()[todoId] ?? '';
  }

  toggleSubtask(todoId: string, subtask: TodoSubtask, event: Event) {
    const completed = (event.target as HTMLInputElement).checked;
    const nextState = this.state();
    const project = this.activeProject(nextState);
    if (!project) return;
    const nextProjects = nextState.projects.map((p) =>
      p.id === project.id
        ? {
            ...p,
            todos: p.todos.map((todo) =>
              todo.id === todoId
                ? {
                    ...todo,
                    subtasks: (todo.subtasks ?? []).map((sub) =>
                      sub.id === subtask.id ? { ...sub, completed } : sub,
                    ),
                  }
                : todo,
            ),
          }
        : p,
    );
    this.updateState({ ...nextState, projects: nextProjects });
  }

  requestDeleteSubtask(todoId: string, subtaskId: string) {
    this.subtaskDeleteTarget.set({ todoId, subtaskId });
  }

  confirmDeleteSubtask() {
    const target = this.subtaskDeleteTarget();
    this.subtaskDeleteTarget.set(null);
    if (!target) return;
    this.deleteSubtask(target.todoId, target.subtaskId);
  }

  deleteSubtask(todoId: string, subtaskId: string) {
    const nextState = this.state();
    const project = this.activeProject(nextState);
    if (!project) return;
    const nextProjects = nextState.projects.map((p) =>
      p.id === project.id
        ? {
            ...p,
            todos: p.todos.map((todo) =>
              todo.id === todoId
                ? {
                    ...todo,
                    subtasks: (todo.subtasks ?? []).filter((sub) => sub.id !== subtaskId),
                  }
                : todo,
            ),
          }
        : p,
    );
    this.updateState({ ...nextState, projects: nextProjects });
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
    link.download = `todos-${this.instanceId}.json`;
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
        const parsed = JSON.parse(String(reader.result || '{}')) as TodoState;
        this.mergeImportedState(parsed);
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
    this.instanceWipeOpen.set(true);
  }

  wipeInstance() {
    const project = this.defaultProject();
    const next: TodoState = {
      version: 2,
      projectsEnabled: false,
      projects: [project],
      activeProjectId: project.id,
      showSubtaskDelete: true,
      subtaskCollapsed: {},
    };
    this.instanceWipeOpen.set(false);
    this.updateState(next);
  }

  private mergeImportedState(imported: TodoState) {
    if (!imported || !Array.isArray(imported.projects)) return;
    const base = this.state();
    const nextCollapsed = { ...(base.subtaskCollapsed ?? {}) };
    const newProjects = imported.projects.map((project) => {
      const newProjectId = this.newProjectId();
      const todos = (project.todos ?? []).map((todo) => {
        const newTodoId = this.newTodoId();
        if (imported.subtaskCollapsed?.[todo.id]) {
          nextCollapsed[newTodoId] = imported.subtaskCollapsed[todo.id];
        }
        const subtasks = (todo.subtasks ?? []).map((sub) => ({
          ...sub,
          id: this.newSubtaskId(),
        }));
        return { ...todo, id: newTodoId, subtasks };
      });
      return { ...project, id: newProjectId, title: project.title || 'Project', todos };
    });
    const nextState: TodoState = {
      ...base,
      projects: [...base.projects, ...newProjects],
      subtaskCollapsed: nextCollapsed,
    };
    this.updateState(nextState);
  }

  private updateState(nextState: TodoState, options?: { suppressPersist?: boolean }) {
    const ensuredProjects = nextState.projects.length
      ? nextState.projects
      : [this.defaultProject()];
    const normalized = {
      ...nextState,
      projects: ensuredProjects,
      activeProjectId:
        nextState.activeProjectId || ensuredProjects[0]?.id || this.defaultProject().id,
    };
    const collapsed = { ...(normalized.subtaskCollapsed ?? {}), ...this.subtaskCollapsed() };
    const next = { ...normalized, subtaskCollapsed: collapsed };
    this.state.set(next);
    this.todos.set(this.activeProject(next)?.todos ?? []);
    this.subtaskCollapsed.set(collapsed);
    this.syncSubtaskCollapse(this.activeProject(next)?.todos ?? []);
    this.refreshTodoContextIfActive();
    if (!options?.suppressPersist) {
      this.persistState();
    }
  }

  private refreshTodoContextIfActive() {
    const universeId = this.currentUniverseId();
    if (!universeId || !this.instanceId) return;
    const selection = this.contextFields.selection(universeId);
    const primary = selection?.primaryRef;
    if (!primary || primary.instanceId !== this.instanceId || primary.kind !== 'todo') return;
    const todo = this.state()
      .projects.flatMap((project) => project.todos)
      .find((item) => item.id === primary.id);
    if (!todo) return;
    this.scheduleTodoContextPublish(todo);
  }

  private scheduleTodoContextPublish(todo: Todo) {
    this.queuedContextTodo = todo;
    if (this.contextPublishTimer !== null) return;
    this.contextPublishTimer = setTimeout(() => {
      this.contextPublishTimer = null;
      const nextTodo = this.queuedContextTodo;
      this.queuedContextTodo = null;
      if (!nextTodo) return;
      this.selectTodoContext(nextTodo);
    }, 150);
  }

  private cancelQueuedContextPublish() {
    if (this.contextPublishTimer !== null) {
      clearTimeout(this.contextPublishTimer);
      this.contextPublishTimer = null;
    }
    this.queuedContextTodo = null;
  }

  private activeProject(state = this.state()) {
    if (!state.projects.length) return null;
    const target = state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];
    if (!state.projectsEnabled) {
      return state.projects[0];
    }
    return target;
  }

  private defaultProject(): TodoProject {
    const project: TodoProject = { id: this.newProjectId(), title: 'Project', todos: [] };
    return project;
  }

  private newProjectId() {
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private newTodoId() {
    return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private newSubtaskId() {
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  toggleSubtasks(todoId: string) {
    const next = { ...this.subtaskCollapsed() };
    next[todoId] = !next[todoId];
    this.subtaskCollapsed.set(next);
    this.updateState({ ...this.state(), subtaskCollapsed: next });
  }

  isSubtasksCollapsed(todoId: string) {
    return this.subtaskCollapsed()[todoId] ?? true;
  }

  private syncSubtaskCollapse(todos: Todo[], options?: { suppressNormalizationPersist?: boolean }) {
    const next = { ...this.subtaskCollapsed() };
    let changed = false;
    todos.forEach((todo) => {
      if (!(todo.id in next)) {
        next[todo.id] = true;
        changed = true;
      }
    });
    if (changed) {
      this.subtaskCollapsed.set(next);
      const current = this.state();
      const updated = { ...current, subtaskCollapsed: next };
      this.state.set(updated);
      if (!options?.suppressNormalizationPersist) {
        this.persistState();
      }
    }
  }

  private persistState(options?: { immediate?: boolean }) {
    this.persistQueue.schedule(options);
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

  startTodoDrag(todo: Todo, event: PointerEvent) {
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    this.draggingTodoId.set(todo.id);
  }

  startSubtaskDrag(todoId: string, sub: TodoSubtask, event: PointerEvent) {
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    this.draggingSubtask.set({ todoId, subtaskId: sub.id });
  }

  @HostListener('document:pointermove', ['$event'])
  onDocumentPointerMove(event: PointerEvent) {
    if (this.draggingSubtask()) {
      const dragging = this.draggingSubtask();
      if (!dragging) return;
      const rows = Array.from(
        document.querySelectorAll(`[data-subtask-todo-id="${dragging.todoId}"]`),
      ) as HTMLElement[];
      if (!rows.length) {
        this.hoverSubtask.set(null);
        return;
      }
      const positions = rows.map((row) => ({
        id: row.getAttribute('data-subtask-id') ?? '',
        rect: row.getBoundingClientRect(),
      }));
      let insertIndex = positions.findIndex(
        (pos) => event.clientY < pos.rect.top + pos.rect.height / 2,
      );
      if (insertIndex === -1) insertIndex = positions.length;
      if (insertIndex >= positions.length) {
        const last = positions[positions.length - 1];
        this.hoverSubtask.set({ todoId: dragging.todoId, subtaskId: last.id, side: 'below' });
      } else {
        const target = positions[insertIndex];
        this.hoverSubtask.set({ todoId: dragging.todoId, subtaskId: target.id, side: 'above' });
      }
      return;
    }
    if (this.draggingTodoId()) {
      const rows = Array.from(document.querySelectorAll('[data-todo-id]')) as HTMLElement[];
      if (!rows.length) {
        this.hoverTodoId.set(null);
        this.hoverTodoSide.set(null);
        return;
      }
      const positions = rows.map((row) => ({
        id: row.getAttribute('data-todo-id') ?? '',
        rect: row.getBoundingClientRect(),
      }));
      let insertIndex = positions.findIndex(
        (pos) => event.clientY < pos.rect.top + pos.rect.height / 2,
      );
      if (insertIndex === -1) insertIndex = positions.length;
      if (insertIndex >= positions.length) {
        const last = positions[positions.length - 1];
        this.hoverTodoId.set(last.id);
        this.hoverTodoSide.set('below');
      } else {
        const target = positions[insertIndex];
        this.hoverTodoId.set(target.id);
        this.hoverTodoSide.set('above');
      }
    }
  }

  @HostListener('document:pointerup')
  onDocumentPointerUp() {
    if (this.draggingTodoId() && this.hoverTodoId()) {
      const draggedId = this.draggingTodoId()!;
      const targetId = this.hoverTodoId()!;
      const side = this.hoverTodoSide() ?? 'below';
      if (draggedId !== targetId) {
        const nextState = this.state();
        const project = this.activeProject(nextState);
        if (project) {
          const todos = [...project.todos];
          const fromIndex = todos.findIndex((todo) => todo.id === draggedId);
          const toIndex = todos.findIndex((todo) => todo.id === targetId);
          if (fromIndex >= 0 && toIndex >= 0) {
            const [moved] = todos.splice(fromIndex, 1);
            let insertIndex = side === 'below' ? toIndex + 1 : toIndex;
            if (fromIndex < insertIndex) insertIndex -= 1;
            todos.splice(insertIndex, 0, moved);
            const nextProjects = nextState.projects.map((p) =>
              p.id === project.id ? { ...p, todos } : p,
            );
            this.updateState({ ...nextState, projects: nextProjects });
          }
        }
      }
    }
    if (this.draggingSubtask() && this.hoverSubtask()) {
      const dragging = this.draggingSubtask()!;
      const hover = this.hoverSubtask()!;
      if (dragging.subtaskId !== hover.subtaskId) {
        const nextState = this.state();
        const project = this.activeProject(nextState);
        if (project) {
          const nextProjects = nextState.projects.map((p) =>
            p.id === project.id
              ? {
                  ...p,
                  todos: p.todos.map((todo) => {
                    if (todo.id !== hover.todoId) return todo;
                    const subtasks = [...(todo.subtasks ?? [])];
                    const fromIndex = subtasks.findIndex((item) => item.id === dragging.subtaskId);
                    const toIndex = subtasks.findIndex((item) => item.id === hover.subtaskId);
                    if (fromIndex < 0 || toIndex < 0) return todo;
                    const [moved] = subtasks.splice(fromIndex, 1);
                    let insertIndex = hover.side === 'below' ? toIndex + 1 : toIndex;
                    if (fromIndex < insertIndex) insertIndex -= 1;
                    subtasks.splice(insertIndex, 0, moved);
                    return { ...todo, subtasks };
                  }),
                }
              : p,
          );
          this.updateState({ ...nextState, projects: nextProjects });
        }
      }
    }
    this.draggingTodoId.set(null);
    this.hoverTodoId.set(null);
    this.hoverTodoSide.set(null);
    this.draggingSubtask.set(null);
    this.hoverSubtask.set(null);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement | null;
    if (this.editingId()) {
      const input = document.querySelector(
        `input[data-edit-id="${this.editingId()}"]`,
      ) as HTMLInputElement | null;
      if (input && target && input !== target && !input.contains(target)) {
        const todo = this.todos().find((item) => item.id === this.editingId());
        if (todo) this.finishEdit(todo);
      }
    }
    if (this.editingSubtaskId()) {
      const input = document.querySelector(
        `input[data-sub-edit-id="${this.editingSubtaskId()}"]`,
      ) as HTMLInputElement | null;
      if (input && target && input !== target && !input.contains(target)) {
        const todo = this.todos().find((item) =>
          (item.subtasks ?? []).some((sub) => sub.id === this.editingSubtaskId()),
        );
        const sub = todo?.subtasks?.find((item) => item.id === this.editingSubtaskId());
        if (todo && sub) this.finishSubtaskEdit(todo.id, sub);
      }
    }
  }

  private instanceStorageKey() {
    return `${TODO_STATE_STORAGE_KEY}:${this.prefs.userId()}:${this.instanceId || ''}`;
  }

  private currentUniverseId() {
    const key = this.prefs.userId();
    const parts = key.split(':');
    return parts.length >= 2 ? parts[1] : null;
  }

  selectTodoContext(todo: Todo) {
    const universeId = this.currentUniverseId();
    if (!universeId || !this.instanceId) return;
    const ref: ObjectRef = {
      universeId,
      instanceId: this.instanceId,
      kind: 'todo',
      id: todo.id,
      title: todo.text,
      content: todo.text,
    };
    this.contextFields.setSelection(universeId, [ref], {
      primaryRef: ref,
      sourceInstanceId: this.instanceId,
      intent: 'inspect',
    });
  }

  externalContextPrompt() {
    const ref = this.externalContextRef();
    if (!ref) return '';
    return this.translate.instant('todo.contextPrompt', {
      target: this.externalContextTargetLabel(ref),
    });
  }

  private externalContextTargetLabel(ref: ObjectRef) {
    return this.translate.instant(this.externalContextTargetKey(ref));
  }

  private externalContextTargetKey(ref: ObjectRef) {
    const labels: Record<string, string> = {
      note: 'context.target.note',
      kanbanCard: 'context.target.kanbanCard',
      sticky: 'context.target.sticky',
    };
    return labels[ref.kind] ?? 'context.target.item';
  }

  private externalContextTodoText(ref: ObjectRef) {
    const fromTitle = (ref.title ?? '').trim();
    const fromContent = (ref.content ?? '').trim();
    const best = fromContent || fromTitle;
    if (best) return best;
    return this.translate.instant('todo.contextCreateLabel', {
      target: this.externalContextTargetLabel(ref),
    });
  }

  private isLocallyEditing() {
    return Boolean(this.editFocusCount > 0 || this.editingId() || this.editingSubtaskId());
  }

  private isEditableTarget(target: HTMLElement) {
    if (target.isContentEditable) return true;
    if (target instanceof HTMLTextAreaElement) return true;
    if (target instanceof HTMLInputElement) {
      const type = (target.type || 'text').toLowerCase();
      return !['checkbox', 'radio', 'button', 'submit', 'file', 'color'].includes(type);
    }
    return false;
  }

  private async handlePersistError(error: unknown) {
    const key = this.instanceStorageKey();
    if (isRemoteStorageVersionConflict(error)) {
      this.remoteConflict.queue([key], 'dirty');
      let remoteState: TodoState | null = null;
      try {
        const raw = await this.storage.getItem(key);
        if (raw) {
          remoteState = parseTodoState(raw);
        }
      } catch {
        // Ignore cache refresh failures; polling/realtime will retry.
      }
      if (remoteState) {
        const mergedState = mergeTodoStates(remoteState, this.state());
        this.updateState(mergedState, { suppressPersist: true });
        if (!this.isLocallyEditing()) {
          this.persistState({ immediate: true });
        }
        return 'handled' as const;
      }
      if (!this.isLocallyEditing()) {
        await this.reload({ suppressNormalizationPersist: true });
      }
      return 'handled' as const;
    }
    return undefined;
  }
}
