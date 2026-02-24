import { Injectable, inject, signal } from '@angular/core';
import { CognitoOidcService } from '../auth/cognito-oidc.service';
import { getOpConfig } from '../op-config';

type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class RealtimeSyncService {
  private cognitoOidc = inject(CognitoOidcService);
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private shouldBeConnected = false;
  private sessionNonce = '';
  private eventSeq = 0;
  private reconnectAttempt = 0;

  readonly status = signal<RealtimeStatus>('idle');
  readonly lastEvent = signal<{ seq: number; payload: RealtimeEvent } | null>(null);

  isConfigured() {
    const config = getOpConfig();
    return Boolean(config.realtimeEnabled && config.realtimeWsUrl);
  }

  async start() {
    this.shouldBeConnected = true;
    if (!this.isConfigured()) {
      this.status.set('idle');
      return;
    }
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
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
  }

  private async connect() {
    if (typeof window === 'undefined') return;
    const wsUrl = await this.buildUrl();
    if (!wsUrl) {
      this.status.set('idle');
      return;
    }
    this.status.set('connecting');
    const socket = new WebSocket(wsUrl);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.status.set('connected');
      this.reconnectAttempt = 0;
      this.clearReconnect();
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      const payload = this.parseEvent(event.data);
      if (!payload) return;
      this.eventSeq += 1;
      this.lastEvent.set({ seq: this.eventSeq, payload });
    };

    socket.onerror = () => {
      if (this.socket !== socket) return;
      this.status.set('disconnected');
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.status.set(this.shouldBeConnected ? 'disconnected' : 'idle');
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
    const attempt = this.reconnectAttempt++;
    const delayMs = Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 4));
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
}
