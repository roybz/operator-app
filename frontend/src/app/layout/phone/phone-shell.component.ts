import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppListComponent, AppGroup } from '../shared/app-list/app-list.component';
import { DialogInstance } from '../../core/dialog.service';
import { AppId } from '../../features/dependencies/app-types';

@Component({
  selector: 'app-phone-shell',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppListComponent],
  template: `
    @if (navOpen) {
      <div
        style="position:fixed; inset:0; background:var(--color-overlay); z-index:2200; touch-action:none; overscroll-behavior:contain;"
        role="button"
        tabindex="0"
        (click)="toggleNav.emit()"
        (touchmove)="$event.preventDefault()"
        (keydown.enter)="toggleNav.emit()"
        (keydown.space)="toggleNav.emit()"
      ></div>
    }
    <aside
      [style.width]="navOpen ? '90vw' : '0'"
      [style.padding]="navOpen ? '16px' : '0'"
      [style.overflowX]="'hidden'"
      [style.overflowY]="navOpen ? 'auto' : 'hidden'"
      style="position:fixed; top:0; left:0; bottom:0; z-index:2201; background:var(--color-surface); box-shadow:0 12px 24px rgba(0,0,0,0.2); display:flex; flex-direction:column; gap:16px; transition:width 180ms ease; box-sizing:border-box; overscroll-behavior:contain;"
    >
      @if (navOpen) {
        <div style="display:flex; flex-direction:column; flex:1; min-height:0;">
          <button
            (click)="toggleNav.emit()"
            style="margin-bottom: 8px; padding:10px 12px; font-size:16px; border-radius:5px;"
          >
            {{ 'nav.collapse' | translate }}
          </button>
          <div style="border-top:1px solid var(--color-border); margin:12px 0; opacity:0.6;"></div>
          <button
            (click)="toggleAppDrawer()"
            style="margin-bottom: 8px; padding:10px 12px; font-size:16px; border-radius:5px;"
          >
            &#9638; {{ 'nav.appsDrawer' | translate }}
          </button>
          @if (appDrawerOpen) {
            <div
              style="display:grid; gap:6px; margin-bottom:10px; padding:6px; border:1px solid var(--color-border); border-radius:8px;"
            >
              @for (app of drawerApps(); track app.id) {
                <button
                  type="button"
                  style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:6px;"
                  (click)="openApp.emit(app.id)"
                >
                  <span style="display:inline-flex; align-items:center; gap:8px;">
                    <span>{{ app.icon }}</span>
                    <span>{{ app.labelKey | translate }}</span>
                  </span>
                  <span aria-hidden="true" style="opacity:0.75;">+</span>
                </button>
              }
            </div>
          }
          <div style="flex:1; min-height:0; overflow:hidden;">
            <app-app-list
              [apps]="apps"
              [instancesByApp]="instancesByApp"
              [deleteTargetActive]="deleteTargetActive"
              [actionsDisabled]="actionsDisabled"
              [phoneMode]="true"
              [activeInstanceId]="activeInstanceId"
              [showArchivedSection]="false"
              [showAppCreateButtons]="false"
              (openApp)="openApp.emit($event)"
              (restore)="restore.emit($event)"
              (duplicate)="duplicate.emit($event)"
              (toggleLock)="toggleLock.emit($event)"
              (archive)="archive.emit($event)"
              (deletePermanently)="deletePermanently.emit($event)"
              (unarchive)="unarchive.emit($event)"
            />
          </div>
          <div style="display:flex; flex-direction:column; gap:12px; margin-top:16px;">
            <button
              (click)="switchToDesktopMode.emit()"
              style="padding:10px 12px; font-size:16px; border-radius:5px;"
            >
              {{ 'nav.switchDesktopMode' | translate }}
            </button>
            <button
              (click)="toggleSettings.emit()"
              style="padding:10px 12px; font-size:16px; border-radius:5px;"
            >
              {{ 'nav.settings' | translate }}
            </button>
            <button
              (click)="openLicense.emit()"
              style="padding:10px 12px; font-size:16px; border-radius:5px;"
            >
              {{ 'nav.license' | translate }}
            </button>
            <button
              (click)="logout.emit()"
              style="padding:10px 12px; font-size:16px; border-radius:5px;"
            >
              {{ 'nav.logout' | translate }}
            </button>
          </div>
        </div>
      }
    </aside>
  `,
})
export class PhoneShellComponent {
  appDrawerOpen = false;

  @Input() navOpen = false;
  @Input() apps: AppGroup[] = [];
  @Input() instancesByApp: Record<AppId, DialogInstance[]> = {} as Record<AppId, DialogInstance[]>;
  @Input() activeInstanceId: string | null = null;
  @Input() deleteTargetActive = false;
  @Input() actionsDisabled = false;

  @Output() toggleNav = new EventEmitter<void>();
  @Output() openApp = new EventEmitter<AppId>();
  @Output() restore = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();
  @Output() toggleLock = new EventEmitter<string>();
  @Output() archive = new EventEmitter<string>();
  @Output() deletePermanently = new EventEmitter<string>();
  @Output() unarchive = new EventEmitter<string>();
  @Output() switchToDesktopMode = new EventEmitter<void>();
  @Output() toggleSettings = new EventEmitter<void>();
  @Output() openLicense = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  toggleAppDrawer() {
    this.appDrawerOpen = !this.appDrawerOpen;
  }

  drawerApps() {
    return [...this.apps].sort((a, b) => a.labelKey.localeCompare(b.labelKey));
  }
}
