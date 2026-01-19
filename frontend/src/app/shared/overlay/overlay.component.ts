import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      style="position:absolute; inset:0; background:var(--color-surface); z-index:2000; overflow:auto;"
    >
      <div style="position:relative; min-height:100%; padding:24px;">
        <div style="position:sticky; top:16px; display:flex; justify-content:flex-end; z-index:5;">
          <button (click)="closed.emit()">✕</button>
        </div>
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class OverlayComponent {
  @Output() closed = new EventEmitter<void>();
}
