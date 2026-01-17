export interface Todo {
  id: string;
  text: string;
  createdAt: string;
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
  return w?.__OP_CONFIG__?.apiBaseUrl ?? meta.env?.NG_APP_API_BASE_URL ?? '';
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readMockTodos(): Todo[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMockTodos(todos: Todo[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(todos));
}

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function listTodos(): Promise<Todo[]> {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    const items = readMockTodos();
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  const res = await fetch(`${API_BASE}/todos`, { credentials: 'omit' });
  if (!res.ok) throw new Error('todo.error.list');
  return res.json();
}

export async function createTodo(text: string): Promise<Todo> {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    const created: Todo = { id: newId(), text, createdAt: new Date().toISOString() };
    const items = [created, ...readMockTodos()];
    writeMockTodos(items);
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

export async function deleteTodo(id: string): Promise<void> {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    const items = readMockTodos().filter((t) => t.id !== id);
    writeMockTodos(items);
    return;
  }
  const res = await fetch(`${API_BASE}/todos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('todo.error.delete');
}
