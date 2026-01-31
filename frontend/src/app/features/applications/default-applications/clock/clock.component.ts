import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';

interface ClockEntry {
  id: string;
  timeZone: string;
}

interface ClockState {
  clocks: ClockEntry[];
  format: '12h' | '24h';
}

const stateStore = new Map<string, ClockState>();
const STORAGE_PREFIX = 'op_app_state:clock';

const storageKey = (userId: string, instanceId: string) =>
  `${STORAGE_PREFIX}:${userId}:${instanceId}`;

export function clearClockState(instanceId: string) {
  stateStore.delete(instanceId);
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function cloneClockState(fromId: string, toId: string) {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, {
    ...stored,
    clocks: stored.clocks.map((clock) => ({ ...clock })),
  });
}

const fallbackZones = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
];

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div style="height:100%; display:flex; flex-direction:column;">
      @if (settingsOpen()) {
        <div style="display:flex; flex-direction:column; gap:12px; height:100%;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0;">{{ 'clock.settingsTitle' | translate }}</h3>
            <button (click)="closeSettings()">{{ 'clock.closeSettings' | translate }}</button>
          </div>

          <label
            style="display:flex; flex-direction:column; gap:6px; font-size:13px; max-width: 220px;"
          >
            {{ 'clock.formatLabel' | translate }}
            <select [value]="state().format" (change)="updateFormat($event)">
              <option value="12h">{{ 'clock.format12' | translate }}</option>
              <option value="24h">{{ 'clock.format24' | translate }}</option>
            </select>
          </label>

          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-weight:600;">{{ 'clock.clocksTitle' | translate }}</div>
            @for (clock of state().clocks; track clock.id) {
              <div style="display:flex; gap:8px; align-items:center;">
                <select
                  [value]="clock.timeZone"
                  (change)="updateClockZone(clock.id, $event)"
                  style="flex:1;"
                >
                  @for (zone of timeZoneOptions(); track zone.id) {
                    <option [value]="zone.id">{{ zone.label }}</option>
                  }
                </select>
                <button (click)="removeClock(clock.id)" [disabled]="state().clocks.length <= 1">
                  {{ 'clock.removeClock' | translate }}
                </button>
              </div>
            }
            <button (click)="addClock()">{{ 'clock.addClock' | translate }}</button>
          </div>
        </div>
      } @else {
        <div style="display:flex; flex-direction:column; gap:14px;">
          @for (clock of state().clocks; track clock.id) {
            <div
              style="display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid var(--color-border); border-radius:8px; padding:10px;"
            >
              <div>
                <div style="font-size:14px; opacity:0.7;">{{ timeZoneLabel(clock.timeZone) }}</div>
                <div style="font-size:36px; font-weight:600; letter-spacing:1px;">
                  {{ timeLabel(clock.timeZone) }}
                </div>
              </div>
              @if (observesDst(clock.timeZone)) {
                <div style="font-size:12px; opacity:0.7;">
                  {{
                    isDstActive(clock.timeZone)
                      ? ('clock.dstActive' | translate)
                      : ('clock.dstInactive' | translate)
                  }}
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ClockComponent implements OnInit, OnDestroy {
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  private translate = inject(TranslateService);
  private instanceSettings = inject(InstanceSettingsService);
  private interval?: number;
  private now = signal(new Date());
  state = signal<ClockState>({
    clocks: [{ id: uid('clock'), timeZone: 'UTC' }],
    format: '12h',
  });
  timeZoneOptions = signal<{ id: string; label: string }[]>([]);
  settingsOpen = computed(() => this.instanceSettings.isOpen(this.instanceId));

  constructor() {
    effect(() => {
      const fallback = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const language = this.prefs.language() || fallback || 'en';
      this.translate.use(language);
    });
  }

  ngOnInit() {
    const userId = this.prefs.userId();
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(storageKey(userId, this.instanceId));
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          const normalized = this.normalizeState(parsed);
          this.state.set(normalized);
          stateStore.set(this.instanceId, normalized);
          this.initializeOptions(normalized.clocks[0]?.timeZone || this.prefs.timeZone());
          this.interval = window.setInterval(() => this.now.set(new Date()), 1000);
          return;
        } catch {
          // ignore malformed stored data
        }
      }
    }

    const stored = stateStore.get(this.instanceId);
    if (stored) {
      const normalized = this.normalizeState(stored);
      this.state.set(normalized);
      stateStore.set(this.instanceId, normalized);
      this.initializeOptions(normalized.clocks[0]?.timeZone || this.prefs.timeZone());
    } else {
      const tz = this.prefs.timeZone() || 'UTC';
      const next: ClockState = {
        clocks: [{ id: uid('clock'), timeZone: tz }],
        format: this.prefs.timeFormat() === '24h' ? '24h' : '12h',
      };
      this.state.set(next);
      stateStore.set(this.instanceId, next);
      this.initializeOptions(tz);
      this.persistState();
    }

    this.interval = window.setInterval(() => this.now.set(new Date()), 1000);
  }

  ngOnDestroy() {
    if (this.interval) window.clearInterval(this.interval);
  }

  closeSettings() {
    this.instanceSettings.close(this.instanceId);
  }

  addClock() {
    const tz = this.prefs.timeZone() || 'UTC';
    const next = {
      ...this.state(),
      clocks: [...this.state().clocks, { id: uid('clock'), timeZone: tz }],
    };
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  removeClock(clockId: string) {
    if (this.state().clocks.length <= 1) return;
    const next = {
      ...this.state(),
      clocks: this.state().clocks.filter((clock) => clock.id !== clockId),
    };
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  updateClockZone(clockId: string, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const next = {
      ...this.state(),
      clocks: this.state().clocks.map((clock) =>
        clock.id === clockId ? { ...clock, timeZone: value } : clock,
      ),
    };
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  updateFormat(event: Event) {
    const value = (event.target as HTMLSelectElement).value as '12h' | '24h';
    const next = { ...this.state(), format: value };
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  timeLabel(timeZone: string) {
    const hour12 = this.state().format === '12h';
    const language = this.translate.currentLang || 'en';
    return new Intl.DateTimeFormat(language, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12,
    }).format(this.now());
  }

  timeZoneLabel(zone: string) {
    const parts = zone.split('/');
    if (parts.length < 2) return zone;
    const continent = parts[0].replace('_', ' ');
    const city = parts.slice(1).join('/').replace(/_/g, ' ');
    return `${city} (${continent})`;
  }

  observesDst(zone: string) {
    const { janOffset, julOffset } = this.offsetsFor(zone);
    return janOffset !== julOffset;
  }

  isDstActive(zone: string) {
    const { janOffset, julOffset } = this.offsetsFor(zone);
    const standard = Math.min(janOffset, julOffset);
    const nowOffset = this.offsetFor(this.now(), zone);
    return nowOffset !== standard;
  }

  private offsetsFor(zone: string) {
    const year = new Date().getFullYear();
    const jan = new Date(Date.UTC(year, 0, 1, 12));
    const jul = new Date(Date.UTC(year, 6, 1, 12));
    return {
      janOffset: this.offsetFor(jan, zone),
      julOffset: this.offsetFor(jul, zone),
    };
  }

  private offsetFor(date: Date, zone: string) {
    const local = new Date(date.toLocaleString('en-US', { timeZone: zone }));
    return Math.round((local.getTime() - date.getTime()) / 60000);
  }

  private getTimeZones() {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      const zones = (
        Intl as typeof Intl & { supportedValuesOf?: (type: string) => string[] }
      ).supportedValuesOf?.('timeZone');
      if (zones?.length) return zones;
    }
    return fallbackZones;
  }

  private initializeOptions(preferred: string) {
    const zones = this.getTimeZones();
    const sorted = this.withPreferredZone(zones, preferred);
    this.timeZoneOptions.set(sorted.map((zone) => ({ id: zone, label: this.timeZoneLabel(zone) })));
  }

  private withPreferredZone(zones: string[], preferred: string) {
    if (!preferred) return zones;
    if (zones[0] === preferred) return zones;
    const filtered = zones.filter((zone) => zone !== preferred);
    return [preferred, ...filtered];
  }

  private persistState() {
    if (typeof window === 'undefined') return;
    const userId = this.prefs.userId();
    window.localStorage.setItem(storageKey(userId, this.instanceId), JSON.stringify(this.state()));
  }

  private normalizeState(raw: unknown): ClockState {
    const fallbackZone = this.prefs.timeZone() || 'UTC';
    const prefFormat = this.prefs.timeFormat() === '24h' ? '24h' : '12h';
    const rawObj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const formatValue = rawObj['format'];
    const format =
      formatValue === '24h' || formatValue === '12h' ? (formatValue as '12h' | '24h') : prefFormat;
    const clocksValue = rawObj['clocks'];
    if (Array.isArray(clocksValue) && clocksValue.length) {
      const clocks = clocksValue.map((clock) => {
        const clockObj =
          clock && typeof clock === 'object' ? (clock as Record<string, unknown>) : {};
        const idValue = clockObj['id'];
        const timeZoneValue = clockObj['timeZone'];
        return {
          id: typeof idValue === 'string' ? idValue : uid('clock'),
          timeZone: typeof timeZoneValue === 'string' ? timeZoneValue : fallbackZone,
        };
      });
      return { clocks, format };
    }
    const timeZoneValue = rawObj['timeZone'];
    if (typeof timeZoneValue === 'string') {
      return { clocks: [{ id: uid('clock'), timeZone: timeZoneValue }], format };
    }
    if (typeof raw === 'string') {
      return { clocks: [{ id: uid('clock'), timeZone: raw }], format };
    }
    return { clocks: [{ id: uid('clock'), timeZone: fallbackZone }], format };
  }
}
