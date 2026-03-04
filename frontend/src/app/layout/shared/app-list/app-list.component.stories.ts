import type { Meta, StoryObj } from '@storybook/angular';
import { AppListComponent, type AppGroup } from './app-list.component';
import type { DialogInstance } from '../../../core/dialog.service';
import type { AppId } from '../../../features/dependencies/app-types';

const appCatalog: AppGroup[] = [
  { id: 'todo', labelKey: 'apps.todo', icon: 'T' },
  { id: 'kanban', labelKey: 'apps.kanban', icon: 'K' },
  { id: 'notes', labelKey: 'apps.notes', icon: 'N' },
];

function createEmptyInstances(): Record<AppId, DialogInstance[]> {
  return {
    kanban: [],
    todo: [],
    calculator: [],
    timer: [],
    navigator: [],
    notes: [],
    stickyNotes: [],
    calendar: [],
    clock: [],
    dataTable: [],
  };
}

function createBaseInstance(
  id: string,
  appId: AppId,
  titleOverride: string,
  archived = false,
): DialogInstance {
  return {
    id,
    appId,
    titleKey: `apps.${appId}`,
    titleOverride,
    instanceNumber: 1,
    rect: { x: 80, y: 80, width: 360, height: 260 },
    minimized: false,
    phoneMinimized: false,
    stashed: false,
    archived,
    z: 2,
    isMaximized: false,
  };
}

const populatedInstances = createEmptyInstances();
populatedInstances.todo = [
  createBaseInstance('todo-1', 'todo', 'Personal Tasks'),
  createBaseInstance('todo-2', 'todo', 'Archived Sprint', true),
];
populatedInstances.kanban = [createBaseInstance('kanban-1', 'kanban', 'Marketing Board')];
populatedInstances.notes = [createBaseInstance('notes-1', 'notes', 'Research Notes')];

const meta: Meta<AppListComponent> = {
  title: 'Layout/App List',
  component: AppListComponent,
  args: {
    apps: appCatalog,
    instancesByApp: populatedInstances,
    activeInstanceId: 'todo-1',
    phoneMode: false,
    deleteTargetActive: false,
    actionsDisabled: false,
  },
};

export default meta;
type Story = StoryObj<AppListComponent>;

export const DefaultPopulated: Story = {};

export const Loading: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div style="display:grid; gap:8px; max-width:420px;">
        <div style="font-size:12px; opacity:0.7;">Loading app instances...</div>
        <app-app-list
          [apps]="apps"
          [instancesByApp]="instancesByApp"
          [actionsDisabled]="true"
        ></app-app-list>
      </div>
    `,
  }),
};

export const Empty: Story = {
  args: {
    instancesByApp: createEmptyInstances(),
    activeInstanceId: null,
  },
};

export const Error: Story = {
  args: {
    instancesByApp: createEmptyInstances(),
    activeInstanceId: null,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="display:grid; gap:8px; max-width:420px;">
        <div style="font-size:12px; color:#991b1b;">Failed to load app instances. Showing retry-safe shell.</div>
        <app-app-list [apps]="apps" [instancesByApp]="instancesByApp"></app-app-list>
      </div>
    `,
  }),
};

export const Readonly: Story = {
  args: {
    actionsDisabled: true,
  },
};

export const RealtimeDegraded: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div style="display:grid; gap:8px; max-width:420px;">
        <div
          style="font-size:12px; padding:6px 10px; border-radius:999px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; width:max-content;"
        >
          Realtime degraded: refresh cadence increased
        </div>
        <app-app-list
          [apps]="apps"
          [instancesByApp]="instancesByApp"
          [activeInstanceId]="activeInstanceId"
          [deleteTargetActive]="deleteTargetActive"
          [actionsDisabled]="actionsDisabled"
          [phoneMode]="phoneMode"
        ></app-app-list>
      </div>
    `,
  }),
};
