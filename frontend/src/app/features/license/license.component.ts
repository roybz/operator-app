import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-license',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <section style="position:relative; padding:24px 16px; max-width: 900px;">
      @if (showClose) {
        <button
          (click)="closed.emit()"
          style="position:sticky; top:0; float:right; border-radius:999px; width:28px; height:28px; display:flex; align-items:center; justify-content:center;"
          title="{{ 'dialogs.close' | translate }}"
        >
          ✕
        </button>
      }
      <h2 style="margin:0 0 12px;">{{ 'license.title' | translate }}</h2>

      <h3 style="margin:16px 0 8px;">{{ 'license.mitTitle' | translate }}</h3>
      <p style="white-space:pre-line;">{{ 'license.mitBody' | translate }}</p>

      <h3 style="margin:16px 0 8px;">{{ 'license.privacyTitle' | translate }}</h3>
      <p style="white-space:pre-line;">{{ 'license.privacyBody' | translate }}</p>

      <div style="display:flex; gap:12px; margin-top:16px;">
        <a href="https://github.com/roybz/operator-app" target="_blank" rel="noopener noreferrer">
          {{ 'about.github' | translate }}
        </a>
        <a href="https://www.linkedin.com/in/roynouneh/" target="_blank" rel="noopener noreferrer">
          {{ 'about.linkedin' | translate }}
        </a>
      </div>
    </section>
  `,
})
export class LicenseComponent {
  @Input() showClose = true;
  @Output() closed = new EventEmitter<void>();
}
