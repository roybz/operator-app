import { InstancePersistQueue } from './instance-persist-queue';

describe('InstancePersistQueue', () => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it('coalesces repeated schedules into one flush', async () => {
    let calls = 0;
    const queue = new InstancePersistQueue({
      flush: async () => {
        calls += 1;
      },
      minDelayMs: 20,
    });

    queue.schedule();
    queue.schedule();
    queue.schedule();

    await sleep(10);
    expect(calls).toBe(0);
    await sleep(25);
    expect(calls).toBe(1);
    queue.destroy();
  });

  it('retries with backoff on 429', async () => {
    let calls = 0;
    const queue = new InstancePersistQueue({
      flush: async () => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error('Too Many Requests'), { status: 429 });
        }
      },
      minDelayMs: 10,
      baseBackoffMs: 20,
      maxBackoffMs: 100,
    });

    queue.schedule({ immediate: true });
    await sleep(5);
    expect(calls).toBe(1);

    await sleep(10);
    expect(calls).toBe(1);
    await sleep(45);
    expect(calls).toBe(2);
    queue.destroy();
  });

  it('supports handled custom conflict errors without console spam', async () => {
    let onUnhandledErrorCalls = 0;
    let onErrorCalls = 0;
    const queue = new InstancePersistQueue({
      flush: async () => {
        throw Object.assign(new Error('version_conflict'), { status: 409 });
      },
      onError: async () => {
        onErrorCalls += 1;
        return 'handled' as const;
      },
      onUnhandledError: () => {
        onUnhandledErrorCalls += 1;
      },
      minDelayMs: 1,
    });

    queue.schedule({ immediate: true });
    await sleep(5);

    expect(onErrorCalls).toBe(1);
    expect(onUnhandledErrorCalls).toBe(0);
    queue.destroy();
  });

  it('stops timers on destroy', async () => {
    let calls = 0;
    const queue = new InstancePersistQueue({
      flush: async () => {
        calls += 1;
      },
      minDelayMs: 25,
    });

    queue.schedule();
    queue.destroy();
    await sleep(50);

    expect(calls).toBe(0);
  });
});
