import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppPreferencesService } from '../../dependencies/app-preferences.service';

type TimerMode = 'stopwatch' | 'countdown' | 'pomodoro';
type PomodoroPhase = 'work' | 'break' | 'longBreak';

interface TimerState {
  mode: TimerMode;
  running: boolean;
  elapsedSeconds: number;
  remainingSeconds: number;
  countdownSeconds: number;
  pomodoroWork: number;
  pomodoroBreak: number;
  pomodoroLongBreak: number;
  pomodoroCycles: number;
  pomodoroPhase: PomodoroPhase;
}

const stateStore = new Map<string, TimerState>();
const STORAGE_PREFIX = 'op_app_state:timer';

const storageKey = (userId: string, instanceId: string) =>
  `${STORAGE_PREFIX}:${userId}:${instanceId}`;

export function clearTimerState(instanceId: string) {
  stateStore.delete(instanceId);
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function cloneTimerState(fromId: string, toId: string) {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, { ...stored });
}

const defaultState = (): TimerState => ({
  mode: 'stopwatch',
  running: false,
  elapsedSeconds: 0,
  remainingSeconds: 0,
  countdownSeconds: 300,
  pomodoroWork: 25 * 60,
  pomodoroBreak: 5 * 60,
  pomodoroLongBreak: 15 * 60,
  pomodoroCycles: 0,
  pomodoroPhase: 'work',
});

