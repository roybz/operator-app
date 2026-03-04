import {
  getRemoteStorageRetryAfterMs,
  isRemoteStorageTooManyRequests,
  isRemoteStorageVersionConflict,
} from '../storage/remote-write-utils';

export type PersistQueueErrorAction = 'handled' | 'retry';

export interface InstancePersistQueueOptions {
  flush: () => Promise<void>;
  minDelayMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  isTooManyRequests?: (error: unknown) => boolean;
  onError?: (
    error: unknown,
  ) => PersistQueueErrorAction | void | Promise<PersistQueueErrorAction | void>;
  onUnhandledError?: (error: unknown) => void;
}

const DEFAULT_MIN_DELAY_MS = 180;
const DEFAULT_BASE_BACKOFF_MS = 200;
const DEFAULT_MAX_BACKOFF_MS = 2000;

export class InstancePersistQueue {
  private timer: number | null = null;
  private inFlight = false;
  private queued = false;
  private backoffMs = 0;
  private destroyed = false;

  private readonly minDelayMs: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly isTooManyRequestsFn: (error: unknown) => boolean;
  private readonly onErrorFn?: InstancePersistQueueOptions['onError'];
  private readonly onUnhandledErrorFn: (error: unknown) => void;

  constructor(private readonly options: InstancePersistQueueOptions) {
    this.minDelayMs = options.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
    this.baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
    this.maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.isTooManyRequestsFn = options.isTooManyRequests ?? isRemoteStorageTooManyRequests;
    this.onErrorFn = options.onError;
    this.onUnhandledErrorFn = options.onUnhandledError ?? ((error) => console.error(error));
  }

  schedule(options?: { immediate?: boolean }) {
    if (this.destroyed) return;
    this.queued = true;
    const delay = options?.immediate ? 0 : Math.max(this.minDelayMs, this.backoffMs);
    this.scheduleFlush(delay);
  }

  destroy() {
    this.destroyed = true;
    if (this.timer && typeof window !== 'undefined') {
      window.clearTimeout(this.timer);
    }
    this.timer = null;
    this.queued = false;
  }

  private scheduleFlush(delayMs: number) {
    if (this.destroyed) return;
    if (typeof window === 'undefined') {
      void this.flushLoop();
      return;
    }
    if (this.timer) {
      if (delayMs <= 0) return;
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.flushLoop();
    }, delayMs);
  }

  private async flushLoop() {
    if (this.destroyed || this.inFlight || !this.queued) return;
    this.inFlight = true;
    try {
      while (!this.destroyed && this.queued) {
        this.queued = false;
        try {
          await this.options.flush();
          this.backoffMs = 0;
        } catch (error) {
          if (this.isTooManyRequestsFn(error)) {
            const exponentialBackoffMs = Math.min(
              Math.max(this.backoffMs || this.baseBackoffMs, this.baseBackoffMs) * 2,
              this.maxBackoffMs,
            );
            const retryAfterMs = getRemoteStorageRetryAfterMs(error) ?? 0;
            this.backoffMs = Math.min(Math.max(exponentialBackoffMs, retryAfterMs), this.maxBackoffMs);
            this.queued = true;
            this.scheduleFlush(this.backoffMs);
            break;
          }
          const action = await this.onErrorFn?.(error);
          if (action === 'retry') {
            this.queued = true;
            this.scheduleFlush(Math.max(this.minDelayMs, this.backoffMs));
            break;
          }
          if (action !== 'handled') {
            this.onUnhandledErrorFn(error);
          }
          break;
        }
      }
    } finally {
      this.inFlight = false;
      if (!this.destroyed && this.queued && !this.timer) {
        this.scheduleFlush(Math.max(this.minDelayMs, this.backoffMs));
      }
    }
  }
}

export { isRemoteStorageTooManyRequests, isRemoteStorageVersionConflict };
