import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { AppPreferencesService } from '../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../core/instance-settings.service';

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

export const clearDataTableState = (instanceId: string) => {
  stateStore.delete(instanceId);
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => window.localStorage.removeItem(key));
};

export const cloneDataTableState = (fromId: string, toId: string) => {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, JSON.parse(JSON.stringify(stored)) as DataTableState);
};

const columnTypes: ColumnType[] = ['text', 'number', 'date', 'emoji', 'image', 'url', 'boolean'];

const defaultTable = (translate: TranslateService): DataTable => ({
  id: uid('table'),
  name: translate.instant('dataTable.defaultTable'),
  columns: [{ id: uid('col'), name: translate.instant('dataTable.defaultColumn'), type: 'text' }],
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
  template: `
    <div style="display:flex; flex-direction:column; gap:12px; height:100%;">
      @if (settingsOpen()) {
        <div style="display:flex; flex-direction:column; gap:12px;">
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
          @if (pendingDeleteId()) {
            <app-confirm-dialog
              [message]="'dataTable.deleteConfirm' | translate"
              [confirmLabel]="'dialogs.confirm' | translate"
              [cancelLabel]="'dialogs.cancel' | translate"
              (confirm)="confirmDeleteTable()"
              (cancel)="pendingDeleteId.set(null)"
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

        <div style="overflow:auto; flex:1; margin-top:8px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr>
                @for (column of activeTable().columns; track column.id) {
                  <th
                    style="text-align:left; border-bottom:1px solid var(--color-border); padding:6px; cursor:pointer;"
                    (click)="toggleSort(column.id)"
                  >
                    <div style="display:flex; align-items:center; gap:6px;">
                      <input
                        [value]="column.name"
                        (input)="renameColumn(column.id, $event)"
                        (click)="$event.stopPropagation()"
                        style="width:110px;"
                      />
                      <select
                        [value]="column.type"
                        (change)="updateColumnType(column.id, $event)"
                        (click)="$event.stopPropagation()"
                      >
                        @for (type of columnTypes; track type) {
                          <option [value]="type">{{ 'dataTable.type.' + type | translate }}</option>
                        }
                      </select>
                      <button
                        (click)="removeColumn(column.id)"
                        [disabled]="activeTable().columns.length <= 1"
                      >
                        ✕
                      </button>
                      @if (state().sortColumnId === column.id) {
                        <span>{{ state().sortDirection === 'asc' ? '▲' : '▼' }}</span>
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
                    <td style="border-bottom:1px solid var(--color-border); padding:6px;">
                      @if (column.type === 'boolean') {
                        <input
                          type="checkbox"
                          [checked]="cellValue(row, column.id) === 'true'"
                          (change)="updateCell(row.id, column.id, $event)"
                        />
                      } @else if (column.type === 'image') {
                        <input
                          type="text"
                          [value]="cellValue(row, column.id)"
                          (input)="updateCell(row.id, column.id, $event)"
                          style="width:160px;"
                        />
                        @if (cellValue(row, column.id)) {
                          <img
                            [src]="cellValue(row, column.id)"
                            alt=""
                            style="display:block; max-width:120px; max-height:60px; margin-top:4px;"
                          />
                        }
                      } @else {
                        <input
                          [type]="inputType(column.type)"
                          [value]="cellValue(row, column.id)"
                          (input)="updateCell(row.id, column.id, $event)"
                          [attr.maxlength]="column.type === 'emoji' ? 2 : null"
                          style="width:160px;"
                        />
                      }
                    </td>
                  }
                  <td style="border-bottom:1px solid var(--color-border); padding:6px;">
                    <button (click)="removeRow(row.id)">
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
  `,
})
export class DataTableComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  private translate = inject(TranslateService);
  private instanceSettings = inject(InstanceSettingsService);

  state = signal<DataTableState>(defaultState(this.translate));
  settingsOpen = computed(() => this.instanceSettings.isOpen(this.instanceId));
  columnTypes = columnTypes;
  pendingDeleteId = signal<string | null>(null);

  ngOnInit() {
    const userId = this.prefs.userId();
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(storageKey(userId, this.instanceId));
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

  updateColumnType(columnId: string, event: Event) {
    const value = (event.target as HTMLSelectElement).value as ColumnType;
    const table = this.activeTable();
    const columns = table.columns.map((col) =>
      col.id === columnId ? { ...col, type: value } : col,
    );
    this.updateTable({ ...table, columns });
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

  private persistState() {
    if (typeof window === 'undefined') return;
    const userId = this.prefs.userId();
    window.localStorage.setItem(storageKey(userId, this.instanceId), JSON.stringify(this.state()));
  }
}
