import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      style="position:absolute; inset:0; background:rgba(255,255,255,0.98); z-index:2000; overflow:auto;"
    >
      <div style="position:relative; min-height:100%; padding:24px;">
        <button style="position:absolute; top:16px; right:16px;" (click)="closed.emit()">✕</button>
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class OverlayComponent {
  @Output() closed = new EventEmitter<void>();
}
