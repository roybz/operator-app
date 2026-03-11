import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalShellComponent],
  styles: [
    `
      .confirm-dialog__panel {
        width: min(560px, 94vw);
        box-sizing: border-box;
        background: var(--color-surface);
        padding: var(--space-5);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        max-height: min(86vh, 760px);
        overflow-y: auto;
        overflow-x: hidden;
      }

      :host-context(.phone-mode) .confirm-dialog__panel {
        width: min(560px, calc(100vw - 12px));
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
        flex-wrap: wrap;
      }
    `,
  ],
  template: `
    <app-modal-shell
      [zIndex]="3500"
      [ariaLabel]="title || 'Confirmation dialog'"
      maxWidth="min(560px, calc(100vw - 24px))"
      (closed)="canceled.emit()"
    >
      <div class="confirm-dialog__panel">
        <div class="confirm-dialog__header">
          <button
            type="button"
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
            <button type="button" (click)="canceled.emit()">{{ cancelLabel }}</button>
          }
          <button type="button" (click)="confirmed.emit()">{{ confirmLabel }}</button>
        </div>
      </div>
    </app-modal-shell>
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
