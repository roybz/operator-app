import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import packageJson from '../../../../package.json';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <section style="max-width: 640px;">
      <h2 style="margin:0;">{{ 'about.title' | translate }}</h2>
      <p>{{ 'about.line1' | translate }}</p>
      <div style="font-size: 12px; opacity: 0.7; margin-top: 6px;">v{{ appVersion }}</div>
      <p>
        <a href="https://www.linkedin.com/in/roynouneh/" target="_blank" rel="noreferrer">
          {{ 'about.linkedin' | translate }}
        </a>
        ·
        <a href="https://github.com/roybz/operator-app" target="_blank" rel="noreferrer">
          {{ 'about.github' | translate }}
        </a>
      </p>
    </section>
  `,
})
export class AboutComponent {
  appVersion = packageJson.version ?? '0.0.0';
}
