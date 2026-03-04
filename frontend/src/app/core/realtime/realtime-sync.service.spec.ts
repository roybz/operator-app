import { TestBed } from '@angular/core/testing';
import { CognitoOidcService } from '../auth/cognito-oidc.service';
import { RealtimeSyncService } from './realtime-sync.service';

class MockCognitoOidcService {
  async getAccessToken() {
    return 'token-123';
  }
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;

  constructor(public url: string | URL) {
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  message(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }
}

describe('RealtimeSyncService', () => {
  let originalWebSocket: typeof WebSocket;
  let originalConfig: unknown;

  beforeEach(async () => {
    originalWebSocket = globalThis.WebSocket;
    originalConfig = (window as Window & { __OP_CONFIG__?: unknown }).__OP_CONFIG__;
    (globalThis as { WebSocket: typeof WebSocket }).WebSocket =
      MockWebSocket as unknown as typeof WebSocket;
    MockWebSocket.reset();
    await TestBed.configureTestingModule({
      providers: [{ provide: CognitoOidcService, useClass: MockCognitoOidcService }],
    }).compileComponents();
  });

  afterEach(() => {
    (globalThis as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
    (window as Window & { __OP_CONFIG__?: unknown }).__OP_CONFIG__ = originalConfig;
  });

  it('does not connect when realtime is disabled', async () => {
    (window as Window & { __OP_CONFIG__?: unknown }).__OP_CONFIG__ = {
      realtimeEnabled: false,
      realtimeWsUrl: 'wss://example.test/ws',
    };
    const service = TestBed.inject(RealtimeSyncService);

    await service.start();

    expect(service.status()).toBe('idle');
    expect(MockWebSocket.instances.length).toBe(0);
  });

  it('connects with token and client query params and emits parsed events', async () => {
    (window as Window & { __OP_CONFIG__?: unknown }).__OP_CONFIG__ = {
      realtimeEnabled: true,
      realtimeWsUrl: 'wss://example.test/ws',
    };
    const service = TestBed.inject(RealtimeSyncService);

    await service.start();
    expect(MockWebSocket.instances.length).toBe(1);
    const socket = MockWebSocket.instances[0];
    const url = new URL(String(socket.url));
    expect(url.searchParams.get('access_token')).toBe('token-123');
    expect(url.searchParams.get('client')).toBeTruthy();

    socket.open();
    expect(service.status()).toBe('connected');

    socket.message(JSON.stringify({ type: 'storage.changed', keys: ['a'] }));
    expect(service.lastEvent()?.payload.type).toBe('storage.changed');

    socket.message('not-json');
    expect(service.lastEvent()?.payload.type).toBe('storage.changed');
  });

  it('reconnects after close while started and stops reconnecting after stop()', async () => {
    (window as Window & { __OP_CONFIG__?: unknown }).__OP_CONFIG__ = {
      realtimeEnabled: true,
      realtimeWsUrl: 'wss://example.test/ws',
    };
    const service = TestBed.inject(RealtimeSyncService);

    await service.start();
    expect(MockWebSocket.instances.length).toBe(1);
    const socket1 = MockWebSocket.instances[0];
    socket1.open();
    socket1.close();
    expect(service.connectivity()).toBe('degraded-polling');

    await new Promise((resolve) => setTimeout(resolve, 2800));
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);

    service.stop();
    const socket2 = MockWebSocket.instances.at(-1);
    expect(socket2).toBeTruthy();
    if (!socket2) return;
    socket2.close();
    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);
    expect(service.status()).toBe('idle');
    expect(service.connectivity()).toBe('idle');
  });

  it('buffers writes while offline and flushes in order on reconnect', async () => {
    (window as Window & { __OP_CONFIG__?: unknown }).__OP_CONFIG__ = {
      realtimeEnabled: true,
      realtimeWsUrl: 'wss://example.test/ws',
    };
    const service = TestBed.inject(RealtimeSyncService);
    const writes: string[] = [];

    await service.enqueueBufferedWrite('a', async () => {
      writes.push('a');
    });
    await service.enqueueBufferedWrite('b', async () => {
      writes.push('b');
    });
    expect(service.connectivity()).toBe('offline-buffering');

    await service.start();
    const socket = MockWebSocket.instances[0];
    socket.open();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(writes).toEqual(['a', 'b']);
    expect(service.connectivity()).toBe('connected');
  });
});
