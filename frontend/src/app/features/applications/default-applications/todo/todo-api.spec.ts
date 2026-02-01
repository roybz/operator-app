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
});
