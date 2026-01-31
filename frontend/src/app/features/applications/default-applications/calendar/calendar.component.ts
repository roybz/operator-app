import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { ImportGuardService } from '../../../../core/import-guard.service';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
}

interface ExternalCalendar {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  sourceUrl: string;
  events: CalendarEvent[];
}

interface CalendarState {
  viewDate: string;
  viewMode: 'month' | 'week' | 'day';
  calendars: ExternalCalendar[];
  showSettings: boolean;
  selectedCalendarId: string | null;
}

const stateStore = new Map<string, CalendarState>();
const STORAGE_PREFIX = 'op_app_state:calendar';

const storageKey = (userId: string, instanceId: string) =>
  `${STORAGE_PREFIX}:${userId}:${instanceId}`;

export function clearCalendarState(instanceId: string) {
  stateStore.delete(instanceId);
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function cloneCalendarState(fromId: string, toId: string) {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, {
    ...stored,
    calendars: stored.calendars.map((cal) => ({
      ...cal,
      events: cal.events.map((event) => ({ ...event })),
    })),
  });
}

const defaultState = (): CalendarState => ({
  viewDate: new Date().toISOString(),
  viewMode: 'month',
  calendars: [],
  showSettings: true,
  selectedCalendarId: null,
});

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmDialogComponent],
  template: `
    <div style="display:flex; gap:16px; height:100%;">
      <section style="flex:1; display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <button (click)="shiftPeriod(-1)">←</button>
            <strong>{{ periodLabel() }}</strong>
            <button (click)="shiftPeriod(1)">→</button>
          </div>
          <div style="display:flex; gap:6px;">
            <button (click)="setViewMode('month')" [disabled]="state().viewMode === 'month'">
              {{ 'calendar.viewMonth' | translate }}
            </button>
            <button (click)="setViewMode('week')" [disabled]="state().viewMode === 'week'">
              {{ 'calendar.viewWeek' | translate }}
            </button>
            <button (click)="setViewMode('day')" [disabled]="state().viewMode === 'day'">
              {{ 'calendar.viewDay' | translate }}
            </button>
          </div>
          <button (click)="toggleSettings()">
            {{
              state().showSettings
                ? ('calendar.hideSettings' | translate)
                : ('calendar.showSettings' | translate)
            }}
          </button>
        </div>

        @if (state().viewMode === 'month') {
          <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px;">
            @for (label of weekdayLabels(); track label) {
              <div style="font-size:12px; opacity:0.7;">{{ label }}</div>
            }
            @for (day of calendarDays(); track day.date) {
              <div
                (click)="openDay(day.date)"
                (keydown.enter)="openDay(day.date)"
                (keydown.space)="openDay(day.date)"
                tabindex="0"
                role="button"
                style="border:1px solid var(--color-border); border-radius:8px; padding:6px; min-height:90px; display:flex; flex-direction:column; gap:4px; cursor:pointer;"
                [style.opacity]="day.inMonth ? 1 : 0.45"
              >
                <div style="font-size:12px; opacity:0.7;">{{ day.label }}</div>
                <div
                  style="display:flex; flex-direction:column; gap:2px; overflow:auto; max-height:120px;"
                >
                  @for (event of day.events; track event.id) {
                    <div
                      style="font-size:11px; padding:2px 4px; border-radius:4px; color:var(--color-text);"
                      [style.background]="event.color"
                      [title]="event.title"
                    >
                      {{ event.title }}
                    </div>
                  }
                  @if (!day.events.length) {
                    <span style="font-size:11px; opacity:0.4;">—</span>
                  }
                </div>
              </div>
            }
          </div>
        } @else if (state().viewMode === 'week') {
          <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px;">
            @for (day of weekDays(); track day.date) {
              <div
                style="border:1px solid var(--color-border); border-radius:8px; padding:6px; min-height:120px; display:flex; flex-direction:column; gap:4px;"
              >
                <div style="font-size:12px; opacity:0.7;">{{ day.label }}</div>
                <div style="display:flex; flex-direction:column; gap:2px; overflow:auto;">
                  @for (event of day.events; track event.id) {
                    <div
                      style="font-size:11px; padding:2px 4px; border-radius:4px; color:var(--color-text);"
                      [style.background]="event.color"
                      [title]="event.title"
                    >
                      {{ event.title }}
                    </div>
                  }
                  @if (!day.events.length) {
                    <span style="font-size:11px; opacity:0.4;">—</span>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div style="border:1px solid var(--color-border); border-radius:8px; padding:12px;">
            <strong>{{ dayLabel() }}</strong>
            <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
              @for (event of dayEvents(); track event.id) {
                <div
                  style="padding:6px 8px; border-radius:6px; color:var(--color-text);"
                  [style.background]="event.color"
                >
                  {{ event.title }}
                </div>
              }
              @if (!dayEvents().length) {
                <span style="opacity:0.5;">{{ 'calendar.noEvents' | translate }}</span>
              }
            </div>
          </div>
        }
      </section>

      @if (state().showSettings) {
        <aside
          style="width:280px; border-left:1px solid var(--color-border); padding-left:12px; overflow:auto;"
        >
          <h4 style="margin-top:0;">{{ 'calendar.integrations' | translate }}</h4>

          <div style="display:grid; gap:10px;">
            @for (cal of state().calendars; track cal.id) {
              <div style="border:1px solid var(--color-border); border-radius:8px; padding:8px;">
                <label style="display:flex; align-items:center; gap:8px;">
                  <input
                    type="checkbox"
                    [checked]="cal.visible"
                    (change)="toggleCalendarVisibility(cal, $event)"
                  />
                  <span style="font-weight:600;">{{ cal.name }}</span>
                </label>
                <div style="display:flex; gap:8px; align-items:center; margin-top:6px;">
                  <label style="display:flex; align-items:center; gap:6px;">
                    <span>{{ 'calendar.color' | translate }}</span>
                    <input type="color" [value]="cal.color" (change)="updateColor(cal, $event)" />
                  </label>
                  <button (click)="selectCalendar(cal)">{{ 'calendar.manage' | translate }}</button>
                  <button (click)="removeCalendar(cal)">
                    {{ 'calendar.remove' | translate }}
                  </button>
                </div>
              </div>
            }
          </div>

          <div style="margin-top:16px;">
            <h5>{{ 'calendar.addCalendar' | translate }}</h5>
            <fieldset [disabled]="true" style="border:none; padding:0; margin:0; opacity:0.6;">
              <label style="display:block; margin-bottom:6px;">
                {{ 'calendar.name' | translate }}
                <input
                  type="text"
                  [value]="newName()"
                  (input)="newName.set($any($event.target).value)"
                  style="width:100%; padding:6px;"
                />
              </label>
              <label style="display:block; margin-bottom:6px;">
                {{ 'calendar.sourceUrl' | translate }}
                <input
                  type="text"
                  [value]="newUrl()"
                  (input)="newUrl.set($any($event.target).value)"
                  style="width:100%; padding:6px;"
                />
              </label>
              <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <span>{{ 'calendar.color' | translate }}</span>
                <input type="color" [value]="newColor()" (change)="updateNewColor($event)" />
              </label>
              <button (click)="addCalendar()">{{ 'calendar.add' | translate }}</button>
            </fieldset>
            <div style="font-size:12px; opacity:0.7;">{{ 'calendar.addDisabled' | translate }}</div>
          </div>

          @if (selectedCalendar()) {
            <div style="margin-top:16px;">
              <h5>{{ 'calendar.importTitle' | translate }}</h5>
              <p style="font-size:12px; opacity:0.7; margin-top:0;">
                {{ 'calendar.importHint' | translate }}
              </p>
              <textarea
                [value]="importDraft()"
                (input)="importDraft.set($any($event.target).value)"
                style="width:100%; min-height:120px; padding:6px;"
              ></textarea>
              <button style="margin-top:8px;" (click)="importEvents()">
                {{ 'calendar.import' | translate }}
              </button>
              @if (importStatus() === 'loading') {
                <div style="margin-top:6px; opacity:0.7;">
                  {{ 'dialogs.importing' | translate }}
                </div>
              } @else if (importStatus() === 'success') {
                <div style="margin-top:6px; color:#1b5e20;">
                  {{ 'dialogs.importSuccess' | translate }}
                </div>
              } @else if (importStatus() === 'error') {
                <div style="margin-top:6px; color:#b00020;">
                  {{ importMessage() ?? '' | translate }}
                </div>
              }
            </div>
          }
        </aside>
      }
    </div>

    @if (confirmImportOpen()) {
      <app-confirm-dialog
        [title]="'dialogs.importTitle' | translate"
        [message]="'dialogs.importConfirm' | translate"
        [confirmLabel]="'dialogs.confirm' | translate"
        [cancelLabel]="'dialogs.cancel' | translate"
        (confirmed)="confirmImport()"
        (canceled)="confirmImportOpen.set(false)"
      />
    }
    @if (importLimitOpen()) {
      <app-confirm-dialog
        [message]="'dialogs.importLimit' | translate"
        [confirmLabel]="'dialogs.ok' | translate"
        [showCancel]="false"
        (confirmed)="importLimitOpen.set(false)"
      />
    }
  `,
})
export class CalendarComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  private translate = inject(TranslateService);
  private prefs = inject(AppPreferencesService);
  private importGuard = inject(ImportGuardService);
  state = signal<CalendarState>(defaultState());
  newName = signal('');
  newUrl = signal('');
  newColor = signal('#60a5fa');
  importDraft = signal('');
  confirmImportOpen = signal(false);
  importStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  importMessage = signal<string | null>(null);
  importLimitOpen = signal(false);

  ngOnInit() {
    const userId = this.prefs.userId();
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(storageKey(userId, this.instanceId));
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as CalendarState;
          this.state.set(parsed);
          stateStore.set(this.instanceId, parsed);
          return;
        } catch {
          // ignore malformed stored data
        }
      }
    }
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.state.set({
        ...stored,
        calendars: stored.calendars.map((cal) => ({
          ...cal,
          events: cal.events.map((event) => ({ ...event })),
        })),
      });
      return;
    }
    stateStore.set(this.instanceId, this.state());
    this.persistState();
  }

  private commit(next: CalendarState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  private persistState() {
    if (typeof window === 'undefined') return;
    const userId = this.prefs.userId();
    window.localStorage.setItem(storageKey(userId, this.instanceId), JSON.stringify(this.state()));
  }

  periodLabel() {
    const date = new Date(this.state().viewDate);
    if (this.state().viewMode === 'day') {
      return new Intl.DateTimeFormat(this.prefs.language(), {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: this.prefs.timeZone(),
      }).format(date);
    }
    if (this.state().viewMode === 'week') {
      const weekStart = this.startOfWeek(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString(this.prefs.language())} - ${weekEnd.toLocaleDateString(this.prefs.language())}`;
    }
    return new Intl.DateTimeFormat(this.prefs.language(), {
      month: 'long',
      year: 'numeric',
      timeZone: this.prefs.timeZone(),
    }).format(date);
  }

  weekdayLabels() {
    const base = new Date(Date.UTC(2020, 5, 7));
    return Array.from({ length: 7 }).map((_, idx) => {
      const next = new Date(base);
      next.setUTCDate(base.getUTCDate() + idx);
      return new Intl.DateTimeFormat(this.prefs.language(), {
        weekday: 'short',
      }).format(next);
    });
  }

  calendarDays() {
    const current = new Date(this.state().viewDate);
    const year = current.getFullYear();
    const month = current.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const start = new Date(year, month, 1 - startDay);
    return Array.from({ length: 42 }).map((_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      const inMonth = date.getMonth() === month;
      return {
        date: date.toISOString(),
        label: String(date.getDate()),
        inMonth,
        events: this.eventsForDate(date),
      };
    });
  }

  weekDays() {
    const start = this.startOfWeek(new Date(this.state().viewDate));
    return Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return {
        date: date.toISOString(),
        label: new Intl.DateTimeFormat(this.prefs.language(), {
          weekday: 'short',
          day: 'numeric',
        }).format(date),
        events: this.eventsForDate(date),
      };
    });
  }

  dayEvents() {
    return this.eventsForDate(new Date(this.state().viewDate));
  }

  dayLabel() {
    const date = new Date(this.state().viewDate);
    return new Intl.DateTimeFormat(this.prefs.language(), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  eventsForDate(date: Date) {
    const dayKey = date.toDateString();
    return this.state()
      .calendars.filter((cal) => cal.visible)
      .flatMap((cal) =>
        cal.events
          .filter((event) => new Date(event.start).toDateString() === dayKey)
          .map((event) => ({ ...event, color: cal.color })),
      );
  }

  setViewMode(mode: 'month' | 'week' | 'day') {
    this.commit({ ...this.state(), viewMode: mode });
  }

  openDay(dateIso: string) {
    this.commit({ ...this.state(), viewDate: dateIso, viewMode: 'day' });
  }

  shiftPeriod(delta: number) {
    const current = new Date(this.state().viewDate);
    if (this.state().viewMode === 'day') {
      current.setDate(current.getDate() + delta);
    } else if (this.state().viewMode === 'week') {
      current.setDate(current.getDate() + delta * 7);
    } else {
      current.setMonth(current.getMonth() + delta);
    }
    this.commit({ ...this.state(), viewDate: current.toISOString() });
  }

  private startOfWeek(date: Date) {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }

  toggleSettings() {
    this.commit({ ...this.state(), showSettings: !this.state().showSettings });
  }

  toggleCalendarVisibility(calendar: ExternalCalendar, event: Event) {
    const visible = (event.target as HTMLInputElement).checked;
    this.updateCalendar(calendar.id, { visible });
  }

  updateColor(calendar: ExternalCalendar, event: Event) {
    const color = (event.target as HTMLInputElement).value || '#60a5fa';
    this.updateCalendar(calendar.id, { color });
  }

  selectCalendar(calendar: ExternalCalendar) {
    this.importDraft.set('');
    this.commit({ ...this.state(), selectedCalendarId: calendar.id });
  }

  removeCalendar(calendar: ExternalCalendar) {
    const next = this.state().calendars.filter((cal) => cal.id !== calendar.id);
    const selectedCalendarId =
      this.state().selectedCalendarId === calendar.id ? null : this.state().selectedCalendarId;
    this.commit({ ...this.state(), calendars: next, selectedCalendarId });
  }

  addCalendar() {
    const name = this.newName().trim();
    if (!name) return;
    const calendar: ExternalCalendar = {
      id: this.uid('cal'),
      name,
      color: this.newColor(),
      visible: true,
      sourceUrl: this.newUrl().trim(),
      events: [],
    };
    this.commit({ ...this.state(), calendars: [...this.state().calendars, calendar] });
    this.newName.set('');
    this.newUrl.set('');
  }

  updateNewColor(event: Event) {
    const color = (event.target as HTMLInputElement).value || '#60a5fa';
    this.newColor.set(color);
  }

  selectedCalendar() {
    const id = this.state().selectedCalendarId;
    return id ? (this.state().calendars.find((cal) => cal.id === id) ?? null) : null;
  }

  importEvents() {
    const calendar = this.selectedCalendar();
    if (!calendar) return;
    const raw = this.importDraft().trim();
    if (!raw) return;
    this.confirmImportOpen.set(true);
  }

  confirmImport() {
    const calendar = this.selectedCalendar();
    if (!calendar) {
      this.confirmImportOpen.set(false);
      return;
    }
    if (!this.importGuard.start()) {
      this.importLimitOpen.set(true);
      this.confirmImportOpen.set(false);
      return;
    }
    this.confirmImportOpen.set(false);
    this.importStatus.set('loading');
    this.importMessage.set('dialogs.importing');
    const raw = this.importDraft().trim();
    setTimeout(() => {
      try {
        const parsed = JSON.parse(raw) as { title: string; start: string; end?: string }[];
        const events = Array.isArray(parsed)
          ? parsed.map((event) => ({
              id: this.uid('evt'),
              title: event.title,
              start: event.start,
              end: event.end ?? event.start,
            }))
          : [];
        this.updateCalendar(calendar.id, { events });
        this.importDraft.set('');
        this.importStatus.set('success');
        this.importMessage.set('dialogs.importSuccess');
      } catch {
        this.importStatus.set('error');
        this.importMessage.set('calendar.importError');
      } finally {
        this.importGuard.finish();
      }
    }, 0);
  }

  private updateCalendar(id: string, updates: Partial<ExternalCalendar>) {
    const next = this.state().calendars.map((cal) =>
      cal.id === id ? { ...cal, ...updates } : cal,
    );
    this.commit({ ...this.state(), calendars: next });
  }

  private uid(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
