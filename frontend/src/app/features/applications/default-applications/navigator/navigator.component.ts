import { Component, Input, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import {
  buildInstanceStorageKey,
  clearInstanceScopedState,
  cloneInstanceScopedState,
} from '../../../dependencies/instance-state-storage';
import { StorageService } from '../../../../core/storage/storage.service';
import { RemoteConflictService } from '../../../../core/realtime/remote-conflict.service';
import {
  InstancePersistQueue,
  isRemoteStorageTooManyRequests,
  isRemoteStorageVersionConflict,
} from '../../../../core/realtime/instance-persist-queue';

interface NavigatorTab {
  id: string;
  url: string;
  title: string;
  history: string[];
  historyIndex: number;
}

interface NavigatorState {
  tabs: NavigatorTab[];
  activeTabId: string;
}

const stateStore = new Map<string, NavigatorState>();
const STORAGE_PREFIX = 'op_app_state:navigator';
// Temporarily disabled to prevent iframe navigation misuse.
const NAVIGATION_DISABLED = true;

export function clearNavigatorState(instanceId: string, storage: StorageService) {
  clearInstanceScopedState(stateStore, STORAGE_PREFIX, instanceId, storage);
}

export function cloneNavigatorState(fromId: string, toId: string, storage: StorageService) {
  cloneInstanceScopedState(stateStore, STORAGE_PREFIX, fromId, toId, storage, (stored) => ({
    ...stored,
    tabs: stored.tabs.map((tab) => ({ ...tab, history: [...tab.history] })),
  }));
}

const createTab = (url: string): NavigatorTab => ({
  id: `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  url,
  title: formatTitle(url),
  history: [url],
  historyIndex: 0,
});

const formatTitle = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname || url;
  } catch {
    return url;
  }
};

@Component({
  selector: 'app-navigator',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .navigator-shell {
        display: flex;
        flex-direction: column;
        gap: 8px;
        height: 100%;
      }

      :host-context(.phone-mode) .navigator-shell {
        padding: 12px;
      }

      :host-context(.phone-mode) .navigator-toolbar {
        flex-wrap: wrap;
      }
    `,
  ],
  template: `
    <div class="navigator-shell">
      <div class="navigator-toolbar" style="display:flex; gap:8px; align-items:center;">
        <button (click)="goBack()" [disabled]="navigationDisabled">←</button>
        <button (click)="goForward()" [disabled]="navigationDisabled">→</button>
        <button (click)="refresh()" [disabled]="navigationDisabled">⟳</button>
        <input
          type="text"
          [value]="activeTab()?.url"
          (change)="navigate($event)"
          [disabled]="navigationDisabled"
          style="flex:1; padding:6px;"
        />
        <button (click)="addTab()" [disabled]="navigationDisabled">+</button>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        @for (tab of state().tabs; track tab.id) {
          <div style="display:flex; align-items:center; gap:4px;">
            <button
              (click)="activateTab(tab.id)"
              [style.fontWeight]="tab.id === state().activeTabId ? '600' : '400'"
            >
              {{ tab.title }}
            </button>
            <button (click)="closeTab(tab.id)">✕</button>
          </div>
        }
      </div>

      <div style="flex:1; border:1px solid #ccc; border-radius:6px; overflow:hidden;">
        @if (activeTab()) {
          <iframe
            [attr.lang]="language()"
            [src]="safeUrl(activeTab()?.url)"
            style="width:100%; height:100%; border:0;"
          ></iframe>
        }
      </div>
    </div>
  `,
})
export class NavigatorComponent implements OnInit, OnDestroy {
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  private sanitizer = inject(DomSanitizer);
  private storage = inject(StorageService);
  private remoteConflict = inject(RemoteConflictService);
  state = signal<NavigatorState>({ tabs: [], activeTabId: '' });
  language = signal('en');
  navigationDisabled = NAVIGATION_DISABLED;
  private readonly persistQueue = new InstancePersistQueue({
    flush: async () => {
      await this.storage.setItem(this.instanceStorageKey(), JSON.stringify(this.state()));
    },
    onError: async (error) => this.handlePersistError(error),
    isTooManyRequests: isRemoteStorageTooManyRequests,
  });

  constructor() {
    effect(() => {
      const fallback = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      this.language.set(this.prefs.language() || fallback);
    });
    effect(() => {
      const event = this.storage.lastRemoteChange();
      if (!event || !this.instanceId) return;
      const key = this.instanceStorageKey();
      if (!event.keys.includes(key)) return;
      this.reloadFromStorage();
    });
  }

