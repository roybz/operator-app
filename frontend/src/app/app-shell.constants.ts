import { APP_LIST } from './features/dependencies/app-registry';
import { AppGroup } from './layout/shared/app-list/app-list.component';

export type CanvasMode = 'repeat' | 'center' | 'stretch';

export const RESERVED_SIDEBAR_WIDTH = 267;
export const RESERVED_TOPBAR_HEIGHT = 48;
export const RESERVED_WORKSPACE_HEIGHT = 72;
export const PHONE_MODE_BOOT_KEY = 'op_phone_mode_boot';

export const APP_GROUPS: AppGroup[] = APP_LIST.map(({ id, labelKey, icon }) => ({
  id,
  labelKey,
  icon,
}));

export const createFallbackRect = (width: number, height: number): DOMRect => {
  if (typeof DOMRect !== 'undefined') return new DOMRect(0, 0, width, height);
  return {
    x: 0,
    y: 0,
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  } as DOMRect;
};

