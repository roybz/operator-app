import { Component, Input, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../core/auth.service';

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

export function clearNavigatorState(instanceId: string) {
  stateStore.delete(instanceId);
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
  template: `
    <div style="display:flex; flex-direction:column; gap:8px; height:100%;">
      <div style="display:flex; gap:8px; align-items:center;">
        <button (click)="goBack()">←</button>
        <button (click)="goForward()">→</button>
        <button (click)="refresh()">⟳</button>
        <input
          type="text"
          [value]="activeTab()?.url"
          (change)="navigate($event)"
          style="flex:1; padding:6px;"
        />
        <button (click)="addTab()">+</button>
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
export class NavigatorComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  private auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);
  state = signal<NavigatorState>({ tabs: [], activeTabId: '' });
  language = signal('en');

  constructor() {
    effect(() => {
      const fallback = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const preferred = this.auth.preferences().language || fallback;
      this.language.set(preferred);
    });
  }

  ngOnInit() {
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.state.set({ ...stored, tabs: stored.tabs.map((tab) => ({ ...tab })) });
      return;
    }
    const initialUrl =
      typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
    const tab = createTab(initialUrl);
    const next = { tabs: [tab], activeTabId: tab.id };
    this.state.set(next);
    stateStore.set(this.instanceId, next);
  }

  private commit(next: NavigatorState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
  }

  activeTab() {
    return this.state().tabs.find((tab) => tab.id === this.state().activeTabId) ?? null;
  }

  addTab() {
    const url = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
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
      const fallback = createTab('https://example.com');
      this.commit({ tabs: [fallback], activeTabId: fallback.id });
      return;
    }
    const activeTabId = this.state().activeTabId === id ? tabs[0].id : this.state().activeTabId;
    this.commit({ ...this.state(), tabs, activeTabId });
  }

  navigate(event: Event) {
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
    const active = this.activeTab();
    if (!active || active.historyIndex === 0) return;
    const nextIndex = active.historyIndex - 1;
    const url = active.history[nextIndex];
    this.updateTab({ ...active, url, title: formatTitle(url), historyIndex: nextIndex });
  }

  goForward() {
    const active = this.activeTab();
    if (!active || active.historyIndex >= active.history.length - 1) return;
    const nextIndex = active.historyIndex + 1;
    const url = active.history[nextIndex];
    this.updateTab({ ...active, url, title: formatTitle(url), historyIndex: nextIndex });
  }

  refresh() {
    const active = this.activeTab();
    if (!active) return;
    this.updateTab({ ...active });
  }

  private updateTab(nextTab: NavigatorTab) {
    const tabs = this.state().tabs.map((tab) => (tab.id === nextTab.id ? nextTab : tab));
    this.commit({ ...this.state(), tabs });
  }

  safeUrl(url?: string): SafeResourceUrl {
    const next = url ?? 'about:blank';
    return this.sanitizer.bypassSecurityTrustResourceUrl(next);
  }
}
