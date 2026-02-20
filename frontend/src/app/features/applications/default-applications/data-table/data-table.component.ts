import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { ImportGuardService } from '../../../../core/import-guard.service';
import { ExportGuardService } from '../../../../core/export-guard.service';
import { StorageService } from '../../../../core/storage/storage.service';

export type ColumnType = 'text' | 'number' | 'date' | 'emoji' | 'image' | 'url' | 'boolean';

interface DataColumn {
  id: string;
  name: string;
  type: ColumnType;
}

interface DataRow {
  id: string;
  values: Record<string, string>;
}

interface DataTable {
  id: string;
  name: string;
  columns: DataColumn[];
  rows: DataRow[];
}

interface DataTableState {
  tables: DataTable[];
  activeTableId: string;
  search: string;
  sortColumnId: string | null;
  sortDirection: 'asc' | 'desc';
}

const STORAGE_PREFIX = 'op_app_state:data_table';
const stateStore = new Map<string, DataTableState>();

const storageKey = (userId: string, instanceId: string) =>
  `${STORAGE_PREFIX}:${userId}:${instanceId}`;

export const clearDataTableState = (instanceId: string, storage: StorageService) => {
  stateStore.delete(instanceId);
  storage
    .keysSync()
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => void storage.removeItem(key));
};

