import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div
      style="position:fixed; inset:0; background:var(--color-overlay); display:flex; align-items:center; justify-content:center; z-index:3500;"
    >
      <div
        style="background:var(--color-surface); padding:20px; border-radius:12px; width:min(420px, 92vw); box-shadow:0 12px 32px rgba(0,0,0,0.2);"
      >
        <div style="display:flex; justify-content:flex-end;">
          <button
            (click)="cancel.emit()"
            style="border-radius:999px; width:28px; height:28px;"
            title="{{ 'dialogs.close' | translate }}"
          >
            ✕
          </button>
        </div>
        @if (title) {
          <h3 style="margin:0 0 12px;">{{ title }}</h3>
        }
        @if (message) {
          <p style="margin:0;">{{ message }}</p>
        }
        <ng-content />
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
          <button (click)="cancel.emit()">{{ cancelLabel }}</button>
          <button (click)="confirm.emit()">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  @Input() title = '';
  @Input() message = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
