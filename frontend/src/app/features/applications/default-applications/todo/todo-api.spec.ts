import {
  createTodoItem,
  loadTodoState,
  mergeTodoStates,
  saveTodoState,
  TodoState,
} from './todo-api';
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

  it('merges remote + local states by project/todo id to avoid destructive conflict overwrite', () => {
    const remote: TodoState = {
      version: 2,
      projectsEnabled: true,
      activeProjectId: 'p_remote',
      projects: [
        {
          id: 'p_remote',
          title: 'Remote Project',
          todos: [
            {
              id: 't_shared',
              text: 'Remote title',
              createdAt: '2026-01-01T00:00:00.000Z',
              completed: false,
              subtasks: [{ id: 's_shared', text: 'Remote subtask', completed: false }],
            },
            {
              id: 't_remote_only',
              text: 'Remote only',
              createdAt: '2026-01-01T00:00:00.000Z',
              completed: false,
              subtasks: [],
            },
          ],
        },
      ],
      subtaskCollapsed: { t_shared: true },
    };
    const local: TodoState = {
      version: 2,
      projectsEnabled: true,
      activeProjectId: 'p_remote',
      projects: [
        {
          id: 'p_remote',
          title: 'Local Rename',
          todos: [
            {
              id: 't_shared',
              text: 'Local title',
              createdAt: '2026-01-01T00:00:00.000Z',
              completed: true,
              subtasks: [{ id: 's_shared', text: 'Local subtask', completed: true }],
            },
            {
              id: 't_local_only',
              text: 'Local only',
              createdAt: '2026-01-01T00:00:00.000Z',
              completed: false,
              subtasks: [],
            },
          ],
        },
      ],
      subtaskCollapsed: { t_local_only: false },
    };

    const merged = mergeTodoStates(remote, local);
    const project = merged.projects.find((item) => item.id === 'p_remote');
    expect(project?.title).toBe('Local Rename');
    expect(project?.todos.some((item) => item.id === 't_remote_only')).toBe(true);
    expect(project?.todos.some((item) => item.id === 't_local_only')).toBe(true);
    const shared = project?.todos.find((item) => item.id === 't_shared');
    expect(shared?.text).toBe('Local title');
    expect(shared?.completed).toBe(true);
    expect(shared?.subtasks?.[0]?.text).toBe('Local subtask');
    expect(merged.subtaskCollapsed?.['t_shared']).toBe(true);
    expect(merged.subtaskCollapsed?.['t_local_only']).toBe(false);
  });

  it('keeps local todos when remote conflict snapshot looks like a blank/default state', () => {
    const remote: TodoState = {
      version: 2,
      projectsEnabled: false,
      activeProjectId: 'p_default',
      projects: [{ id: 'p_default', title: 'Project', todos: [] }],
      subtaskCollapsed: {},
    };
    const local: TodoState = {
      version: 2,
      projectsEnabled: false,
      activeProjectId: 'p_local',
      projects: [
        {
          id: 'p_local',
          title: 'Project',
          todos: [{ id: 't1', text: 'Keep me', createdAt: '2026-01-01T00:00:00.000Z' }],
        },
      ],
      subtaskCollapsed: {},
    };

    const merged = mergeTodoStates(remote, local);
    expect(merged.projects.some((project) => project.id === 'p_local')).toBe(true);
    const localProject = merged.projects.find((project) => project.id === 'p_local');
    expect(localProject?.todos.length).toBe(1);
    expect(localProject?.todos[0].text).toBe('Keep me');
  });
});
