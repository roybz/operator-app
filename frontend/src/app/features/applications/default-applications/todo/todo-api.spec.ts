import { createTodoItem, loadTodoState, saveTodoState, TodoState } from './todo-api';
import { StorageService } from '../../../../core/storage/storage.service';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { TestBed } from '@angular/core/testing';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';

describe('todo-api mock mode', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        StorageService,
        {
          provide: STORAGE_ADAPTER,
          useClass: LocalStorageAdapter,
        },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads and persists todo state', async () => {
    const storage = TestBed.inject(StorageService);
    await storage.hydrate();
    const instanceId = 'dlg_test';
    const todo = createTodoItem('Task one');
    const state: TodoState = {
      version: 2,
      projectsEnabled: false,
      projects: [{ id: 'p1', title: 'Project', todos: [todo] }],
      activeProjectId: 'p1',
    };
    saveTodoState(storage, instanceId, 'u_test', state);
    const loaded = loadTodoState(storage, instanceId, 'u_test');
    expect(loaded.projects[0].todos.length).toBe(1);
    expect(loaded.projects[0].todos[0].text).toBe('Task one');
  });

  it('does not auto-persist a blank fallback when no todo state exists yet', async () => {
    const storage = TestBed.inject(StorageService);
    await storage.hydrate();
    const instanceId = 'dlg_missing';
    const key = `op_todo_state_v2:u_test:${instanceId}`;

    expect(storage.getItemSync(key)).toBeNull();

    const loaded = loadTodoState(storage, instanceId, 'u_test');

    expect(loaded.projects.length).toBe(1);
    expect(storage.getItemSync(key)).toBeNull();
  });

  it('normalizes malformed stored state without wiping valid nested todos', async () => {
    const storage = TestBed.inject(StorageService);
    await storage.hydrate();
    const instanceId = 'dlg_corrupt_shape';
    const key = `op_todo_state_v2:u_test:${instanceId}`;
    await storage.setItem(
      key,
      JSON.stringify({
        version: 2,
        projectsEnabled: true,
        activeProjectId: 'p1',
        projects: [
          {
            id: 'p1',
            title: '',
            todos: [{ id: 't1', text: 'Keep me', createdAt: '2026-02-24T00:00:00.000Z' }],
          },
          { id: 'p2', todos: 'bad-shape' },
        ],
      }),
    );

    const loaded = loadTodoState(storage, instanceId, 'u_test');

    expect(loaded.projectsEnabled).toBe(true);
    expect(loaded.projects[0].id).toBe('p1');
    expect(loaded.projects[0].title).toBe('Project');
    expect(loaded.projects[0].todos[0].text).toBe('Keep me');
    expect(Array.isArray(loaded.projects[1].todos)).toBe(true);
  });
});
