import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, UniverseInfo, UserPreferences } from '../../../core/auth.service';
import { ImportGuardService } from '../../../core/import-guard.service';
import { ExportGuardService } from '../../../core/export-guard.service';
import { SettingsDraftService } from '../settings-draft.service';
import { SharedTableComponent, TableColumn } from '../../../shared/table/table.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { InfoTooltipComponent } from '../../../shared/info-tooltip/info-tooltip.component';

@Component({
  selector: 'app-universe-settings',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    SharedTableComponent,
    ConfirmDialogComponent,
    InfoTooltipComponent,
  ],
  template: `
    <section>
      <h3>{{ 'universe.title' | translate }}</h3>

      <section style="margin: 16px 0;">
        <h4>{{ 'universe.universesTitle' | translate }}</h4>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <input
            type="text"
            [value]="newUniverseName()"
            (input)="newUniverseName.set($any($event.target).value)"
            [placeholder]="'universe.newUniversePlaceholder' | translate"
          />
          <button (click)="createUniverse()">{{ 'universe.createUniverse' | translate }}</button>
          <app-info-tooltip [text]="'universe.maxInfo' | translate" />
        </div>
        @if (universeError()) {
          <p style="color:#b00020; margin:8px 0 0;">{{ universeError() }}</p>
        }
        <div style="margin-top:8px;">
          <app-shared-table
            [columns]="universeColumns"
            [rows]="universes()"
            [actionsTemplate]="actionsTpl"
          />
          <ng-template #actionsTpl let-row>
            <button
              (click)="requestDelete(row)"
              [disabled]="universes().length <= 1"
              [style.opacity]="universes().length <= 1 ? 0.5 : 1"
              [style.cursor]="universes().length <= 1 ? 'not-allowed' : 'pointer'"
            >
              {{ 'universe.delete' | translate }}
            </button>
          </ng-template>
        </div>

        <div style="margin-top: 12px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button (click)="exportAll('json')">{{ 'universe.exportAllJson' | translate }}</button>
            <button (click)="exportAll('xml')">{{ 'universe.exportAllXml' | translate }}</button>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <label style="display:flex; gap:8px; align-items:center;">
              {{ 'universe.importAllJson' | translate }}
              <input type="file" accept="application/json" (change)="onImport($event, 'json')" />
            </label>
            <label style="display:flex; gap:8px; align-items:center;">
              {{ 'universe.importAllXml' | translate }}
              <input
                type="file"
                accept="application/xml,text/xml"
                (change)="onImport($event, 'xml')"
              />
            </label>
          </div>
          <button (click)="confirmWipeAll.set(true)">
            {{ 'universe.wipeAll' | translate }}
          </button>
          @if (importStatus() === 'loading') {
            <p style="margin:0; opacity:0.7;">{{ 'dialogs.importing' | translate }}</p>
          } @else if (importStatus() === 'success') {
            <p style="margin:0; color:#1b5e20;">{{ 'dialogs.importSuccess' | translate }}</p>
          } @else if (importStatus() === 'error') {
            <p style="margin:0; color:#b00020;">{{ importMessage() ?? '' | translate }}</p>
          }
        </div>
      </section>

      <div style="display:grid; gap:12px; max-width: 560px;">
        <label>
          {{ 'universe.name' | translate }}
          <input type="text" [value]="prefs().universeName" (input)="onNameInput($event)" />
        </label>
      </div>

      @if (confirmWipeAll()) {
        <app-confirm-dialog
          [message]="'universe.wipeAllConfirm' | translate"
          [confirmLabel]="'dialogs.confirm' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="wipeAllUniverses()"
          (canceled)="confirmWipeAll.set(false)"
        />
      }
      @if (deleteTarget()) {
        <app-confirm-dialog
          [message]="'universe.deleteConfirm' | translate: { name: deleteTarget()?.name ?? '' }"
          [confirmLabel]="'dialogs.confirm' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="deleteUniverse()"
          (canceled)="deleteTarget.set(null)"
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
    </section>
  `,
})
export class UniverseSettingsComponent {
  private auth = inject(AuthService);
  private draft = inject(SettingsDraftService);
  private translate = inject(TranslateService);
  private importGuard = inject(ImportGuardService);
  private exportGuard = inject(ExportGuardService);

  prefs = signal<UserPreferences>(this.draft.preferences());
  confirmWipeAll = signal(false);
  newUniverseName = signal('');
  universeError = signal<string | null>(null);
  pendingImport = signal<{
    file: File;
    format: 'json' | 'xml';
    input: HTMLInputElement;
  } | null>(null);
  importStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  importMessage = signal<string | null>(null);
  importLimitOpen = signal(false);
  exportLimitOpen = signal(false);
  deleteTarget = signal<UniverseInfo | null>(null);

  universeColumns: TableColumn<UniverseInfo>[] = [
    { header: 'universe.name', cell: (row) => row.name },
    {
      header: 'universe.current',
      cell: (row) =>
        row.id === this.activeUniverseId() ? this.translate.instant('universe.current') : '',
    },
  ];

