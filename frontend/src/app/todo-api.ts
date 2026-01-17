export type Todo = { id: string; text: string; createdAt: string };

function getApiBase(): string {
  // SSR-safe: window may not exist
  const w = typeof window !== 'undefined' ? (window as any) : undefined;

  return (
    w?.__OP_CONFIG__?.apiBaseUrl ??
    (import.meta as any).env?.NG_APP_API_BASE_URL ??
    ''
  );
}

function assertApiBase(): string {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error(
      'Missing API base URL. Set window.__OP_CONFIG__.apiBaseUrl or NG_APP_API_BASE_URL.'
    );
  }
  return apiBase;
}

export async function listTodos(): Promise<Todo[]> {
  const API_BASE = assertApiBase();
  const res = await fetch(`${API_BASE}/todos`, { credentials: 'omit' });
  if (!res.ok) throw new Error(`listTodos failed: ${res.status}`);
  return res.json();
}

export async function createTodo(text: string): Promise<Todo> {
  const API_BASE = assertApiBase();
  const res = await fetch(`${API_BASE}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`createTodo failed: ${res.status}`);
  return res.json();
}

export async function deleteTodo(id: string): Promise<void> {
  const API_BASE = assertApiBase();
  const res = await fetch(`${API_BASE}/todos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`deleteTodo failed: ${res.status}`);
}
