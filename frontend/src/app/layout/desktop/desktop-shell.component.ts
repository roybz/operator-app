import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { StorageService } from '../../core/storage/storage.service';
import { AppId } from '../../features/dependencies/app-types';
import { DialogInstance } from '../../core/dialog.service';
import { AppGroup, AppListComponent } from '../shared/app-list/app-list.component';
import { DeviceModeToggleComponent } from '../../shared/device-mode-toggle/device-mode-toggle.component';

@Component({
  selector: 'app-desktop-shell',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppListComponent, DeviceModeToggleComponent],
  templateUrl: './desktop-shell.component.html',
  styleUrls: ['./desktop-shell.component.scss'],
})
export class DesktopShellComponent implements OnInit {
  @Input() navOpen = false;
  @Input() dialogsHidden = false;
  @Input() resetMenuOpen = false;
  @Input() settingsOpen = false;
  @Input() canEdit = false;
  @Input() deleteTargetActive = false;
  @Input() apps: AppGroup[] = [];
  @Input() instancesByApp: Record<AppId, DialogInstance[]> = {} as Record<AppId, DialogInstance[]>;
  @Input() phoneMode = false;
  @Input() showViewportSizingControls = false;
  @Input() isCanvasLocked = false;
  @Input() canvasMode: 'follow' | 'locked' = 'follow';
  @Input() canvasDraftWidth = 0;
  @Input() canvasDraftHeight = 0;
  @Input() canvasDraftDirty = false;
  @Input() showZoomControls = false;
  @Input() showCanvasDivider = false;
  @Input() canOpenSettings = true;

  @Output() toggleNav = new EventEmitter<void>();
  @Output() toggleDialogsHidden = new EventEmitter<void>();
  @Output() toggleResetMenu = new EventEmitter<void>();
  @Output() resetLeft = new EventEmitter<void>();
  @Output() resetMiddle = new EventEmitter<void>();
  @Output() openApp = new EventEmitter<AppId>();
  @Output() restore = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();
  @Output() toggleLock = new EventEmitter<string>();
  @Output() archive = new EventEmitter<string>();
  @Output() unarchive = new EventEmitter<string>();
  @Output() phoneModeToggle = new EventEmitter<Event>();
  @Output() canvasModeChange = new EventEmitter<Event>();
  @Output() canvasDraftWidthChange = new EventEmitter<number>();
  @Output() canvasDraftHeightChange = new EventEmitter<number>();
  @Output() applyCanvasSize = new EventEmitter<void>();
  @Output() resetZoom = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();
  @Output() zoomIn = new EventEmitter<void>();
  @Output() toggleSettings = new EventEmitter<void>();
  @Output() openLicense = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  displayOptionsOpen = false;
  displayOptionsHovered = false;

  private storage = inject(StorageService);

  ngOnInit() {
    this.displayOptionsOpen = this.readDisplayOptions();
  }

  toggleDisplayOptions() {
    this.displayOptionsOpen = !this.displayOptionsOpen;
    void this.storage.setItem('op_display_options_open', this.displayOptionsOpen ? '1' : '0');
  }

  private readDisplayOptions() {
    const raw = this.storage.getItemSync('op_display_options_open');
    if (raw === null) return false;
    return raw === '1';
  }
}
