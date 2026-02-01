import { Component, Input, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { StorageService } from '../../../../core/storage/storage.service';

type StickyMode = 'rich' | 'markdown';

interface StickyNoteState {
  content: string;
  mode: StickyMode;
  visualMode: boolean;
  locked: boolean;
  fontSize: number;
  colorEnabled: boolean;
  bgColor: string;
  textColor: string;
}

const stateStore = new Map<string, StickyNoteState>();
const STORAGE_PREFIX = 'op_app_state:sticky_note';

const storageKey = (userId: string, instanceId: string) =>
  `${STORAGE_PREFIX}:${userId}:${instanceId}`;

export const clearStickyNoteState = (instanceId: string, storage: StorageService) => {
  stateStore.delete(instanceId);
  storage
    .keysSync()
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => void storage.removeItem(key));
};

export const cloneStickyNoteState = (fromId: string, toId: string, storage: StorageService) => {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, { ...stored });
  storage
    .keysSync()
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${fromId}`))
    .forEach((key) => {
      const value = storage.getItemSync(key);
      if (value === null) return;
      const nextKey = key.replace(`:${fromId}`, `:${toId}`);
      void storage.setItem(nextKey, value);
    });
};

const defaultState = (mode: StickyMode): StickyNoteState => ({
  content: '',
  mode,
  visualMode: false,
  locked: false,
  fontSize: 16,
  colorEnabled: false,
  bgColor: '',
  textColor: '',
});

@Component({
  selector: 'app-sticky-notes',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .sticky-shell {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
      }

      :host-context(.phone-mode) .sticky-shell {
        padding: 12px;
      }

      :host-context(.phone-mode) button {
        min-height: 40px;
      }
    `,
  ],
  template: `
    <div class="sticky-shell">
      @if (settingsOpen()) {
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0;">{{ 'sticky.settingsTitle' | translate }}</h3>
            <button (click)="closeSettings()">{{ 'sticky.closeSettings' | translate }}</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <button (click)="toggleModeClick()">
                {{
                  state().mode === 'markdown'
                    ? ('notes.switchToRich' | translate)
                    : ('notes.switchToMarkdown' | translate)
                }}
              </button>
              <span style="font-size:12px; font-style:italic; opacity:0.7;">
                {{ 'sticky.currentlyIn' | translate }}
                {{
                  state().mode === 'markdown'
                    ? ('sticky.modeMarkdown' | translate)
                    : ('sticky.modeRich' | translate)
                }}
              </span>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <button (click)="toggleVisualClick()">
                {{
                  state().visualMode
                    ? ('notes.switchToEditing' | translate)
                    : ('notes.switchToVisual' | translate)
                }}
              </button>
              <span style="font-size:12px; font-style:italic; opacity:0.7;">
                {{ 'sticky.currentlyIn' | translate }}
                {{
                  state().visualMode
                    ? ('sticky.visualMode' | translate)
                    : ('sticky.editMode' | translate)
                }}
              </span>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <button (click)="toggleLockClick()">
                {{ state().locked ? ('notes.unlock' | translate) : ('notes.lock' | translate) }}
              </button>
              <span style="font-size:12px; font-style:italic; opacity:0.7;">
                {{
                  state().locked
                    ? ('sticky.currentlyLocked' | translate)
                    : ('sticky.currentlyUnlocked' | translate)
                }}
              </span>
            </div>
          </div>

          <label>
            {{ 'sticky.fontSize' | translate }}
            <input
              type="number"
              min="10"
              max="64"
              [value]="state().fontSize"
              (input)="updateFontSize($event)"
              style="width:120px;"
            />
          </label>

          <label style="display:flex; gap:8px; align-items:center;">
            <input
              type="checkbox"
              [checked]="state().colorEnabled"
              (change)="toggleColors($event)"
              [disabled]="accessibilityMode()"
            />
            {{ 'sticky.colorsEnabled' | translate }}
          </label>

          <div style="display:flex; gap:12px; align-items:center;">
            <label style="display:flex; gap:8px; align-items:center;">
              {{ 'sticky.backgroundColor' | translate }}
              <input
                type="color"
                [value]="state().bgColor"
                (input)="updateBgColor($event)"
                [disabled]="!state().colorEnabled || accessibilityMode()"
              />
            </label>
            <label style="display:flex; gap:8px; align-items:center;">
              {{ 'sticky.textColor' | translate }}
              <input
                type="color"
                [value]="state().textColor"
                (input)="updateTextColor($event)"
                [disabled]="!state().colorEnabled || accessibilityMode()"
              />
            </label>
          </div>
        </div>
      } @else {
        <div
          [style.background]="state().colorEnabled ? state().bgColor : 'transparent'"
          [style.color]="state().colorEnabled ? state().textColor : 'inherit'"
          style="flex:1; display:flex; flex-direction:column; gap:8px;"
        >
          @if (!state().visualMode) {
            @if (state().mode === 'rich') {
              <div
                contenteditable="true"
                [innerHTML]="richHtml()"
                (focus)="startRichEdit()"
                (input)="onRichInput($event)"
                (blur)="finishRichEdit()"
                [style.pointerEvents]="state().locked ? 'none' : 'auto'"
                [style.opacity]="state().locked ? 0.6 : 1"
                [style.fontSize.px]="state().fontSize"
                style="border:1px solid var(--color-border); border-radius:6px; padding:10px; min-height:200px; flex:1;"
              ></div>
            } @else {
              <textarea
                [value]="state().content"
                (input)="onMarkdownInput($event)"
                [disabled]="state().locked"
                [style.fontSize.px]="state().fontSize"
                style="border:1px solid var(--color-border); border-radius:6px; padding:10px; min-height:200px; flex:1;"
              ></textarea>
            }
          } @else {
            <div
              [innerHTML]="renderVisual()"
              [style.fontSize.px]="state().fontSize"
              style="border:1px solid var(--color-border); border-radius:6px; padding:10px; min-height:200px; flex:1;"
            ></div>
          }
        </div>
      }
    </div>
  `,
})
export class StickyNotesComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  private instanceSettings = inject(InstanceSettingsService);
  private storage = inject(StorageService);

  state = signal<StickyNoteState>(defaultState('rich'));
  settingsOpen = computed(() => this.instanceSettings.isOpen(this.instanceId));
  accessibilityMode = computed(() => this.prefs.preferences().accessibilityMode);
  richFocused = signal(false);
  richSnapshot = signal('');
  richHtml = computed(() => (this.richFocused() ? this.richSnapshot() : this.state().content));

  constructor() {
    effect(() => {
      if (this.accessibilityMode() && this.state().colorEnabled) {
        this.commit({ ...this.state(), colorEnabled: false });
      }
    });
  }

  ngOnInit() {
    const userId = this.prefs.userId();
    const defaultMode = this.prefs.preferences().stickyNoteDefaultMode ?? 'rich';
    const fallback = defaultState(defaultMode);
    const raw = this.storage.getItemSync(storageKey(userId, this.instanceId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StickyNoteState;
        this.state.set({ ...fallback, ...parsed });
        this.syncRichSnapshot();
        stateStore.set(this.instanceId, this.state());
        return;
      } catch {
        // ignore malformed stored data
      }
    }
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.state.set({ ...fallback, ...stored });
      this.syncRichSnapshot();
    } else {
      this.state.set(fallback);
      stateStore.set(this.instanceId, this.state());
    }
    this.persistState();
  }

  closeSettings() {
    this.instanceSettings.close(this.instanceId);
  }

  toggleMode(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const nextMode: StickyMode = checked ? 'markdown' : 'rich';
    this.applyMode(nextMode);
  }

  toggleModeClick() {
    const nextMode: StickyMode = this.state().mode === 'markdown' ? 'rich' : 'markdown';
    this.applyMode(nextMode);
  }

  private applyMode(nextMode: StickyMode) {
    let nextContent = this.state().content;
    if (nextMode === 'markdown' && this.state().mode === 'rich') {
      nextContent = this.richToPlainText(nextContent);
    }
    this.commit({ ...this.state(), mode: nextMode, content: nextContent });
    this.syncRichSnapshot();
  }

  toggleVisual(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.commit({ ...this.state(), visualMode: checked });
  }

  toggleVisualClick() {
    this.commit({ ...this.state(), visualMode: !this.state().visualMode });
  }

  toggleLock(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.commit({ ...this.state(), locked: checked });
  }

  toggleLockClick() {
    this.commit({ ...this.state(), locked: !this.state().locked });
  }

  updateFontSize(event: Event) {
    const raw = Number((event.target as HTMLInputElement).value);
    const next = Number.isFinite(raw) ? Math.min(64, Math.max(10, raw)) : 16;
    this.commit({ ...this.state(), fontSize: next });
  }

  toggleColors(event: Event) {
    if (this.accessibilityMode()) return;
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      const colors = this.getThemeColors();
      this.commit({
        ...this.state(),
        colorEnabled: true,
        bgColor: colors.bg,
        textColor: colors.text,
      });
      return;
    }
    this.commit({ ...this.state(), colorEnabled: false });
  }

  updateBgColor(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.commit({ ...this.state(), bgColor: value });
  }

  updateTextColor(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.commit({ ...this.state(), textColor: value });
  }

  startRichEdit() {
    this.richFocused.set(true);
    this.syncRichSnapshot();
  }

  finishRichEdit() {
    this.richFocused.set(false);
    this.commit({ ...this.state() });
    this.syncRichSnapshot();
  }

  onRichInput(event: Event) {
    if (this.state().locked) return;
    const target = event.target as HTMLElement;
    const next = { ...this.state(), content: target.innerHTML };
    this.state.set(next);
  }

  onMarkdownInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.commit({ ...this.state(), content: target.value });
  }

  renderVisual() {
    const content = this.state().content;
    if (this.state().mode === 'markdown') {
      return this.renderMarkdown(content);
    }
    return this.normalizeRichHtml(content);
  }

  private commit(next: StickyNoteState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  private persistState() {
    const userId = this.prefs.userId();
    void this.storage.setItem(storageKey(userId, this.instanceId), JSON.stringify(this.state()));
  }

  private syncRichSnapshot() {
    if (!this.richFocused()) {
      this.richSnapshot.set(this.state().content || '');
    }
  }

  private getThemeColors() {
    if (typeof window === 'undefined') {
      return { bg: '#ffffff', text: '#111827' };
    }
    const styles = getComputedStyle(document.body);
    const bg = styles.getPropertyValue('--color-surface').trim() || '#ffffff';
    const text = styles.getPropertyValue('--color-text').trim() || '#111827';
    return { bg, text };
  }

  private renderMarkdown(input: string) {
    const escaped = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped
      .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  }

  private normalizeRichHtml(input: string) {
    return input
      .replace(/\u00a0/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;nbsp;/g, ' ')
      .replace(/<div><br><\/div>/g, '<br />')
      .replace(/<div>/g, '')
      .replace(/<\/div>/g, '<br />');
  }

  private richToPlainText(input: string) {
    const normalized = this.normalizeRichHtml(input)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    return normalized
      .replace(/\u00a0/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }
}
