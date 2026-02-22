import { InjectionToken } from '@angular/core';

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  getItems?(keys: string[]): Promise<Record<string, string | null>>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export const STORAGE_ADAPTER = new InjectionToken<StorageAdapter>('STORAGE_ADAPTER');
