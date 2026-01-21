import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { listTodos, createTodo, deleteTodo, updateTodo, Todo } from './todo-api';
import { AppPreferencesService } from '../../dependencies/app-preferences.service';

@Component({
  selector: 'app-todo-page',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <main style="max-width: 720px; margin: 24px auto;">
      <h2>{{ 'todo.title' | translate }}</h2>

      <section style="display:flex; gap:8px; margin: 16px 0;">
        <input
          #txt
          [placeholder]="'todo.placeholder' | translate"
          style="flex:1; padding:10px;"
          (keydown.enter)="onAdd(txt.value); txt.value = ''"
        />
        <button style="padding:10px 14px;" (click)="onAdd(txt.value); txt.value = ''">
          {{ 'todo.add' | translate }}
        </button>
        <button style="padding:10px 14px;" (click)="reload()">
          {{ 'todo.reload' | translate }}
        </button>
        <button style="padding:10px 14px;" (click)="clearCompleted()">
          {{ 'todo.clearCompleted' | translate }}
        </button>
      </section>

      @if (err()) {
        <p style="color:#b00020;">{{ err() }}</p>
      }
      @if (loading()) {
        <p>{{ 'todo.loading' | translate }}</p>
      }

      <div style="display:grid; gap:10px;">
        @for (t of todos(); track t.id) {
          <article
            style="border:1px solid #ddd; border-radius:12px; padding:12px; display:flex; justify-content:space-between; gap:12px;"
          >
            <div style="min-width:0; flex:1;">
              <label style="display:flex; align-items:center; gap:8px;">
                <input
                  type="checkbox"
                  [checked]="t.completed"
                  (change)="toggleComplete(t, $event)"
                />
                @if (editingId() === t.id) {
                  <input
                    [value]="editingText()"
                    (input)="editingText.set($any($event.target).value)"
                    (blur)="finishEdit(t)"
                    (keydown.enter)="finishEdit(t)"
                    style="flex:1; padding:6px;"
                  />
                } @else {
                  <button
                    type="button"
                    style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:text; background:transparent; border:none; padding:0; text-align:left;"
                    [style.textDecoration]="t.completed ? 'line-through' : 'none'"
                    [style.opacity]="t.completed ? 0.6 : 1"
                    (click)="startEdit(t)"
                  >
                    {{ t.text }}
                  </button>
                }
              </label>
            </div>

            <div style="display:flex; gap:8px; align-items:center;">
              <button (click)="onDuplicate(t)" [title]="'todo.duplicateTitle' | translate">
                {{ 'todo.duplicate' | translate }}
              </button>
              <button (click)="onDelete(t)" [title]="'todo.deleteTitle' | translate">
                {{ 'todo.delete' | translate }}
              </button>
            </div>
          </article>
        }
      </div>
    </main>
  `,
})
export class TodoPageComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;
  todos = signal<Todo[]>([]);
  loading = signal(false);
  err = signal<string | null>(null);
  editingId = signal<string | null>(null);
  editingText = signal('');
  private readonly translate = inject(TranslateService);
  private readonly prefs = inject(AppPreferencesService);

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.err.set(null);
    this.loading.set(true);
    try {
      this.todos.set(await listTodos(this.instanceId, this.prefs.userId()));
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    } finally {
      this.loading.set(false);
    }
  }

  async onAdd(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.err.set(null);
    try {
      const created = await createTodo(trimmed, this.instanceId, this.prefs.userId());
      this.todos.set([created, ...this.todos()]);
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    }
  }

  async onDuplicate(t: Todo) {
    await this.onAdd(t.text);
  }

  async onDelete(t: Todo) {
    this.err.set(null);
    try {
      await deleteTodo(t.id, this.instanceId, this.prefs.userId());
      this.todos.set(this.todos().filter((x) => x.id !== t.id));
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    }
  }

  startEdit(t: Todo) {
    this.editingId.set(t.id);
    this.editingText.set(t.text);
  }

  async finishEdit(t: Todo) {
    if (this.editingId() !== t.id) return;
    const nextText = this.editingText().trim();
    this.editingId.set(null);
    if (!nextText || nextText === t.text) return;
    try {
      const updated = await updateTodo(
        t.id,
        { text: nextText },
        this.instanceId,
        this.prefs.userId(),
      );
      this.todos.set(this.todos().map((todo) => (todo.id === t.id ? updated : todo)));
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    }
  }

  async toggleComplete(t: Todo, event: Event) {
    const completed = (event.target as HTMLInputElement).checked;
    try {
      const updated = await updateTodo(t.id, { completed }, this.instanceId, this.prefs.userId());
      this.todos.set(this.todos().map((todo) => (todo.id === t.id ? updated : todo)));
    } catch {
      this.err.set(this.translate.instant('todo.error.unknown'));
    }
  }

  async clearCompleted() {
    const completed = this.todos().filter((todo) => todo.completed);
    for (const todo of completed) {
      await this.onDelete(todo);
    }
  }
}
