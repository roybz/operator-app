export interface Todo {
  id: string;
  text: string;
  createdAt: string;
  completed?: boolean;
}

const MOCK_STORAGE_KEY = 'op_mock_todos';

interface OpWindow extends Window {
  __OP_CONFIG__?: { apiBaseUrl?: string; mockMode?: boolean };
}

interface ImportMetaEnv {
  NG_APP_API_BASE_URL?: string;
}

interface ImportMetaWithEnv extends ImportMeta {
  env?: ImportMetaEnv;
}

function getApiBase(): string {
  // SSR-safe: window may not exist
  const w = typeof window !== 'undefined' ? (window as OpWindow) : undefined;
  const meta = import.meta as ImportMetaWithEnv;

  if (w?.__OP_CONFIG__?.mockMode === true) return '';
  if (typeof window !== 'undefined') {
    const orgRaw = window.localStorage.getItem('op_org_settings');
    if (orgRaw) {
      try {
        const org = JSON.parse(orgRaw) as { testModeEnabled?: boolean };
        if (org?.testModeEnabled === true) return '';
      } catch {
        // ignore parse errors and fall back to config checks
      }
    }
  }
  return w?.__OP_CONFIG__?.apiBaseUrl ?? meta.env?.NG_APP_API_BASE_URL ?? '';
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readMockTodos(instanceId: string): Todo[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(`${MOCK_STORAGE_KEY}:${instanceId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMockTodos(instanceId: string, todos: Todo[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(`${MOCK_STORAGE_KEY}:${instanceId}`, JSON.stringify(todos));
}

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function listTodos(instanceId: string): Promise<Todo[]> {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    const items = readMockTodos(instanceId);
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  const res = await fetch(`${API_BASE}/todos`, { credentials: 'omit' });
  if (!res.ok) throw new Error('todo.error.list');
  return res.json();
}

export async function createTodo(text: string, instanceId: string): Promise<Todo> {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    const created: Todo = { id: newId(), text, createdAt: new Date().toISOString() };
    const items = [created, ...readMockTodos(instanceId)];
    writeMockTodos(instanceId, items);
    return created;
  }
  const res = await fetch(`${API_BASE}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('todo.error.create');
  return res.json();
}

export async function deleteTodo(id: string, instanceId: string): Promise<void> {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    const items = readMockTodos(instanceId).filter((t) => t.id !== id);
    writeMockTodos(instanceId, items);
    return;
  }
  const res = await fetch(`${API_BASE}/todos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('todo.error.delete');
}

export async function updateTodo(
  id: string,
  updates: Partial<Pick<Todo, 'text' | 'completed'>>,
  instanceId: string,
): Promise<Todo> {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    const items = readMockTodos(instanceId).map((todo) =>
      todo.id === id ? { ...todo, ...updates } : todo,
    );
    writeMockTodos(instanceId, items);
    const next = items.find((todo) => todo.id === id);
    if (!next) throw new Error('todo.error.update');
    return next;
  }
  const res = await fetch(`${API_BASE}/todos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('todo.error.update');
  return res.json();
}
