import type { Meta, StoryObj } from '@storybook/angular';
import { ConfirmDialogComponent } from './confirm-dialog.component';

const meta: Meta<ConfirmDialogComponent> = {
  title: 'Shared/Confirm Dialog',
  component: ConfirmDialogComponent,
  args: {
    title: 'Confirm action',
    message: 'Are you sure you want to continue?',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    showCancel: true,
  },
};

export default meta;
type Story = StoryObj<ConfirmDialogComponent>;

export const Default: Story = {};

export const DestructiveConfirm: Story = {
  args: {
    title: 'Delete workspace',
    message: 'This action is permanent and cannot be undone.\nPlease confirm to continue deletion.',
    confirmLabel: 'Delete permanently',
  },
  parameters: {
    docs: {
      description: {
        story: 'Destructive confirm variant used by archive/delete flows.',
      },
    },
  },
};

export const LongMessageWithScroll: Story = {
  args: {
    title: 'Bulk operation',
    message: Array.from({ length: 16 })
      .map((_, index) => `Item ${index + 1} will be affected.`)
      .join('\n'),
  },
};
