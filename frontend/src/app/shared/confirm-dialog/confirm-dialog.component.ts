import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  styles: [
    `
      .confirm-dialog__panel {
        width: min(420px, 92vw);
        box-sizing: border-box;
        background: var(--color-surface);
        padding: var(--space-5);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
      }

      :host-context(.phone-mode) .confirm-dialog__panel {
        width: min(420px, calc(96vw - 12px));
      }

      .confirm-dialog {
        position: fixed;
        inset: 0;
        background: var(--color-overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3500;
      }

      .confirm-dialog__header {
        display: flex;
        justify-content: flex-end;
      }

      .confirm-dialog__close {
        border-radius: 999px;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }

      .confirm-dialog__actions button {
        padding: 5px 6px;
        border-radius: 3px;
      }

      .confirm-dialog__title {
        margin: 0 0 var(--space-3);
      }

      .confirm-dialog__message {
        margin: 5px 0;
        line-height: 24px;
        white-space: pre-line;
      }

      .confirm-dialog__actions {
        display: flex;
        gap: var(--space-2);
        justify-content: flex-end;
        margin-top: var(--space-4);
      }
    `,
  ],
  template: `
    <div
      class="confirm-dialog"
      (pointerdown)="canceled.emit()"
      role="button"
      tabindex="0"
      (keydown.enter)="canceled.emit()"
      (keydown.space)="canceled.emit()"
    >
      <div
        class="confirm-dialog__panel"
        (pointerdown)="$event.stopPropagation()"
      >
        <div class="confirm-dialog__header">
          <button
            class="confirm-dialog__close"
            (click)="canceled.emit()"
            title="{{ 'dialogs.close' | translate }}"
          >
            &#215;
          </button>
        </div>
        @if (title) {
          <h3 class="confirm-dialog__title">{{ title }}</h3>
        }
        @if (message) {
          <p class="confirm-dialog__message">{{ message }}</p>
        }
        <ng-content />
        <div class="confirm-dialog__actions">
          @if (showCancel) {
            <button (click)="canceled.emit()">{{ cancelLabel }}</button>
          }
          <button (click)="confirmed.emit()">{{ confirmLabel }}</button>
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
  @Input() showCancel = true;

  @Output() confirmed = new EventEmitter<void>();
  @Output() canceled = new EventEmitter<void>();
}
