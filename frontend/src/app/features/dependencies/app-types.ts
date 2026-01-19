export type AppId = 'todo' | 'calculator' | 'timer' | 'navigator' | 'notes' | 'calendar' | 'clock';

export interface DialogRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppDefinition {
  id: AppId;
  labelKey: string;
  icon: string;
  defaultSize: DialogRect;
}