export const cloneDataTableState = (fromId: string, toId: string, storage: StorageService) => {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, JSON.parse(JSON.stringify(stored)) as DataTableState);
  storage
    .keysSync()
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${fromId}`))
    .forEach((key) => {
      const value = storage.getItemSync(key);
      if (value === null) return;
      const nextKey = key.replace(`:${fromId}`, `:${toId}`);
      void storage.setItem(nextKey, value);
    });
};

const columnTypes: ColumnType[] = ['text', 'number', 'date', 'emoji', 'image', 'url', 'boolean'];

const defaultTable = (translate: TranslateService): DataTable => ({
  id: uid('table'),
  name: translate.instant('dataTable.defaultTable'),
  columns: [
    { id: uid('col'), name: translate.instant('dataTable.defaultColumn'), type: 'text' },
    { id: uid('col'), name: translate.instant('dataTable.defaultColumn'), type: 'text' },
    { id: uid('col'), name: translate.instant('dataTable.defaultColumn'), type: 'text' },
  ],
  rows: [],
});

const defaultState = (translate: TranslateService): DataTableState => {
  const table = defaultTable(translate);
  return {
    tables: [table],
    activeTableId: table.id,
    search: '',
    sortColumnId: null,
    sortDirection: 'asc',
  };
};

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmDialogComponent],
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .data-table-shell {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
      }

      :host-context(.phone-mode) .data-table-shell {
        gap: 10px;
        padding: 12px;
      }

      :host-context(.phone-mode) table {
        display: table;
        overflow-x: visible;
      }

      :host-context(.phone-mode) button {
        min-height: 40px;
      }

      .data-table-scroll {
        position: relative;
        overflow-x: auto;
        overflow-y: auto;
        min-width: 0;
        max-width: 100%;
      }

      .data-table-scroll--left {
        box-shadow: inset 10px 0 12px -10px color-mix(in srgb, var(--color-accent) 42%, transparent);
      }

      .data-table-scroll--right {
        box-shadow: inset -10px 0 12px -10px
          color-mix(in srgb, var(--color-accent) 42%, transparent);
      }

      .data-table-scroll--left.data-table-scroll--right {
        box-shadow:
          inset 10px 0 12px -10px color-mix(in srgb, var(--color-accent) 42%, transparent),
          inset -10px 0 12px -10px color-mix(in srgb, var(--color-accent) 42%, transparent);
      }

      .data-table-cell {
        width: 100%;
        box-sizing: border-box;
      }

      .data-table-delete {
        opacity: 0.45;
        transition: opacity 120ms ease;
      }

      .data-table-delete:hover {
        opacity: 1;
      }

      .data-table-editable {
        border: 1px solid transparent;
        background: transparent;
        text-align: left;
        width: 100%;
        padding: 4px 6px;
        border-radius: 4px;
      }

      .data-table-editable:hover {
        border-color: var(--color-border);
      }

      .data-table-header-select {
        width: auto;
        min-width: 13ch;
        max-width: 13ch;
      }

      .data-table-col-sep {
        border-right: 1px solid color-mix(in srgb, var(--color-border) 90%, transparent);
      }
    `,
  ],
  template: `
    <div class="data-table-shell">
      @if (settingsOpen()) {
        <div
          style="display:flex; flex-direction:column; gap:12px; background:color-mix(in srgb, var(--color-surface) 85%, var(--color-border)); border-radius:8px; padding:10px;"
        >
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0;">{{ 'dataTable.settingsTitle' | translate }}</h3>
            <button (click)="closeSettings()">{{ 'dataTable.closeSettings' | translate }}</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            @for (table of state().tables; track table.id) {
              <div style="display:flex; gap:8px; align-items:center;">
                <input
                  [value]="table.name"
                  (input)="renameTable(table.id, $event)"
                  style="flex:1;"
                />
                <button
                  (click)="requestDeleteTable(table.id)"
                  [disabled]="state().tables.length <= 1"
                >
                  {{ 'dataTable.deleteTable' | translate }}
                </button>
              </div>
            }
            <button (click)="addTable()">{{ 'dataTable.addTable' | translate }}</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button (click)="exportInstance()">
                {{ 'dataTable.exportInstance' | translate }}
              </button>
              <label style="display:inline-flex; align-items:center; gap:8px;">
                <span>{{ 'dataTable.importInstance' | translate }}</span>
                <input type="file" accept=".json" (change)="queueImport($event)" />
              </label>
              <button (click)="confirmWipeInstance()">
                {{ 'dataTable.wipeInstance' | translate }}
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
          @if (pendingDeleteId()) {
            <app-confirm-dialog
              [message]="'dataTable.deleteConfirm' | translate"
              [confirmLabel]="'dialogs.confirm' | translate"
              [cancelLabel]="'dialogs.cancel' | translate"
              (confirmed)="confirmDeleteTable()"
              (canceled)="pendingDeleteId.set(null)"
            />
          }
        </div>
      } @else {
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <label>
            {{ 'dataTable.tableLabel' | translate }}
            <select [value]="state().activeTableId" (change)="selectTable($event)">
              @for (table of state().tables; track table.id) {
                <option [value]="table.id" [selected]="table.id === state().activeTableId">
                  {{ table.name }}
                </option>
              }
            </select>
          </label>
          <label>
            {{ 'dataTable.search' | translate }}
            <input type="text" [value]="state().search" (input)="updateSearch($event)" />
          </label>
          <button (click)="addRow()">{{ 'dataTable.addRow' | translate }}</button>
          <button (click)="addColumn()">{{ 'dataTable.addColumn' | translate }}</button>
        </div>

        <div
          #scrollEl
          class="data-table-scroll"
          [class.data-table-scroll--left]="scrollShadows().left"
          [class.data-table-scroll--right]="scrollShadows().right"
          style="overflow:auto; flex:1; margin-top:8px;"
          (scroll)="updateScrollShadows($event)"
        >
          <table
            style="width:100%; border-collapse:collapse; min-width:max-content; border-left:1px solid var(--color-border); border-right:1px solid var(--color-border); border-top:1px solid var(--color-border);"
          >
            <thead>
              <tr>
                @for (column of activeTable().columns; track column.id) {
                  <th
                    class="data-table-col-sep"
                    style="text-align:left; border-bottom:1px solid var(--color-border); padding:6px; cursor:pointer;"
                    (click)="toggleSort(column.id)"
                  >
                    <div style="display:flex; align-items:center; gap:6px;">
                      @if (editingColumnNameId() === column.id) {
                        <input
                          [value]="editingColumnNameDraft()"
                          (input)="editingColumnNameDraft.set($any($event.target).value)"
                          (blur)="finishColumnNameEdit(column.id)"
                          (keydown.enter)="finishColumnNameEdit(column.id)"
                          (keydown.escape)="cancelColumnNameEdit()"
                          (click)="$event.stopPropagation()"
                          style="width:110px;"
                        />
                      } @else {
                        <button
                          class="data-table-editable"
                          (click)="startColumnNameEdit(column.id); $event.stopPropagation()"
                          title="{{ column.name }}"
                        >
                          {{ column.name }}
                        </button>
                      }
                      <select
                        class="data-table-header-select"
                        [value]="column.type"
                        (change)="updateColumnType(column.id, $event)"
                        (click)="$event.stopPropagation()"
                      >
                        @for (type of columnTypes; track type) {
                          <option [value]="type">{{ 'dataTable.type.' + type | translate }}</option>
                        }
                      </select>
                      <button
                        class="data-table-delete"
                        (click)="requestDeleteColumn(column.id)"
                        [disabled]="activeTable().columns.length <= 1"
                      >
                        &#10005;
                      </button>
                      @if (state().sortColumnId === column.id) {
                        <span
                          [innerHTML]="state().sortDirection === 'asc' ? '&#9650;' : '&#9660;'"
                        ></span>
                      }
                    </div>
                  </th>
                }
                <th style="border-bottom:1px solid var(--color-border); padding:6px;"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of filteredRows(); track row.id) {
                <tr>
                  @for (column of activeTable().columns; track column.id) {
                    <td
                      class="data-table-col-sep"
                      style="border-bottom:1px solid var(--color-border); padding:6px;"
                    >
                      @if (column.type === 'boolean') {
                        <input
                          type="checkbox"
                          [checked]="cellValue(row, column.id) === 'true'"
                          (change)="updateCell(row.id, column.id, $event)"
                        />
                      } @else {
                        @if (isEditingCell(row.id, column.id)) {
                          <input
                            class="data-table-cell"
                            [type]="inputType(column.type)"
                            [value]="editingCellDraft()"
                            (input)="editingCellDraft.set($any($event.target).value)"
                            (blur)="finishCellEdit(row.id, column.id)"
                            (keydown.enter)="finishCellEdit(row.id, column.id)"
                            (keydown.escape)="cancelCellEdit()"
                            [attr.maxlength]="column.type === 'emoji' ? 2 : null"
                          />
                        } @else {
                          <button
                            class="data-table-editable"
                            (click)="startCellEdit(row.id, column.id)"
                            [title]="cellValue(row, column.id) || ''"
                          >
                            {{ cellValue(row, column.id) || ' ' }}
                          </button>
                        }
                        @if (column.type === 'image' && cellValue(row, column.id)) {
                          <img
                            [src]="cellValue(row, column.id)"
                            alt=""
                            style="display:block; max-width:120px; max-height:60px; margin-top:4px;"
                          />
                        }
                      }
                    </td>
                  }
                  <td style="border-bottom:1px solid var(--color-border); padding:6px;">
                    <button class="data-table-delete" (click)="requestDeleteRow(row.id)">
                      {{ 'dataTable.deleteRow' | translate }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (confirmWipeOpen()) {
      <app-confirm-dialog
        [message]="'dataTable.confirmWipeInstance' | translate"
        [confirmLabel]="'dataTable.wipeInstance' | translate"
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
    @if (pendingDeleteRowId()) {
      <app-confirm-dialog
        [message]="'dataTable.deleteRowConfirm' | translate"
        [confirmLabel]="'dialogs.confirm' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmDeleteRow()"
        (canceled)="pendingDeleteRowId.set(null)"
      />
    }
    @if (pendingDeleteColumnId()) {
      <app-confirm-dialog
        [message]="'dataTable.deleteColumnConfirm' | translate"
        [confirmLabel]="'dialogs.confirm' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmDeleteColumn()"
        (canceled)="pendingDeleteColumnId.set(null)"
      />
    }
  `,
})
export class DataTableComponent implements OnInit, AfterViewInit {
  @ViewChild('scrollEl') scrollEl?: ElementRef<HTMLDivElement>;
  private host = inject(ElementRef);
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  private translate = inject(TranslateService);
  private instanceSettings = inject(InstanceSettingsService);
  private importGuard = inject(ImportGuardService);
  private exportGuard = inject(ExportGuardService);
  private storage = inject(StorageService);

