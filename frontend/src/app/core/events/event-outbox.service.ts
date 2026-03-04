import { Injectable, OnDestroy, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import {
  InstancePersistQueue,
  PersistQueueErrorAction,
  isRemoteStorageTooManyRequests,
  isRemoteStorageVersionConflict,
} from '../realtime/instance-persist-queue';
import { OperatorEvent, UniverseEventHubService } from './universe-event-hub.service';

const EVENT_OUTBOX_KEY = 'op_event_outbox_v1';
const MAX_OUTBOX_EVENTS = 500;

@Injectable({ providedIn: 'root' })
export class EventOutboxService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly eventHub = inject(UniverseEventHubService);

  private readonly outboxByStorageKey = new Map<string, OperatorEvent[]>();
  private readonly loadedStorageKeys = new Set<string>();
  private readonly queueByStorageKey = new Map<string, InstancePersistQueue>();
  private readonly unsubscribeHub: () => void;

  constructor() {
    this.unsubscribeHub = this.eventHub.subscribe(
      (event) => {
        if (event.scope !== 'domain' || !event.durable) return;
        void this.enqueueDurableEvent(event);
      },
      { scope: 'domain', durable: true },
    );
  }

  ensureStarted() {
    // no-op: this service starts when first injected.
  }

  ngOnDestroy() {
    this.unsubscribeHub();
    this.queueByStorageKey.forEach((queue) => queue.destroy());
    this.queueByStorageKey.clear();
  }

  getOutboxSnapshot(universeId: string) {
    const key = this.storageKeyForUniverse(universeId);
    return [...(this.outboxByStorageKey.get(key) ?? [])];
  }

  private async enqueueDurableEvent(event: OperatorEvent) {
    const storageKey = this.storageKeyForUniverse(event.universeId);
    await this.ensureLoaded(storageKey);
    const current = [...(this.outboxByStorageKey.get(storageKey) ?? [])];
    if (current.some((item) => item.id === event.id)) return;
    current.push(event);
    this.outboxByStorageKey.set(storageKey, this.normalizeOutbox(current));
    this.persistQueue(storageKey).schedule({ immediate: true });
  }

  private async ensureLoaded(storageKey: string) {
    if (this.loadedStorageKeys.has(storageKey)) return;
    this.loadedStorageKeys.add(storageKey);
    const parsed = await this.storage.getJson<OperatorEvent[]>(storageKey, []);
    this.outboxByStorageKey.set(storageKey, this.normalizeOutbox(parsed));
  }

  private persistQueue(storageKey: string) {
    const existing = this.queueByStorageKey.get(storageKey);
    if (existing) return existing;
    const queue = new InstancePersistQueue({
      flush: async () => {
        await this.storage.setJson(storageKey, this.outboxByStorageKey.get(storageKey) ?? []);
        this.eventHub.publishSystem(
          this.universeIdFromStorageKey(storageKey) ?? 'default',
          'EventOutboxFlushed',
          { key: storageKey, count: this.outboxByStorageKey.get(storageKey)?.length ?? 0 },
          { agent: 'event-outbox' },
        );
      },
      isTooManyRequests: isRemoteStorageTooManyRequests,
      onError: async (error) => {
        if (!isRemoteStorageVersionConflict(error)) return undefined;
        const remote = await this.storage.getJson<OperatorEvent[]>(storageKey, []);
        const local = this.outboxByStorageKey.get(storageKey) ?? [];
        const merged = this.normalizeOutbox([...remote, ...local]);
        this.outboxByStorageKey.set(storageKey, merged);
        this.eventHub.publishSystem(
          this.universeIdFromStorageKey(storageKey) ?? 'default',
          'EventOutboxConflictReconciled',
          { key: storageKey, count: merged.length },
          { agent: 'event-outbox' },
        );
        return 'retry' as PersistQueueErrorAction;
      },
      onUnhandledError: (error) => console.error(error),
    });
    this.queueByStorageKey.set(storageKey, queue);
    return queue;
  }

  private normalizeOutbox(events: OperatorEvent[]) {
    const byId = new Map<string, OperatorEvent>();
    events.forEach((event) => {
      if (!event || typeof event.id !== 'string' || !event.id) return;
      byId.set(event.id, event);
    });
    const deduped = Array.from(byId.values()).sort((a, b) => a.ts - b.ts);
    if (deduped.length <= MAX_OUTBOX_EVENTS) return deduped;
    return deduped.slice(deduped.length - MAX_OUTBOX_EVENTS);
  }

  private storageKeyForUniverse(universeId: string) {
    const sessionKey = this.auth.storageUserKey();
    const [userId] = sessionKey.split(':');
    const safeUserId = userId || 'anonymous';
    return `${EVENT_OUTBOX_KEY}:${safeUserId}:${universeId}`;
  }

  private universeIdFromStorageKey(storageKey: string) {
    const parts = storageKey.split(':');
    return parts.length >= 4 ? parts[3] : null;
  }
}
