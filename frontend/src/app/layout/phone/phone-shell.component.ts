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
        style="position:fixed; inset:0; background:var(--color-overlay); z-index:1500;"
        role="button"
        tabindex="0"
        (click)="toggleNav.emit()"
        (keydown.enter)="toggleNav.emit()"
        (keydown.space)="toggleNav.emit()"
      ></div>
    }
    <aside
      [style.width]="navOpen ? '90vw' : '0'"
      [style.padding]="navOpen ? '16px' : '0'"
      [style.overflow]="'hidden'"
      style="position:fixed; top:0; left:0; bottom:0; z-index:1501; background:var(--color-surface); box-shadow:0 12px 24px rgba(0,0,0,0.2); display:flex; flex-direction:column; gap:16px; transition:width 180ms ease; box-sizing:border-box;"
    >
      @if (navOpen) {
        <div style="display:flex; flex-direction:column; height:100%; min-height:0;">
          <button
            (click)="toggleNav.emit()"
            style="margin-bottom: 8px; padding:10px 12px; font-size:16px;"
          >
            {{ 'nav.collapse' | translate }}
          </button>
          <div style="border-top:1px solid var(--color-border); margin:12px 0; opacity:0.6;"></div>
          <div style="flex:1; min-height:0; overflow:hidden;">
            <app-app-list
              [apps]="apps"
              [instancesByApp]="instancesByApp"
              [deleteTargetActive]="deleteTargetActive"
              [actionsDisabled]="actionsDisabled"
              [phoneMode]="true"
              [activeInstanceId]="activeInstanceId"
              (openApp)="openApp.emit($event)"
              (restore)="restore.emit($event)"
              (duplicate)="duplicate.emit($event)"
              (toggleLock)="toggleLock.emit($event)"
              (archive)="archive.emit($event)"
              (unarchive)="unarchive.emit($event)"
            />
          </div>
          <div style="display:flex; flex-direction:column; gap:12px; margin-top:16px;">
            <button (click)="toggleSettings.emit()" style="padding:10px 12px; font-size:16px;">
              {{ 'nav.settings' | translate }}
            </button>
            <button (click)="openLicense.emit()" style="padding:10px 12px; font-size:16px;">
              {{ 'nav.license' | translate }}
            </button>
            <button (click)="logout.emit()" style="padding:10px 12px; font-size:16px;">
              {{ 'nav.logout' | translate }}
            </button>
          </div>
        </div>
      }
    </aside>
  `,
})
export class PhoneShellComponent {
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
  @Output() unarchive = new EventEmitter<string>();
  @Output() toggleSettings = new EventEmitter<void>();
  @Output() openLicense = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
}
