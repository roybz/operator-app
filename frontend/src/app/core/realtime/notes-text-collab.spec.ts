import { NotesParagraphCollabAdapter } from './notes-text-collab';

describe('NotesParagraphCollabAdapter', () => {
  const adapter = new NotesParagraphCollabAdapter();

  it('keeps local text when remote matches base', () => {
    const result = adapter.merge({
      baseText: 'A',
      localText: 'A local',
      remoteText: 'A',
    });
    expect(result.mode).toBe('local');
    expect(result.conflict).toBe(false);
    expect(result.text).toBe('A local');
  });

  it('keeps remote text when local matches base', () => {
    const result = adapter.merge({
      baseText: 'A',
      localText: 'A',
      remoteText: 'A remote',
    });
    expect(result.mode).toBe('remote');
    expect(result.conflict).toBe(false);
    expect(result.text).toBe('A remote');
  });

  it('merges unique paragraph additions deterministically', () => {
    const result = adapter.merge({
      localText: 'Local one\n\nShared',
      remoteText: 'Remote one\n\nShared',
    });
    expect(result.mode).toBe('merged');
    expect(result.conflict).toBe(true);
    expect(result.text).toBe('Local one\n\nShared\n\nRemote one');
  });
});
