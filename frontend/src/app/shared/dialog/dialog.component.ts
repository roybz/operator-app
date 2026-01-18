import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DialogInstance } from '../../core/dialog.service';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div
      class="dialog"
      [class.dialog--disabled]="disabled"
      [style.left.px]="instance.rect.x"
      [style.top.px]="instance.rect.y"
      [style.width.px]="instance.rect.width"
      [style.height.px]="instance.rect.height"
      [style.zIndex]="instance.z"
      (pointerdown)="onPointerDown($event)"
    >
      <div class="dialog__bar" (pointerdown)="startDrag($event)">
        <button
          class="dialog__icon"
          (pointerdown)="$event.stopPropagation()"
          (click)="trash.emit()"
          [disabled]="trashDisabled"
          [style.opacity]="trashDisabled ? 0.4 : 1"
          title="{{ 'dialogs.trash' | translate }}"
        >
          🗑️
        </button>
        <div class="dialog__title">
          @if (!isEditingTitle) {
            <div (dblclick)="startTitleEdit()">{{ title }}</div>
          } @else {
            <input
              [value]="titleDraft"
              (input)="onTitleInput($event)"
              (blur)="finishTitleEdit()"
              (keydown.enter)="finishTitleEdit()"
              (keydown.escape)="cancelTitleEdit()"
              style="width:100%;"
            />
          }
        </div>
        <div class="dialog__actions">
          <button
            class="dialog__icon"
            (pointerdown)="$event.stopPropagation()"
            (click)="stash.emit()"
            title="{{ 'dialogs.stash' | translate }}"
          >
            📦
          </button>
          <button
            class="dialog__icon"
            (pointerdown)="$event.stopPropagation()"
            (click)="minimize.emit()"
            title="{{ 'dialogs.minimize' | translate }}"
          >
            ⎯
          </button>
          <button
            class="dialog__icon"
            (pointerdown)="$event.stopPropagation()"
            (click)="maximize.emit()"
            title="{{ 'dialogs.maximize' | translate }}"
          >
            ⬜
          </button>
          <button
            class="dialog__icon"
            (pointerdown)="$event.stopPropagation()"
            (click)="closed.emit()"
            title="{{ 'dialogs.close' | translate }}"
          >
            ✕
          </button>
        </div>
      </div>
      <div class="dialog__body">
        <ng-content />
      </div>
      <div class="dialog__resize" (pointerdown)="startResize($event)"></div>
    </div>
  `,
  styles: [
    `
      .dialog {
        position: absolute;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .dialog__bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        background: var(--color-bg);
        cursor: grab;
        user-select: none;
      }
      .dialog__title {
        flex: 1;
        font-weight: 600;
        font-size: 13px;
      }
      .dialog__actions {
        display: flex;
        gap: 6px;
      }
      .dialog__icon {
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
      }
      .dialog__body {
        flex: 1;
        overflow: auto;
        padding: 8px 12px;
      }
      .dialog__resize {
        position: absolute;
        right: 2px;
        bottom: 2px;
        width: 22px;
        height: 22px;
        cursor: nwse-resize;
        border: 3px solid var(--color-border);
        border-radius: 0 0 10px 0;
        background: color-mix(in srgb, var(--color-border) 55%, transparent);
      }
      .dialog--disabled {
        pointer-events: none;
      }
    `,
  ],
})
export class DialogComponent {
  @Input({ required: true }) instance!: DialogInstance;
  @Input({ required: true }) bounds!: DOMRect;
  @Input() disabled = false;
  @Input() trashDisabled = false;
  @Input() title = '';

  @Output() moved = new EventEmitter<{ x: number; y: number }>();
  @Output() resized = new EventEmitter<{ width: number; height: number }>();
  @Output() minimize = new EventEmitter<void>();
  @Output() stash = new EventEmitter<void>();
  @Output() maximize = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() trash = new EventEmitter<void>();
  @Output() bringToFront = new EventEmitter<void>();
  @Output() titleEdited = new EventEmitter<string>();

  private dragStart?: { x: number; y: number; left: number; top: number };
  private resizeStart?: { x: number; y: number; width: number; height: number };
  isEditingTitle = false;
  titleDraft = '';

  onPointerDown(event: PointerEvent) {
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    this.bringToFront.emit();
  }

  startDrag(event: PointerEvent) {
    if (this.disabled) return;
    if (this.isEditingTitle) return;
    const target = event.target as HTMLElement;
    if (target.closest('input')) return;
    if (event.detail > 1 && target.closest('.dialog__title')) return;
    event.preventDefault();
    this.bringToFront.emit();
    this.dragStart = {
      x: event.clientX,
      y: event.clientY,
      left: this.instance.rect.x,
      top: this.instance.rect.y,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  startResize(event: PointerEvent) {
    if (this.disabled) return;
    event.preventDefault();
    this.bringToFront.emit();
    this.resizeStart = {
      x: event.clientX,
      y: event.clientY,
      width: this.instance.rect.width,
      height: this.instance.rect.height,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent) {
    if (this.dragStart) {
      const dx = event.clientX - this.dragStart.x;
      const dy = event.clientY - this.dragStart.y;
      this.moved.emit({ x: this.dragStart.left + dx, y: this.dragStart.top + dy });
    }
    if (this.resizeStart) {
      const dw = event.clientX - this.resizeStart.x;
      const dh = event.clientY - this.resizeStart.y;
      this.resized.emit({
        width: this.resizeStart.width + dw,
        height: this.resizeStart.height + dh,
      });
    }
  }

  @HostListener('window:pointerup')
  onPointerUp() {
    this.dragStart = undefined;
    this.resizeStart = undefined;
  }

  startTitleEdit() {
    this.isEditingTitle = true;
    this.titleDraft = this.title;
  }

  onTitleInput(event: Event) {
    this.titleDraft = (event.target as HTMLInputElement).value;
  }

  finishTitleEdit() {
    const next = this.titleDraft.trim();
    this.isEditingTitle = false;
    if (!next) return;
    this.titleEdited.emit(next);
  }

  cancelTitleEdit() {
    this.isEditingTitle = false;
    this.titleDraft = this.title;
  }
}
