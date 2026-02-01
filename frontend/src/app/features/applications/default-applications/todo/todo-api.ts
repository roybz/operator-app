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

interface StorageLike {
  getItemSync: (key: string) => string | null;
  setItem: (key: string, value: string) => Promise<void>;
}

const MOCK_STORAGE_KEY = 'op_mock_todos';
const STATE_STORAGE_KEY = 'op_todo_state_v2';

function readMockTodos(storage: StorageLike, instanceId: string, userId: string): Todo[] {
  const raw = storage.getItemSync(`${MOCK_STORAGE_KEY}:${userId}:${instanceId}`);
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

export function loadTodoState(storage: StorageLike, instanceId: string, userId: string): TodoState {
  const raw = storage.getItemSync(stateKey(instanceId, userId));
  if (raw) {
    try {
      return normalizeState(JSON.parse(raw) as TodoState);
    } catch {
      // fall through to migration
    }
  }
  const legacyTodos = readMockTodos(storage, instanceId, userId);
  if (legacyTodos.length) {
    const project = defaultProject(legacyTodos);
    const next: TodoState = {
      version: 2,
      projectsEnabled: false,
      projects: [project],
      activeProjectId: project.id,
      subtaskCollapsed: {},
    };
    saveTodoState(storage, instanceId, userId, next);
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
  saveTodoState(storage, instanceId, userId, fallback);
  return fallback;
}

export function saveTodoState(
  storage: StorageLike,
  instanceId: string,
  userId: string,
  state: TodoState,
) {
  void storage.setItem(stateKey(instanceId, userId), JSON.stringify(normalizeState(state)));
}

export function cloneTodoState(
  storage: StorageLike,
  fromInstanceId: string,
  toInstanceId: string,
  userId: string,
) {
  const state = loadTodoState(storage, fromInstanceId, userId);
  saveTodoState(storage, toInstanceId, userId, {
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
