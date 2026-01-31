export interface TodoSubtask {
  id: string;
  text: string;
  completed?: boolean;
}

export interface Todo {
  id: string;
  text: string;
  createdAt: string;
  completed?: boolean;
  subtasks?: TodoSubtask[];
}

export interface TodoProject {
  id: string;
  title: string;
  todos: Todo[];
}

export interface TodoState {
  version: 2;
  projectsEnabled: boolean;
  projects: TodoProject[];
  activeProjectId: string;
  subtaskCollapsed?: Record<string, boolean>;
}

const MOCK_STORAGE_KEY = 'op_mock_todos';
const STATE_STORAGE_KEY = 'op_todo_state_v2';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readMockTodos(instanceId: string, userId: string): Todo[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(`${MOCK_STORAGE_KEY}:${userId}:${instanceId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function stateKey(instanceId: string, userId: string) {
  return `${STATE_STORAGE_KEY}:${userId}:${instanceId}`;
}

function defaultProject(todos: Todo[] = []): TodoProject {
  return { id: newId(), title: 'Project', todos };
}

function normalizeState(state: TodoState): TodoState {
  const projects = state.projects?.length ? state.projects : [defaultProject()];
  const activeProjectId = projects.some((p) => p.id === state.activeProjectId)
    ? state.activeProjectId
    : projects[0].id;
  return {
    version: 2,
    projectsEnabled: state.projectsEnabled ?? false,
    projects,
    activeProjectId,
    subtaskCollapsed: state.subtaskCollapsed ?? {},
  };
}

export function loadTodoState(instanceId: string, userId: string): TodoState {
  if (!isBrowser()) {
    const project = defaultProject([]);
    return { version: 2, projectsEnabled: false, projects: [project], activeProjectId: project.id };
  }
  const raw = window.localStorage.getItem(stateKey(instanceId, userId));
  if (raw) {
    try {
      return normalizeState(JSON.parse(raw) as TodoState);
    } catch {
      // fall through to migration
    }
  }
  const legacyTodos = readMockTodos(instanceId, userId);
  if (legacyTodos.length) {
    const project = defaultProject(legacyTodos);
    const next: TodoState = {
      version: 2,
      projectsEnabled: false,
      projects: [project],
      activeProjectId: project.id,
      subtaskCollapsed: {},
    };
    saveTodoState(instanceId, userId, next);
    return next;
  }
  const project = defaultProject([]);
  const fallback: TodoState = {
    version: 2,
    projectsEnabled: false,
    projects: [project],
    activeProjectId: project.id,
    subtaskCollapsed: {},
  };
  saveTodoState(instanceId, userId, fallback);
  return fallback;
}

export function saveTodoState(instanceId: string, userId: string, state: TodoState) {
  if (!isBrowser()) return;
  window.localStorage.setItem(stateKey(instanceId, userId), JSON.stringify(normalizeState(state)));
}

export function cloneTodoState(fromInstanceId: string, toInstanceId: string, userId: string) {
  if (!isBrowser()) return;
  const state = loadTodoState(fromInstanceId, userId);
  saveTodoState(toInstanceId, userId, {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      todos: project.todos.map((todo) => ({
        ...todo,
        subtasks: todo.subtasks?.map((sub) => ({ ...sub })) ?? [],
      })),
    })),
  });
}

export function createTodoItem(text: string): Todo {
  return { id: newId(), text, createdAt: new Date().toISOString(), completed: false, subtasks: [] };
}

export function createSubtask(text: string): TodoSubtask {
  return { id: newId(), text, completed: false };
}
