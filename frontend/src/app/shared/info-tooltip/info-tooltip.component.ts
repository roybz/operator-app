import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-info-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="info-tooltip" [attr.aria-label]="text">
      i
      <span class="info-tooltip__bubble">{{ text }}</span>
    </span>
  `,
  styles: [
    `
      .info-tooltip {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 1px solid var(--color-border);
        font-size: 12px;
        cursor: help;
        line-height: 1;
      }

      .info-tooltip__bubble {
        position: absolute;
        left: 22px;
        top: -4px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 11px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 120ms ease;
        z-index: 3001;
      }

      .info-tooltip:hover .info-tooltip__bubble {
        opacity: 1;
      }
    `,
  ],
})
export class InfoTooltipComponent {
  @Input() text = '';
}
