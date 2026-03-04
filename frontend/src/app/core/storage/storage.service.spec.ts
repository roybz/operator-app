import { TestBed } from '@angular/core/testing';
import { STORAGE_ADAPTER, type StorageAdapter } from './storage-adapter';
import { StorageService } from './storage.service';

class FakeStorageAdapter implements StorageAdapter {
  store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async getItems(keys: string[]): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {};
    keys.forEach((key) => (out[key] = this.store.get(key) ?? null));
    return out;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

describe('StorageService', () => {
  let adapter: FakeStorageAdapter;
  let service: StorageService;

  beforeEach(async () => {
    adapter = new FakeStorageAdapter();
    await TestBed.configureTestingModule({
      providers: [{ provide: STORAGE_ADAPTER, useValue: adapter }],
    }).compileComponents();
    service = TestBed.inject(StorageService);
  });

  it('hydrates and reports changed keys from remote cache diffs', async () => {
    adapter.store.set('a', '1');
    adapter.store.set('b', '2');
    await service.hydrate();

    adapter.store.set('a', '3');
    adapter.store.delete('b');
    adapter.store.set('c', '4');

    const changed = await service.hydrateAndGetChangedKeys();

    expect(changed).toEqual(['a', 'b', 'c']);
    expect(service.lastRemoteChange()?.keys).toEqual(['a', 'b', 'c']);
  });

  it('returns no changed keys when remote state is unchanged', async () => {
    adapter.store.set('x', '1');
    await service.hydrate();

    const changed = await service.hydrateAndGetChangedKeys();

    expect(changed).toEqual([]);
    expect(service.lastRemoteChange()).toBeNull();
  });

  it('tracks last local mutation timestamps on set and remove', async () => {
    expect(service.getLastLocalMutationAt()).toBe(0);

    await service.setItem('k', 'v');
    const afterSet = service.getLastLocalMutationAt();
    expect(afterSet).toBeGreaterThan(0);

    await service.removeItem('k');
    expect(service.getLastLocalMutationAt()).toBeGreaterThanOrEqual(afterSet);
  });

  it('applies built-in storage migrations during hydrate', async () => {
    adapter.store.set('op_org_settings', '{not-json');
    adapter.store.set('op_login_phone_mode', '1');

    await service.hydrate();

    expect(adapter.store.has('op_org_settings')).toBe(false);
    expect(adapter.store.get('op_login_phone_mode')).toBe('true');
    expect(adapter.store.has('op_storage_migrations_v1')).toBe(true);
  });

  it('returns fallback for invalid validated json payloads', async () => {
    adapter.store.set('contract_key', JSON.stringify({ ok: false }));
    await service.hydrate();

    const value = service.getJsonSyncValidated('contract_key', { ok: true }, (raw): raw is { ok: true } => {
      return !!raw && typeof raw === 'object' && (raw as { ok?: unknown }).ok === true;
    });

    expect(value).toEqual({ ok: true });
  });
});
