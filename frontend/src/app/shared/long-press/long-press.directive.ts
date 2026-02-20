import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Directive({
  selector: '[appLongPress]',
  standalone: true,
})
export class LongPressDirective {
  @Input() longPressDelay = 550;
  @Input() longPressEnabled = true;
  @Input() longPressMoveTolerance = 8;
  @Output() longPress = new EventEmitter<PointerEvent>();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private startX = 0;
  private startY = 0;
  private active = false;

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent) {
    if (!this.longPressEnabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.active = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.clearTimer();
    this.timer = setTimeout(() => {
      if (!this.active) return;
      this.longPress.emit(event);
      this.clearTimer();
    }, this.longPressDelay);
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent) {
    if (!this.active) return;
    const dx = Math.abs(event.clientX - this.startX);
    const dy = Math.abs(event.clientY - this.startY);
    if (dx > this.longPressMoveTolerance || dy > this.longPressMoveTolerance) {
      this.cancel();
    }
  }

  @HostListener('pointerup')
  onPointerUp() {
    this.cancel();
  }

  @HostListener('pointercancel')
  onPointerCancel() {
    this.cancel();
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.cancel();
  }

  private cancel() {
    this.active = false;
    this.clearTimer();
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