@Component({
  selector: 'app-timer',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; gap:8px;">
        <button (click)="setMode('stopwatch')">{{ 'timer.stopwatch' | translate }}</button>
        <button (click)="setMode('countdown')">{{ 'timer.countdown' | translate }}</button>
        <button (click)="setMode('pomodoro')">{{ 'timer.pomodoro' | translate }}</button>
      </div>

      <div style="font-size:28px; font-weight:600;">
        {{ formattedTime() }}
      </div>

      @if (state().mode === 'countdown') {
        <div style="display:flex; gap:8px; align-items:center;">
          <input
            type="number"
            min="0"
            [value]="minutesFromSeconds(state().countdownSeconds)"
            (change)="updateCountdownMinutes($event)"
            style="width:80px;"
          />
          <span>{{ 'timer.minutes' | translate }}</span>
          <input
            type="number"
            min="0"
            max="59"
            [value]="state().countdownSeconds % 60"
            (change)="updateCountdownSeconds($event)"
            style="width:80px;"
          />
          <span>{{ 'timer.seconds' | translate }}</span>
        </div>
      }

      @if (state().mode === 'pomodoro') {
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <label>
            {{ 'timer.work' | translate }}
            <input
              type="number"
              min="5"
              [value]="minutesFromSeconds(state().pomodoroWork)"
              (change)="updatePomodoro('work', $event)"
              style="width:80px;"
            />
          </label>
          <label>
            {{ 'timer.break' | translate }}
            <input
              type="number"
              min="1"
              [value]="minutesFromSeconds(state().pomodoroBreak)"
              (change)="updatePomodoro('break', $event)"
              style="width:80px;"
            />
          </label>
          <label>
            {{ 'timer.longBreak' | translate }}
            <input
              type="number"
              min="5"
              [value]="minutesFromSeconds(state().pomodoroLongBreak)"
              (change)="updatePomodoro('longBreak', $event)"
              style="width:80px;"
            />
          </label>
          <div>
            {{ 'timer.phase' | translate }}:
            @if (state().pomodoroPhase === 'work') {
              {{ 'timer.phaseWork' | translate }}
            } @else if (state().pomodoroPhase === 'break') {
              {{ 'timer.phaseBreak' | translate }}
            } @else {
              {{ 'timer.phaseLongBreak' | translate }}
            }
          </div>
        </div>
      }

      <div style="display:flex; gap:8px;">
        <button (click)="toggle()">
          {{ state().running ? ('timer.pause' | translate) : ('timer.start' | translate) }}
        </button>
        <button (click)="reset()">{{ 'timer.reset' | translate }}</button>
      </div>
    </div>
  `,
})
export class TimerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  state = signal<TimerState>(defaultState());
  private tickId?: number;

  ngOnInit() {
    const userId = this.prefs.userId();
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(storageKey(userId, this.instanceId));
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as TimerState;
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
      this.state.set({ ...stored });
    } else {
      stateStore.set(this.instanceId, this.state());
    }
    this.persistState();
  }

  ngOnDestroy() {
    if (this.tickId) window.clearInterval(this.tickId);
  }

  private commit(next: TimerState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  private persistState() {
    if (typeof window === 'undefined') return;
    const userId = this.prefs.userId();
    window.localStorage.setItem(storageKey(userId, this.instanceId), JSON.stringify(this.state()));
  }

  setMode(mode: TimerMode) {
    if (this.state().mode === mode) return;
    this.commit({ ...this.state(), mode, running: false });
    if (this.tickId) window.clearInterval(this.tickId);
  }

  toggle() {
    const current = this.state();
    if (current.running) {
      this.commit({ ...current, running: false });
      if (this.tickId) window.clearInterval(this.tickId);
      return;
    }
    let remainingSeconds = current.remainingSeconds;
    if (current.mode === 'countdown' && remainingSeconds === 0) {
      remainingSeconds = current.countdownSeconds;
    }
    if (current.mode === 'pomodoro' && remainingSeconds === 0) {
      remainingSeconds = current.pomodoroWork;
    }
    const next = { ...current, running: true, remainingSeconds };
    this.commit(next);
    this.tickId = window.setInterval(() => this.tick(), 1000);
  }

  reset() {
    const current = this.state();
    this.commit({
      ...current,
      running: false,
      elapsedSeconds: 0,
      remainingSeconds: current.mode === 'countdown' ? current.countdownSeconds : 0,
      pomodoroPhase: 'work',
      pomodoroCycles: 0,
    });
    if (this.tickId) window.clearInterval(this.tickId);
  }

  tick() {
    const current = this.state();
    if (!current.running) return;
    if (current.mode === 'stopwatch') {
      this.commit({ ...current, elapsedSeconds: current.elapsedSeconds + 1 });
      return;
    }
    if (current.mode === 'countdown') {
      const nextRemaining = Math.max(0, current.remainingSeconds - 1);
      const running = nextRemaining > 0;
      this.commit({ ...current, remainingSeconds: nextRemaining, running });
      return;
    }
    this.tickPomodoro(current);
  }

  private tickPomodoro(current: TimerState) {
    const remaining = current.remainingSeconds || current.pomodoroWork;
    const nextRemaining = Math.max(0, remaining - 1);
    if (nextRemaining > 0) {
      this.commit({ ...current, remainingSeconds: nextRemaining });
      return;
    }
    const nextPhase =
      current.pomodoroPhase === 'work'
        ? current.pomodoroCycles % 3 === 2
          ? 'longBreak'
          : 'break'
        : 'work';
    const nextCycles =
      current.pomodoroPhase === 'work' ? current.pomodoroCycles + 1 : current.pomodoroCycles;
    const nextRemainingSeconds =
      nextPhase === 'work'
        ? current.pomodoroWork
        : nextPhase === 'break'
          ? current.pomodoroBreak
          : current.pomodoroLongBreak;
    this.commit({
      ...current,
      pomodoroPhase: nextPhase,
      pomodoroCycles: nextCycles,
      remainingSeconds: nextRemainingSeconds,
    });
  }

  updateCountdownMinutes(event: Event) {
    const minutes = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
    const seconds = this.state().countdownSeconds % 60;
    const total = minutes * 60 + seconds;
    this.commit({ ...this.state(), countdownSeconds: total, remainingSeconds: total });
  }

  updateCountdownSeconds(event: Event) {
    const seconds = Math.max(
      0,
      Math.min(59, Number((event.target as HTMLInputElement).value) || 0),
    );
    const minutes = Math.floor(this.state().countdownSeconds / 60);
    const total = minutes * 60 + seconds;
    this.commit({ ...this.state(), countdownSeconds: total, remainingSeconds: total });
  }

  updatePomodoro(field: PomodoroPhase, event: Event) {
    const minutes = Math.max(1, Number((event.target as HTMLInputElement).value) || 1);
    if (field === 'work') {
      this.commit({ ...this.state(), pomodoroWork: minutes * 60 });
    } else if (field === 'break') {
      this.commit({ ...this.state(), pomodoroBreak: minutes * 60 });
    } else {
      this.commit({ ...this.state(), pomodoroLongBreak: minutes * 60 });
    }
  }

  formattedTime() {
    const current = this.state();
    const seconds =
      current.mode === 'stopwatch'
        ? current.elapsedSeconds
        : current.mode === 'countdown'
          ? current.remainingSeconds || current.countdownSeconds
          : current.remainingSeconds || current.pomodoroWork;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const base = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return hrs > 0 ? `${hrs}:${base}` : base;
  }

  minutesFromSeconds(value: number) {
    return Math.floor(value / 60);
  }
}
