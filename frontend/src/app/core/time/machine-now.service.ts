import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MachineNowService {
  readonly now = signal(new Date());
  private timer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.scheduleNextTick();
    }
  }

  private scheduleNextTick() {
    const now = Date.now();
    const delay = 1000 - (now % 1000);
    this.timer = window.setTimeout(() => {
      this.now.set(new Date());
      this.scheduleNextTick();
    }, delay);
  }
}
