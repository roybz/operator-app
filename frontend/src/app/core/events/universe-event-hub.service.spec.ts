import { UniverseEventHubService } from './universe-event-hub.service';

describe('UniverseEventHubService', () => {
  it('publishes and filters events by universe/type/scope', () => {
    const hub = new UniverseEventHubService();
    const seen: string[] = [];
    const unsub = hub.subscribe(
      (event) => {
        seen.push(event.type);
      },
      { universeId: 'u1', scope: 'system', type: 'RemoteInvalidationReceived' },
    );

    hub.publishSystem('u1', 'RemoteInvalidationReceived', { keys: ['a'] });
    hub.publishSystem('u2', 'RemoteInvalidationReceived', { keys: ['b'] });
    hub.publishSystem('u1', 'PersistFlushCompleted', { key: 'x' });

    expect(seen).toEqual(['RemoteInvalidationReceived']);
    unsub();
  });

  it('keeps a bounded recent ring buffer per universe', () => {
    const hub = new UniverseEventHubService();
    for (let i = 0; i < 260; i += 1) {
      hub.publishSystem('u1', `evt-${i}`, { i });
    }
    const recent = hub.getRecentEvents('u1');
    expect(recent.length).toBe(200);
    expect(recent[0]?.type).toBe('evt-60');
    expect(recent[199]?.type).toBe('evt-259');
  });

  it('supports durable domain publishing and durable filtering', () => {
    const hub = new UniverseEventHubService();
    const seen: string[] = [];
    hub.subscribe(
      (event) => {
        seen.push(event.type);
      },
      { universeId: 'u1', scope: 'domain', durable: true },
    );

    hub.publishDomain('u1', 'TodoCreated', { todoId: 't1' });
    hub.publishDomain('u1', 'SelectionChanged', { todoId: 't1' }, { durable: false });

    expect(seen).toEqual(['TodoCreated']);
  });
});
