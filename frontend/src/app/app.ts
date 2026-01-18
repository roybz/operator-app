import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from './core/auth.service';

type OpWindow = Window & { __OP_CONFIG__?: { apiBaseUrl?: string; mockMode?: boolean } };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, TranslateModule],
  template: `
    @if (!auth.isLoggedIn()) {
      <router-outlet />
    } @else {
      <header
        style="max-width: 960px; margin: 32px auto 8px; padding: 0 16px; display:flex; justify-content:space-between; align-items:flex-start;"
      >
        <div>
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
          @if (auth.isPreviewing()) {
            <span
              style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:12px; background:#e8f2ff; color:#1f5fa7; border:1px solid #cfe2ff; vertical-align:middle;"
            >
              {{ 'preview.label' | translate: { user: previewUserLabel() } }}
            </span>
          }
          @if (auth.previewPersist()) {
            <span
              style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:12px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; vertical-align:middle;"
            >
              {{ 'preview.persist' | translate }}
            </span>
          }
        </div>

        @if (showTime()) {
          <div style="font-size:14px; opacity:0.8;">
            {{ timeLabel() }}
          </div>
        }
      </header>

      <main
        style="max-width: 960px; margin: 0 auto; padding: 0 16px 32px; display: flex; gap: 16px;"
      >
        <aside style="width: 220px; display:flex; flex-direction:column; gap:16px;">
          <div>
            <button (click)="toggleNav()" style="margin-bottom: 8px;">
              {{ navOpen ? ('nav.collapse' | translate) : ('nav.expand' | translate) }}
            </button>
            @if (navOpen) {
              <ul style="margin: 0; padding-left: 18px;">
                <li>
                  <a routerLink="/todo">{{ 'nav.todoApp' | translate }}</a>
                </li>
              </ul>
            }
          </div>

          <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
            <a routerLink="/settings">{{ 'nav.settings' | translate }}</a>
            <button (click)="logout()">{{ 'nav.logout' | translate }}</button>
          </div>
        </aside>

        <section style="flex: 1; min-width: 0;">
          <router-outlet />
        </section>
      </main>
    }
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  isMockMode =
    typeof window !== 'undefined' &&
    ((window as OpWindow).__OP_CONFIG__?.mockMode === true ||
      !(window as OpWindow).__OP_CONFIG__?.apiBaseUrl);
  navOpen = true;
  private readonly translate = inject(TranslateService);
  private timeInterval?: number;
  private now = signal(new Date());

  timeLabel = computed(() => {
    const prefs = this.auth.preferences();
    const timeZone = prefs.timeZone;
    const hour12 = prefs.timeFormat === '12h';
    return new Intl.DateTimeFormat(prefs.language || 'en', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    }).format(this.now());
  });

  showTime = computed(() => this.auth.preferences().showTime);

  previewUserLabel = computed(() => this.auth.currentUser()?.username ?? '');

  constructor() {
    this.translate.setDefaultLang('en');
    this.translate.use('en');
  }

  ngOnInit() {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('op_nav_open');
    if (stored !== null) this.navOpen = stored === 'true';

    this.timeInterval = window.setInterval(() => this.now.set(new Date()), 60_000);
  }

  ngOnDestroy() {
    if (this.timeInterval) window.clearInterval(this.timeInterval);
  }

  toggleNav() {
    this.navOpen = !this.navOpen;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('op_nav_open', String(this.navOpen));
    }
  }

  logout() {
    this.auth.logout();
  }
}
