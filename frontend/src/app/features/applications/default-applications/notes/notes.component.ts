import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import {
  buildInstanceStorageKey,
  clearInstanceScopedState,
  cloneInstanceScopedState,
} from '../../../dependencies/instance-state-storage';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { ImportGuardService } from '../../../../core/import-guard.service';
import { ExportGuardService } from '../../../../core/export-guard.service';
import { StorageService } from '../../../../core/storage/storage.service';
import { RemoteConflictService } from '../../../../core/realtime/remote-conflict.service';
import {
  InstancePersistQueue,
  isRemoteStorageTooManyRequests,
  isRemoteStorageVersionConflict,
} from '../../../../core/realtime/instance-persist-queue';
import { ObsidianImportService } from '../../../../core/obsidian/obsidian-import.service';
import { VaultDbService } from '../../../../core/obsidian/vault-db';
import {
  ObsidianImportProgress,
  ObsidianImportStats,
  LinkIndexRecord,
  VaultFileTreeNode,
} from '../../../../core/obsidian/vault-types';
import { DialogService } from '../../../../core/dialog.service';

type NodeType = 'folder' | 'note';
type EditorMode = 'rich' | 'markdown' | 'visual';

type NotesView = 'notes' | 'archive';
type NotesSource =
  | { type: 'internal' }
  | { type: 'vault'; vaultId: string; vaultName: string; pathPrefix?: string | null };

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
  sidebarOpenDesktop: boolean;
  sidebarOpenPhone: boolean;
  phoneSidebarInit?: boolean;
  source?: NotesSource;
  vaultSelectedNodeId?: string | null;
}

interface VaultTreeFlatRow {
  id: string;
  node: VaultFileTreeNode;
  depth: number;
}

const stateStore = new Map<string, NotesState>();
const STORAGE_PREFIX = 'op_app_state:notes';

export function clearNotesState(instanceId: string, storage: StorageService) {
  clearInstanceScopedState(stateStore, STORAGE_PREFIX, instanceId, storage);
}

