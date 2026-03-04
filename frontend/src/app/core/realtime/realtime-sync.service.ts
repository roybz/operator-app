import { Injectable, inject, signal } from '@angular/core';
import { CognitoOidcService } from '../auth/cognito-oidc.service';
import { getOpCapabilities, getOpConfig } from '../op-config';
import { UniverseEventHubService } from '../events/universe-event-hub.service';
import { ClientObservabilityService } from '../observability/client-observability.service';

type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';
export type RealtimeConnectivityState =
  | 'idle'
  | 'connected'
  | 'degraded-polling'
  | 'offline-buffering'
  | 'reconciling';

interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

interface BufferedWrite {
  key: string;
  run: () => Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class RealtimeSyncService {
  private cognitoOidc = inject(CognitoOidcService);
  private eventHub = inject(UniverseEventHubService);
  private observability = inject(ClientObservabilityService);
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private shouldBeConnected = false;
  private sessionNonce = '';
  private eventSeq = 0;
  private reconnectAttempt = 0;
  private reconnectWindowStart = 0;
  private reconnectWindowAttempts = 0;
  private readonly bufferedWrites: BufferedWrite[] = [];
  private flushingBufferedWrites = false;

  readonly status = signal<RealtimeStatus>('idle');
  readonly connectivity = signal<RealtimeConnectivityState>('idle');
  readonly lastEvent = signal<{ seq: number; payload: RealtimeEvent } | null>(null);

  isConfigured() {
    const config = getOpConfig();
    const capabilities = getOpCapabilities(config);
    return Boolean(capabilities.realtime && config.realtimeEnabled && config.realtimeWsUrl);
  }

  async start() {
    this.shouldBeConnected = true;
    if (!this.isConfigured()) {
      this.status.set('idle');
      this.connectivity.set('idle');
      return;
    }
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    await this.connect();
  }

  stop() {
    this.shouldBeConnected = false;
    this.clearReconnect();
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.status.set('idle');
    this.connectivity.set('idle');
  }

  async enqueueBufferedWrite(key: string, run: () => Promise<void>) {
    if (this.connectivity() === 'connected') {
      await run();
      return;
    }
    this.bufferedWrites.push({ key, run });
    this.connectivity.set('offline-buffering');
    this.observability.logWarn('realtime.buffered_write_queued', {
      key,
      queueDepth: this.bufferedWrites.length,
    });
  }

  private async connect() {
    if (typeof window === 'undefined') return;
    const wsUrl = await this.buildUrl();
    if (!wsUrl) {
      this.status.set('idle');
      this.connectivity.set('idle');
      return;
    }
    this.status.set('connecting');
    this.observability.logInfo('realtime.connecting');
    const socket = new WebSocket(wsUrl);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.status.set('connected');
      this.connectivity.set(this.bufferedWrites.length ? 'reconciling' : 'connected');
      this.observability.logInfo('realtime.connected', { reconnectAttempt: this.reconnectAttempt });
      this.reconnectAttempt = 0;
      this.reconnectWindowStart = 0;
      this.reconnectWindowAttempts = 0;
      this.clearReconnect();
      void this.flushBufferedWrites();
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      const payload = this.parseEvent(event.data);
      if (!payload) return;
      this.eventSeq += 1;
      this.lastEvent.set({ seq: this.eventSeq, payload });
      const payloadUniverseId = payload['universeId'];
      const universeId =
        typeof payloadUniverseId === 'string' && payloadUniverseId.trim()
          ? payloadUniverseId
          : 'default';
      if (universeId) {
        this.eventHub.publishSystem(
          universeId,
          'RemoteInvalidationReceived',
          { payload, seq: this.eventSeq },
          { agent: 'realtime-sync' },
        );
      }
    };

    socket.onerror = () => {
      if (this.socket !== socket) return;
      this.status.set('disconnected');
      this.connectivity.set('degraded-polling');
      this.observability.logWarn('realtime.socket_error');
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.status.set(this.shouldBeConnected ? 'disconnected' : 'idle');
      this.connectivity.set(this.shouldBeConnected ? 'degraded-polling' : 'idle');
      this.observability.logWarn('realtime.closed', { shouldReconnect: this.shouldBeConnected });
      if (this.shouldBeConnected) this.scheduleReconnect();
    };
  }

