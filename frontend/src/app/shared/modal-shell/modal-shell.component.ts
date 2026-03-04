import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="modal-shell__backdrop"
      [style.zIndex]="zIndex"
      (pointerdown)="onBackdropPointerDown()"
    >
      <div
        #panel
        class="modal-shell__panel"
        [style.maxWidth]="maxWidth"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="ariaLabelledBy ? null : ariaLabel"
        [attr.aria-labelledby]="ariaLabelledBy || null"
        [attr.aria-describedby]="ariaDescribedBy || null"
        tabindex="-1"
        (pointerdown)="$event.stopPropagation()"
      >
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .modal-shell__backdrop {
        position: fixed;
        inset: 0;
        background: var(--color-overlay);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-shell__panel {
        background: var(--color-surface);
        border-radius: 12px;
        max-height: min(90vh, 860px);
        overflow: auto;
      }
    `,
  ],
})
export class ModalShellComponent implements AfterViewInit {
  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  @Input() maxWidth = 'min(860px, calc(100vw - 32px))';
  @Input() zIndex = 2400;
  @Input() ariaLabel = 'Dialog';
  @Input() ariaLabelledBy?: string;
  @Input() ariaDescribedBy?: string;
  @Input() closeOnBackdrop = true;
  @Output() closed = new EventEmitter<void>();

  ngAfterViewInit() {
    queueMicrotask(() => this.panelRef?.nativeElement.focus());
  }

  onBackdropPointerDown() {
    if (!this.closeOnBackdrop) return;
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closed.emit();
  }
}
