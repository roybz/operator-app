import { Component, Input, TemplateRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export interface TableColumn<T = unknown> {
  header: string;
  cell: (row: T) => string;
}

@Component({
  selector: 'app-shared-table',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <input
        type="text"
        [placeholder]="searchPlaceholder"
        [value]="query()"
        (input)="onSearch($event)"
        style="padding:8px; flex:1; max-width: 320px;"
      />

      <label style="display:flex; gap:6px; align-items:center;">
        {{ 'table.pageSize' | translate }}
        <select [value]="pageSize()" (change)="setPageSize($event)">
          @for (size of pageSizeOptions; track size) {
            <option [value]="size">{{ size }}</option>
          }
        </select>
      </label>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-top:12px;">
      <thead>
        <tr>
          @for (column of columns; track column.header) {
            <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">
              {{ column.header | translate }}
            </th>
          }
          @if (actionsTemplate) {
            <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">
              {{ 'table.actions' | translate }}
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of pagedRows(); track rowTrack(row, $index)) {
          <tr>
            @for (column of columns; track column.header) {
              <td style="padding:8px; border-bottom:1px solid #eee;">
                {{ column.cell(row) }}
              </td>
            }
            @if (actionsTemplate) {
              <td style="padding:8px; border-bottom:1px solid #eee;">
                <ng-container
                  *ngTemplateOutlet="actionsTemplate; context: { $implicit: row }"
                ></ng-container>
              </td>
            }
          </tr>
        }
        @if (!pagedRows().length) {
          <tr>
            <td
              [attr.colspan]="columns.length + (actionsTemplate ? 1 : 0)"
              style="padding:12px; color:#666;"
            >
              {{ emptyMessage | translate }}
            </td>
          </tr>
        }
      </tbody>
    </table>

    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
      <button (click)="prevPage()" [disabled]="page() === 1">{{ 'table.prev' | translate }}</button>
      <span>
        {{ 'table.page' | translate: { current: page(), total: pageCount() } }}
      </span>
      <button (click)="nextPage()" [disabled]="page() === pageCount()">
        {{ 'table.next' | translate }}
      </button>
    </div>
  `,
})
export class SharedTableComponent<T = unknown> {
  @Input() columns: TableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() actionsTemplate?: TemplateRef<{ $implicit: T }>;
  @Input() searchPlaceholder = '';
  @Input() emptyMessage = '';
  @Input() pageSizeOptions = [5, 10, 20];
  @Input() rowTrack: (row: T, index: number) => string | number = (_, index) => index;

  query = signal('');
  page = signal(1);
  pageSize = signal(this.pageSizeOptions[0]);

  filteredRows = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) return this.rows;
    return this.rows.filter((row) =>
      this.columns.some((column) => column.cell(row).toLowerCase().includes(query)),
    );
  });

  pageCount = computed(() => Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize())));

  pagedRows = computed(() => {
    const safePage = Math.min(this.page(), this.pageCount());
    const start = (safePage - 1) * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  setPageSize(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.pageSize.set(value);
    this.page.set(1);
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.page.set(1);
  }

  prevPage() {
    this.page.set(Math.max(1, this.page() - 1));
  }

  nextPage() {
    this.page.set(Math.min(this.pageCount(), this.page() + 1));
  }
}
