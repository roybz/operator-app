import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export interface UniverseItem {
  id: string;
  name: string;
}

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  styles: [
    `
      .topbar {
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .topbar--phone {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .topbar__main {
        position: relative;
        width: 100%;
      }

      .topbar__logo {
        margin-right: 6px;
      }

      .topbar__title-row {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        max-width: 100%;
        gap: 24px;
      }

      .topbar__title-row--phone {
        gap: 12px;
      }

      .topbar__title {
        max-width: 70vw;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 18px;
      }

      .topbar__title--phone {
        font-size: 16px;
        display: inline-block;
      }

      .topbar__badges {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        max-width: 100%;
        gap: 9px;
      }

      .topbar__badges--phone {
        gap: 6px;
      }

      .topbar__badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        vertical-align: middle;
        font-size: 12px;
      }

      .topbar__badge--phone {
        font-size: 11px;
      }

      .topbar__badge--login {
        background: #f3f4f6;
        color: #334155;
        border: 1px solid #e2e8f0;
      }

      .topbar__badge--warn {
        background: #fff3cd;
        color: #7a5b00;
        border: 1px solid #ffe49a;
      }

      .topbar__badge--preview {
        background: #e8f2ff;
        color: #1f5fa7;
        border: 1px solid #cfe2ff;
      }

      .topbar__universe {
        margin-top: 2px;
        font-size: 12px;
        font-style: italic;
        position: relative;
      }

      .topbar__universe--logo {
        padding-left: 22px;
      }

      .topbar__universe-name {
        max-width: 70vw;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: inline-block;
        vertical-align: middle;
      }

      .topbar__universe-toggle {
        margin-left: 6px;
        font-size: 15px;
        line-height: 1;
        min-width: 22px;
        min-height: 22px;
      }

      .topbar__overlay-dismiss {
        position: fixed;
        inset: 0;
        background: var(--color-overlay);
        z-index: 1400;
      }

      .topbar__controls {
        display: flex;
        align-items: center;
        gap: 12px;
        white-space: nowrap;
      }

      .topbar__controls--phone {
        width: 100%;
        justify-content: space-between;
      }

      .topbar__controls-right {
        display: flex;
        align-items: center;
        gap: 12px;
        justify-content: flex-end;
      }

      .topbar__meta {
        font-size: 14px;
        opacity: 0.8;
      }

      .topbar__nav {
        font-size: 22px;
      }

      .square-btn {
        padding: 5px 6px;
        border-radius: 3px;
      }

      .universe-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 6px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 180px;
        z-index: 1401;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
      }

      .universe-menu__item {
        text-align: left;
        padding: 6px 8px;
        border-radius: 6px;
      }

      .universe-menu__item--active {
        font-weight: 600;
      }

      :host-context(.phone-mode) .universe-menu {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        margin-top: 0;
        width: min(460px, 92vw);
        padding: 12px;
        border-radius: 12px;
      }

      :host-context(.phone-mode) .universe-menu__item {
        padding: 10px 12px;
        font-size: 16px;
      }
    `,
  ],
  template: `
    <header id="topbar-header" class="topbar" [class.topbar--phone]="phoneMode">
      <div class="topbar__main">
        @if (siteLogoEmoji) {
          <span class="topbar__logo">{{ siteLogoEmoji }}</span>
        }
        <div class="topbar__title-row" [class.topbar__title-row--phone]="phoneMode">
          <strong class="topbar__title" [class.topbar__title--phone]="phoneMode">
            {{ siteTitle }}
          </strong>
          <div class="topbar__badges" [class.topbar__badges--phone]="phoneMode">
            @if (loggedInLabel) {
              <span
                class="topbar__badge topbar__badge--login"
                [class.topbar__badge--phone]="phoneMode"
              >
                {{ 'auth.loggedInAs' | translate: { user: loggedInLabel } }}
              </span>
            }
            @if (mockLabel) {
              <span
                class="topbar__badge topbar__badge--warn"
                [class.topbar__badge--phone]="phoneMode"
              >
                {{ 'mock.label' | translate }}
              </span>
            }
            @if (previewLabel) {
              <span
                class="topbar__badge topbar__badge--preview"
                [class.topbar__badge--phone]="phoneMode"
              >
                {{ 'preview.label' | translate: { user: previewLabel } }}
              </span>
            }
            @if (previewPersist) {
              <span
                class="topbar__badge topbar__badge--warn"
                [class.topbar__badge--phone]="phoneMode"
              >
                {{ 'preview.persist' | translate }}
              </span>
            }
          </div>
        </div>
        @if (canSwitchUniverse) {
          <div class="topbar__universe" [class.topbar__universe--logo]="!!siteLogoEmoji">
            <span class="topbar__universe-name">
              {{ currentUniverseName }}
            </span>
            <button class="square-btn topbar__universe-toggle" (click)="toggleUniverseMenu.emit()">
              &#9662;
            </button>
            @if (universeMenuOpen) {
              <div
                class="topbar__overlay-dismiss"
                role="button"
                tabindex="0"
                (click)="closeUniverseMenu.emit()"
                (keydown.enter)="closeUniverseMenu.emit()"
                (keydown.space)="closeUniverseMenu.emit()"
              ></div>
              <div class="universe-menu" (pointerdown)="$event.stopPropagation()">
                @for (u of universes; track u.id) {
                  <button
                    class="universe-menu__item"
                    [class.universe-menu__item--active]="u.id === activeUniverseId"
                    (click)="switchUniverse.emit(u.id)"
                  >
                    {{ u.name }}
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>

      @if (phoneMode) {
        <div class="topbar__controls topbar__controls--phone">
          <button class="square-btn topbar__nav" (click)="toggleNav.emit()">&#9776;</button>
          <div class="topbar__controls-right">
            @if (showTime) {
              <div class="topbar__meta">
                {{ timeLabel }}
              </div>
            }
            <button
              class="square-btn"
              data-workspace-toggle="true"
              (click)="toggleWorkspaceMenu.emit()"
              [style.boxShadow]="
                workspaceMenuOpen
                  ? '0 0 8px 4px rgba(255, 228, 154, 0.9), 0 0 12px 1px rgba(199, 160, 55, 0.6)'
                  : 'none'
              "
            >
              {{ 'workspaces.button' | translate }}
            </button>
            <button class="square-btn" (click)="toggleTopBar.emit()">
              {{ 'topbar.collapse' | translate }}
            </button>
          </div>
        </div>
      } @else {
        <div class="topbar__controls">
          @if (city) {
            <div class="topbar__meta">{{ city }}</div>
          }
          @if (showTime) {
            <div class="topbar__meta">
              {{ timeLabel }}
            </div>
          }
          <button
            class="square-btn"
            data-workspace-toggle="true"
            (click)="toggleWorkspaceMenu.emit()"
            [style.boxShadow]="
              workspaceMenuOpen
                ? '0 0 8px 4px rgba(255, 228, 154, 0.9), 0 0 12px 1px rgba(199, 160, 55, 0.6)'
                : 'none'
            "
          >
            {{ 'workspaces.button' | translate }}
          </button>
          <button class="square-btn" (click)="toggleTopBar.emit()">
            {{ 'topbar.collapse' | translate }}
          </button>
        </div>
      }
    </header>
  `,
})
export class TopBarComponent {
  @Input() phoneMode = false;
  @Input() siteLogoEmoji = '';
  @Input() siteTitle = '';
  @Input() loggedInLabel = '';
  @Input() mockLabel = false;
  @Input() previewLabel = '';
  @Input() previewPersist = false;
  @Input() canSwitchUniverse = false;
  @Input() currentUniverseName = '';
  @Input() universeMenuOpen = false;
  @Input() universes: UniverseItem[] = [];
  @Input() activeUniverseId: string | null = null;
  @Input() city = '';
  @Input() showTime = false;
  @Input() timeLabel = '';
  @Input() workspaceMenuOpen = false;

  @Output() toggleNav = new EventEmitter<void>();
  @Output() toggleWorkspaceMenu = new EventEmitter<void>();
  @Output() toggleTopBar = new EventEmitter<void>();
  @Output() toggleUniverseMenu = new EventEmitter<void>();
  @Output() closeUniverseMenu = new EventEmitter<void>();
  @Output() switchUniverse = new EventEmitter<string>();
}
