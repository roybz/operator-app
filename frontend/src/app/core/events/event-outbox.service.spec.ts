import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import { EventOutboxService } from './event-outbox.service';
import { OperatorEvent, UniverseEventHubService } from './universe-event-hub.service';

class StorageServiceMock {
  store = new Map<string, string>();
  failOnceByKey = new Map<string, Error>();

  async getJson<T>(key: string, fallback: T): Promise<T> {
    const raw = this.store.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  async setJson<T>(key: string, value: T): Promise<void> {
    const error = this.failOnceByKey.get(key);
    if (error) {
      this.failOnceByKey.delete(key);
      throw error;
    }
    this.store.set(key, JSON.stringify(value));
  }
}

describe('EventOutboxService', () => {
  const authMock = {
    storageUserKey: () => 'u_test:universe_active',
  };

  let storage: StorageServiceMock;
  let hub: UniverseEventHubService;
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    storage = new StorageServiceMock();
    TestBed.configureTestingModule({
      providers: [
        EventOutboxService,
        UniverseEventHubService,
        { provide: AuthService, useValue: authMock },
        { provide: StorageService, useValue: storage },
      ],
    });
    hub = TestBed.inject(UniverseEventHubService);
    TestBed.inject(EventOutboxService).ensureStarted();
  });

  it('persists durable domain events to the outbox', async () => {
    hub.publishDomain('u1', 'TodoCreated', { todoId: 't1' });

    await wait(20);

    const raw = storage.store.get('op_event_outbox_v1:u_test:u1');
    expect(raw).toBeTruthy();
    const events = JSON.parse(raw ?? '[]') as OperatorEvent[];
    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe('TodoCreated');
  });

  it('does not persist non-durable domain events', async () => {
    hub.publishDomain('u1', 'TransientSelectionChanged', { todoId: 't1' }, { durable: false });

    await wait(20);

    expect(storage.store.has('op_event_outbox_v1:u_test:u1')).toBe(false);
  });

  it('reconciles and retries when outbox persistence hits a version conflict', async () => {
    const key = 'op_event_outbox_v1:u_test:u1';
    const remoteEvent: OperatorEvent = {
      id: 'evt_remote',
      ts: Date.now() - 1000,
      universeId: 'u1',
      source: { agent: 'remote' },
      scope: 'domain',
      type: 'TodoCreated',
      payload: { todoId: 'remote' },
      durable: true,
    };
    storage.store.set(key, JSON.stringify([remoteEvent]));
    const conflict = Object.assign(new Error('version_conflict'), {
      code: 'version_conflict',
      status: 409,
    });
    storage.failOnceByKey.set(key, conflict);

    hub.publishDomain('u1', 'TodoCreated', { todoId: 'local' });

    await wait(500);

    const events = JSON.parse(storage.store.get(key) ?? '[]') as OperatorEvent[];
    expect(events.length).toBe(2);
    expect(events.some((event) => event.id === 'evt_remote')).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === 'TodoCreated' &&
          typeof event.payload === 'object' &&
          !!event.payload &&
          (event.payload as { todoId?: string }).todoId === 'local',
      ),
    ).toBe(true);
  });
});
