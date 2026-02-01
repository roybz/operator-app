import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { ImportGuardService } from '../../../../core/import-guard.service';
import { ExportGuardService } from '../../../../core/export-guard.service';

type NodeType = 'folder' | 'note';
type EditorMode = 'rich' | 'markdown' | 'visual';

type NotesView = 'notes' | 'archive';

interface NoteNode {
  id: string;
  type: NodeType;
  name: string;
  parentId?: string;
  children?: NoteNode[];
  collapsed?: boolean;
  content?: string;
  editorMode?: EditorMode;
  lastEditMode?: 'rich' | 'markdown';
  editorVisible?: boolean;
  locked?: boolean;
}

interface NotesState {
  root: NoteNode;
  archiveRoot: NoteNode;
  selectedId: string | null;
  selectedIds: string[];
  view: NotesView;
  listCollapsed: boolean;
  sidebarOpen: boolean;
  phoneSidebarInit?: boolean;
}

const stateStore = new Map<string, NotesState>();
const STORAGE_PREFIX = 'op_app_state:notes';

const storageKey = (userId: string, instanceId: string) =>
  `${STORAGE_PREFIX}:${userId}:${instanceId}`;

export function clearNotesState(instanceId: string) {
  stateStore.delete(instanceId);
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function cloneNotesState(fromId: string, toId: string) {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  const cloneTree = (node: NoteNode, parentId?: string): NoteNode => {
    const copy: NoteNode = { ...node, parentId };
    if (node.type === 'folder') {
      copy.children = (node.children ?? []).map((child) => cloneTree(child, copy.id));
    }
    return copy;
  };
  stateStore.set(toId, {
    ...stored,
    root: cloneTree(stored.root),
    archiveRoot: cloneTree(stored.archiveRoot),
    selectedId: null,
    selectedIds: [],
  });
}

const createFolder = (name: string, parentId?: string, locked = false): NoteNode => ({
  id: `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  type: 'folder',
  name,
  parentId,
  children: [],
  collapsed: false,
  locked,
});

const createNote = (name: string, parentId?: string, locked = false): NoteNode => ({
  id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  type: 'note',
  name,
  parentId,
  content: '',
  editorMode: 'rich',
  lastEditMode: 'rich',
  editorVisible: true,
  locked,
});

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmDialogComponent],
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .notes-shell {
        display: flex;
        gap: 12px;
        height: 100%;
        position: relative;
      }

      :host-context(.phone-mode) .notes-shell {
        flex-direction: column;
        gap: 10px;
        padding: 8px;
      }

      :host-context(.phone-mode) .notes-shell > aside {
        position: absolute;
        inset: 0;
        width: 100% !important;
        min-width: 0 !important;
        max-height: none;
        background: var(--color-surface);
        z-index: 2;
        border-right: none;
        padding-right: 0;
      }

      :host-context(.phone-mode) .notes-shell > aside[data-collapsed='true'] {
        width: 0 !important;
        min-width: 0 !important;
        padding: 0;
        border: none;
        pointer-events: none;
        display: none;
      }

      :host-context(.phone-mode) .notes-shell > aside[data-collapsed='false'] {
        box-shadow: 6px 0 16px rgba(0, 0, 0, 0.2);
      }

      .notes-sidebar-toggle {
        position: absolute;
        left: -5px;
        top: 20px;
        z-index: 3;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        border-radius: 8px;
        opacity: 0.7;
        font-size: 30px;
        width: 36px;
        height: 36px;
      }

      :host-context(.phone-mode) .notes-editor-actions button {
        font-size: 11px;
        padding: 4px 8px;
      }
    `,
  ],
  template: `
    <div class="notes-shell">
      @if (settingsOpen()) {
        <div
          style="position:absolute; inset:0; background:var(--color-surface); padding:16px; z-index:2; display:flex; flex-direction:column; gap:12px;"
        >
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0;">{{ 'notes.settingsTitle' | translate }}</h3>
            <button (click)="closeSettings()">{{ 'notes.closeSettings' | translate }}</button>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button (click)="exportInstance()">{{ 'notes.exportInstance' | translate }}</button>
            <label style="display:inline-flex; align-items:center; gap:8px;">
              <span>{{ 'notes.importInstance' | translate }}</span>
              <input type="file" accept=".json" (change)="queueImport($event)" />
            </label>
            <button (click)="confirmWipeInstance()">
              {{ 'notes.wipeInstance' | translate }}
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
      }
      @if (isPhoneMode()) {
        <button class="notes-sidebar-toggle" (click)="toggleSidebar()">
          {{ state().sidebarOpen ? '⟨' : '⟩' }}
        </button>
      }
      <aside
        [attr.data-collapsed]="state().sidebarOpen ? 'false' : 'true'"
        [style.width]="
          isPhoneMode()
            ? state().sidebarOpen
              ? '100%'
              : '0'
            : state().sidebarOpen
              ? '240px'
              : '40px'
        "
        [style.minWidth]="
          isPhoneMode()
            ? state().sidebarOpen
              ? '100%'
              : '0'
            : state().sidebarOpen
              ? '200px'
              : '40px'
        "
        [style.display]="isPhoneMode() && !state().sidebarOpen ? 'none' : 'flex'"
        style="border-right:1px solid var(--color-border); padding-right:8px; padding-left:13px; overflow:auto; transition:width 160ms ease; display:flex; flex-direction:column;"
      >
        @if (state().sidebarOpen) {
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
            <div style="display:flex; gap:6px; align-items:center;">
              <button
                (click)="toggleView('notes')"
                [style.fontWeight]="
                  state().view === 'notes' && !state().listCollapsed ? '700' : '500'
                "
                [style.background]="
                  state().view === 'notes' && !state().listCollapsed
                    ? '#fff3cd'
                    : 'var(--color-surface)'
                "
                [style.color]="
                  state().view === 'notes' && !state().listCollapsed ? '#7a5b00' : 'inherit'
                "
              >
                {{ 'notes.root' | translate }}
              </button>
              <button
                (click)="toggleView('archive')"
                [style.fontWeight]="
                  state().view === 'archive' && !state().listCollapsed ? '700' : '500'
                "
                [style.background]="
                  state().view === 'archive' && !state().listCollapsed
                    ? '#fff3cd'
                    : 'var(--color-surface)'
                "
                [style.color]="
                  state().view === 'archive' && !state().listCollapsed ? '#7a5b00' : 'inherit'
                "
              >
                {{ 'notes.archive' | translate }}
              </button>
            </div>
            @if (!isPhoneMode()) {
              <button (click)="toggleSidebar()">⟨</button>
            }
          </div>
        } @else {
          @if (!isPhoneMode()) {
            <button (click)="toggleSidebar()">⟩</button>
          }
        }

        @if (state().sidebarOpen) {
          <div style="display:flex; gap:6px; margin: 10px 0 6px; flex-wrap:wrap;">
            <button (click)="addFolder()" [disabled]="isArchiveView()">
              {{ 'notes.addFolder' | translate }}
            </button>
            <button (click)="addNote()" [disabled]="isArchiveView()">
              {{ 'notes.addNote' | translate }}
            </button>
          </div>
          <div style="display:flex; gap:6px; margin: 0 0 10px; flex-wrap:wrap;">
            <button (click)="selectAll()">{{ 'notes.selectAll' | translate }}</button>
            <button (click)="deselectAll()" [disabled]="!selectedIds().length">
              {{ 'notes.deselectAll' | translate }}
            </button>
          </div>

          @if (selectedIds().length) {
            <div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">
              <button (click)="duplicateSelected()">
                {{ 'notes.duplicateSelected' | translate }}
              </button>
              <button (click)="confirmBulkDelete()">
                {{ 'notes.deleteSelected' | translate }}
              </button>
              @if (!isArchiveView()) {
                <button (click)="archiveSelected()">
                  {{ 'notes.archiveSelected' | translate }}
                </button>
              } @else {
                <button (click)="unarchiveSelected()">
                  {{ 'notes.unarchiveSelected' | translate }}
                </button>
              }
            </div>
          }

          @if (!state().listCollapsed) {
            @if (!(activeRoot().children?.length ?? 0)) {
              <div style="font-size:12px; opacity:0.6;">
                {{ 'notes.emptyHint' | translate }}
              </div>
            }
            <ng-container
              *ngTemplateOutlet="treeTemplate; context: { $implicit: activeRoot(), depth: 0 }"
            ></ng-container>
          }

          <div style="margin-top:auto; display:flex; flex-wrap:wrap; padding-left:20px;">
            <div style="font-size:12px; color:var(--color-muted);">
              {{ 'notes.folderCount' | translate: { count: folderCount() } }}
            </div>
            <span> </span>
            <div style="font-size:12px; color:var(--color-muted);">
              {{ 'notes.noteCount' | translate: { count: noteCount() } }}
            </div>
          </div>
        }
      </aside>

      <section
        style="flex:1; display:flex; flex-direction:column; gap:12px;"
        [style.display]="isPhoneMode() && state().sidebarOpen ? 'none' : 'flex'"
      >
        @if (!settingsOpen() && selectedNode() && selectedNode()?.type === 'note') {
          <div style="display:flex; justify-content:space-between; align-items:center;">
            @if (editingNodeId() === selectedNode()?.id) {
              <input
                [value]="editingName()"
                (input)="editingName.set($any($event.target).value)"
                (blur)="finishRename()"
                (keydown.enter)="finishRename()"
                style="font-size:16px; font-weight:600; padding:4px;"
              />
            } @else {
              <h3
                style="margin:0; padding:4px;"
                [style.boxShadow]="isActive(selectedNode()?.id) ? activeGlow() : 'none'"
                (dblclick)="startRename(selectedNode()?.id)"
              >
                {{ selectedNode()?.name }}
              </h3>
            }
          </div>
          <div
            class="notes-editor-actions"
            style="display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); gap:8px;"
          >
            <button style="width:100%;" (click)="toggleEditor()">
              {{
                selectedNode()?.editorVisible
                  ? ('notes.collapseEditor' | translate)
                  : ('notes.expandEditor' | translate)
              }}
            </button>
            <button style="width:100%;" (click)="toggleEditorMode()">
              {{
                selectedNode()?.editorMode === 'markdown'
                  ? ('notes.switchToRich' | translate)
                  : ('notes.switchToMarkdown' | translate)
              }}
            </button>
            <button style="width:100%;" (click)="toggleVisualMode()">
              {{
                selectedNode()?.editorMode === 'visual'
                  ? ('notes.switchToEditing' | translate)
                  : ('notes.switchToVisual' | translate)
              }}
            </button>
            <button style="width:100%;" (click)="toggleLock()">
              {{
                selectedNode()?.locked ? ('notes.unlock' | translate) : ('notes.lock' | translate)
              }}
            </button>
            <button style="width:100%;" (click)="duplicateNode(selectedNode()?.id)">
              {{ 'notes.duplicate' | translate }}
            </button>
            <button style="width:100%;" (click)="deleteNode(selectedNode()?.id)">
              {{ 'notes.delete' | translate }}
            </button>
          </div>

          @if (selectedNode()?.editorVisible) {
            @if (selectedNode()?.editorMode === 'rich') {
              <div
                contenteditable="true"
                dir="auto"
                [innerHTML]="richHtml()"
                (focus)="startRichEdit()"
                (input)="onRichInput($event)"
                (blur)="finishRichEdit()"
                [style.pointerEvents]="selectedNode()?.locked ? 'none' : 'auto'"
                [style.opacity]="selectedNode()?.locked ? 0.6 : 1"
                style="border:1px solid var(--color-border); border-radius:6px; padding:10px; min-height:200px;"
              ></div>
            } @else if (selectedNode()?.editorMode === 'markdown') {
              <textarea
                [value]="selectedNode()?.content"
                (input)="onMarkdownInput($event)"
                [disabled]="selectedNode()?.locked"
                style="border:1px solid var(--color-border); border-radius:6px; padding:10px; min-height:200px;"
              ></textarea>
            } @else {
              <div
                [innerHTML]="renderVisual(selectedNode())"
                style="border:1px solid var(--color-border); border-radius:6px; padding:10px; min-height:200px; background:var(--color-bg); color:var(--color-text);"
              ></div>
            }
          }

          <div style="font-size:12px; color:var(--color-muted);">{{ statusLabel() }}</div>
        } @else {
          <div style="opacity:0.7;">{{ 'notes.selectHint' | translate }}</div>
        }
      </section>
    </div>

    <ng-template #treeTemplate let-node let-depth="depth">
      <div
        style="display:flex; align-items:center; gap:6px;"
        [style.marginLeft.px]="depth * 12"
        [style.opacity]="node.locked ? 0.7 : 1"
      >
        @if (node.id !== activeRoot().id) {
          <span
            style="width:10px; height:16px; border-left:1px solid var(--color-border); opacity:0.6;"
          ></span>
          <input
            type="checkbox"
            [checked]="isSelected(node.id)"
            (change)="toggleSelected(node, $event)"
          />
        }
        @if (editingNodeId() === node.id) {
          <input
            [value]="editingName()"
            (input)="editingName.set($any($event.target).value)"
            (blur)="finishRename()"
            (keydown.enter)="finishRename()"
            style="padding:4px;"
          />
        } @else {
          <button
            (click)="selectNode(node.id)"
            (dblclick)="startRename(node.id)"
            [style.fontWeight]="isActive(node.id) ? '600' : '400'"
            [style.fontStyle]="node.locked ? 'italic' : 'normal'"
            [style.boxShadow]="isActive(node.id) ? activeGlow() : 'none'"
          >
            {{ nodeLabel(node) }}
          </button>
        }
        @if (node.type === 'folder' && node.id !== activeRoot().id) {
          <button (click)="toggleFolder(node)">{{ node.collapsed ? '+' : '−' }}</button>
        }
      </div>
      @if (node.type === 'folder' && !node.collapsed) {
        @for (child of node.children ?? []; track child.id) {
          <ng-container
            *ngTemplateOutlet="treeTemplate; context: { $implicit: child, depth: depth + 1 }"
          ></ng-container>
        }
      }
    </ng-template>

    @if (bulkDeleteOpen()) {
      <app-confirm-dialog
        [message]="'notes.confirmDelete' | translate"
        [confirmLabel]="'dialogs.confirm' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="deleteSelected()"
        (canceled)="bulkDeleteOpen.set(false)"
      />
    }
    @if (wipeInstanceOpen()) {
      <app-confirm-dialog
        [message]="'notes.confirmWipeInstance' | translate"
        [confirmLabel]="'dialogs.confirm' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="wipeInstance()"
        (canceled)="wipeInstanceOpen.set(false)"
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
export class NotesComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  private translate = inject(TranslateService);
  private prefs = inject(AppPreferencesService);
  private instanceSettings = inject(InstanceSettingsService);
  private importGuard = inject(ImportGuardService);
  private exportGuard = inject(ExportGuardService);
  state = signal<NotesState>({
    root: createFolder('Notes'),
    archiveRoot: createFolder('Archive', undefined, true),
    selectedId: null,
    selectedIds: [],
    view: 'notes',
    listCollapsed: false,
    sidebarOpen: true,
  });
  editingNodeId = signal<string | null>(null);
  editingName = signal('');
  bulkDeleteOpen = signal(false);
  wipeInstanceOpen = signal(false);
  pendingImport = signal<{ file: File; input: HTMLInputElement } | null>(null);
  importStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  importMessage = signal<string | null>(null);
  importLimitOpen = signal(false);
  exportLimitOpen = signal(false);
  richFocused = signal(false);
  richSnapshot = signal('');
  isPhoneMode = computed(() => this.prefs.preferences().phoneMode);
  richHtml = computed(() =>
    this.richFocused() ? this.richSnapshot() : (this.selectedNode()?.content ?? ''),
  );

  ngOnInit() {
    const userId = this.prefs.userId();
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(storageKey(userId, this.instanceId));
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as NotesState;
          const next = {
            ...parsed,
            sidebarOpen:
              this.isPhoneMode() && !parsed.phoneSidebarInit ? false : parsed.sidebarOpen,
            phoneSidebarInit: this.isPhoneMode() ? true : parsed.phoneSidebarInit,
          };
          this.state.set(next);
          stateStore.set(this.instanceId, next);
          this.persistState();
          this.syncRichSnapshot();
          return;
        } catch {
          // ignore malformed stored data
        }
      }
    }
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      const nextStored = this.cloneState(stored);
      const next = {
        ...nextStored,
        sidebarOpen:
          this.isPhoneMode() && !nextStored.phoneSidebarInit ? false : nextStored.sidebarOpen,
        phoneSidebarInit: this.isPhoneMode() ? true : nextStored.phoneSidebarInit,
      };
      this.state.set(next);
      stateStore.set(this.instanceId, next);
      this.persistState();
      this.syncRichSnapshot();
      return;
    }
    const root = createFolder('Notes');
    const firstFolder = createFolder('New folder', root.id);
    const firstNote = createNote('New note', firstFolder.id);
    firstFolder.children = [firstNote];
    root.children = [firstFolder];
    const next: NotesState = {
      ...this.state(),
      root,
      selectedId: firstNote.id,
      sidebarOpen: this.isPhoneMode() ? false : true,
      phoneSidebarInit: this.isPhoneMode() ? true : undefined,
    };
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
    this.syncRichSnapshot();
  }

  private commit(next: NotesState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  private persistState() {
    if (typeof window === 'undefined') return;
    const userId = this.prefs.userId();
    window.localStorage.setItem(storageKey(userId, this.instanceId), JSON.stringify(this.state()));
  }

  activeRoot() {
    return this.state().view === 'archive' ? this.state().archiveRoot : this.state().root;
  }

  activeTitle() {
    return this.state().view === 'archive'
      ? this.translate.instant('notes.archive')
      : this.translate.instant('notes.root');
  }

  isArchiveView() {
    return this.state().view === 'archive';
  }

  selectedNode() {
    const id = this.state().selectedId;
    return id ? this.findNode(this.activeRoot(), id) : null;
  }

  private syncRichSnapshot() {
    const note = this.selectedNode();
    if (!note || note.type !== 'note') {
      this.richSnapshot.set('');
      this.richFocused.set(false);
      return;
    }
    if (!this.richFocused()) {
      this.richSnapshot.set(note.content ?? '');
    }
  }

  selectNode(id: string) {
    if (id === this.activeRoot().id) return;
    this.commit({ ...this.state(), selectedId: id });
    this.syncRichSnapshot();
  }

  toggleView(view: NotesView) {
    if (this.state().view === view) {
      this.commit({ ...this.state(), listCollapsed: !this.state().listCollapsed });
      this.syncRichSnapshot();
      return;
    }
    this.commit({ ...this.state(), view, listCollapsed: false, selectedId: null, selectedIds: [] });
    this.syncRichSnapshot();
  }

  toggleSidebar() {
    this.commit({ ...this.state(), sidebarOpen: !this.state().sidebarOpen });
  }

  settingsOpen() {
    return this.instanceSettings.isOpen(this.instanceId);
  }

  closeSettings() {
    this.instanceSettings.close(this.instanceId);
  }

  folderCount() {
    return this.countNodes(this.activeRoot(), 'folder');
  }

  noteCount() {
    return this.countNodes(this.activeRoot(), 'note');
  }

  nodeLabel(node: NoteNode) {
    if (node.id === this.activeRoot().id) return this.activeTitle();
    if (node.type === 'folder') {
      const direct = this.directNoteCount(node);
      const total = this.totalNoteCount(node);
      if (total > direct) {
        return `${node.name} (${direct}) (${total})`;
      }
      if (direct > 0) {
        return `${node.name} (${direct})`;
      }
      return node.name;
    }
    return node.name;
  }

  addFolder() {
    if (this.isArchiveView()) return;
    const parent = this.selectedFolder() ?? this.state().root;
    if (this.depthForNode(parent) >= 99) return;
    const folder = createFolder(this.translate.instant('notes.defaultFolder'), parent.id);
    parent.children?.push(folder);
    this.commit({ ...this.state(), selectedId: folder.id });
    this.syncRichSnapshot();
  }

  addNote() {
    if (this.isArchiveView()) return;
    const parent = this.selectedFolder() ?? this.state().root;
    if (this.depthForNode(parent) >= 99) return;
    const note = createNote(this.translate.instant('notes.defaultNote'), parent.id);
    parent.children?.push(note);
    this.commit({ ...this.state(), selectedId: note.id });
    this.syncRichSnapshot();
  }

  toggleFolder(node: NoteNode) {
    if (node.type !== 'folder') return;
    node.collapsed = !node.collapsed;
    this.commit({ ...this.state() });
  }

  toggleEditor() {
    const note = this.selectedNode();
    if (!note || note.type !== 'note') return;
    note.editorVisible = !note.editorVisible;
    this.commit({ ...this.state() });
    this.syncRichSnapshot();
  }

  toggleEditorMode() {
    const note = this.selectedNode();
    if (!note || note.type !== 'note') return;
    const nextMode = note.lastEditMode === 'rich' ? 'markdown' : 'rich';
    if (nextMode === 'markdown' && note.lastEditMode === 'rich') {
      note.content = this.richToPlainText(note.content ?? '');
    }
    note.editorMode = nextMode;
    note.lastEditMode = nextMode;
    this.commit({ ...this.state() });
    this.syncRichSnapshot();
  }

  toggleVisualMode() {
    const note = this.selectedNode();
    if (!note || note.type !== 'note') return;
    if (note.editorMode === 'visual') {
      note.editorMode = note.lastEditMode ?? 'rich';
    } else {
      note.editorMode = 'visual';
    }
    this.commit({ ...this.state() });
    this.syncRichSnapshot();
  }

  toggleLock() {
    const note = this.selectedNode();
    if (!note || note.type !== 'note') return;
    if (note.locked && this.isArchiveView()) return;
    note.locked = !note.locked;
    this.commit({ ...this.state() });
  }

  startRichEdit() {
    this.richFocused.set(true);
    this.syncRichSnapshot();
  }

  finishRichEdit() {
    this.richFocused.set(false);
    this.commit({ ...this.state() });
    this.syncRichSnapshot();
  }

  onRichInput(event: Event) {
    const note = this.selectedNode();
    if (!note || note.type !== 'note' || note.locked) return;
    const target = event.target as HTMLElement;
    note.content = target.innerHTML;
  }

  onMarkdownInput(event: Event) {
    const note = this.selectedNode();
    if (!note || note.type !== 'note' || note.locked) return;
    const target = event.target as HTMLTextAreaElement;
    note.content = target.value;
    this.commit({ ...this.state() });
  }

  deleteNode(nodeId?: string) {
    if (!nodeId) return;
    if (nodeId === this.activeRoot().id) return;
    this.removeNode(nodeId);
  }

  duplicateNode(nodeId?: string) {
    if (!nodeId) return;
    const node = this.findNode(this.activeRoot(), nodeId);
    if (!node || !node.parentId) return;
    const parent = this.findNode(this.activeRoot(), node.parentId);
    if (!parent || parent.type !== 'folder' || !parent.children) return;
    parent.children.push(this.cloneNode(node, parent.id));
    this.commit({ ...this.state() });
  }

  toggleSelected(node: NoteNode, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.state().selectedIds);
    if (checked) {
      next.add(node.id);
      if (node.type === 'folder') {
        this.collectDescendants(node).forEach((id) => next.add(id));
      }
    } else {
      next.delete(node.id);
      if (node.type === 'folder') {
        this.collectDescendants(node).forEach((id) => next.delete(id));
      }
    }
    this.commit({ ...this.state(), selectedIds: Array.from(next) });
  }

  isSelected(id: string) {
    return this.state().selectedIds.includes(id);
  }

  isActive(id?: string | null) {
    return Boolean(id && this.state().selectedId === id);
  }

  selectedIds() {
    return this.state().selectedIds;
  }

  selectAll() {
    const ids = new Set<string>();
    const walk = (node: NoteNode) => {
      if (node.id !== this.activeRoot().id) ids.add(node.id);
      if (node.type === 'folder') {
        (node.children ?? []).forEach(walk);
      }
    };
    walk(this.activeRoot());
    this.commit({ ...this.state(), selectedIds: Array.from(ids) });
  }

  deselectAll() {
    this.commit({ ...this.state(), selectedIds: [] });
  }

  duplicateSelected() {
    const selected = new Set(this.state().selectedIds);
    const targets = this.selectedTopLevelNodes(selected);
    targets.forEach(({ node, parent }) => {
      if (!parent?.children) return;
      parent.children.push(this.cloneNodeFiltered(node, parent.id, selected));
    });
    this.commit({ ...this.state() });
  }

  confirmBulkDelete() {
    this.bulkDeleteOpen.set(true);
  }

  deleteSelected() {
    const selected = new Set(this.state().selectedIds);
    const root = this.activeRoot();
    const cleaned = this.pruneNode(root, selected, undefined);
    const nextRoot = cleaned[0] ?? root;
    if (this.isArchiveView()) {
      this.commit({
        ...this.state(),
        archiveRoot: nextRoot,
        selectedIds: [],
        selectedId: null,
      });
    } else {
      this.commit({
        ...this.state(),
        root: nextRoot,
        selectedIds: [],
        selectedId: null,
      });
    }
    this.bulkDeleteOpen.set(false);
  }

  archiveSelected() {
    const selected = new Set(this.state().selectedIds);
    if (!selected.size) return;
    const root = this.state().root;
    const archiveRoot = this.state().archiveRoot;
    const targets = this.selectedTopLevelNodes(selected);
    const archived = targets.map(({ node }) =>
      this.cloneNodeFiltered(node, archiveRoot.id, selected, true),
    );
    const pruned = this.pruneNode(root, selected, undefined)[0] ?? root;
    archived.forEach((node) => this.markLocked(node));
    archiveRoot.children?.push(...archived);
    this.commit({
      ...this.state(),
      root: pruned,
      archiveRoot,
      selectedIds: [],
      selectedId: null,
    });
  }

  unarchiveSelected() {
    const selected = new Set(this.state().selectedIds);
    if (!selected.size) return;
    const archiveRoot = this.state().archiveRoot;
    const root = this.state().root;
    const targets = this.selectedTopLevelNodes(selected);
    const restored = targets.map(({ node }) =>
      this.cloneNodeFiltered(node, root.id, selected, true),
    );
    restored.forEach((node) => this.markUnlocked(node));
    const pruned = this.pruneNode(archiveRoot, selected, undefined)[0] ?? archiveRoot;
    root.children?.push(...restored);
    this.commit({
      ...this.state(),
      root,
      archiveRoot: pruned,
      selectedIds: [],
      selectedId: null,
    });
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
    link.download = `notes-${this.instanceId}.json`;
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
        const parsed = JSON.parse(String(reader.result || '{}')) as NotesState;
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
    this.wipeInstanceOpen.set(true);
  }

  wipeInstance() {
    const root = createFolder('Notes');
    const firstFolder = createFolder('New folder', root.id);
    const firstNote = createNote('New note', firstFolder.id);
    firstFolder.children = [firstNote];
    root.children = [firstFolder];
    const next = { ...this.state(), root, selectedId: firstNote.id };
    this.commit(next);
    this.wipeInstanceOpen.set(false);
  }

  private mergeImported(imported: NotesState) {
    const root = this.state().root;
    const archive = this.state().archiveRoot;
    const importedRoot = this.cloneTreeWithNewIds(imported.root, root.id);
    const importedArchive = this.cloneTreeWithNewIds(imported.archiveRoot, archive.id);
    root.children = [...(root.children ?? []), ...(importedRoot.children ?? [])];
    archive.children = [...(archive.children ?? []), ...(importedArchive.children ?? [])];
    this.commit({ ...this.state(), root, archiveRoot: archive });
  }

  private cloneTreeWithNewIds(node: NoteNode, parentId?: string): NoteNode {
    const nextId = `${node.type}_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const copy: NoteNode = { ...node, id: nextId, parentId };
    if (node.type === 'folder') {
      copy.children = (node.children ?? []).map((child) =>
        this.cloneTreeWithNewIds(child, copy.id),
      );
    }
    return copy;
  }

  private countNodes(node: NoteNode, type: NodeType): number {
    let count = 0;
    if (node.type === type && node.id !== this.activeRoot().id) count += 1;
    if (node.type === 'folder') {
      for (const child of node.children ?? []) {
        count += this.countNodes(child, type);
      }
    }
    return count;
  }

  private directNoteCount(node: NoteNode): number {
    if (node.type !== 'folder') return 0;
    return (node.children ?? []).filter((child) => child.type === 'note').length;
  }

  private totalNoteCount(node: NoteNode): number {
    if (node.type !== 'folder') return 0;
    let count = 0;
    for (const child of node.children ?? []) {
      if (child.type === 'note') count += 1;
      if (child.type === 'folder') count += this.totalNoteCount(child);
    }
    return count;
  }

  activeGlow() {
    return '0 0 0 2px #ffe49a, 0 0 10px rgba(255, 228, 154, 0.6)';
  }

  switchLabel() {
    const note = this.selectedNode();
    const mode = note?.lastEditMode ?? 'rich';
    return mode === 'markdown'
      ? this.translate.instant('notes.switchToRich')
      : this.translate.instant('notes.switchToMarkdown');
  }

  statusLabel() {
    const note = this.selectedNode();
    if (!note || note.type !== 'note') return '';
    const labels: string[] = [];
    const baseMode = note.lastEditMode ?? 'rich';
    labels.push(
      baseMode === 'markdown'
        ? this.translate.instant('notes.modeMarkdown')
        : this.translate.instant('notes.modeRich'),
    );
    if (note.editorMode === 'visual') {
      labels.push(this.translate.instant('notes.modeVisual'));
    }
    if (note.locked) {
      labels.push(this.translate.instant('notes.lockedLabel'));
    } else if (note.editorMode !== 'visual') {
      labels.push(this.translate.instant('notes.editingActive'));
    }
    return labels.join(' - ');
  }

  startRename(nodeId?: string | null) {
    if (!nodeId) return;
    if (nodeId === this.activeRoot().id) return;
    if (this.state().selectedId !== nodeId) return;
    const node = this.findNode(this.activeRoot(), nodeId);
    if (!node) return;
    this.editingNodeId.set(nodeId);
    this.editingName.set(node.name);
  }

  finishRename() {
    const nodeId = this.editingNodeId();
    if (!nodeId) return;
    const node = this.findNode(this.activeRoot(), nodeId);
    const nextName = this.editingName().trim();
    if (node && nextName) {
      node.name = nextName;
      this.commit({ ...this.state() });
    }
    this.editingNodeId.set(null);
  }

  private selectedFolder() {
    const selected = this.selectedNode();
    if (!selected) return null;
    if (selected.type === 'folder') return selected;
    if (selected.parentId) {
      const parent = this.findNode(this.state().root, selected.parentId);
      return parent?.type === 'folder' ? parent : null;
    }
    return null;
  }

  private collectDescendants(node: NoteNode) {
    const ids: string[] = [];
    if (node.type === 'folder') {
      (node.children ?? []).forEach((child) => {
        ids.push(child.id);
        ids.push(...this.collectDescendants(child));
      });
    }
    return ids;
  }

  private selectedTopLevelNodes(selected: Set<string>) {
    const root = this.activeRoot();
    const targets: { node: NoteNode; parent: NoteNode | null }[] = [];
    const walk = (node: NoteNode, parent: NoteNode | null) => {
      const isSelected = selected.has(node.id);
      if (isSelected && (!parent || !selected.has(parent.id))) {
        targets.push({ node, parent });
      }
      if (node.type === 'folder') {
        (node.children ?? []).forEach((child) => walk(child, node));
      }
    };
    (root.children ?? []).forEach((child) => walk(child, root));
    return targets;
  }

  private pruneNode(node: NoteNode, selected: Set<string>, parentId?: string): NoteNode[] {
    if (node.type === 'note') {
      return selected.has(node.id) ? [] : [{ ...node, parentId }];
    }
    if (node.id !== this.activeRoot().id && selected.has(node.id)) {
      const children = (node.children ?? []).flatMap((child) =>
        this.pruneNode(child, selected, parentId),
      );
      return children;
    }
    const keptChildren = (node.children ?? []).flatMap((child) =>
      this.pruneNode(child, selected, node.id),
    );
    return [{ ...node, parentId, children: keptChildren }];
  }

  private cloneNode(node: NoteNode, parentId: string): NoteNode {
    if (node.type === 'note') {
      return {
        ...createNote(`${node.name} ${this.translate.instant('notes.copySuffix')}`, parentId),
        content: node.content ?? '',
        editorMode: node.editorMode ?? 'rich',
        editorVisible: node.editorVisible ?? true,
        locked: node.locked ?? false,
      };
    }
    const folder = createFolder(
      `${node.name} ${this.translate.instant('notes.copySuffix')}`,
      parentId,
      node.locked ?? false,
    );
    folder.children = (node.children ?? []).map((child) => this.cloneNode(child, folder.id));
    return folder;
  }

  private cloneNodeFiltered(
    node: NoteNode,
    parentId: string,
    selected: Set<string>,
    preserveName = false,
  ): NoteNode {
    if (node.type === 'note') {
      return {
        ...createNote(
          preserveName ? node.name : `${node.name} ${this.translate.instant('notes.copySuffix')}`,
          parentId,
          node.locked ?? false,
        ),
        content: node.content ?? '',
        editorMode: node.editorMode ?? 'rich',
        editorVisible: node.editorVisible ?? true,
      };
    }
    const folder = createFolder(
      preserveName ? node.name : `${node.name} ${this.translate.instant('notes.copySuffix')}`,
      parentId,
      node.locked ?? false,
    );
    folder.children = (node.children ?? [])
      .filter((child) => selected.has(child.id))
      .map((child) => this.cloneNodeFiltered(child, folder.id, selected));
    return folder;
  }

  private markLocked(node: NoteNode) {
    node.locked = true;
    if (node.type === 'folder') {
      (node.children ?? []).forEach((child) => this.markLocked(child));
    }
  }

  private markUnlocked(node: NoteNode) {
    node.locked = false;
    if (node.type === 'folder') {
      (node.children ?? []).forEach((child) => this.markUnlocked(child));
    }
  }

  private depthForNode(node: NoteNode) {
    let depth = 0;
    let current: NoteNode | null = node;
    while (current?.parentId) {
      depth += 1;
      const next = this.findNode(this.state().root, current.parentId);
      if (!next) break;
      current = next;
    }
    return depth;
  }

  private findNode(node: NoteNode, id: string): NoteNode | null {
    if (node.id === id) return node;
    if (node.type === 'folder') {
      for (const child of node.children ?? []) {
        const found = this.findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  }

  private removeNode(id: string) {
    const root = this.activeRoot();
    const parent = this.findParent(root, id);
    if (!parent || !parent.children) return;
    parent.children = parent.children.filter((child) => child.id !== id);
    this.commit({ ...this.state(), selectedId: null });
  }

  private findParent(node: NoteNode, id: string): NoteNode | null {
    if (node.type !== 'folder') return null;
    for (const child of node.children ?? []) {
      if (child.id === id) return node;
      const found = this.findParent(child, id);
      if (found) return found;
    }
    return null;
  }

  private cloneState(state: NotesState): NotesState {
    const cloneTree = (node: NoteNode, parentId?: string): NoteNode => {
      const copy: NoteNode = { ...node, parentId };
      if (node.type === 'folder') {
        copy.children = (node.children ?? []).map((child) => cloneTree(child, copy.id));
      }
      return copy;
    };
    return {
      ...state,
      root: cloneTree(state.root),
      archiveRoot: cloneTree(state.archiveRoot),
      selectedId: state.selectedId,
      selectedIds: [...state.selectedIds],
    };
  }

  renderMarkdown(input: string) {
    const escaped = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped
      .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  }

  renderVisual(note: NoteNode | null) {
    if (!note || note.type !== 'note') return '';
    const raw = note.content ?? '';
    if (note.lastEditMode === 'markdown') {
      return this.renderMarkdown(raw);
    }
    return this.normalizeRichHtml(raw);
  }

  private normalizeRichHtml(input: string) {
    return input
      .replace(/\u00a0/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;nbsp;/g, ' ')
      .replace(/<div><br><\/div>/g, '<br />')
      .replace(/<div>/g, '')
      .replace(/<\/div>/g, '<br />');
  }

  private richToPlainText(input: string) {
    const normalized = this.normalizeRichHtml(input)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    return normalized
      .replace(/\u00a0/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }
}
