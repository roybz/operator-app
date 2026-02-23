import { TestBed } from '@angular/core/testing';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { NotesComponent } from './notes.component';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { buildInstanceStorageKey } from '../../../dependencies/instance-state-storage';

interface NoteLike {
  id: string;
  type: 'folder' | 'note';
  content?: string;
  children?: NoteLike[];
}

function findNode(node: NoteLike, id: string): NoteLike | null {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

describe('NotesComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [
        NotesComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { notes: { root: 'Notes' } });
    translate.use('en');

    const fixture = TestBed.createComponent(NotesComponent);
    fixture.componentInstance.instanceId = 'notes_test';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders notes tree', async () => {
    const fixture = await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Notes');
  });

  it('reloads from storage on relevant remote change when editor is not focused', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    const storage = TestBed.inject(StorageService);
    const prefs = TestBed.inject(AppPreferencesService);
    const key = buildInstanceStorageKey('op_app_state:notes', prefs.userId(), component.instanceId);

    const nextState = JSON.parse(JSON.stringify(component.state())) as {
      root: NoteLike;
      selectedId: string | null;
    };
    const selectedId = nextState.selectedId;
    expect(selectedId).toBeTruthy();
    const selected = findNode(nextState.root, String(selectedId));
    expect(selected?.type).toBe('note');
    if (!selected || selected.type !== 'note') throw new Error('Expected selected note');
    selected.content = 'Remote update';

    await storage.setItem(key, JSON.stringify(nextState));
    storage.lastRemoteChange.set({ seq: 1, keys: [key] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.selectedNode()?.content).toBe('Remote update');
  });

  it('does not clobber focused rich editor on relevant remote change', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    const storage = TestBed.inject(StorageService);
    const prefs = TestBed.inject(AppPreferencesService);
    const key = buildInstanceStorageKey('op_app_state:notes', prefs.userId(), component.instanceId);

    const beforeContent = component.selectedNode()?.content ?? '';
    component.richFocused.set(true);
    component.richSnapshot.set('Local typing draft');

    const nextState = JSON.parse(JSON.stringify(component.state())) as {
      root: NoteLike;
      selectedId: string | null;
    };
    const selected = findNode(nextState.root, String(nextState.selectedId));
    expect(selected?.type).toBe('note');
    if (!selected || selected.type !== 'note') throw new Error('Expected selected note');
    selected.content = 'Remote update while focused';

    await storage.setItem(key, JSON.stringify(nextState));
    storage.lastRemoteChange.set({ seq: 2, keys: [key] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.selectedNode()?.content).toBe(beforeContent);
    expect(component.richSnapshot()).toBe('Local typing draft');
  });
});
