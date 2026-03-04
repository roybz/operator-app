import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="modal-shell__backdrop"
      role="button"
      tabindex="0"
      aria-label="Close dialog"
      [style.zIndex]="zIndex"
      (pointerdown)="onBackdropPointerDown($event)"
      (keydown.enter)="closed.emit()"
      (keydown.space)="closed.emit()"
    >
      <div
        class="modal-shell__panel"
        [style.maxWidth]="maxWidth"
        role="dialog"
        [attr.aria-modal]="true"
        [attr.aria-label]="ariaLabel"
        tabindex="-1"
        (pointerdown)="$event.stopPropagation()"
      >
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .modal-shell__backdrop {
        position: fixed;
        inset: 0;
        background: var(--color-overlay);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-shell__panel {
        background: var(--color-surface);
        border-radius: 12px;
        max-height: min(90vh, 860px);
        overflow: auto;
      }
    `,
  ],
})
export class ModalShellComponent {
  @Input() maxWidth = 'min(860px, calc(100vw - 32px))';
  @Input() zIndex = 2400;
  @Input() ariaLabel = 'Dialog';
  @Output() closed = new EventEmitter<void>();

  onBackdropPointerDown(event: PointerEvent) {
    event.preventDefault();
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closed.emit();
  }
}

