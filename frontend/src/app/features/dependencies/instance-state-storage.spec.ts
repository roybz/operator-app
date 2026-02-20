import {
  buildInstanceStorageKey,
  clearInstanceScopedState,
  cloneInstanceScopedState,
} from './instance-state-storage';

class MockStorage {
  private map = new Map<string, string>();

  keysSync() {
    return Array.from(this.map.keys());
  }

  getItemSync(key: string) {
    return this.map.get(key) ?? null;
  }

  removeItem(key: string) {
    this.map.delete(key);
    return Promise.resolve();
  }

  setItem(key: string, value: string) {
    this.map.set(key, value);
    return Promise.resolve();
  }
}

describe('instance-state-storage', () => {
  it('builds deterministic storage keys', () => {
    expect(buildInstanceStorageKey('prefix', 'u1', 'i1')).toBe('prefix:u1:i1');
  });

  it('clears map entry and matching storage keys for one instance', () => {
    const store = new Map<string, { a: number }>([
      ['inst-a', { a: 1 }],
      ['inst-b', { a: 2 }],
    ]);
    const storage = new MockStorage();
    void storage.setItem('prefix:u1:inst-a', '{"a":1}');
    void storage.setItem('prefix:u2:inst-a', '{"a":1}');
    void storage.setItem('prefix:u1:inst-b', '{"a":2}');

    clearInstanceScopedState(store, 'prefix', 'inst-a', storage as never);

    expect(store.has('inst-a')).toBe(false);
    expect(store.has('inst-b')).toBe(true);
    expect(storage.getItemSync('prefix:u1:inst-a')).toBeNull();
    expect(storage.getItemSync('prefix:u2:inst-a')).toBeNull();
    expect(storage.getItemSync('prefix:u1:inst-b')).toBe('{"a":2}');
  });

  it('clones map and storage entries for another instance id', () => {
    const store = new Map<string, { list: string[] }>([['inst-a', { list: ['x'] }]]);
    const storage = new MockStorage();
    void storage.setItem('prefix:u1:inst-a', '{"list":["x"]}');

    cloneInstanceScopedState(store, 'prefix', 'inst-a', 'inst-b', storage as never, (state) => ({
      list: [...state.list, 'y'],
    }));

    expect(store.get('inst-b')).toEqual({ list: ['x', 'y'] });
    expect(storage.getItemSync('prefix:u1:inst-b')).toBe('{"list":["x"]}');
  });
});
