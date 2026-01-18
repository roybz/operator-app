import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type NodeType = 'folder' | 'note';
type EditorMode = 'rich' | 'markdown';

interface NoteNode {
  id: string;
  type: NodeType;
  name: string;
  parentId?: string;
  children?: NoteNode[];
  collapsed?: boolean;
  content?: string;
  editorMode?: EditorMode;
  editorVisible?: boolean;
  locked?: boolean;
}

interface NotesState {
  root: NoteNode;
  selectedId: string | null;
  selectedIds: string[];
}

const stateStore = new Map<string, NotesState>();

export function clearNotesState(instanceId: string) {
  stateStore.delete(instanceId);
}

const createFolder = (name: string, parentId?: string): NoteNode => ({
  id: `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  type: 'folder',
  name,
  parentId,
  children: [],
  collapsed: false,
});

const createNote = (name: string, parentId?: string): NoteNode => ({
  id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  type: 'note',
  name,
  parentId,
  content: '',
  editorMode: 'rich',
  editorVisible: true,
  locked: false,
});

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div style="display:flex; gap:12px; height:100%;">
      <aside style="width:220px; border-right:1px solid #ddd; padding-right:8px; overflow:auto;">
        <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
          <button (click)="addFolder()">{{ 'notes.addFolder' | translate }}</button>
          <button (click)="addNote()">{{ 'notes.addNote' | translate }}</button>
        </div>

        <div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">
          <button (click)="duplicateSelected()" [disabled]="!selectedIds().length">
            {{ 'notes.duplicateSelected' | translate }}
          </button>
          <button (click)="deleteSelected()" [disabled]="!selectedIds().length">
            {{ 'notes.deleteSelected' | translate }}
          </button>
        </div>

        <ng-container
          *ngTemplateOutlet="treeTemplate; context: { $implicit: state().root, depth: 0 }"
        ></ng-container>
      </aside>

      <section style="flex:1; display:flex; flex-direction:column; gap:12px;">
        @if (selectedNode() && selectedNode()?.type === 'note') {
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0;">{{ selectedNode()?.name }}</h3>
            <div style="display:flex; gap:8px;">
              <button (click)="toggleEditor()">
                {{
                  selectedNode()?.editorVisible
                    ? ('notes.collapseEditor' | translate)
                    : ('notes.expandEditor' | translate)
                }}
              </button>
              <button (click)="toggleEditorMode()">
                {{
                  selectedNode()?.editorMode === 'rich'
                    ? ('notes.switchToMarkdown' | translate)
                    : ('notes.switchToRich' | translate)
                }}
              </button>
              <button (click)="toggleLock()">
                {{
                  selectedNode()?.locked ? ('notes.unlock' | translate) : ('notes.lock' | translate)
                }}
              </button>
              <button (click)="duplicateNode(selectedNode()?.id)">
                {{ 'notes.duplicate' | translate }}
              </button>
              <button (click)="deleteNode(selectedNode()?.id)">
                {{ 'notes.delete' | translate }}
              </button>
            </div>
          </div>

          @if (selectedNode()?.editorVisible) {
            @if (selectedNode()?.editorMode === 'rich') {
              <div
                contenteditable="true"
                [innerHTML]="selectedNode()?.content"
                (input)="onRichInput($event)"
                [style.pointerEvents]="selectedNode()?.locked ? 'none' : 'auto'"
                [style.opacity]="selectedNode()?.locked ? 0.6 : 1"
                style="border:1px solid #ccc; border-radius:6px; padding:10px; min-height:200px;"
              ></div>
            } @else {
              <textarea
                [value]="selectedNode()?.content"
                (input)="onMarkdownInput($event)"
                [disabled]="selectedNode()?.locked"
                style="border:1px solid #ccc; border-radius:6px; padding:10px; min-height:200px;"
              ></textarea>
            }
          }
        } @else {
          <div style="opacity:0.7;">{{ 'notes.selectHint' | translate }}</div>
        }
      </section>
    </div>

    <ng-template #treeTemplate let-node let-depth="depth">
      <div style="display:flex; align-items:center; gap:6px;" [style.marginLeft.px]="depth * 12">
        @if (node.id !== state().root.id) {
          <input
            type="checkbox"
            [checked]="isSelected(node.id)"
            (change)="toggleSelected(node.id, $event)"
          />
        }
        <button
          (click)="selectNode(node.id)"
          [style.fontWeight]="isActive(node.id) ? '600' : '400'"
        >
          {{ node.id === state().root.id ? ('notes.root' | translate) : node.name }}
        </button>
        @if (node.type === 'folder' && node.id !== state().root.id) {
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
  `,
})
export class NotesComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  private translate = inject(TranslateService);
  state = signal<NotesState>({
    root: createFolder('Notes'),
    selectedId: null,
    selectedIds: [],
  });

  ngOnInit() {
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.state.set(this.cloneState(stored));
      return;
    }
    stateStore.set(this.instanceId, this.state());
  }

  private commit(next: NotesState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
  }

  selectedNode() {
    const id = this.state().selectedId;
    return id ? this.findNode(this.state().root, id) : null;
  }

  selectNode(id: string) {
    if (id === this.state().root.id) return;
    this.commit({ ...this.state(), selectedId: id });
  }

  addFolder() {
    const parent = this.selectedFolder() ?? this.state().root;
    if (this.depthForNode(parent) >= 99) return;
    const folder = createFolder(this.translate.instant('notes.defaultFolder'), parent.id);
    parent.children?.push(folder);
    this.commit({ ...this.state(), selectedId: folder.id });
  }

  addNote() {
    const parent = this.selectedFolder() ?? this.state().root;
    if (this.depthForNode(parent) >= 99) return;
    const note = createNote(this.translate.instant('notes.defaultNote'), parent.id);
    parent.children?.push(note);
    this.commit({ ...this.state(), selectedId: note.id });
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
  }

  toggleEditorMode() {
    const note = this.selectedNode();
    if (!note || note.type !== 'note') return;
    note.editorMode = note.editorMode === 'rich' ? 'markdown' : 'rich';
    this.commit({ ...this.state() });
  }

  toggleLock() {
    const note = this.selectedNode();
    if (!note || note.type !== 'note') return;
    note.locked = !note.locked;
    this.commit({ ...this.state() });
  }

  onRichInput(event: Event) {
    const note = this.selectedNode();
    if (!note || note.type !== 'note' || note.locked) return;
    const target = event.target as HTMLElement;
    note.content = target.innerHTML;
    this.commit({ ...this.state() });
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
    if (nodeId === this.state().root.id) return;
    this.removeNode(nodeId);
  }

  duplicateNode(nodeId?: string) {
    if (!nodeId) return;
    const node = this.findNode(this.state().root, nodeId);
    if (!node || !node.parentId) return;
    const parent = this.findNode(this.state().root, node.parentId);
    if (!parent || parent.type !== 'folder' || !parent.children) return;
    parent.children.push(this.cloneNode(node, parent.id));
    this.commit({ ...this.state() });
  }

  toggleSelected(id: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.state().selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.commit({ ...this.state(), selectedIds: Array.from(next) });
  }

  isSelected(id: string) {
    return this.state().selectedIds.includes(id);
  }

  isActive(id: string) {
    return this.state().selectedId === id;
  }

  selectedIds() {
    return this.state().selectedIds;
  }

  duplicateSelected() {
    const ids = this.state().selectedIds;
    ids.forEach((id) => this.duplicateNode(id));
  }

  deleteSelected() {
    const ids = [...this.state().selectedIds];
    ids.forEach((id) => this.removeNode(id));
    this.commit({ ...this.state(), selectedIds: [] });
  }

  private removeNode(id: string) {
    const parent = this.findParent(this.state().root, id);
    if (!parent || !parent.children) return;
    parent.children = parent.children.filter((child) => child.id !== id);
    this.commit({ ...this.state(), selectedId: null });
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

  private findParent(node: NoteNode, id: string): NoteNode | null {
    if (node.type !== 'folder') return null;
    for (const child of node.children ?? []) {
      if (child.id === id) return node;
      const found = this.findParent(child, id);
      if (found) return found;
    }
    return null;
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
    );
    folder.children = (node.children ?? []).map((child) => this.cloneNode(child, folder.id));
    return folder;
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
      root: cloneTree(state.root),
      selectedId: state.selectedId,
      selectedIds: [...state.selectedIds],
    };
  }
}
