import { AppDefinition } from './app-types';

export const APP_REGISTRY: Record<AppDefinition['id'], AppDefinition> = {
  todo: {
    id: 'todo',
    labelKey: 'apps.todo',
    icon: '📝',
    defaultSize: { x: 0, y: 0, width: 480, height: 560 },
  },
  calculator: {
    id: 'calculator',
    labelKey: 'apps.calculator',
    icon: '🧮',
    defaultSize: { x: 0, y: 0, width: 320, height: 360 },
  },
  timer: {
    id: 'timer',
    labelKey: 'apps.timer',
    icon: '⏱️',
    defaultSize: { x: 0, y: 0, width: 420, height: 420 },
  },
  navigator: {
    id: 'navigator',
    labelKey: 'apps.navigator',
    icon: '🧭',
    defaultSize: { x: 0, y: 0, width: 720, height: 520 },
  },
  notes: {
    id: 'notes',
    labelKey: 'apps.notes',
    icon: '🗒️',
    defaultSize: { x: 0, y: 0, width: 700, height: 600 },
  },
  calendar: {
    id: 'calendar',
    labelKey: 'apps.calendar',
    icon: '📅',
    defaultSize: { x: 0, y: 0, width: 860, height: 640 },
  },
  clock: {
    id: 'clock',
    labelKey: 'apps.clock',
    icon: '🕒',
    defaultSize: { x: 0, y: 0, width: 360, height: 220 },
  },
};

export const APP_LIST = Object.values(APP_REGISTRY);
