import { vi } from 'vitest';
import { createTodo, deleteTodo, listTodos } from './todo-api';

interface OpWindow extends Window {
  __OP_CONFIG__?: { apiBaseUrl?: string; mockMode?: boolean };
}

describe('todo-api mock mode', () => {
  const w = window as OpWindow;

  beforeEach(() => {
    localStorage.clear();
    w.__OP_CONFIG__ = { mockMode: true, apiBaseUrl: 'https://example.com' };
  });

  afterEach(() => {
    localStorage.clear();
    delete w.__OP_CONFIG__;
  });

  it('creates, lists, and deletes todos using localStorage', async () => {
    const created = await createTodo('Task one');
    expect(created.text).toBe('Task one');

    const listAfterCreate = await listTodos();
    expect(listAfterCreate.length).toBe(1);

    await deleteTodo(created.id);
    const listAfterDelete = await listTodos();
    expect(listAfterDelete.length).toBe(0);
  });
});

describe('todo-api live mode', () => {
  const w = window as OpWindow;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    w.__OP_CONFIG__ = { mockMode: false, apiBaseUrl: 'https://example.com' };
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
  });

  afterEach(() => {
    delete w.__OP_CONFIG__;
    fetchSpy.mockRestore();
  });

  it('uses fetch when apiBaseUrl is set', async () => {
    await listTodos();
    expect(fetchSpy).toHaveBeenCalled();
  });
});
