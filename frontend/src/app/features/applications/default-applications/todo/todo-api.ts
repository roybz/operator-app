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

export function todoStateKey(instanceId: string, userId: string) {
  return `${STATE_STORAGE_KEY}:${userId}:${instanceId}`;
}

function defaultProject(todos: Todo[] = []): TodoProject {
  return { id: newId(), title: 'Project', todos };
}

function normalizeTodo(raw: unknown): Todo | null {
  if (!raw || typeof raw !== 'object') return null;
  const todo = raw as Partial<Todo>;
  const id = typeof todo.id === 'string' && todo.id ? todo.id : newId();
  const text = typeof todo.text === 'string' ? todo.text : '';
  const createdAt =
    typeof todo.createdAt === 'string' && todo.createdAt
      ? todo.createdAt
      : new Date().toISOString();
  const completed = Boolean(todo.completed);
  const subtasks: TodoSubtask[] = [];
  if (Array.isArray(todo.subtasks)) {
    for (const sub of todo.subtasks) {
      if (!sub || typeof sub !== 'object') continue;
      const item = sub as Partial<TodoSubtask>;
      subtasks.push({
        id: typeof item.id === 'string' && item.id ? item.id : newId(),
        text: typeof item.text === 'string' ? item.text : '',
        completed: Boolean(item.completed),
      });
    }
  }
  return { id, text, createdAt, completed, subtasks };
}

function normalizeProject(raw: unknown): TodoProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const project = raw as Partial<TodoProject>;
  const id = typeof project.id === 'string' && project.id ? project.id : newId();
  const title =
    typeof project.title === 'string' && project.title.trim() ? project.title : 'Project';
  const todos = Array.isArray(project.todos)
    ? project.todos.map((todo) => normalizeTodo(todo)).filter((todo): todo is Todo => Boolean(todo))
    : [];
  return { id, title, todos };
}

function normalizeState(state: Partial<TodoState> | null | undefined): TodoState {
  const projects =
    Array.isArray(state?.projects) && state.projects.length
      ? state.projects
          .map((project) => normalizeProject(project))
          .filter((project): project is TodoProject => Boolean(project))
      : [];
  const ensuredProjects = projects.length ? projects : [defaultProject()];
  const activeProjectId =
    typeof state?.activeProjectId === 'string' &&
    ensuredProjects.some((p) => p.id === state.activeProjectId)
      ? state.activeProjectId
      : ensuredProjects[0].id;
  return {
    version: 2,
    projectsEnabled: Boolean(state?.projectsEnabled),
    projects: ensuredProjects,
    activeProjectId,
    subtaskCollapsed:
      state?.subtaskCollapsed && typeof state.subtaskCollapsed === 'object'
        ? state.subtaskCollapsed
        : {},
  };
}

export function loadTodoState(storage: StorageLike, instanceId: string, userId: string): TodoState {
  const raw = storage.getItemSync(todoStateKey(instanceId, userId));
  if (raw) {
    try {
      return normalizeState(JSON.parse(raw) as Partial<TodoState>);
    } catch {
      // fall through to migration/fallback; do not overwrite storage on a bad read.
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
  return fallback;
}

export function saveTodoState(
  storage: StorageLike,
  instanceId: string,
  userId: string,
  state: TodoState,
) {
  void storage.setItem(todoStateKey(instanceId, userId), serializeTodoState(state));
}

export function serializeTodoState(state: TodoState) {
  return JSON.stringify(normalizeState(state));
}

export function parseTodoState(raw: string): TodoState | null {
  try {
    return normalizeState(JSON.parse(raw) as Partial<TodoState>);
  } catch {
    return null;
  }
}

function mergeSubtasks(
  remote: TodoSubtask[] | undefined,
  local: TodoSubtask[] | undefined,
): TodoSubtask[] {
  const remoteList = Array.isArray(remote) ? remote : [];
  const localList = Array.isArray(local) ? local : [];
  const remoteMap = new Map(remoteList.map((item) => [item.id, item] as const));
  const localMap = new Map(localList.map((item) => [item.id, item] as const));
  const merged: TodoSubtask[] = [];
  for (const sub of remoteList) {
    merged.push(localMap.get(sub.id) ?? sub);
  }
  for (const sub of localList) {
    if (!remoteMap.has(sub.id)) merged.push(sub);
  }
  return merged;
}

function mergeTodos(remote: Todo[] | undefined, local: Todo[] | undefined): Todo[] {
  const remoteList = Array.isArray(remote) ? remote : [];
  const localList = Array.isArray(local) ? local : [];
  const remoteMap = new Map(remoteList.map((item) => [item.id, item] as const));
  const localMap = new Map(localList.map((item) => [item.id, item] as const));
  const merged: Todo[] = [];
  for (const todo of remoteList) {
    const localTodo = localMap.get(todo.id);
    if (!localTodo) {
      merged.push(todo);
      continue;
    }
    merged.push({
      ...todo,
      ...localTodo,
      subtasks: mergeSubtasks(todo.subtasks, localTodo.subtasks),
    });
  }
  for (const todo of localList) {
    if (!remoteMap.has(todo.id)) merged.push(todo);
  }
  return merged;
}

export function mergeTodoStates(remoteState: TodoState, localState: TodoState): TodoState {
  const remote = normalizeState(remoteState);
  const local = normalizeState(localState);
  const localProjectsById = new Map(
    local.projects.map((project) => [project.id, project] as const),
  );
  const remoteProjectsById = new Map(
    remote.projects.map((project) => [project.id, project] as const),
  );

  const mergedProjects: TodoProject[] = [];
  for (const remoteProject of remote.projects) {
    const localProject = localProjectsById.get(remoteProject.id);
    if (!localProject) {
      mergedProjects.push(remoteProject);
      continue;
    }
    mergedProjects.push({
      ...remoteProject,
      ...localProject,
      todos: mergeTodos(remoteProject.todos, localProject.todos),
    });
  }
  for (const localProject of local.projects) {
    if (!remoteProjectsById.has(localProject.id)) mergedProjects.push(localProject);
  }

  const ensuredProjects = mergedProjects.length ? mergedProjects : [defaultProject()];
  const activeProjectId = ensuredProjects.some((project) => project.id === local.activeProjectId)
    ? local.activeProjectId
    : ensuredProjects.some((project) => project.id === remote.activeProjectId)
      ? remote.activeProjectId
      : ensuredProjects[0].id;

  return normalizeState({
    version: 2,
    projectsEnabled: remote.projectsEnabled || local.projectsEnabled,
    projects: ensuredProjects,
    activeProjectId,
    subtaskCollapsed: {
      ...(remote.subtaskCollapsed ?? {}),
      ...(local.subtaskCollapsed ?? {}),
    },
  });
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
