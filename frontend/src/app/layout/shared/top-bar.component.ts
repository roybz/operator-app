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
    <header
      id="topbar-header"
      style="background:var(--color-surface); border-bottom:1px solid var(--color-border); padding: 12px 16px; display:flex; justify-content:space-between; align-items:center;"
      [style.flexDirection]="phoneMode ? 'column' : 'row'"
      [style.alignItems]="phoneMode ? 'flex-start' : 'center'"
      [style.gap]="phoneMode ? '8px' : '0'"
    >
      <div style="position:relative; width:100%;">
        @if (siteLogoEmoji) {
          <span style="margin-right:6px;">{{ siteLogoEmoji }}</span>
        }
        <div
          style="display:inline-flex; align-items:center; flex-wrap:wrap; max-width:100%;"
          [style.gap]="phoneMode ? '12px' : '24px'"
        >
          <strong
            [style.fontSize]="phoneMode ? '16px' : '18px'"
            style="max-width:70vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
            [style.display]="phoneMode ? 'inline-block' : 'inline'"
          >
            {{ siteTitle }}
          </strong>
          <div
            style="display:inline-flex; align-items:center; flex-wrap:wrap; max-width:100%;"
            [style.gap]="phoneMode ? '6px' : '9px'"
          >
            @if (loggedInLabel) {
              <span
                style="display:inline-block; padding:2px 8px; border-radius:999px; background:#f3f4f6; color:#334155; border:1px solid #e2e8f0; vertical-align:middle;"
                [style.fontSize]="phoneMode ? '11px' : '12px'"
              >
                {{ 'auth.loggedInAs' | translate: { user: loggedInLabel } }}
              </span>
            }
            @if (mockLabel) {
              <span
                style="display:inline-block; padding:2px 8px; border-radius:999px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; vertical-align:middle;"
                [style.fontSize]="phoneMode ? '11px' : '12px'"
              >
                {{ 'mock.label' | translate }}
              </span>
            }
            @if (previewLabel) {
              <span
                style="display:inline-block; padding:2px 8px; border-radius:999px; background:#e8f2ff; color:#1f5fa7; border:1px solid #cfe2ff; vertical-align:middle;"
                [style.fontSize]="phoneMode ? '11px' : '12px'"
              >
                {{ 'preview.label' | translate: { user: previewLabel } }}
              </span>
            }
            @if (previewPersist) {
              <span
                style="display:inline-block; padding:2px 8px; border-radius:999px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; vertical-align:middle;"
                [style.fontSize]="phoneMode ? '11px' : '12px'"
              >
                {{ 'preview.persist' | translate }}
              </span>
            }
          </div>
        </div>
        @if (canSwitchUniverse) {
          <div
            style="margin-top:2px; font-size:12px; font-style:italic; position:relative;"
            [style.paddingLeft.px]="siteLogoEmoji ? 22 : 0"
          >
            <span
              style="max-width:70vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block; vertical-align:middle;"
            >
              {{ currentUniverseName }}
            </span>
            <button
              class="square-btn"
              (click)="toggleUniverseMenu.emit()"
              style="margin-left:6px; font-size:10px;"
            >
              &#9662;
            </button>
            @if (universeMenuOpen) {
              <div
                style="position:fixed; inset:0; background:var(--color-overlay); z-index:1400;"
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
        <div style="width:100%; display:flex; align-items:center; justify-content:space-between;">
          <button class="square-btn" (click)="toggleNav.emit()" style="font-size:22px;">
            &#9776;
          </button>
          <div style="display:flex; align-items:center; gap:12px; justify-content:flex-end;">
            @if (showTime) {
              <div style="font-size:14px; opacity:0.8; white-space:nowrap;">
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
        <div style="display:flex; align-items:center; gap:12px;" [style.flexWrap]="'nowrap'">
          @if (city) {
            <div style="font-size:14px; opacity:0.8;">{{ city }}</div>
          }
          @if (showTime) {
            <div style="font-size:14px; opacity:0.8; white-space:nowrap;">
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
