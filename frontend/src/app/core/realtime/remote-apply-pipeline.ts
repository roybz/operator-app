import { isRemoteStorageTooManyRequests } from '../storage/remote-write-utils';

export interface RemoteApplyPipelineOptions {
  flush: (keys: string[]) => Promise<void>;
  minDelayMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  onError?: (error: unknown, keys: string[]) => void;
  onFlushStart?: (keys: string[]) => void;
  onFlushComplete?: (keys: string[]) => void;
}

const DEFAULT_MIN_DELAY_MS = 120;
const DEFAULT_BASE_BACKOFF_MS = 400;
const DEFAULT_MAX_BACKOFF_MS = 5_000;

export class RemoteApplyPipeline {
  private readonly pendingKeys = new Set<string>();
  private timer: number | null = null;
  private destroyed = false;
  private inFlight = false;
  private backoffMs = 0;

  private readonly minDelayMs: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(private readonly options: RemoteApplyPipelineOptions) {
    this.minDelayMs = options.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
    this.baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
    this.maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  }

  schedule(keys: string[], options?: { immediate?: boolean }) {
    if (this.destroyed || !keys.length) return;
    for (const key of keys) this.pendingKeys.add(key);
    const delay = options?.immediate ? 0 : Math.max(this.minDelayMs, this.backoffMs);
    this.scheduleFlush(delay);
  }

  clear() {
    this.pendingKeys.clear();
  }

  destroy() {
    this.destroyed = true;
    this.pendingKeys.clear();
    if (this.timer && typeof window !== 'undefined') {
      window.clearTimeout(this.timer);
    }
    this.timer = null;
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
    if (this.destroyed || this.inFlight || this.pendingKeys.size === 0) return;
    this.inFlight = true;
    try {
      while (!this.destroyed && this.pendingKeys.size > 0) {
        const keys = Array.from(this.pendingKeys).sort();
        this.pendingKeys.clear();
        this.options.onFlushStart?.(keys);
        try {
          await this.options.flush(keys);
          this.backoffMs = 0;
          this.options.onFlushComplete?.(keys);
        } catch (error) {
          if (isRemoteStorageTooManyRequests(error)) {
            this.backoffMs = Math.min(
              Math.max(this.backoffMs || this.baseBackoffMs, this.baseBackoffMs) * 2,
              this.maxBackoffMs,
            );
          } else {
            this.backoffMs = Math.min(
              Math.max(this.backoffMs || this.minDelayMs, this.minDelayMs),
              this.maxBackoffMs,
            );
          }
          this.options.onError?.(error, keys);
          for (const key of keys) this.pendingKeys.add(key);
          this.scheduleFlush(this.backoffMs);
          break;
        }
      }
    } finally {
      this.inFlight = false;
      if (!this.destroyed && this.pendingKeys.size > 0 && !this.timer) {
        this.scheduleFlush(Math.max(this.minDelayMs, this.backoffMs));
      }
    }
  }
}
