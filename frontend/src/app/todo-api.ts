export type Todo = { id: string; text: string; createdAt: string };

const API_BASE = (window as any).__OP_CONFIG__?.apiBaseUrl
  ?? (import.meta as any).env?.NG_APP_API_BASE_URL
  ?? '';

function assertApiBase() {
  if (!API_BASE) throw new Error('Missing API base URL. Set __OP_CONFIG__.apiBaseUrl.');
}

export async function listTodos(): Promise<Todo[]> {
  assertApiBase();
  const res = await fetch(`${API_BASE}/todos`, { credentials: 'omit' });
  if (!res.ok) throw new Error(`listTodos failed: ${res.status}`);
  return res.json();
}

export async function createTodo(text: string): Promise<Todo> {
  assertApiBase();
  const res = await fetch(`${API_BASE}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`createTodo failed: ${res.status}`);
  return res.json();
}

export async function deleteTodo(id: string): Promise<void> {
  assertApiBase();
  const res = await fetch(`${API_BASE}/todos/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteTodo failed: ${res.status}`);
}

