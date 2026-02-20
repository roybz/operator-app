import { StorageService } from '../../core/storage/storage.service';

export const buildInstanceStorageKey = (prefix: string, userId: string, instanceId: string) =>
  `${prefix}:${userId}:${instanceId}`;

export const clearInstanceScopedState = <T>(
  stateStore: Map<string, T>,
  storagePrefix: string,
  instanceId: string,
  storage: StorageService,
) => {
  stateStore.delete(instanceId);
  storage
    .keysSync()
    .filter((key) => key.startsWith(`${storagePrefix}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => void storage.removeItem(key));
};

export const cloneInstanceScopedState = <T>(
  stateStore: Map<string, T>,
  storagePrefix: string,
  fromId: string,
  toId: string,
  storage: StorageService,
  cloneState: (state: T) => T,
) => {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, cloneState(stored));
  storage
    .keysSync()
    .filter((key) => key.startsWith(`${storagePrefix}:`) && key.endsWith(`:${fromId}`))
    .forEach((key) => {
      const value = storage.getItemSync(key);
      if (value === null) return;
      const nextKey = key.replace(`:${fromId}`, `:${toId}`);
      void storage.setItem(nextKey, value);
    });
};

export const persistInstanceState = <T>(
  storagePrefix: string,
  userId: string,
  instanceId: string,
  state: T,
  storage: StorageService,
) =>
  void storage.setItem(
    buildInstanceStorageKey(storagePrefix, userId, instanceId),
    JSON.stringify(state),
  );
