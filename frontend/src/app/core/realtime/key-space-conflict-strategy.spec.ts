import {
  getKeySpaceConflictPolicy,
  getKeySpaceConflictStrategy,
} from './key-space-conflict-strategy';

describe('key-space-conflict-strategy', () => {
  it('maps ephemeral universe coordination keys to ignore-conflict strategy', () => {
    expect(getKeySpaceConflictStrategy('op_universe_presence:abc')).toBe(
      'ephemeral-ignore-conflict',
    );
    expect(getKeySpaceConflictPolicy('op_universe_edit_holder:xyz').ignoreVersionConflict).toBe(
      true,
    );
  });

  it('maps prefs/layout/session keys to silent LWW', () => {
    expect(getKeySpaceConflictStrategy('op_prefs')).toBe('silent-lww');
    expect(getKeySpaceConflictStrategy('op_session')).toBe('silent-lww');
    expect(getKeySpaceConflictStrategy('op_dialog_state_v1:u_1')).toBe('silent-lww');
    expect(getKeySpaceConflictPolicy('op_dialog_state_v1:u_1').maxRetries).toBe(2);
  });

  it('maps app structured state to merge-rebase by default', () => {
    expect(getKeySpaceConflictStrategy('op_app_state:todo:u_1:instance_1')).toBe('merge-rebase');
    expect(getKeySpaceConflictPolicy('op_app_state:kanban:u_1:instance_1').strategy).toBe(
      'merge-rebase',
    );
  });

  it('maps notes app content namespace to crdt-text-ready strategy', () => {
    expect(getKeySpaceConflictStrategy('op_app_state:notes:u_1:note_1')).toBe('crdt-text');
    expect(getKeySpaceConflictPolicy('op_app_state:notes:u_1:note_1').maxRetries).toBe(3);
  });
});
