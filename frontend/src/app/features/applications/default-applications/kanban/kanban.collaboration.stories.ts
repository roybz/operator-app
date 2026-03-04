import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';

interface KanbanCardItem {
  id: string;
  title: string;
}

interface KanbanColumnItem {
  id: string;
  title: string;
  cards: KanbanCardItem[];
}

@Component({
  selector: 'app-kanban-collab-fixture',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .kanban-fixture {
        display: grid;
        gap: 10px;
      }

      .kanban-banner {
        font-size: 12px;
        padding: 8px 10px;
        border-radius: 8px;
      }

      .kanban-banner--conflict {
        background: #fff3cd;
        border: 1px solid #ffe49a;
        color: #7a5b00;
      }

      .kanban-banner--readonly {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #334155;
      }

      .kanban-board {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
      }

      .kanban-column {
        border: 1px solid var(--color-border);
        border-radius: 10px;
        background: var(--color-surface);
        padding: 10px;
        display: grid;
        gap: 8px;
        min-height: 120px;
      }

      .kanban-card {
        border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
        border-radius: 8px;
        padding: 8px;
        background: var(--color-bg);
        font-size: 13px;
      }

      .kanban-empty {
        opacity: 0.7;
        font-style: italic;
      }
    `,
  ],
  template: `
    <section class="kanban-fixture" [attr.aria-readonly]="readonly ? 'true' : null">
      @if (showConflictBanner) {
        <div class="kanban-banner kanban-banner--conflict">
          Remote board changes detected. Deferred apply is waiting for idle state.
        </div>
      }
      @if (readonly) {
        <div class="kanban-banner kanban-banner--readonly">
          Read-only collaborator mode. Drag/drop and card edits are disabled.
        </div>
      }
      <div class="kanban-board">
        @if (!columns.length) {
          <div class="kanban-empty">No columns yet.</div>
        }
        @for (column of columns; track column.id) {
          <section class="kanban-column">
            <strong>{{ column.title }}</strong>
            @if (!column.cards.length) {
              <div class="kanban-empty">No cards</div>
            }
            @for (card of column.cards; track card.id) {
              <article class="kanban-card">{{ card.title }}</article>
            }
          </section>
        }
      </div>
    </section>
  `,
})
class KanbanCollabFixtureComponent {
  @Input() columns: KanbanColumnItem[] = [];
  @Input() showConflictBanner = false;
  @Input() readonly = false;
}

const populatedColumns: KanbanColumnItem[] = [
  {
    id: 'col-todo',
    title: 'To Do',
    cards: [
      { id: 'c1', title: 'Draft onboarding notes' },
      { id: 'c2', title: 'Refine release checklist' },
    ],
  },
  {
    id: 'col-doing',
    title: 'In Progress',
    cards: [{ id: 'c3', title: 'Stabilize websocket reconnect flow' }],
  },
  {
    id: 'col-done',
    title: 'Done',
    cards: [{ id: 'c4', title: 'Ship Storybook bootstrap' }],
  },
];

const meta: Meta<KanbanCollabFixtureComponent> = {
  title: 'Applications/Kanban Collaboration States',
  component: KanbanCollabFixtureComponent,
  args: {
    columns: [],
    showConflictBanner: false,
    readonly: false,
  },
};

export default meta;
type Story = StoryObj<KanbanCollabFixtureComponent>;

export const Empty: Story = {};

export const Populated: Story = {
  args: {
    columns: populatedColumns,
  },
};

export const ConflictBanner: Story = {
  args: {
    columns: populatedColumns,
    showConflictBanner: true,
  },
};

export const ReadonlyCollaborator: Story = {
  args: {
    columns: populatedColumns,
    readonly: true,
  },
};