  private async buildUrl() {
    const config = getOpConfig();
    const raw = String(config.realtimeWsUrl ?? '').trim();
    if (!raw) return '';
    const url = new URL(raw);
    const token = await this.cognitoOidc.getAccessToken();
    if (token) {
      url.searchParams.set('access_token', token);
    }
    if (!this.sessionNonce) {
      this.sessionNonce = Math.random().toString(36).slice(2, 10);
    }
    url.searchParams.set('client', this.sessionNonce);
    return url.toString();
  }

  private scheduleReconnect() {
    if (typeof window === 'undefined') return;
    if (this.reconnectTimer) return;
    const tuning = this.getReconnectTuning();
    const now = Date.now();
    if (!this.reconnectWindowStart || now - this.reconnectWindowStart > tuning.windowMs) {
      this.reconnectWindowStart = now;
      this.reconnectWindowAttempts = 0;
    }
    this.reconnectWindowAttempts += 1;
    const attempt = this.reconnectAttempt++;
    const baseDelayMs = Math.min(
      tuning.maxDelayMs,
      tuning.baseDelayMs * 2 ** Math.min(attempt, tuning.exponentCap),
    );
    const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(baseDelayMs * 0.25)));
    let delayMs = baseDelayMs + jitter;
    if (this.reconnectWindowAttempts > tuning.stormThreshold) {
      delayMs = Math.max(delayMs, tuning.stormDelayMs);
      this.connectivity.set('degraded-polling');
      this.observability.logWarn('realtime.reconnect_storm_guard', {
        attempt,
        reconnectWindowAttempts: this.reconnectWindowAttempts,
        delayMs,
      });
    }
    this.observability.logInfo('realtime.reconnect_scheduled', { attempt, delayMs, jitter });
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldBeConnected) return;
      void this.connect();
    }, delayMs);
  }

  private clearReconnect() {
    if (this.reconnectTimer && typeof window !== 'undefined') {
      window.clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = null;
  }

  private parseEvent(data: unknown): RealtimeEvent | null {
    if (typeof data !== 'string') return null;
    try {
      const parsed = JSON.parse(data) as RealtimeEvent;
      if (!parsed || typeof parsed.type !== 'string') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private async flushBufferedWrites() {
    if (this.flushingBufferedWrites) return;
    if (!this.bufferedWrites.length) {
      this.connectivity.set('connected');
      return;
    }
    this.flushingBufferedWrites = true;
    try {
      while (this.bufferedWrites.length) {
        const next = this.bufferedWrites.shift();
        if (!next) break;
        await next.run();
      }
      this.connectivity.set('connected');
      this.observability.logInfo('realtime.buffered_write_flush_completed');
    } catch (error) {
      this.connectivity.set('offline-buffering');
      this.observability.logWarn('realtime.buffered_write_flush_failed', {
        message: error instanceof Error ? error.message : 'unknown_error',
      });
    } finally {
      this.flushingBufferedWrites = false;
    }
  }

  private getReconnectTuning() {
    const cfg = getOpConfig();
    return {
      baseDelayMs: this.sanitizePositiveInt(cfg.realtimeReconnectBaseDelayMs, 2_000),
      maxDelayMs: this.sanitizePositiveInt(cfg.realtimeReconnectMaxDelayMs, 60_000),
      exponentCap: this.sanitizePositiveInt(cfg.realtimeReconnectExponentCap, 4),
      windowMs: this.sanitizePositiveInt(cfg.realtimeReconnectStormWindowMs, 60_000),
      stormThreshold: this.sanitizePositiveInt(cfg.realtimeReconnectStormThreshold, 8),
      stormDelayMs: this.sanitizePositiveInt(cfg.realtimeReconnectStormDelayMs, 60_000),
    };
  }

  private sanitizePositiveInt(value: unknown, fallback: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return Math.floor(numeric);
  }
}
