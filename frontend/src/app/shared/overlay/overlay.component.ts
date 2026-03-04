import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-overlay',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .overlay {
        position: absolute;
        inset: 0;
        background: var(--color-surface);
        z-index: 2000;
        overflow: auto;
      }

      .overlay__content {
        position: relative;
        min-height: 100%;
        padding: var(--space-6);
      }

      .overlay__header {
        position: sticky;
        top: var(--space-4);
        display: flex;
        justify-content: flex-end;
        z-index: 5;
      }

      .overlay__close {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
    `,
  ],
  template: `
    <div class="overlay">
      <div class="overlay__content">
        <div class="overlay__header">
          <button class="overlay__close" (click)="closed.emit()">×</button>
        </div>
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class OverlayComponent {
  @Output() closed = new EventEmitter<void>();
}
