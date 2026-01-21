import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class InstanceSettingsService {
  private openIds = signal<Set<string>>(new Set());

  isOpen(instanceId: string) {
    return this.openIds().has(instanceId);
  }

  toggle(instanceId: string) {
    const next = new Set(this.openIds());
    if (next.has(instanceId)) {
      next.delete(instanceId);
    } else {
      next.add(instanceId);
    }
    this.openIds.set(next);
  }

  open(instanceId: string) {
    if (this.openIds().has(instanceId)) return;
    const next = new Set(this.openIds());
    next.add(instanceId);
    this.openIds.set(next);
  }

  close(instanceId: string) {
    if (!this.openIds().has(instanceId)) return;
    const next = new Set(this.openIds());
    next.delete(instanceId);
    this.openIds.set(next);
  }
}
