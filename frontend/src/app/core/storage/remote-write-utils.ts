import {
  getKeySpaceConflictPolicy,
  getKeySpaceConflictStrategy,
} from '../realtime/key-space-conflict-strategy';

export type StorageKeyClass = 'durable' | 'ephemeral';

export function classifyStorageKey(key: string): StorageKeyClass {
  return getKeySpaceConflictStrategy(key) === 'ephemeral-ignore-conflict' ? 'ephemeral' : 'durable';
}

export function isRemoteStorageVersionConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  const maybeCode = (error as Error & { code?: unknown }).code;
  const maybeStatus = (error as Error & { status?: unknown }).status;
  const code = typeof maybeCode === 'string' ? maybeCode : '';
  const status = typeof maybeStatus === 'number' ? maybeStatus : null;
  const message = String(error.message || '');
  return status === 409 || code === 'version_conflict' || message.includes('version_conflict');
}

export function isRemoteStorageTooManyRequests(error: unknown) {
  if (!(error instanceof Error)) return false;
  const maybeCode = (error as Error & { code?: unknown }).code;
  const maybeStatus = (error as Error & { status?: unknown }).status;
  const code = typeof maybeCode === 'string' ? maybeCode : '';
  const status = typeof maybeStatus === 'number' ? maybeStatus : null;
  const message = String(error.message || '');
  return status === 429 || code === 'too_many_requests' || message.includes('Too Many Requests');
}

export function shouldIgnoreConflictForKey(key: string, error: unknown) {
  return (
    getKeySpaceConflictPolicy(key).ignoreVersionConflict && isRemoteStorageVersionConflict(error)
  );
}

export interface WriteWithRetryOptions {
  key: string;
  serialized: string;
  write: (serialized: string) => Promise<void>;
  getCurrentSerialized: () => string | null;
  refresh?: () => Promise<void>;
  maxRetries?: number;
  retryDelayMs?: number;
}

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, delayMs)));

export async function writeWithConflictRetry(options: WriteWithRetryOptions) {
  const { key, serialized, write, getCurrentSerialized, refresh } = options;
  const keyPolicy = getKeySpaceConflictPolicy(key);
  const maxRetries = options.maxRetries ?? keyPolicy.maxRetries;
  const retryDelayMs = options.retryDelayMs ?? keyPolicy.baseRetryDelayMs;
  if (getCurrentSerialized() === serialized) return 'skipped' as const;

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      await write(serialized);
      return 'written' as const;
    } catch (error) {
      if (shouldIgnoreConflictForKey(key, error)) return 'ignored_ephemeral_conflict' as const;

      const retryable =
        isRemoteStorageVersionConflict(error) || isRemoteStorageTooManyRequests(error);
      if (!retryable || attempt >= maxRetries) throw error;

      try {
        await refresh?.();
      } catch {
        // Best-effort refresh only; retry still proceeds.
      }
      if (getCurrentSerialized() === serialized) return 'skipped' as const;

      attempt += 1;
      await sleep(retryDelayMs * attempt);
    }
  }

  return 'skipped' as const;
}
