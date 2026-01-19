import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <section style="max-width: 640px;">
      <h2 style="margin:0;">{{ 'about.title' | translate }}</h2>
      <p>{{ 'about.line1' | translate }}</p>
      <p>{{ 'about.copyright' | translate: { year: currentYear } }}</p>
      <p>
        <a href="https://www.linkedin.com/in/roynouneh/" target="_blank" rel="noreferrer">
          {{ 'about.linkedin' | translate }}
        </a>
      </p>
    </section>
  `,
})
export class AboutComponent {
  currentYear = new Date().getFullYear();
}
