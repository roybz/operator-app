import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type OpWindow = Window & { __OP_CONFIG__?: { apiBaseUrl?: string; mockMode?: boolean } };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, TranslateModule],
  template: `
    <header style="max-width: 960px; margin: 32px auto 8px; padding: 0 16px;">
      <a routerLink="/" style="color: inherit; text-decoration: none;">
        <h1 style="display: inline-block; margin: 0;">{{ 'app.title' | translate }}</h1>
      </a>
      @if (isMockMode) {
        <span
          style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:12px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; vertical-align:middle;"
        >
          {{ 'mock.label' | translate }}
        </span>
      }
    </header>

    <main style="max-width: 960px; margin: 0 auto; padding: 0 16px 32px; display: flex; gap: 16px;">
      <aside style="width: 220px;">
        <button (click)="toggleNav()" style="margin-bottom: 8px;">
          {{ navOpen ? ('nav.collapse' | translate) : ('nav.expand' | translate) }}
        </button>
        @if (navOpen) {
          <div>
            <ul style="margin: 0; padding-left: 18px;">
              <li>
                <a routerLink="/todo">{{ 'nav.todoApp' | translate }}</a>
              </li>
            </ul>
          </div>
        }
      </aside>

      <section style="flex: 1; min-width: 0;">
        <router-outlet />
      </section>
    </main>
  `,
})
export class AppComponent implements OnInit {
  isMockMode =
    typeof window !== 'undefined' &&
    ((window as OpWindow).__OP_CONFIG__?.mockMode === true ||
      !(window as OpWindow).__OP_CONFIG__?.apiBaseUrl);
  navOpen = true;
  private readonly translate = inject(TranslateService);

  constructor() {
    this.translate.setDefaultLang('en');
    this.translate.use('en');
  }

  ngOnInit() {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('op_nav_open');
    if (stored !== null) this.navOpen = stored === 'true';
  }

  toggleNav() {
    this.navOpen = !this.navOpen;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('op_nav_open', String(this.navOpen));
    }
  }
}
