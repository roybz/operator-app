import type { Meta, StoryObj } from '@storybook/angular';
import { ModalShellComponent } from './modal-shell.component';

const meta: Meta<ModalShellComponent> = {
  title: 'Shared/Modal Shell',
  component: ModalShellComponent,
  args: {
    ariaLabel: 'Example modal',
    maxWidth: 'min(560px, calc(100vw - 32px))',
    zIndex: 2400,
  },
};

export default meta;
type Story = StoryObj<ModalShellComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-modal-shell [ariaLabel]="ariaLabel" [maxWidth]="maxWidth" [zIndex]="zIndex">
        <section style="padding: 16px;">
          <h3 style="margin-top: 0;">Modal Title</h3>
          <p>This is the default modal-shell content projection.</p>
        </section>
      </app-modal-shell>
    `,
  }),
};

export const LongContentScroll: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-modal-shell [ariaLabel]="ariaLabel" [maxWidth]="maxWidth" [zIndex]="zIndex">
        <section style="padding: 16px;">
          <h3 style="margin-top: 0;">Long Content</h3>
          <p>Scroll behavior should remain inside the panel.</p>
          ${'<p>Line item for scroll validation.</p>'.repeat(40)}
        </section>
      </app-modal-shell>
    `,
  }),
};

export const FocusAndEscapeBehavior: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Use keyboard Tab to inspect focus order and Escape to validate close behavior wiring.',
      },
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <app-modal-shell [ariaLabel]="ariaLabel" [maxWidth]="maxWidth" [zIndex]="zIndex">
        <section style="padding: 16px; display: grid; gap: 8px;">
          <h3 style="margin-top: 0;">Keyboard Validation</h3>
          <button type="button">Primary Action</button>
          <button type="button">Secondary Action</button>
          <input type="text" placeholder="Focusable input" />
        </section>
      </app-modal-shell>
    `,
  }),
};
