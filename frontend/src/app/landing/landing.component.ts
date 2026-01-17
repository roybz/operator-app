import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <p style="text-align: center; margin-top: 80px;">{{ 'landing.welcome' | translate }}</p>
  `,
})
export class LandingComponent {}
