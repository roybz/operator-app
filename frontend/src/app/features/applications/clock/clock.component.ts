import { Component, Input, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppPreferencesService } from '../../dependencies/app-preferences.service';

interface ClockState {
  timeZone: string;
}

const stateStore = new Map<string, ClockState>();

export function clearClockState(instanceId: string) {
  stateStore.delete(instanceId);
}

export function cloneClockState(fromId: string, toId: string) {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, { ...stored });
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

@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <label style="display:flex; flex-direction:column; gap:6px; font-size:13px;">
        {{ 'clock.timeZone' | translate }}
        <select [value]="timeZone()" (change)="updateTimeZone($event)" style="padding:6px;">
          @for (zone of timeZones(); track zone) {
            <option [value]="zone">{{ zone }}</option>
          }
        </select>
      </label>
      <div style="font-size:48px; font-weight:600; letter-spacing:1px;">
        {{ timeLabel() }}
      </div>
    </div>
  `,
})
export class ClockComponent implements OnInit, OnDestroy {
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  private translate = inject(TranslateService);
  private interval?: number;
  private now = signal(new Date());
  timeZone = signal('UTC');
  timeZones = signal<string[]>(fallbackZones);

  constructor() {
    effect(() => {
      const fallback = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const language = this.prefs.language() || fallback || 'en';
      this.translate.use(language);
    });
  }

  ngOnInit() {
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.timeZone.set(stored.timeZone);
    } else {
      const prefsZone = this.prefs.timeZone();
      const zone = prefsZone || 'UTC';
      this.timeZone.set(zone);
      stateStore.set(this.instanceId, { timeZone: zone });
    }
    const zones = this.getTimeZones();
    this.timeZones.set(this.withPreferredZone(zones, this.timeZone()));
    this.interval = window.setInterval(() => this.now.set(new Date()), 1000);
  }

  ngOnDestroy() {
    if (this.interval) window.clearInterval(this.interval);
  }

  timeLabel() {
    const hour12 = this.prefs.timeFormat() === '12h';
    const language = this.translate.currentLang || 'en';
    return new Intl.DateTimeFormat(language, {
      timeZone: this.timeZone(),
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12,
    }).format(this.now());
  }

  updateTimeZone(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.timeZone.set(value);
    stateStore.set(this.instanceId, { timeZone: value });
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

  private withPreferredZone(zones: string[], preferred: string) {
    if (!preferred) return zones;
    if (zones[0] === preferred) return zones;
    const filtered = zones.filter((zone) => zone !== preferred);
    return [preferred, ...filtered];
  }
}