  state = signal<DataTableState>(defaultState(this.translate));
  settingsOpen = computed(() => this.instanceSettings.isOpen(this.instanceId));
  columnTypes = columnTypes;
  pendingDeleteId = signal<string | null>(null);
  pendingDeleteRowId = signal<string | null>(null);
  pendingDeleteColumnId = signal<string | null>(null);
  confirmWipeOpen = signal(false);
  pendingImport = signal<{ file: File; input: HTMLInputElement } | null>(null);
  importStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  importMessage = signal<string | null>(null);
  importLimitOpen = signal(false);
  exportLimitOpen = signal(false);
  scrollShadows = signal({ left: false, right: false });
  editingColumnNameId = signal<string | null>(null);
  editingColumnNameDraft = signal('');
  editingCell = signal<{ rowId: string; columnId: string } | null>(null);
  editingCellDraft = signal('');

  ngOnInit() {
    const userId = this.prefs.userId();
    const raw = this.storage.getItemSync(storageKey(userId, this.instanceId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DataTableState;
        this.state.set(parsed);
        stateStore.set(this.instanceId, parsed);
        return;
      } catch {
        // ignore malformed stored data
      }
    }
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.state.set(stored);
    } else {
      const next = defaultState(this.translate);
      this.state.set(next);
      stateStore.set(this.instanceId, next);
    }
    this.persistState();
  }

  ngAfterViewInit() {
    if (this.scrollEl?.nativeElement) {
      const el = this.scrollEl.nativeElement;
      this.updateScrollShadows(el);
      requestAnimationFrame(() => this.updateScrollShadows(el));
      setTimeout(() => this.updateScrollShadows(el), 0);
    }
  }

  closeSettings() {
    this.instanceSettings.close(this.instanceId);
  }

  activeTable() {
    return (
      this.state().tables.find((table) => table.id === this.state().activeTableId) ??
      this.state().tables[0]
    );
  }

  selectTable(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    this.commit({ ...this.state(), activeTableId: id });
  }

  updateSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.commit({ ...this.state(), search: value });
  }

  addTable() {
    const table = defaultTable(this.translate);
    const next = {
      ...this.state(),
      tables: [...this.state().tables, table],
      activeTableId: table.id,
    };
    this.commit(next);
  }

  requestDeleteTable(tableId: string) {
    this.pendingDeleteId.set(tableId);
  }

  confirmDeleteTable() {
    const tableId = this.pendingDeleteId();
    if (!tableId) return;
    if (this.state().tables.length <= 1) {
      this.pendingDeleteId.set(null);
      return;
    }
    const tables = this.state().tables.filter((table) => table.id !== tableId);
    const nextActive = tables[0]?.id ?? '';
    this.commit({ ...this.state(), tables, activeTableId: nextActive });
    this.pendingDeleteId.set(null);
  }

  renameTable(tableId: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const tables = this.state().tables.map((table) =>
      table.id === tableId ? { ...table, name: value } : table,
    );
    this.commit({ ...this.state(), tables });
  }

  addColumn() {
    const table = this.activeTable();
    const column: DataColumn = {
      id: uid('col'),
      name: this.translate.instant('dataTable.defaultColumn'),
      type: 'text',
    };
    const nextTable = { ...table, columns: [...table.columns, column] };
    this.updateTable(nextTable);
  }

  renameColumn(columnId: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const table = this.activeTable();
    const columns = table.columns.map((col) =>
      col.id === columnId ? { ...col, name: value } : col,
    );
    this.updateTable({ ...table, columns });
  }

  startColumnNameEdit(columnId: string) {
    const column = this.activeTable().columns.find((item) => item.id === columnId);
    if (!column) return;
    this.editingColumnNameId.set(columnId);
    this.editingColumnNameDraft.set(column.name);
  }

  finishColumnNameEdit(columnId: string) {
    if (this.editingColumnNameId() !== columnId) return;
    const value = this.editingColumnNameDraft().trim();
    this.editingColumnNameId.set(null);
    this.editingColumnNameDraft.set('');
    if (!value) return;
    const table = this.activeTable();
    const columns = table.columns.map((col) =>
      col.id === columnId ? { ...col, name: value } : col,
    );
    this.updateTable({ ...table, columns });
  }

  cancelColumnNameEdit() {
    this.editingColumnNameId.set(null);
    this.editingColumnNameDraft.set('');
  }

  updateColumnType(columnId: string, event: Event) {
    const value = (event.target as HTMLSelectElement).value as ColumnType;
    const table = this.activeTable();
    const columns = table.columns.map((col) =>
      col.id === columnId ? { ...col, type: value } : col,
    );
    this.updateTable({ ...table, columns });
  }

  requestDeleteColumn(columnId: string) {
    if (this.activeTable().columns.length <= 1) return;
    this.pendingDeleteColumnId.set(columnId);
  }

  confirmDeleteColumn() {
    const columnId = this.pendingDeleteColumnId();
    if (!columnId) return;
    this.pendingDeleteColumnId.set(null);
    this.removeColumn(columnId);
  }

  removeColumn(columnId: string) {
    const table = this.activeTable();
    const columns = table.columns.filter((col) => col.id !== columnId);
    const rows = table.rows.map((row) => {
      const nextValues = { ...row.values };
      delete nextValues[columnId];
      return { ...row, values: nextValues };
    });
    this.updateTable({ ...table, columns, rows });
  }

  addRow() {
    const table = this.activeTable();
    const row: DataRow = { id: uid('row'), values: {} };
    this.updateTable({ ...table, rows: [...table.rows, row] });
  }

  removeRow(rowId: string) {
    const table = this.activeTable();
    const rows = table.rows.filter((row) => row.id !== rowId);
    this.updateTable({ ...table, rows });
  }

  requestDeleteRow(rowId: string) {
    this.pendingDeleteRowId.set(rowId);
  }

  confirmDeleteRow() {
    const rowId = this.pendingDeleteRowId();
    if (!rowId) return;
    this.pendingDeleteRowId.set(null);
    this.removeRow(rowId);
  }

  updateCell(rowId: string, columnId: string, event: Event) {
    const table = this.activeTable();
    const rows = table.rows.map((row) => {
      if (row.id !== rowId) return row;
      const value =
        event.target instanceof HTMLInputElement && event.target.type === 'checkbox'
          ? String(event.target.checked)
          : (event.target as HTMLInputElement).value;
      return { ...row, values: { ...row.values, [columnId]: value } };
    });
    this.updateTable({ ...table, rows });
  }

  isEditingCell(rowId: string, columnId: string) {
    const current = this.editingCell();
    return current?.rowId === rowId && current?.columnId === columnId;
  }

  startCellEdit(rowId: string, columnId: string) {
    this.editingCell.set({ rowId, columnId });
    const table = this.activeTable();
    const row = table.rows.find((item) => item.id === rowId);
    this.editingCellDraft.set(row?.values[columnId] ?? '');
  }

  finishCellEdit(rowId: string, columnId: string) {
    if (!this.isEditingCell(rowId, columnId)) return;
    const table = this.activeTable();
    const value = this.editingCellDraft();
    const rows = table.rows.map((row) =>
      row.id === rowId ? { ...row, values: { ...row.values, [columnId]: value } } : row,
    );
    this.updateTable({ ...table, rows });
    this.editingCell.set(null);
    this.editingCellDraft.set('');
  }

  cancelCellEdit() {
    this.editingCell.set(null);
    this.editingCellDraft.set('');
  }

  toggleSort(columnId: string) {
    if (this.state().sortColumnId === columnId) {
      const nextDirection = this.state().sortDirection === 'asc' ? 'desc' : 'asc';
      this.commit({ ...this.state(), sortDirection: nextDirection });
      return;
    }
    this.commit({ ...this.state(), sortColumnId: columnId, sortDirection: 'asc' });
  }

  filteredRows = computed(() => {
    const table = this.activeTable();
    if (!table) return [];
    const search = this.state().search.trim().toLowerCase();
    let rows = [...table.rows];
    if (search) {
      rows = rows.filter((row) =>
        Object.values(row.values).join(' ').toLowerCase().includes(search),
      );
    }
    const columnId = this.state().sortColumnId;
    if (columnId) {
      const column = table.columns.find((col) => col.id === columnId);
      if (column) {
        const dir = this.state().sortDirection === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
          const aVal = this.normalizeSortValue(a.values[columnId], column.type);
          const bVal = this.normalizeSortValue(b.values[columnId], column.type);
          if (aVal < bVal) return -1 * dir;
          if (aVal > bVal) return 1 * dir;
          return 0;
        });
      }
    }
    return rows;
  });

  updateScrollShadows(eventOrTarget: Event | HTMLDivElement) {
    const target =
      this.scrollEl?.nativeElement ??
      (eventOrTarget instanceof Event
        ? (eventOrTarget.target as HTMLDivElement | null)
        : eventOrTarget);
    if (!target) return;
    const { showLeft, showRight } = this.computeScrollShadowState(target);
    this.scrollShadows.set({ left: showLeft, right: showRight });
    const dialogBody = this.host.nativeElement
      .closest('.dialog')
      ?.querySelector('.dialog__body--phone, .dialog__body') as HTMLElement | null;
    if (!dialogBody) return;
    dialogBody.style.setProperty('--phone-scroll-shadow-left', 'none');
    dialogBody.style.setProperty('--phone-scroll-shadow-right', 'none');
  }

  private computeScrollShadowState(target: HTMLDivElement) {
    const maxLeft = Math.max(0, target.scrollWidth - target.clientWidth);
    const scrollLeft = Math.max(0, Math.min(maxLeft, target.scrollLeft));
    const canScroll = maxLeft > 0.5;
    const atLeft = scrollLeft <= 0.5;
    const atRight = maxLeft - scrollLeft <= 0.5;
    return {
      showLeft: canScroll && !atLeft,
      showRight: canScroll && !atRight,
    };
  }

  cellValue(row: DataRow, columnId: string) {
    return row.values[columnId] ?? '';
  }

  inputType(type: ColumnType) {
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    return 'text';
  }

  private normalizeSortValue(value: string | undefined, type: ColumnType) {
    if (type === 'number') return Number(value || 0);
    if (type === 'date') return value ? Date.parse(value) : 0;
    return (value || '').toString().toLowerCase();
  }

  private updateTable(table: DataTable) {
    const tables = this.state().tables.map((item) => (item.id === table.id ? table : item));
    this.commit({ ...this.state(), tables });
  }

  private commit(next: DataTableState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
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
    link.download = `data-table-${this.instanceId}.json`;
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
        const parsed = JSON.parse(String(reader.result || '{}')) as DataTableState;
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
    const next = defaultState(this.translate);
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
    this.confirmWipeOpen.set(false);
  }

  private mergeImported(imported: DataTableState) {
    if (!imported || !Array.isArray(imported.tables)) return;
    const tables = imported.tables.map((table) => this.cloneTable(table));
    const nextTables = [...this.state().tables, ...tables];
    const next = { ...this.state(), tables: nextTables };
    this.state.set(next);
    this.persistState();
  }

  private cloneTable(table: DataTable): DataTable {
    const columnMap = new Map<string, string>();
    const columns = (table.columns ?? []).map((col) => {
      const nextId = uid('col');
      columnMap.set(col.id, nextId);
      return { ...col, id: nextId };
    });
    const rows = (table.rows ?? []).map((row) => {
      const values: Record<string, string> = {};
      Object.entries(row.values ?? {}).forEach(([key, value]) => {
        const nextKey = columnMap.get(key);
        if (nextKey) values[nextKey] = String(value);
      });
      return { id: uid('row'), values };
    });
    return {
      id: uid('table'),
      name: table.name || this.translate.instant('dataTable.defaultTable'),
      columns,
      rows,
    };
  }

  private persistState() {
    const userId = this.prefs.userId();
    void this.storage.setItem(storageKey(userId, this.instanceId), JSON.stringify(this.state()));
  }
}
