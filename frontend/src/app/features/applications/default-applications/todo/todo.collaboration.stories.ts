import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

@Component({
  selector: 'app-todo-collab-fixture',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .todo-fixture {
        display: grid;
        gap: 10px;
        max-width: 640px;
      }

      .todo-banner {
        font-size: 12px;
        padding: 8px 10px;
        border-radius: 8px;
      }

      .todo-banner--conflict {
        background: #fff3cd;
        border: 1px solid #ffe49a;
        color: #7a5b00;
      }

      .todo-banner--readonly {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #334155;
      }

      .todo-list {
        border: 1px solid var(--color-border);
        border-radius: 12px;
        background: var(--color-surface);
        padding: 12px;
        display: grid;
        gap: 8px;
      }

      .todo-item {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
      }

      .todo-item__text--done {
        text-decoration: line-through;
        opacity: 0.65;
      }

      .todo-empty {
        opacity: 0.7;
        font-style: italic;
      }
    `,
  ],
  template: `
    <section class="todo-fixture" [attr.aria-readonly]="readonly ? 'true' : null">
      @if (showConflictBanner) {
        <div class="todo-banner todo-banner--conflict">
          Remote updates are available and will apply when editing stops.
        </div>
      }
      @if (readonly) {
        <div class="todo-banner todo-banner--readonly">
          Read-only collaborator mode. Editing controls are disabled.
        </div>
      }

      <div class="todo-list">
        @if (!todos.length) {
          <div class="todo-empty">No tasks yet.</div>
        }
        @for (todo of todos; track todo.id) {
          <div class="todo-item">
            <input type="checkbox" [checked]="todo.completed" [disabled]="readonly" />
            <span [class.todo-item__text--done]="todo.completed">{{ todo.text }}</span>
          </div>
        }
      </div>
    </section>
  `,
})
class TodoCollabFixtureComponent {
  @Input() todos: TodoItem[] = [];
  @Input() showConflictBanner = false;
  @Input() readonly = false;
}

const populatedTodos: TodoItem[] = [
  { id: 't1', text: 'Prepare roadmap update', completed: false },
  { id: 't2', text: 'Share launch checklist with team', completed: true },
];

const meta: Meta<TodoCollabFixtureComponent> = {
  title: 'Applications/Todo Collaboration States',
  component: TodoCollabFixtureComponent,
  args: {
    todos: [],
    showConflictBanner: false,
    readonly: false,
  },
};

export default meta;
type Story = StoryObj<TodoCollabFixtureComponent>;

export const Empty: Story = {};

export const Populated: Story = {
  args: {
    todos: populatedTodos,
  },
};

export const ConflictBanner: Story = {
  args: {
    todos: populatedTodos,
    showConflictBanner: true,
  },
};

export const ReadonlyCollaborator: Story = {
  args: {
    todos: populatedTodos,
    readonly: true,
  },
};
