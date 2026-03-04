import { vi } from 'vitest';
import { RemoteApplyPipeline } from './remote-apply-pipeline';

describe('RemoteApplyPipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces keys and flushes once', async () => {
    const flush = vi.fn(async () => {
      // test double
    });
    const pipeline = new RemoteApplyPipeline({ flush, minDelayMs: 10 });

    pipeline.schedule(['a', 'b']);
    pipeline.schedule(['b', 'c']);
    await vi.advanceTimersByTimeAsync(20);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(['a', 'b', 'c']);
    pipeline.destroy();
  });

  it('retries with backoff after throttling errors', async () => {
    let calls = 0;
    const flush = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw Object.assign(new Error('Too Many Requests'), { status: 429 });
      }
    });
    const pipeline = new RemoteApplyPipeline({
      flush,
      minDelayMs: 5,
      baseBackoffMs: 50,
      maxBackoffMs: 200,
    });

    pipeline.schedule(['k1']);
    await vi.advanceTimersByTimeAsync(10);
    expect(flush).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(120);
    expect(flush).toHaveBeenCalledTimes(2);
    pipeline.destroy();
  });
});