  ngOnInit() {
    const raw = this.storage.getItemSync(this.instanceStorageKey());
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as NavigatorState;
        this.state.set(parsed);
        stateStore.set(this.instanceId, parsed);
        return;
      } catch {
        // ignore malformed stored data
      }
    }
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.state.set({ ...stored, tabs: stored.tabs.map((tab) => ({ ...tab })) });
      return;
    }
    const initialUrl = 'about:blank';
    const tab = createTab(initialUrl);
    const next = { tabs: [tab], activeTabId: tab.id };
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState({ immediate: true });
  }

  ngOnDestroy() {
    this.persistQueue.destroy();
  }

  private commit(next: NavigatorState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  activeTab() {
    return this.state().tabs.find((tab) => tab.id === this.state().activeTabId) ?? null;
  }

  addTab() {
    const url = 'about:blank';
    const tab = createTab(url);
    const next = { ...this.state(), tabs: [...this.state().tabs, tab], activeTabId: tab.id };
    this.commit(next);
  }

  activateTab(id: string) {
    if (this.state().activeTabId === id) return;
    this.commit({ ...this.state(), activeTabId: id });
  }

  closeTab(id: string) {
    const tabs = this.state().tabs.filter((tab) => tab.id !== id);
    if (!tabs.length) {
      const fallback = createTab('about:blank');
      this.commit({ tabs: [fallback], activeTabId: fallback.id });
      return;
    }
    const activeTabId = this.state().activeTabId === id ? tabs[0].id : this.state().activeTabId;
    this.commit({ ...this.state(), tabs, activeTabId });
  }

  navigate(event: Event) {
    if (NAVIGATION_DISABLED) return;
    const input = (event.target as HTMLInputElement).value.trim();
    if (!input) return;
    const url = input.includes('://') ? input : `https://${input}`;
    const active = this.activeTab();
    if (!active) return;
    const history = active.history.slice(0, active.historyIndex + 1);
    history.push(url);
    const nextTab = {
      ...active,
      url,
      title: formatTitle(url),
      history,
      historyIndex: history.length - 1,
    };
    this.updateTab(nextTab);
  }

  goBack() {
    if (NAVIGATION_DISABLED) return;
    const active = this.activeTab();
    if (!active || active.historyIndex === 0) return;
    const nextIndex = active.historyIndex - 1;
    const url = active.history[nextIndex];
    this.updateTab({ ...active, url, title: formatTitle(url), historyIndex: nextIndex });
  }

  goForward() {
    if (NAVIGATION_DISABLED) return;
    const active = this.activeTab();
    if (!active || active.historyIndex >= active.history.length - 1) return;
    const nextIndex = active.historyIndex + 1;
    const url = active.history[nextIndex];
    this.updateTab({ ...active, url, title: formatTitle(url), historyIndex: nextIndex });
  }

  refresh() {
    if (NAVIGATION_DISABLED) return;
    const active = this.activeTab();
    if (!active) return;
    this.updateTab({ ...active });
  }

  private updateTab(nextTab: NavigatorTab) {
    const tabs = this.state().tabs.map((tab) => (tab.id === nextTab.id ? nextTab : tab));
    this.commit({ ...this.state(), tabs });
  }

  private persistState(options?: { immediate?: boolean }) {
    this.persistQueue.schedule(options);
  }

  private instanceStorageKey() {
    return buildInstanceStorageKey(STORAGE_PREFIX, this.prefs.userId(), this.instanceId || '');
  }

  private reloadFromStorage() {
    const raw = this.storage.getItemSync(this.instanceStorageKey());
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as NavigatorState;
      const next = {
        ...parsed,
        tabs: parsed.tabs.map((tab) => ({ ...tab, history: [...tab.history] })),
      };
      this.state.set(next);
      stateStore.set(this.instanceId, next);
      return true;
    } catch {
      return false;
    }
  }

  private async handlePersistError(error: unknown) {
    const key = this.instanceStorageKey();
    if (isRemoteStorageVersionConflict(error)) {
      this.remoteConflict.queue([key], 'dirty');
      try {
        await this.storage.getItem(key);
      } catch {
        // Ignore cache refresh failures; polling/realtime will retry.
      }
      this.reloadFromStorage();
      return 'handled' as const;
    }
    return undefined;
  }

  safeUrl(url?: string): SafeResourceUrl {
    const next = NAVIGATION_DISABLED ? 'about:blank' : (url ?? 'about:blank');
    return this.sanitizer.bypassSecurityTrustResourceUrl(next);
  }
}
