import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ExportGuardService {
  private activeCount = signal(0);
  private readonly maxConcurrent = 2;

  canStart() {
    return this.activeCount() < this.maxConcurrent;
  }

  start() {
    if (!this.canStart()) return false;
    this.activeCount.set(this.activeCount() + 1);
    return true;
  }

  finish() {
    this.activeCount.set(Math.max(0, this.activeCount() - 1));
  }
}