export function cloneNotesState(fromId: string, toId: string, storage: StorageService) {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  const cloneTree = (node: NoteNode, parentId?: string): NoteNode => {
    const copy: NoteNode = { ...node, parentId };
    if (node.type === 'folder') {
      copy.children = (node.children ?? []).map((child) => cloneTree(child, copy.id));
    }
    return copy;
  };
  cloneInstanceScopedState(stateStore, STORAGE_PREFIX, fromId, toId, storage, (stored) => ({
    ...stored,
    root: cloneTree(stored.root),
    archiveRoot: cloneTree(stored.archiveRoot),
    selectedId: null,
    selectedIds: [],
  }));
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
            <label style="display:inline-flex; align-items:center; gap:8px;">
              <span>{{ 'notes.importVaultZip' | translate }}</span>
              <input
                type="file"
                accept=".zip,application/zip"
                (change)="queueVaultZipImport($event)"
              />
            </label>
            <button (click)="startVaultFolderImport()">
              {{ 'notes.importVaultFolder' | translate }}
            </button>
            <button (click)="confirmWipeInstance()">
              {{ 'notes.wipeInstance' | translate }}
            </button>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span>{{ 'notes.importVaultDestination' | translate }}</span>
            <select
              [value]="vaultImportDestination()"
              (change)="vaultImportDestination.set($any($event.target).value)"
            >
              <option value="new">{{ 'notes.importVaultDestinationNew' | translate }}</option>
              <option value="current">
                {{ 'notes.importVaultDestinationCurrent' | translate }}
              </option>
              <option value="splitTopLevel">
                {{ 'notes.importVaultDestinationSplitTopLevel' | translate }}
              </option>
            </select>
            @if (isVaultMode()) {
              <button (click)="cloneCurrentVaultToNewInstance()">
                {{ 'notes.cloneVaultToNewInstance' | translate }}
              </button>
            }
          </div>
          <label style="display:inline-flex; align-items:flex-start; gap:8px; flex-wrap:wrap;">
            <input
              type="checkbox"
              [checked]="vaultImportCloudBeta()"
              [disabled]="!vaultCloudBetaAvailable()"
              (change)="vaultImportCloudBeta.set($any($event.target).checked)"
            />
            <span>
              {{ 'notes.cloudBetaImportToggle' | translate }}
              <small style="display:block; opacity:0.75;">
                {{
                  (vaultCloudBetaAvailable()
                    ? 'notes.cloudBetaImportHelp'
                    : 'notes.cloudBetaImportUnavailable'
                  ) | translate
                }}
              </small>
            </span>
          </label>
          @if (isVaultMode()) {
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <label style="display:inline-flex; align-items:center; gap:8px;">
                <input
                  type="checkbox"
                  [checked]="vaultCloudBetaEnabled()"
                  [disabled]="!vaultCloudBetaAvailable() || vaultCloudBetaSyncing()"
                  (change)="toggleCurrentVaultCloudBeta($any($event.target).checked)"
                />
                <span>{{ 'notes.cloudBetaVaultToggle' | translate }}</span>
              </label>
              @if (vaultCloudBetaSyncing()) {
                <small style="opacity:0.75;">{{ 'notes.cloudBetaSyncing' | translate }}</small>
              } @else if (vaultCloudBetaStatusMessage()) {
                <small style="opacity:0.75;">{{
                  vaultCloudBetaStatusMessage() ?? '' | translate
                }}</small>
              }
            </div>
          }
          @if (importStatus() === 'loading') {
            <div style="opacity:0.7;">{{ 'dialogs.importing' | translate }}</div>
          } @else if (importStatus() === 'success') {
            <div style="color:#1b5e20;">{{ 'dialogs.importSuccess' | translate }}</div>
          } @else if (importStatus() === 'error') {
            <div style="color:#b00020;">{{ importMessage() ?? '' | translate }}</div>
          }
          @if (vaultImportStatus() === 'loading') {
            <div style="opacity:0.8;">
              {{ 'notes.importVaultLoading' | translate }}
              @if (vaultImportProgress()) {
                <div style="font-size:12px; opacity:0.8;">
                  {{ vaultImportProgress()?.phase }}
                  @if (vaultImportProgress()?.scanned) {
                    ({{ vaultImportProgress()?.scanned }}/{{ vaultImportProgress()?.total }})
                  }
                </div>
              }
            </div>
          } @else if (vaultImportStatus() === 'success') {
            <div style="color:#1b5e20;">{{ 'notes.importVaultSuccess' | translate }}</div>
            @if (vaultImportSummary()) {
              <div style="font-size:12px; opacity:0.8;">
                {{
                  'notes.importVaultSummary'
                    | translate
                      : {
                          md: vaultImportSummary()?.markdownCount,
                          assets: vaultImportSummary()?.assetCount,
                          unresolved: vaultImportSummary()?.unresolvedLinksCount,
                        }
                }}
              </div>
            }
          } @else if (vaultImportStatus() === 'error') {
            <div style="color:#b00020;">{{ vaultImportMessage() ?? '' | translate }}</div>
          }
        </div>
      }
      @if (isPhoneMode()) {
        <button class="notes-sidebar-toggle" (click)="toggleSidebar()">
          {{ sidebarOpen() ? '⟨' : '⟩' }}
        </button>
      }
      <aside
        [attr.data-collapsed]="sidebarOpen() ? 'false' : 'true'"
        [style.width]="
          isPhoneMode() ? (sidebarOpen() ? '100%' : '0') : sidebarOpen() ? '240px' : '40px'
        "
        [style.minWidth]="
          isPhoneMode() ? (sidebarOpen() ? '100%' : '0') : sidebarOpen() ? '200px' : '40px'
        "
        [style.display]="isPhoneMode() && !sidebarOpen() ? 'none' : 'flex'"
        style="border-right:1px solid var(--color-border); padding-right:8px; padding-left:13px; overflow:auto; transition:width 160ms ease; display:flex; flex-direction:column;"
      >
        @if (sidebarOpen()) {
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

        @if (sidebarOpen()) {
          @if (!isVaultMode()) {
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
          }

          @if (!isVaultMode() && selectedIds().length) {
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

          @if (!state().listCollapsed && !isVaultMode()) {
            @if (!(activeRoot().children?.length ?? 0)) {
              <div style="font-size:12px; opacity:0.6;">
                {{ 'notes.emptyHint' | translate }}
              </div>
            }
            <ng-container
              *ngTemplateOutlet="treeTemplate; context: { $implicit: activeRoot(), depth: 0 }"
            ></ng-container>
          }
          @if (isVaultMode()) {
            <div style="font-size:12px; opacity:0.7; margin: 10px 0;">
              {{ 'notes.vaultModeLabel' | translate }}: {{ currentVaultName() }}
              <span style="margin-left:8px;">
                {{
                  (vaultCloudBetaEnabled()
                    ? 'notes.vaultStorageCloudBeta'
                    : 'notes.vaultStorageLocalDevice'
                  ) | translate
                }}
              </span>
            </div>
            <div
              style="border:1px solid var(--color-border); border-radius:6px; overflow:auto; min-height:180px; max-height:320px;"
              (scroll)="onVaultTreeScroll($event)"
              #vaultTreeScrollHost
            >
              <div [style.height.px]="vaultTreeContentHeight()" style="position:relative;">
                <div
                  [style.transform]="
                    'translateY(' + vaultVisibleStartIndex() * vaultTreeRowHeight + 'px)'
                  "
                  style="position:absolute; inset:0 auto auto 0; right:0;"
                >
                  @for (row of vaultVisibleRows(); track row.id) {
                    <div
                      style="display:flex; align-items:center; gap:6px; min-height:26px; padding-right:4px;"
                      [style.marginLeft.px]="row.depth * 12"
                    >
                      @if (row.node.type === 'folder') {
                        <span>📁</span>
                        <span>{{ row.node.name }}</span>
                      } @else {
                        <button
                          (click)="selectVaultNode(row.node.id)"
                          [style.fontWeight]="
                            state().vaultSelectedNodeId === row.node.id ? '700' : '400'
                          "
                          [title]="row.node.path"
                        >
                          {{ row.node.name }}
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
            <div
              style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;"
            >
              <button (click)="vaultUnresolvedPanelOpen.set(!vaultUnresolvedPanelOpen())">
                {{ 'notes.unresolvedLinks' | translate }}
                ({{ vaultUnresolvedLinks().length }})
              </button>
            </div>
            @if (vaultUnresolvedPanelOpen()) {
              <div
                style="border:1px solid var(--color-border); border-radius:6px; padding:8px; margin-top:6px; max-height:180px; overflow:auto; display:flex; flex-direction:column; gap:6px;"
              >
                @if (!vaultUnresolvedLinks().length) {
                  <div style="font-size:12px; opacity:0.7;">
                    {{ 'notes.unresolvedLinksEmpty' | translate }}
                  </div>
                } @else {
                  @for (link of vaultUnresolvedLinks().slice(0, 100); track link.id) {
                    <button
                      style="text-align:left; display:flex; flex-direction:column; gap:2px;"
                      (click)="openUnresolvedLinkSource(link)"
                    >
                      <span style="font-size:12px; font-weight:600;">{{ link.rawTarget }}</span>
                      <span style="font-size:11px; opacity:0.7;">{{
                        unresolvedLinkSourcePath(link)
                      }}</span>
                    </button>
                  }
                }
              </div>
            }
          }

          <div style="margin-top:auto; display:flex; flex-wrap:wrap; padding-left:20px;">
            @if (!isVaultMode()) {
              <div style="font-size:12px; color:var(--color-muted);">
                {{ 'notes.folderCount' | translate: { count: folderCount() } }}
              </div>
              <span> </span>
              <div style="font-size:12px; color:var(--color-muted);">
                {{ 'notes.noteCount' | translate: { count: noteCount() } }}
              </div>
            }
          </div>
        }
      </aside>

      <section
        style="flex:1; display:flex; flex-direction:column; gap:12px;"
        [style.display]="isPhoneMode() && sidebarOpen() ? 'none' : 'flex'"
      >
        @if (!settingsOpen() && isVaultMode()) {
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <h3 style="margin:0;">{{ currentVaultName() }}</h3>
            <button (click)="exitVaultMode()">
              {{ 'notes.exitVaultMode' | translate }}
            </button>
          </div>
          <div style="font-size:12px; color:var(--color-muted);">
            {{ 'notes.vaultReadOnly' | translate }}
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button (click)="saveVaultFile()" [disabled]="!vaultDirty() || vaultSaving()">
              {{
                vaultSaving() ? ('notes.vaultSaving' | translate) : ('notes.vaultSave' | translate)
              }}
            </button>
            @if (vaultDirty()) {
              <span style="font-size:12px; color:var(--color-muted);">
                {{ 'notes.vaultUnsaved' | translate }}
              </span>
            }
          </div>
          <div
            style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; flex:1; min-height:260px;"
          >
            <textarea
              [value]="vaultDraftContent()"
              (input)="onVaultDraftInput($event)"
              (keydown.control.s)="saveVaultFile(); $event.preventDefault()"
              style="border:1px solid var(--color-border); border-radius:6px; padding:10px; min-height:260px;"
            ></textarea>
            <div
              [innerHTML]="vaultPreviewHtml()"
              tabindex="0"
              (click)="onVaultPreviewClick($event)"
              (keydown.enter)="onVaultPreviewClick($event)"
              (keydown.space)="onVaultPreviewClick($event)"
              style="border:1px solid var(--color-border); border-radius:6px; padding:10px; min-height:260px; overflow:auto;"
            ></div>
          </div>
        } @else if (!settingsOpen() && selectedNode() && selectedNode()?.type === 'note') {
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
                (focus)="startMarkdownEdit()"
                (input)="onMarkdownInput($event)"
                (blur)="finishMarkdownEdit()"
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
    <ng-template #vaultTreeTemplate let-nodes let-depth="depth">
      @for (node of nodes; track node.id) {
        <div style="display:flex; align-items:center; gap:6px;" [style.marginLeft.px]="depth * 12">
          @if (node.type === 'folder') {
            <span>📁</span>
            <span>{{ node.name }}</span>
          } @else {
            <button
              (click)="selectVaultNode(node.id)"
              [style.fontWeight]="state().vaultSelectedNodeId === node.id ? '700' : '400'"
            >
              {{ node.name }}
            </button>
          }
        </div>
        @if (node.children?.length) {
          <ng-container
            *ngTemplateOutlet="
              vaultTreeTemplate;
              context: { $implicit: node.children, depth: depth + 1 }
            "
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
export class NotesComponent implements OnInit, OnDestroy {
  @Input({ required: true }) instanceId!: string;

  private translate = inject(TranslateService);
  private prefs = inject(AppPreferencesService);
  private instanceSettings = inject(InstanceSettingsService);
  private importGuard = inject(ImportGuardService);
  private exportGuard = inject(ExportGuardService);
  private storage = inject(StorageService);
  private remoteConflict = inject(RemoteConflictService);
  private obsidianImport = inject(ObsidianImportService);
  private vaultDb = inject(VaultDbService);
  private dialog = inject(DialogService);
  state = signal<NotesState>({
    root: createFolder('Notes'),
    archiveRoot: createFolder('Archive', undefined, true),
    selectedId: null,
    selectedIds: [],
    view: 'notes',
    listCollapsed: false,
    sidebarOpenDesktop: true,
    sidebarOpenPhone: false,
    source: { type: 'internal' },
    vaultSelectedNodeId: null,
  });
  editingNodeId = signal<string | null>(null);
  editingName = signal('');
  bulkDeleteOpen = signal(false);
  wipeInstanceOpen = signal(false);
  pendingImport = signal<{ file: File; input: HTMLInputElement } | null>(null);
  pendingVaultImport = signal<{ file: File; input: HTMLInputElement } | null>(null);
  vaultImportDestination = signal<'current' | 'new' | 'splitTopLevel'>('new');
  vaultImportCloudBeta = signal(false);
  importStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  importMessage = signal<string | null>(null);
  vaultImportStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  vaultImportMessage = signal<string | null>(null);
  vaultImportProgress = signal<ObsidianImportProgress | null>(null);
  vaultImportSummary = signal<ObsidianImportStats | null>(null);
  importLimitOpen = signal(false);
  exportLimitOpen = signal(false);
  richFocused = signal(false);
  markdownFocused = signal(false);
  richSnapshot = signal('');
  isPhoneMode = computed(() => this.prefs.preferences().phoneMode);
  richHtml = computed(() =>
    this.richFocused() ? this.richSnapshot() : (this.selectedNode()?.content ?? ''),
  );
  vaultTree = signal<VaultFileTreeNode[]>([]);
  vaultFlatRows = computed(() => this.flattenVaultTree(this.vaultTree()));
  vaultVisibleRows = computed(() => {
    const rows = this.vaultFlatRows();
    const height = Math.max(this.vaultTreeViewportHeight(), this.vaultTreeRowHeight * 4);
    const overscan = 10;
    const start = Math.max(
      0,
      Math.floor(this.vaultTreeScrollTop() / this.vaultTreeRowHeight) - overscan,
    );
    const count = Math.ceil(height / this.vaultTreeRowHeight) + overscan * 2;
    return rows.slice(start, start + count);
  });
  vaultVisibleStartIndex = computed(() =>
    Math.max(0, Math.floor(this.vaultTreeScrollTop() / this.vaultTreeRowHeight) - 10),
  );
  vaultTreeContentHeight = computed(() => this.vaultFlatRows().length * this.vaultTreeRowHeight);
  vaultFileContent = signal<string>('');
  vaultDraftContent = signal<string>('');
  vaultPreviewHtml = signal<string>('');
  vaultSelectedPath = signal<string | null>(null);
  vaultDirty = signal(false);
  vaultSaving = signal(false);
  vaultCloudBetaEnabled = signal(false);
  vaultCloudBetaSyncing = signal(false);
  vaultCloudBetaStatusMessage = signal<string | null>(null);
  vaultCloudBetaAvailable = computed(() => this.vaultDb.canUseCloudVaultSyncBeta());
  vaultUnresolvedLinks = signal<LinkIndexRecord[]>([]);
  vaultUnresolvedPanelOpen = signal(false);
  vaultTreeScrollTop = signal(0);
  vaultTreeViewportHeight = signal(320);
  readonly vaultTreeRowHeight = 26;
  private lastRemoteStorageChangeSeq = 0;
  private readonly persistQueue = new InstancePersistQueue({
    flush: async () => {
      await this.storage.setItem(this.instanceStorageKey(), JSON.stringify(this.state()));
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
      const userId = this.prefs.userId();
      const key = buildInstanceStorageKey(STORAGE_PREFIX, userId, this.instanceId || '');
      if (!this.instanceId || !event.keys.includes(key)) return;
      if (this.isLocallyEditing()) {
        this.remoteConflict.queue([key], 'dirty');
        return;
      }
      this.reloadFromStorage({ persistNormalized: false });
    });
  }

  ngOnInit() {
    if (this.reloadFromStorage({ persistNormalized: true })) return;
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      const nextStored = this.cloneState(stored);
      const legacySidebar = (nextStored as { sidebarOpen?: boolean }).sidebarOpen;
      const sidebarDesktop = nextStored.sidebarOpenDesktop ?? legacySidebar ?? true;
      const sidebarPhone =
        nextStored.sidebarOpenPhone ??
        (this.isPhoneMode() && !nextStored.phoneSidebarInit ? false : (legacySidebar ?? false));
      const next = {
        ...nextStored,
        sidebarOpenDesktop: sidebarDesktop,
        sidebarOpenPhone: sidebarPhone,
        phoneSidebarInit: this.isPhoneMode() ? true : nextStored.phoneSidebarInit,
        source: nextStored.source ?? ({ type: 'internal' } as const),
        vaultSelectedNodeId: nextStored.vaultSelectedNodeId ?? null,
      };
      this.state.set(next);
      stateStore.set(this.instanceId, next);
      this.persistState();
      this.syncRichSnapshot();
      if (next.source?.type === 'vault') void this.refreshVaultTree();
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
      sidebarOpenDesktop: true,
      sidebarOpenPhone: this.isPhoneMode() ? false : this.state().sidebarOpenPhone,
      phoneSidebarInit: this.isPhoneMode() ? true : undefined,
      source: { type: 'internal' },
      vaultSelectedNodeId: null,
    };
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
    this.syncRichSnapshot();
  }

  ngOnDestroy() {
    this.persistQueue.destroy();
  }

  private reloadFromStorage(options?: { persistNormalized?: boolean }) {
    const userId = this.prefs.userId();
    const raw = this.storage.getItemSync(
      buildInstanceStorageKey(STORAGE_PREFIX, userId, this.instanceId),
    );
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as NotesState & { sidebarOpen?: boolean };
      const sidebarDesktop =
        parsed.sidebarOpenDesktop ?? parsed.sidebarOpen ?? this.state().sidebarOpenDesktop;
      const sidebarPhone =
        parsed.sidebarOpenPhone ??
        (this.isPhoneMode() && !parsed.phoneSidebarInit
          ? false
          : (parsed.sidebarOpen ?? this.state().sidebarOpenPhone));
      const next = {
        ...parsed,
        sidebarOpenDesktop: sidebarDesktop,
        sidebarOpenPhone: sidebarPhone,
        phoneSidebarInit: this.isPhoneMode() ? true : parsed.phoneSidebarInit,
        source: parsed.source ?? ({ type: 'internal' } as const),
        vaultSelectedNodeId: parsed.vaultSelectedNodeId ?? null,
      };
      this.state.set(next);
      stateStore.set(this.instanceId, next);
      if (options?.persistNormalized) {
        this.persistState();
      }
      this.syncRichSnapshot();
      if (next.source?.type === 'vault') void this.refreshVaultTree();
      return true;
    } catch {
      return false;
    }
  }

  private commit(next: NotesState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  private persistState() {
    this.persistQueue.schedule();
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

  private isLocallyEditing() {
    return this.richFocused() || this.markdownFocused();
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
    if (this.isPhoneMode()) {
      this.commit({ ...this.state(), sidebarOpenPhone: !this.state().sidebarOpenPhone });
      return;
    }
    this.commit({ ...this.state(), sidebarOpenDesktop: !this.state().sidebarOpenDesktop });
  }

  sidebarOpen() {
    return this.isPhoneMode() ? this.state().sidebarOpenPhone : this.state().sidebarOpenDesktop;
  }

  settingsOpen() {
    return this.instanceSettings.isOpen(this.instanceId);
  }

  closeSettings() {
    this.instanceSettings.close(this.instanceId);
  }

  isVaultMode() {
    return this.state().source?.type === 'vault';
  }

  currentVaultName() {
    const source = this.state().source;
    if (!source || source.type !== 'vault') return '';
    const prefixLabel = source.pathPrefix ? ` / ${source.pathPrefix}` : '';
    return `${source.vaultName}${prefixLabel}`;
  }

  async refreshVaultTree() {
    const source = this.state().source;
    if (!source || source.type !== 'vault') {
      this.vaultTree.set([]);
      this.vaultFileContent.set('');
      this.vaultSelectedPath.set(null);
      this.vaultCloudBetaEnabled.set(false);
      this.vaultCloudBetaStatusMessage.set(null);
      return;
    }
    await this.vaultDb.ensureVaultAvailable(source.vaultId);
    await this.refreshCurrentVaultCloudStatus();
    const fullTree = await this.vaultDb.getTree(source.vaultId);
    const tree = source.pathPrefix
      ? this.filterVaultTreeByPrefix(fullTree, source.pathPrefix)
      : fullTree;
    this.vaultTree.set(tree);
    await this.refreshVaultUnresolvedLinks();
    const selectedId = this.state().vaultSelectedNodeId;
    if (selectedId) {
      await this.selectVaultNode(selectedId);
    } else {
      const firstFile = this.findFirstVaultFile(tree);
      if (firstFile) {
        await this.selectVaultNode(firstFile.id);
      }
    }
  }

  private filterVaultTreeByPrefix(nodes: VaultFileTreeNode[], prefix: string) {
    const normalized = prefix.replace(/^\/+|\/+$/g, '');
    if (!normalized) return nodes;
    const cloneNode = (node: VaultFileTreeNode): VaultFileTreeNode => ({
      ...node,
      children: node.children ? node.children.map(cloneNode) : undefined,
    });
    const matchedRoots = nodes
      .filter((node) => node.path === normalized || node.path.startsWith(`${normalized}/`))
      .map(cloneNode);
    if (matchedRoots.length) return matchedRoots;
    // Fallback: search descendants and return matching subtree roots.
    const search = (list: VaultFileTreeNode[]): VaultFileTreeNode[] => {
      const out: VaultFileTreeNode[] = [];
      for (const node of list) {
        if (node.path === normalized || node.path.startsWith(`${normalized}/`)) {
          out.push(cloneNode(node));
          continue;
        }
        if (node.children?.length) out.push(...search(node.children));
      }
      return out;
    };
    return search(nodes);
  }

  private findFirstVaultFile(nodes: VaultFileTreeNode[]): VaultFileTreeNode | null {
    for (const node of nodes) {
      if (node.type === 'file' && /\.md$/i.test(node.path)) return node;
      if (node.children?.length) {
        const child = this.findFirstVaultFile(node.children);
        if (child) return child;
      }
    }
    return null;
  }

  async selectVaultNode(nodeId: string) {
    const source = this.state().source;
    if (!source || source.type !== 'vault') return;
    let file = await this.vaultDb.getMarkdownFile(nodeId);
    if (!file) {
      await this.vaultDb.ensureVaultAvailable(source.vaultId);
      file = await this.vaultDb.getMarkdownFile(nodeId);
    }
    if (!file) return;
    this.vaultFileContent.set(file.content);
    this.vaultDraftContent.set(file.content);
    this.vaultDirty.set(false);
    const node = await this.vaultDb.getNode(nodeId);
    const selectedPath = node?.path ?? null;
    if (selectedPath) {
      const html = await this.renderVaultPreviewHtml(source.vaultId, file.content);
      this.vaultPreviewHtml.set(html);
    } else {
      this.vaultPreviewHtml.set(this.renderMarkdown(file.content));
    }
    const nextState = { ...this.state(), vaultSelectedNodeId: nodeId };
    this.state.set(nextState);
    stateStore.set(this.instanceId, nextState);
    this.vaultSelectedPath.set(selectedPath);
    this.persistState();
  }

  exitVaultMode() {
    this.vaultTree.set([]);
    this.vaultFileContent.set('');
    this.vaultDraftContent.set('');
    this.vaultPreviewHtml.set('');
    this.vaultSelectedPath.set(null);
    this.vaultDirty.set(false);
    this.commit({ ...this.state(), source: { type: 'internal' }, vaultSelectedNodeId: null });
  }

  async queueVaultZipImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.pendingVaultImport.set({ file, input });
    this.vaultImportStatus.set('idle');
    this.vaultImportMessage.set(null);
    this.vaultImportProgress.set(null);
    await this.confirmVaultImport();
  }

  async startVaultFolderImport() {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      this.vaultImportStatus.set('error');
      this.vaultImportMessage.set('notes.importVaultFolderUnsupported');
      return;
    }
    try {
      const handle = await (
        window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker();
      await this.runVaultImport({ type: 'folder', handle });
    } catch {
      // User canceled picker or browser blocked it.
    }
  }

  async cloneCurrentVaultToNewInstance() {
    const source = this.state().source;
    if (!source || source.type !== 'vault') return;
    try {
      const sourceVault = await this.vaultDb.getVault(source.vaultId);
      const cloned = await this.vaultDb.cloneVault(source.vaultId, {
        name: `${source.vaultName} ${this.translate.instant('notes.copySuffix')}`,
        mode: 'cow',
      });
      if (
        this.vaultCloudBetaAvailable() &&
        (this.vaultImportCloudBeta() || Boolean(sourceVault?.cloudBeta?.enabled))
      ) {
        await this.vaultDb.setVaultCloudBetaEnabled(cloned.id, true);
      }
      await this.applyImportedVaultToDestination(
        cloned.id,
        cloned.name,
        this.vaultImportSummary(),
        'new',
      );
      this.vaultImportStatus.set('success');
      this.vaultImportMessage.set('notes.cloneVaultSuccess');
    } catch {
      this.vaultImportStatus.set('error');
      this.vaultImportMessage.set('notes.cloneVaultFailed');
    }
  }

  private async confirmVaultImport() {
    const pending = this.pendingVaultImport();
    if (!pending) return;
    await this.runVaultImport({ type: 'zip', file: pending.file }, pending.input);
  }

  private async runVaultImport(
    input: { type: 'zip'; file: File } | { type: 'folder'; handle: FileSystemDirectoryHandle },
    inputElement?: HTMLInputElement,
  ) {
    if (!this.importGuard.start()) {
      this.importLimitOpen.set(true);
      return;
    }
    this.vaultImportStatus.set('loading');
    this.vaultImportMessage.set('notes.importVaultLoading');
    this.vaultImportSummary.set(null);
    try {
      const result = await this.obsidianImport.importObsidianVault(input, {
        onProgress: (progress) => this.vaultImportProgress.set(progress),
      });
      if (this.vaultImportCloudBeta() && this.vaultCloudBetaAvailable()) {
        await this.vaultDb.setVaultCloudBetaEnabled(result.vaultId, true);
      }
      await this.applyImportedVaultToDestination(
        result.vaultId,
        result.vaultName,
        result.stats,
        this.vaultImportDestination(),
      );
      this.vaultImportStatus.set('success');
      this.vaultImportMessage.set('notes.importVaultSuccess');
      this.vaultImportSummary.set(result.stats ?? null);
    } catch {
      this.vaultImportStatus.set('error');
      this.vaultImportMessage.set('notes.importVaultFailed');
    } finally {
      if (inputElement) inputElement.value = '';
      this.pendingVaultImport.set(null);
      this.importGuard.finish();
    }
  }

  private async applyImportedVaultToDestination(
    vaultId: string,
    vaultName: string,
    stats: ObsidianImportStats | null,
    destination: 'current' | 'new' | 'splitTopLevel',
  ) {
    if (destination === 'splitTopLevel') {
      await this.createSplitTopLevelNotesInstances(vaultId, vaultName);
      if (stats) this.vaultImportSummary.set(stats);
      return;
    }
    if (destination === 'new') {
      await this.createNotesInstanceForVault(vaultId, vaultName);
      if (stats) this.vaultImportSummary.set(stats);
      return;
    }
    const next = {
      ...this.state(),
      source: { type: 'vault' as const, vaultId, vaultName, pathPrefix: null },
      vaultSelectedNodeId: null,
    };
    this.commit(next);
    await this.refreshVaultTree();
    if (stats) this.vaultImportSummary.set(stats);
  }

  private async createNotesInstanceForVault(
    vaultId: string,
    vaultName: string,
    pathPrefix?: string | null,
  ) {
    const bounds = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const created = this.dialog.createInstance('notes', bounds);
    if (!created.ok || !created.instance) throw new Error('Unable to create Notes instance');
    const instanceId = created.instance.id;
    this.dialog.setTitleOverride(
      instanceId,
      pathPrefix ? `${vaultName} / ${pathPrefix}` : `${vaultName}`,
    );
    const fresh = this.createDefaultStateForCurrentMode();
    const nextState: NotesState = {
      ...fresh,
      source: { type: 'vault', vaultId, vaultName, pathPrefix: pathPrefix ?? null },
      vaultSelectedNodeId: null,
    };
    stateStore.set(instanceId, nextState);
    const key = buildInstanceStorageKey(STORAGE_PREFIX, this.prefs.userId(), instanceId);
    await this.storage.setItem(key, JSON.stringify(nextState));
  }

  private async createSplitTopLevelNotesInstances(vaultId: string, vaultName: string) {
    const tree = await this.vaultDb.getTree(vaultId);
    const topLevelFolders = tree.filter((node) => node.type === 'folder');
    const topLevelMarkdownFiles = tree.filter(
      (node) => node.type === 'file' && /\.md$/i.test(node.path),
    );
    if (!topLevelFolders.length && !topLevelMarkdownFiles.length) {
      await this.createNotesInstanceForVault(vaultId, vaultName);
      return;
    }
    if (topLevelMarkdownFiles.length) {
      await this.createNotesInstanceForVault(vaultId, `${vaultName} / Root`, null);
    }
    for (const folder of topLevelFolders) {
      await this.createNotesInstanceForVault(vaultId, vaultName, folder.path);
    }
  }

  private createDefaultStateForCurrentMode(): NotesState {
    const root = createFolder('Notes');
    const firstFolder = createFolder('New folder', root.id);
    const firstNote = createNote('New note', firstFolder.id);
    firstFolder.children = [firstNote];
    root.children = [firstFolder];
    return {
      root,
      archiveRoot: createFolder('Archive', undefined, true),
      selectedId: firstNote.id,
      selectedIds: [],
      view: 'notes',
      listCollapsed: false,
      sidebarOpenDesktop: true,
      sidebarOpenPhone: this.isPhoneMode() ? false : false,
      phoneSidebarInit: this.isPhoneMode() ? true : undefined,
      source: { type: 'internal' },
      vaultSelectedNodeId: null,
    };
  }

  private async renderVaultPreviewHtml(vaultId: string, markdown: string) {
    const escaped = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const embeds: string[] = [];
    const links: string[] = [];
    let working = markdown.replace(/!\[\[([^[\]]+)\]\]/g, (_m, raw: string) => {
      embeds.push(raw);
      return `@@OB_EMBED_${embeds.length - 1}@@`;
    });
    working = working.replace(/\[\[([^[\]]+)\]\]/g, (_m, raw: string) => {
      links.push(raw);
      return `@@OB_LINK_${links.length - 1}@@`;
    });
    let html = this.renderMarkdown(working);
    const assets = await this.vaultDb.listAssets(vaultId);
    const assetPathMap = new Map<string, string>();
    const assetBasenameMap = new Map<string, string>();
    for (const asset of assets) {
      assetPathMap.set(asset.path.toLowerCase(), asset.path);
      const basename = asset.path.split('/').pop()?.toLowerCase();
      if (basename && !assetBasenameMap.has(basename)) {
        assetBasenameMap.set(basename, asset.path);
      }
    }
    for (let i = 0; i < embeds.length; i += 1) {
      const [pathRaw] = String(embeds[i]).split('|');
      const targetPath = pathRaw.split('#')[0]?.trim();
      const resolvedAssetPath = targetPath
        ? (assetPathMap.get(targetPath.toLowerCase()) ??
          assetBasenameMap.get(targetPath.split('/').pop()?.toLowerCase() ?? ''))
        : undefined;
      const assetUrl = resolvedAssetPath
        ? await this.vaultDb.getAssetUrl(vaultId, resolvedAssetPath)
        : null;
      const replacement = assetUrl
        ? /\.(png|jpe?g|gif|webp|svg)$/i.test(resolvedAssetPath ?? targetPath ?? '')
          ? `<img src="${escaped(assetUrl)}" alt="${escaped(targetPath ?? '')}" style="max-width:100%; display:block; margin:8px 0;" />`
          : `<a href="${escaped(assetUrl)}" target="_blank" rel="noopener noreferrer">${escaped(resolvedAssetPath ?? targetPath ?? 'attachment')}</a>`
        : `<span style="color:var(--color-muted)">[missing embed: ${escaped(targetPath ?? embeds[i])}]</span>`;
      html = html.replace(`@@OB_EMBED_${i}@@`, replacement);
    }
    for (let i = 0; i < links.length; i += 1) {
      const raw = String(links[i]);
      const [targetWithHeading, alias] = raw.split('|');
      const label = alias?.trim() || targetWithHeading.trim();
      const [targetPathRaw] = targetWithHeading.split('#');
      html = html.replace(
        `@@OB_LINK_${i}@@`,
        `<button type="button" data-ob-link="${escaped(targetPathRaw.trim())}" style="border:none;background:none;padding:0;cursor:pointer;text-decoration:underline;color:var(--color-primary, #1e88e5)">${escaped(label)}</button>`,
      );
    }
    return html;
  }

  async onVaultPreviewClick(event: Event) {
    const source = this.state().source;
    if (!source || source.type !== 'vault') return;
    const target = event.target as HTMLElement | null;
    const linkEl = target?.closest('[data-ob-link]') as HTMLElement | null;
    if (!linkEl) return;
    const raw = linkEl.getAttribute('data-ob-link')?.trim();
    if (!raw) return;
    const direct =
      (await this.vaultDb.getNodeByPath(source.vaultId, raw)) ??
      (await this.vaultDb.getNodeByPath(source.vaultId, `${raw}.md`));
    if (direct) {
      await this.selectVaultNode(direct.id);
      return;
    }
    const basename = raw.split('/').pop()?.toLowerCase();
    if (!basename) return;
    const fallback = this.findVaultNodeByBasename(this.vaultTree(), basename);
    if (fallback) await this.selectVaultNode(fallback.id);
  }

  onVaultDraftInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.vaultDraftContent.set(target.value);
    this.vaultDirty.set(target.value !== this.vaultFileContent());
  }

  async saveVaultFile() {
    const source = this.state().source;
    const nodeId = this.state().vaultSelectedNodeId;
    if (!source || source.type !== 'vault' || !nodeId || !this.vaultDirty() || this.vaultSaving())
      return;
    this.vaultSaving.set(true);
    try {
      await this.vaultDb.saveMarkdownFile(nodeId, this.vaultDraftContent());
      this.vaultFileContent.set(this.vaultDraftContent());
      this.vaultDirty.set(false);
      await this.refreshVaultUnresolvedLinks();
      this.vaultPreviewHtml.set(
        await this.renderVaultPreviewHtml(source.vaultId, this.vaultDraftContent()),
      );
    } finally {
      this.vaultSaving.set(false);
      await this.refreshCurrentVaultCloudStatus();
    }
  }

  async toggleCurrentVaultCloudBeta(enabled: boolean) {
    const source = this.state().source;
    if (!source || source.type !== 'vault') return;
    if (!this.vaultCloudBetaAvailable()) return;
    this.vaultCloudBetaSyncing.set(true);
    this.vaultCloudBetaStatusMessage.set(null);
    try {
      await this.vaultDb.setVaultCloudBetaEnabled(source.vaultId, enabled);
      this.vaultCloudBetaStatusMessage.set(
        enabled ? 'notes.cloudBetaVaultEnabled' : 'notes.cloudBetaVaultDisabled',
      );
    } catch {
      this.vaultCloudBetaStatusMessage.set('notes.cloudBetaVaultFailed');
    } finally {
      this.vaultCloudBetaSyncing.set(false);
      await this.refreshCurrentVaultCloudStatus();
    }
  }

  private async refreshCurrentVaultCloudStatus() {
    const source = this.state().source;
    if (!source || source.type !== 'vault') {
      this.vaultCloudBetaEnabled.set(false);
      this.vaultCloudBetaStatusMessage.set(null);
      return;
    }
    const vault = await this.vaultDb.getVault(source.vaultId);
    const enabled = Boolean(vault?.cloudBeta?.enabled);
    this.vaultCloudBetaEnabled.set(enabled);
    if (!vault) {
      this.vaultCloudBetaStatusMessage.set('notes.cloudBetaVaultUnavailableLocal');
      return;
    }
    if (!enabled) {
      this.vaultCloudBetaStatusMessage.set('notes.vaultStorageLocalDevice');
      return;
    }
    if (vault.cloudBeta?.lastSyncError) {
      this.vaultCloudBetaStatusMessage.set('notes.cloudBetaVaultFailed');
      return;
    }
    this.vaultCloudBetaStatusMessage.set(
      vault.cloudBeta?.lastSyncedAt ? 'notes.cloudBetaVaultEnabled' : 'notes.cloudBetaSyncPending',
    );
  }

  onVaultTreeScroll(event: Event) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    this.vaultTreeScrollTop.set(target.scrollTop || 0);
    this.vaultTreeViewportHeight.set(target.clientHeight || 320);
  }

  unresolvedLinkSourcePath(link: LinkIndexRecord) {
    const row = this.findVaultRowById(this.vaultFlatRows(), link.fromNodeId);
    return row?.node.path ?? link.fromNodeId;
  }

  async openUnresolvedLinkSource(link: LinkIndexRecord) {
    await this.selectVaultNode(link.fromNodeId);
  }

  private async refreshVaultUnresolvedLinks() {
    const source = this.state().source;
    if (!source || source.type !== 'vault') {
      this.vaultUnresolvedLinks.set([]);
      return;
    }
    const all = await this.vaultDb.listUnresolvedLinks(source.vaultId);
    if (!source.pathPrefix) {
      this.vaultUnresolvedLinks.set(all);
      return;
    }
    const rows = this.flattenVaultTree(this.vaultTree());
    this.vaultUnresolvedLinks.set(
      all.filter((link) => {
        const row = this.findVaultRowById(rows, link.fromNodeId);
        return Boolean(
          row &&
          (row.node.path === source.pathPrefix ||
            row.node.path.startsWith(`${source.pathPrefix}/`)),
        );
      }),
    );
  }

  private flattenVaultTree(nodes: VaultFileTreeNode[], depth = 0, out: VaultTreeFlatRow[] = []) {
    for (const node of nodes) {
      out.push({ id: node.id, node, depth });
      if (node.children?.length) this.flattenVaultTree(node.children, depth + 1, out);
    }
    return out;
  }

  private findVaultRowById(rows: VaultTreeFlatRow[], id: string) {
    return rows.find((row) => row.id === id) ?? null;
  }

  private findVaultNodeByBasename(
    nodes: VaultFileTreeNode[],
    basename: string,
  ): VaultFileTreeNode | null {
    for (const node of nodes) {
      if (node.type === 'file') {
        const name = node.name.toLowerCase();
        if (name === basename || name === `${basename}.md`) return node;
      }
      if (node.children?.length) {
        const found = this.findVaultNodeByBasename(node.children, basename);
        if (found) return found;
      }
    }
    return null;
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
    this.remoteConflict.markDirty(this.instanceStorageKey());
    this.syncRichSnapshot();
  }

  finishRichEdit() {
    this.richFocused.set(false);
    if (!this.isLocallyEditing()) {
      this.remoteConflict.clearDirty(this.instanceStorageKey());
    }
    this.commit({ ...this.state() });
    this.syncRichSnapshot();
  }

  startMarkdownEdit() {
    this.markdownFocused.set(true);
    this.remoteConflict.markDirty(this.instanceStorageKey());
  }

  finishMarkdownEdit() {
    this.markdownFocused.set(false);
    if (!this.isLocallyEditing()) {
      this.remoteConflict.clearDirty(this.instanceStorageKey());
    }
    this.commit({ ...this.state() });
  }

  private instanceStorageKey() {
    const userId = this.prefs.userId();
    return buildInstanceStorageKey(STORAGE_PREFIX, userId, this.instanceId || '');
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

  private async handlePersistError(error: unknown) {
    const key = this.instanceStorageKey();
    if (isRemoteStorageVersionConflict(error)) {
      this.remoteConflict.queue([key], 'dirty');
      try {
        await this.storage.getItem(key);
      } catch {
        // Ignore cache refresh failures; polling/realtime will retry.
      }
      if (!this.isLocallyEditing()) {
        this.reloadFromStorage({ persistNormalized: false });
      }
      return 'handled' as const;
    }
    return undefined;
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
