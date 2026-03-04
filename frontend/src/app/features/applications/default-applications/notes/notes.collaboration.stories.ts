import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';

@Component({
  selector: 'app-notes-collab-fixture',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .notes-fixture {
        display: grid;
        gap: 10px;
        max-width: 760px;
      }

      .notes-toolbar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .notes-pill {
        padding: 5px 8px;
        border-radius: 999px;
        font-size: 12px;
        border: 1px solid var(--color-border);
      }

      .notes-pill--warn {
        background: #fff3cd;
        border-color: #ffe49a;
        color: #7a5b00;
      }

      .notes-pane {
        border: 1px solid var(--color-border);
        border-radius: 12px;
        background: var(--color-surface);
        padding: 12px;
        display: grid;
        gap: 8px;
      }

      .notes-content {
        min-height: 140px;
        border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
        border-radius: 8px;
        background: var(--color-bg);
        padding: 10px;
        white-space: pre-wrap;
      }

      .notes-links {
        font-size: 12px;
        display: grid;
        gap: 4px;
      }

      .notes-links__unresolved {
        color: #b42318;
      }
    `,
  ],
  template: `
    <section class="notes-fixture" [attr.aria-readonly]="readonly ? 'true' : null">
      <div class="notes-toolbar">
        <span class="notes-pill">Mode: {{ editorMode }}</span>
        @if (readonly) {
          <span class="notes-pill">Locked</span>
          <span class="notes-pill">Read-only collaborator</span>
        }
        @if (showRemoteDeferredBanner) {
          <span class="notes-pill notes-pill--warn">Remote changes deferred until blur</span>
        }
      </div>

      <section class="notes-pane">
        <strong>{{ noteTitle }}</strong>
        <article class="notes-content">{{ noteContent }}</article>
        <div class="notes-links">
          @if (unresolvedLinks.length) {
            <strong>Unresolved links</strong>
          }
          @for (link of unresolvedLinks; track link) {
            <span class="notes-links__unresolved">[[{{ link }}]] not found</span>
          }
        </div>
      </section>
    </section>
  `,
})
class NotesCollabFixtureComponent {
  @Input() editorMode: 'preview' | 'edit' = 'edit';
  @Input() readonly = false;
  @Input() showRemoteDeferredBanner = false;
  @Input() noteTitle = 'Roadmap Notes';
  @Input() noteContent = '- Build Storybook coverage\n- Add visual regression baseline';
  @Input() unresolvedLinks: string[] = [];
}

const meta: Meta<NotesCollabFixtureComponent> = {
  title: 'Applications/Notes Collaboration States',
  component: NotesCollabFixtureComponent,
  args: {
    editorMode: 'edit',
    readonly: false,
    showRemoteDeferredBanner: false,
    unresolvedLinks: [],
  },
};

export default meta;
type Story = StoryObj<NotesCollabFixtureComponent>;

export const EditorModeEdit: Story = {};

export const EditorModePreview: Story = {
  args: {
    editorMode: 'preview',
  },
};

export const LockedReadonly: Story = {
  args: {
    readonly: true,
  },
};

export const UnresolvedLinks: Story = {
  args: {
    unresolvedLinks: ['QuarterlyPlan', 'Budget/2026'],
  },
};

export const RemoteChangeDeferredApply: Story = {
  args: {
    showRemoteDeferredBanner: true,
    unresolvedLinks: ['DraftLink'],
  },
};
