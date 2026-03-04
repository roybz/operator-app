import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';

interface StickyCard {
  id: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-sticky-collab-fixture',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .sticky-fixture {
        display: grid;
        gap: 10px;
      }

      .sticky-banner {
        font-size: 12px;
        padding: 8px 10px;
        border-radius: 8px;
      }

      .sticky-banner--warn {
        background: #fff3cd;
        border: 1px solid #ffe49a;
        color: #7a5b00;
      }

      .sticky-banner--readonly {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #334155;
      }

      .sticky-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
      }

      .sticky-card {
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
        background: #fff8c5;
        padding: 10px;
        min-height: 140px;
        display: grid;
        gap: 8px;
      }

      .sticky-card__title {
        font-weight: 600;
      }

      .sticky-empty {
        opacity: 0.7;
        font-style: italic;
      }
    `,
  ],
  template: `
    <section class="sticky-fixture" [attr.aria-readonly]="readonly ? 'true' : null">
      @if (showDeferredApply) {
        <div class="sticky-banner sticky-banner--warn">Remote card update deferred until idle.</div>
      }
      @if (readonly) {
        <div class="sticky-banner sticky-banner--readonly">
          Locked/readonly collaborator mode.
        </div>
      }
      <div class="sticky-grid">
        @if (!cards.length) {
          <div class="sticky-empty">No sticky notes created yet.</div>
        }
        @for (card of cards; track card.id) {
          <article class="sticky-card">
            <div class="sticky-card__title">{{ card.title }}</div>
            <div>{{ card.body }}</div>
          </article>
        }
      </div>
    </section>
  `,
})
class StickyCollabFixtureComponent {
  @Input() cards: StickyCard[] = [];
  @Input() readonly = false;
  @Input() showDeferredApply = false;
}

const sampleCards: StickyCard[] = [
  { id: 's1', title: 'Follow-up', body: 'Ping design team for icon set.' },
  { id: 's2', title: 'Demo', body: 'Validate sync behavior before branch cut.' },
];

const meta: Meta<StickyCollabFixtureComponent> = {
  title: 'Applications/Sticky Notes Collaboration States',
  component: StickyCollabFixtureComponent,
  args: {
    cards: [],
    readonly: false,
    showDeferredApply: false,
  },
};

export default meta;
type Story = StoryObj<StickyCollabFixtureComponent>;

export const Empty: Story = {};

export const Populated: Story = {
  args: {
    cards: sampleCards,
  },
};

export const LockedReadonly: Story = {
  args: {
    cards: sampleCards,
    readonly: true,
  },
};

export const RemoteChangeDeferredApply: Story = {
  args: {
    cards: sampleCards,
    showDeferredApply: true,
  },
};
