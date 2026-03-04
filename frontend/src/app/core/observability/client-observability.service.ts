import { Injectable } from '@angular/core';

interface ObservabilityLogEvent {
  level: 'info' | 'warn' | 'error';
  event: string;
  details?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class ClientObservabilityService {
  private readonly sessionId = this.createId('sess');
  private errorWindowStartMs = 0;
  private errorCountInWindow = 0;

  getSessionId() {
    return this.sessionId;
  }

  nextRequestId(prefix = 'req') {
    return this.createId(prefix);
  }

  logInfo(event: string, details?: Record<string, unknown>) {
    this.log({ level: 'info', event, details });
  }

  logWarn(event: string, details?: Record<string, unknown>) {
    this.log({ level: 'warn', event, details });
  }

  logError(event: string, details?: Record<string, unknown>) {
    const now = Date.now();
    if (now - this.errorWindowStartMs > 10_000) {
      this.errorWindowStartMs = now;
      this.errorCountInWindow = 0;
    }
    this.errorCountInWindow += 1;
    if (this.errorCountInWindow > 20) return;
    this.log({ level: 'error', event, details });
  }

  private log(payload: ObservabilityLogEvent) {
    const data = {
      t: Date.now(),
      sessionId: this.sessionId,
      ...payload,
    };
    if (payload.level === 'error') {
      console.error('[obs]', data);
      return;
    }
    if (payload.level === 'warn') {
      console.warn('[obs]', data);
      return;
    }
    console.info('[obs]', data);
  }

  private createId(prefix: string) {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
