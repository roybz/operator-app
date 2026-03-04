import { TestBed } from '@angular/core/testing';
import { ContextFieldStoreService } from './context-field-store.service';
import { ObjectRef } from './context-fields.types';
import { UniverseEventHubService } from './universe-event-hub.service';

describe('ContextFieldStoreService', () => {
  let hub: UniverseEventHubService;
  let store: ContextFieldStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UniverseEventHubService, ContextFieldStoreService],
    });
    hub = TestBed.inject(UniverseEventHubService);
    store = TestBed.inject(ContextFieldStoreService);
  });

  it('publishes and stores selection with primary ref', () => {
    const refA: ObjectRef = {
      universeId: 'u1',
      instanceId: 'todo-1',
      kind: 'todo',
      id: 't1',
    };
    const refB: ObjectRef = {
      universeId: 'u1',
      instanceId: 'todo-1',
      kind: 'todo',
      id: 't2',
    };

    store.setSelection('u1', [refA, refB], {
      primaryRef: refB,
      intent: 'inspect',
      sourceInstanceId: 'todo-1',
    });

    const selection = store.selection('u1');
    expect(selection?.primaryRef?.id).toBe('t2');
    expect(selection?.selectedRefs.length).toBe(2);
  });

  it('consumes external context selection events', () => {
    hub.publish({
      universeId: 'u2',
      scope: 'ui',
      type: 'context.selection.changed',
      source: { instanceId: 'kanban-1', agent: 'kanban' },
      durable: false,
      payload: {
        primaryRef: {
          universeId: 'u2',
          instanceId: 'kanban-1',
          kind: 'kanbanCard',
          id: 'c1',
        },
        selectedRefs: [
          {
            universeId: 'u2',
            instanceId: 'kanban-1',
            kind: 'kanbanCard',
            id: 'c1',
          },
        ],
        selectionIntent: 'inspect',
      },
    });

    const selection = store.selection('u2');
    expect(selection?.primaryRef?.kind).toBe('kanbanCard');
    expect(selection?.selectedRefs[0]?.id).toBe('c1');
  });
});
