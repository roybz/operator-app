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
      <p style="line-height:23px;">{{ 'about.line1' | translate }}</p>
      <div style="font-size: 12px; opacity: 0.7; margin-top: 3px;">v{{ appVersion }}</div>
      <p style="margin-bottom:0;">
        <a href="https://github.com/roybz/operator-app" target="_blank" rel="noreferrer">{{
          'about.github' | translate
        }}</a>
        <span> · </span>
        <a href="https://www.linkedin.com/in/roynouneh/" target="_blank" rel="noreferrer">{{
          'about.linkedin' | translate
        }}</a>
      </p>
    </section>
  `,
})
export class AboutComponent {
  appVersion = packageJson.version ?? '0.0.0';
}
