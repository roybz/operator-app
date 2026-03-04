import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Meta, StoryObj } from '@storybook/angular';

@Component({
  selector: 'app-form-primitives-story-host',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      .form-shell {
        display: grid;
        gap: 12px;
        max-width: 520px;
        padding: 16px;
        border: 1px solid var(--color-border);
        border-radius: 12px;
        background: var(--color-surface);
      }

      .form-row {
        display: grid;
        gap: 6px;
      }

      .form-row__label {
        font-size: 13px;
        font-weight: 600;
      }

      .form-row__control {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
      }

      .form-row__control:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 1px;
      }

      .form-row__error {
        font-size: 12px;
        color: #b42318;
      }

      .form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .btn {
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
      }

      .btn--primary {
        background: var(--color-accent);
        color: var(--color-accent-contrast);
        border-color: transparent;
      }

      .btn:disabled,
      .form-row__control:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      :host-context(.a11y-mode) .form-shell {
        border-width: 2px;
      }

      :host-context(.a11y-mode) .btn,
      :host-context(.a11y-mode) .form-row__control {
        font-size: 16px;
      }
    `,
  ],
  template: `
    <section class="form-shell" [attr.aria-readonly]="readonly ? 'true' : null">
      <div class="form-row">
        <label class="form-row__label" for="email">Email</label>
        <input
          id="email"
          class="form-row__control"
          type="email"
          [disabled]="disabled"
          [value]="'roy.nouneh@gmail.com'"
        />
      </div>

      <div class="form-row">
        <label class="form-row__label" for="role">Role</label>
        <select id="role" class="form-row__control" [disabled]="disabled">
          <option>Owner</option>
          <option>Editor</option>
          <option>Observer</option>
        </select>
        @if (showValidationError) {
          <div class="form-row__error">Please select a valid role for this account.</div>
        }
      </div>

      <div class="form-actions">
        <button class="btn" [disabled]="disabled" type="button">Cancel</button>
        <button class="btn btn--primary" [disabled]="disabled" type="button">Save</button>
      </div>
    </section>
  `,
})
class FormPrimitivesStoryHostComponent {
  @Input() disabled = false;
  @Input() showValidationError = false;
  @Input() readonly = false;
}

const meta: Meta<FormPrimitivesStoryHostComponent> = {
  title: 'Shared/Form Primitives',
  component: FormPrimitivesStoryHostComponent,
  args: {
    disabled: false,
    showValidationError: false,
    readonly: false,
  },
};

export default meta;
type Story = StoryObj<FormPrimitivesStoryHostComponent>;

export const Normal: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const ValidationError: Story = {
  args: {
    showValidationError: true,
  },
};

export const HighContrastAccessibility: Story = {
  args: {
    readonly: true,
  },
  parameters: {
    globals: {
      accessibility: 'on',
    },
  },
};
