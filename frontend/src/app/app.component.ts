import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { listTodos, createTodo, deleteTodo, Todo } from './todo-api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main style="max-width: 720px; margin: 40px auto; font-family: system-ui;">
      <h1>operator-app</h1>

      <section style="display:flex; gap:8px; margin: 16px 0;">
        <input
          #txt
          placeholder="Add a todo"
          style="flex:1; padding:10px;"
          (keydown.enter)="onAdd(txt.value); txt.value='';"
        />
        <button style="padding:10px 14px;" (click)="onAdd(txt.value); txt.value=''">Add</button>
        <button style="padding:10px 14px;" (click)="reload()">Reload</button>
      </section>

      <p *ngIf="err()" style="color:#b00020;">{{ err() }}</p>
      <p *ngIf="loading()">Loading…</p>

      <div style="display:grid; gap:10px;">
        <article
          *ngFor="let t of todos()"
          style="border:1px solid #ddd; border-radius:12px; padding:12px; display:flex; justify-content:space-between; gap:12px;"
        >
          <div style="min-width:0;">
            <div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              {{ t.text }}
            </div>
            <div style="font-size:12px; opacity:.7;">{{ t.id }}</div>
          </div>

          <div style="display:flex; gap:8px; align-items:center;">
            <button (click)="onDuplicate(t)" title="Duplicate">Duplicate</button>
            <button (click)="onDelete(t)" title="Delete forever">Delete</button>
          </div>
        </article>
      </div>
    </main>
  `
})
export class AppComponent {
  todos = signal<Todo[]>([]);
  loading = signal(false);
  err = signal<string | null>(null);

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.err.set(null);
    this.loading.set(true);
    try {
      this.todos.set(await listTodos());
    } catch (e: any) {
      this.err.set(e?.message ?? String(e));
    } finally {
      this.loading.set(false);
    }
  }

  async onAdd(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.err.set(null);
    try {
      const created = await createTodo(trimmed);
      this.todos.set([created, ...this.todos()]);
    } catch (e: any) {
      this.err.set(e?.message ?? String(e));
    }
  }

  async onDuplicate(t: Todo) {
    await this.onAdd(t.text);
  }

  async onDelete(t: Todo) {
    this.err.set(null);
    try {
      await deleteTodo(t.id);
      this.todos.set(this.todos().filter(x => x.id !== t.id));
    } catch (e: any) {
      this.err.set(e?.message ?? String(e));
    }
  }
}

