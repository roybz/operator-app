export interface NotesTextMergeInput {
  localText: string;
  remoteText: string;
  baseText?: string | null;
}

export interface NotesTextMergeResult {
  text: string;
  mode: 'local' | 'remote' | 'merged';
  conflict: boolean;
}

export interface NotesTextCollabAdapter {
  merge(input: NotesTextMergeInput): NotesTextMergeResult;
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

function splitBlocks(value: string) {
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function mergeBlocks(localBlocks: string[], remoteBlocks: string[]) {
  const localSet = new Set(localBlocks);
  const merged = [...localBlocks];
  for (const block of remoteBlocks) {
    if (!localSet.has(block)) {
      merged.push(block);
      localSet.add(block);
    }
  }
  return merged.join('\n\n');
}

export class NotesParagraphCollabAdapter implements NotesTextCollabAdapter {
  merge(input: NotesTextMergeInput): NotesTextMergeResult {
    const localText = normalizeText(input.localText);
    const remoteText = normalizeText(input.remoteText);
    const baseText = input.baseText == null ? null : normalizeText(input.baseText);

    if (localText === remoteText) {
      return { text: localText, mode: 'local', conflict: false };
    }
    if (baseText !== null && localText === baseText) {
      return { text: remoteText, mode: 'remote', conflict: false };
    }
    if (baseText !== null && remoteText === baseText) {
      return { text: localText, mode: 'local', conflict: false };
    }
    if (!localText.trim()) {
      return { text: remoteText, mode: 'remote', conflict: false };
    }
    if (!remoteText.trim()) {
      return { text: localText, mode: 'local', conflict: false };
    }

    const merged = mergeBlocks(splitBlocks(localText), splitBlocks(remoteText));
    if (merged === localText) {
      return { text: localText, mode: 'local', conflict: true };
    }
    if (merged === remoteText) {
      return { text: remoteText, mode: 'remote', conflict: true };
    }
    return { text: merged, mode: 'merged', conflict: true };
  }
}

export const notesTextCollabAdapter: NotesTextCollabAdapter = new NotesParagraphCollabAdapter();