  universes = computed(() => {
    const ownerId = this.auth.actualUser()?.id ?? '';
    return ownerId ? this.auth.getUniversesForUser(ownerId) : [];
  });
  activeUniverseId = computed(() => {
    const ownerId = this.auth.actualUser()?.id ?? '';
    return ownerId ? this.auth.getActiveUniverseId(ownerId) : null;
  });

  constructor() {
    effect(() => {
      this.prefs.set(this.draft.preferences());
    });
  }

  onNameInput(event: Event) {
    const universeName = (event.target as HTMLInputElement).value.trim();
    this.draft.updatePreferences({ ...this.prefs(), universeName });
    const ownerId = this.auth.actualUser()?.id;
    if (ownerId) {
      this.auth.renameUniverse(ownerId, this.prefs().universeId, universeName);
    }
  }

  createUniverse() {
    const ownerId = this.auth.actualUser()?.id;
    if (!ownerId) return;
    const result = this.auth.createUniverse(ownerId, this.newUniverseName(), false);
    if (!result.ok) {
      this.universeError.set(this.translate.instant(result.message ?? 'universe.nameRequired'));
      return;
    }
    this.universeError.set(null);
    this.newUniverseName.set('');
  }

  requestDelete(row: UniverseInfo) {
    if (this.universes().length <= 1) return;
    this.deleteTarget.set(row);
  }

  deleteUniverse() {
    const ownerId = this.auth.actualUser()?.id;
    const target = this.deleteTarget();
    if (!ownerId || !target) return;
    this.auth.deleteUniverse(ownerId, target.id);
    this.deleteTarget.set(null);
  }

  exportAll(format: 'json' | 'xml') {
    if (!this.exportGuard.start()) {
      this.exportLimitOpen.set(true);
      return;
    }
    const ownerId = this.auth.actualUser()?.id;
    if (!ownerId || typeof window === 'undefined') return;
    const payload = this.auth.exportAllUniverses(ownerId);
    const text = format === 'xml' ? this.toXml(payload) : JSON.stringify(payload, null, 2);
    const blob = new Blob([text], {
      type: format === 'xml' ? 'application/xml' : 'application/json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `operator-app-universes.${format}`;
    link.click();
    URL.revokeObjectURL(link.href);
    window.setTimeout(() => this.exportGuard.finish(), 500);
  }

  onImport(event: Event, format: 'json' | 'xml') {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const input = event.target as HTMLInputElement;
    this.importStatus.set('idle');
    this.importMessage.set(null);
    this.pendingImport.set({ file, format, input });
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
        const text = String(reader.result || '');
        const payload = pending.format === 'xml' ? this.fromXml(text) : JSON.parse(text || '{}');
        const ownerId = this.auth.actualUser()?.id;
        if (!ownerId) {
          this.importStatus.set('error');
          this.importMessage.set('settings.importFailed');
        } else {
          const result = this.auth.importAllUniverses(ownerId, payload);
          if (!result.ok) {
            this.importStatus.set('error');
            this.importMessage.set(result.message ?? 'settings.importFailed');
          } else {
            this.importStatus.set('success');
            this.importMessage.set('dialogs.importSuccess');
          }
        }
      } catch {
        this.importStatus.set('error');
        this.importMessage.set('settings.importFailed');
      } finally {
        pending.input.value = '';
        this.importGuard.finish();
      }
    };
    reader.onerror = () => {
      this.importStatus.set('error');
      this.importMessage.set('settings.importFailed');
      pending.input.value = '';
      this.importGuard.finish();
    };
    reader.readAsText(pending.file);
  }

  wipeAllUniverses() {
    const ownerId = this.auth.actualUser()?.id;
    if (!ownerId) return;
    this.auth.wipeAllUniverses(ownerId);
    this.confirmWipeAll.set(false);
  }

  private toXml(payload: unknown) {
    const doc = document.implementation.createDocument('', '', null);
    const root = doc.createElement('universes');
    doc.appendChild(root);
    root.appendChild(this.jsonToXml(doc, 'payload', payload));
    return new XMLSerializer().serializeToString(doc);
  }

  private fromXml(xml: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const payloadNode = doc.querySelector('payload');
    if (!payloadNode) return {};
    return this.xmlToJson(payloadNode);
  }

  private jsonToXml(doc: Document, name: string, value: unknown): Element {
    const node = doc.createElement(name);
    if (Array.isArray(value)) {
      value.forEach((item) => node.appendChild(this.jsonToXml(doc, 'item', item)));
      return node;
    }
    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
        node.appendChild(this.jsonToXml(doc, key, val));
      });
      return node;
    }
    node.textContent = value == null ? '' : String(value);
    return node;
  }

  private xmlToJson(node: Element): unknown {
    const children = Array.from(node.children);
    if (!children.length) return node.textContent ?? '';
    if (children.every((child) => child.tagName === 'item')) {
      return children.map((child) => this.xmlToJson(child));
    }
    const obj: Record<string, unknown> = {};
    children.forEach((child) => {
      obj[child.tagName] = this.xmlToJson(child);
    });
    return obj;
  }
}
