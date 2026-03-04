import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-device-mode-toggle',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <label class="mode-toggle">
      <input type="checkbox" [checked]="checked" [disabled]="disabled" (change)="changed.emit($event)" />
      <span>{{ labelKey | translate }}</span>
    </label>
  `,
  styles: [
    `
      .mode-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `,
  ],
})
export class DeviceModeToggleComponent {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() labelKey = 'phone.modeLabel';
  @Output() changed = new EventEmitter<Event>();
}

