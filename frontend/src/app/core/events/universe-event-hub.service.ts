import { Injectable } from '@angular/core';

export type EventScope = 'ui' | 'domain' | 'system';

export interface OperatorEventSource {
  instanceId?: string;
  actorId?: string;
  agent?: string;
}

export interface OperatorEvent<TType extends string = string, TPayload = unknown> {
  id: string;
  ts: number;
  universeId: string;
  source: OperatorEventSource;
  scope: EventScope;
  type: TType;
  payload: TPayload;
  durable?: boolean;
  correlationId?: string;
}

export interface EventSubscriptionFilter {
  universeId?: string;
  scope?: EventScope;
  type?: string;
  instanceId?: string;
  correlationId?: string;
  durable?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UniverseEventHubService {
  private readonly subscribers = new Map<
    number,
    {
      filter: EventSubscriptionFilter;
      handler: (event: OperatorEvent) => void;
    }
  >();
  private readonly recentByUniverse = new Map<string, OperatorEvent[]>();
  private subscriberId = 0;
  private readonly maxRecentPerUniverse = 200;

  publish(event: Omit<OperatorEvent, 'id' | 'ts'> & Partial<Pick<OperatorEvent, 'id' | 'ts'>>) {
    const next: OperatorEvent = {
      id: event.id ?? this.uid('evt'),
      ts: event.ts ?? Date.now(),
      universeId: event.universeId,
      source: event.source ?? {},
      scope: event.scope,
      type: event.type,
      payload: event.payload,
      durable: event.durable,
      correlationId: event.correlationId,
    };
    this.pushRecent(next);
    this.dispatch(next);
    return next;
  }

  publishSystem<TPayload>(
    universeId: string,
    type: string,
    payload: TPayload,
    source?: OperatorEventSource,
  ) {
    return this.publish({
      universeId,
      scope: 'system',
      type,
      payload,
      source: source ?? {},
      durable: false,
    });
  }

  publishDomain<TPayload>(
    universeId: string,
    type: string,
    payload: TPayload,
    options?: {
      source?: OperatorEventSource;
      durable?: boolean;
      correlationId?: string;
    },
  ) {
    return this.publish({
      universeId,
      scope: 'domain',
      type,
      payload,
      source: options?.source ?? {},
      durable: options?.durable ?? true,
      correlationId: options?.correlationId,
    });
  }

  subscribe(handler: (event: OperatorEvent) => void, filter: EventSubscriptionFilter = {}) {
    const id = ++this.subscriberId;
    this.subscribers.set(id, { filter, handler });
    return () => {
      this.subscribers.delete(id);
    };
  }

  getRecentEvents(universeId: string) {
    return [...(this.recentByUniverse.get(universeId) ?? [])];
  }

  clearRecentEvents(universeId: string) {
    this.recentByUniverse.delete(universeId);
  }

  private dispatch(event: OperatorEvent) {
    this.subscribers.forEach(({ filter, handler }) => {
      if (!this.matches(filter, event)) return;
      handler(event);
    });
  }

  private matches(filter: EventSubscriptionFilter, event: OperatorEvent) {
    if (filter.universeId && filter.universeId !== event.universeId) return false;
    if (filter.scope && filter.scope !== event.scope) return false;
    if (filter.type && filter.type !== event.type) return false;
    if (filter.instanceId && filter.instanceId !== event.source.instanceId) return false;
    if (filter.correlationId && filter.correlationId !== event.correlationId) return false;
    if (typeof filter.durable === 'boolean' && filter.durable !== Boolean(event.durable))
      return false;
    return true;
  }

  private pushRecent(event: OperatorEvent) {
    const current = this.recentByUniverse.get(event.universeId) ?? [];
    current.push(event);
    if (current.length > this.maxRecentPerUniverse) {
      current.splice(0, current.length - this.maxRecentPerUniverse);
    }
    this.recentByUniverse.set(event.universeId, current);
  }

  private uid(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
