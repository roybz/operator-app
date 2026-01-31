import { createTodoItem, loadTodoState, saveTodoState, TodoState } from './todo-api';

describe('todo-api mock mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads and persists todo state', () => {
    const instanceId = 'dlg_test';
    const todo = createTodoItem('Task one');
    const state: TodoState = {
      version: 2,
      projectsEnabled: false,
      projects: [{ id: 'p1', title: 'Project', todos: [todo] }],
      activeProjectId: 'p1',
    };
    saveTodoState(instanceId, 'u_test', state);
    const loaded = loadTodoState(instanceId, 'u_test');
    expect(loaded.projects[0].todos.length).toBe(1);
    expect(loaded.projects[0].todos[0].text).toBe('Task one');
  });
});
