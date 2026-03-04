export type KeySpaceConflictStrategy =
  | 'ephemeral-ignore-conflict'
  | 'silent-lww'
  | 'merge-rebase'
  | 'crdt-text';

export interface KeySpaceConflictPolicy {
  strategy: KeySpaceConflictStrategy;
  maxRetries: number;
  baseRetryDelayMs: number;
  ignoreVersionConflict: boolean;
}

const EPHEMERAL_PREFIXES = [
  'op_universe_presence:',
  'op_universe_guest_counter:',
  'op_universe_edit_holder:',
  'op_universe_kick:',
] as const;

const SILENT_LWW_PREFIXES = [
  'op_session',
  'op_prefs',
  'op_preview_prefs',
  'op_device_ui_prefs_v1',
  'op_login_phone_mode',
  'op_login_phone_mode_apply',
  'op_dialog_state_v1',
  'op_preview_dialog_state_v1',
] as const;

function isEphemeralKey(key: string): boolean {
  return EPHEMERAL_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isSilentLwwKey(key: string): boolean {
  return SILENT_LWW_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isNotesTextKey(key: string): boolean {
  return key.startsWith('op_app_state:notes:');
}

function isStructuredAppRecord(key: string): boolean {
  return key.startsWith('op_app_state:');
}

export function getKeySpaceConflictStrategy(key: string): KeySpaceConflictStrategy {
  if (isEphemeralKey(key)) return 'ephemeral-ignore-conflict';
  if (isSilentLwwKey(key)) return 'silent-lww';
  if (isNotesTextKey(key)) return 'crdt-text';
  if (isStructuredAppRecord(key)) return 'merge-rebase';
  return 'silent-lww';
}

export function getKeySpaceConflictPolicy(key: string): KeySpaceConflictPolicy {
  const strategy = getKeySpaceConflictStrategy(key);
  if (strategy === 'ephemeral-ignore-conflict') {
    return {
      strategy,
      maxRetries: 0,
      baseRetryDelayMs: 0,
      ignoreVersionConflict: true,
    };
  }
  if (strategy === 'silent-lww') {
    return {
      strategy,
      maxRetries: 2,
      baseRetryDelayMs: 80,
      ignoreVersionConflict: false,
    };
  }
  if (strategy === 'crdt-text') {
    return {
      strategy,
      maxRetries: 3,
      baseRetryDelayMs: 80,
      ignoreVersionConflict: false,
    };
  }
  return {
    strategy,
    maxRetries: 2,
    baseRetryDelayMs: 120,
    ignoreVersionConflict: false,
  };
}
