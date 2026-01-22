import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppPreferencesService } from '../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../core/instance-settings.service';

interface CalculatorState {
  display: string;
  accumulator: number | null;
  pendingOp: string | null;
  overwrite: boolean;
  scientific: boolean;
  currencyEnabled: boolean;
  currencyAmount: string;
  currencyFrom: string;
  currencyTo: string;
  currencyResult: string;
  currencyError: string | null;
  currencyLastFetch: number;
  currencyFetching: boolean;
}

const stateStore = new Map<string, CalculatorState>();
const STORAGE_PREFIX = 'op_app_state:calculator';

const storageKey = (userId: string, instanceId: string) =>
  `${STORAGE_PREFIX}:${userId}:${instanceId}`;

export function clearCalculatorState(instanceId: string) {
  stateStore.delete(instanceId);
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key.endsWith(`:${instanceId}`))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function cloneCalculatorState(fromId: string, toId: string) {
  const stored = stateStore.get(fromId);
  if (!stored) return;
  stateStore.set(toId, { ...stored });
}

const defaultState = (): CalculatorState => ({
  display: '0',
  accumulator: null,
  pendingOp: null,
  overwrite: false,
  scientific: false,
  currencyEnabled: false,
  currencyAmount: '1',
  currencyFrom: 'USD',
  currencyTo: 'EUR',
  currencyResult: '',
  currencyError: null,
  currencyLastFetch: 0,
  currencyFetching: false,
});

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL'];
const USE_FRANKFURTER_API = true;
const USE_DEMO_RATES_FALLBACK = true;
const MIN_REQUEST_INTERVAL_MS = 5000;
const CACHE_TTL_MS = 60_000;

// Demo rates are based on ECB reference rates for 31 Dec 2025.
// 01 Jan 2026 was a non-working day, so ECB did not publish new rates.
const ECB_EUR_RATES_2025_12_31: Record<string, number> = {
  EUR: 1,
  USD: 1.175,
  GBP: 0.8726,
  JPY: 184.09,
  CAD: 1.6088,
  AUD: 1.7581,
  CHF: 0.9314,
  CNY: 8.2262,
  INR: 105.5965,
  BRL: 6.4364,
};

const demoRate = (from: string, to: string) => {
  if (from === to) return 1;
  const fromRate = ECB_EUR_RATES_2025_12_31[from];
  const toRate = ECB_EUR_RATES_2025_12_31[to];
  if (!fromRate || !toRate) return null;
  if (from === 'EUR') return toRate;
  if (to === 'EUR') return 1 / fromRate;
  return toRate / fromRate;
};

const currencyCache = new Map<string, { rate: number; ts: number }>();

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div style="display:flex; flex-direction:column; gap:12px;">
      @if (settingsOpen()) {
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0;">{{ 'calculator.settingsTitle' | translate }}</h3>
            <button (click)="closeSettings()">{{ 'calculator.closeSettings' | translate }}</button>
          </div>
          <label style="display:flex; gap:8px; align-items:center;">
            <input
              type="checkbox"
              [checked]="state().scientific"
              (change)="toggleScientific($event)"
            />
            {{ 'calculator.scientific' | translate }}
          </label>
          <label style="display:flex; gap:8px; align-items:center;">
            <input
              type="checkbox"
              [checked]="state().currencyEnabled"
              (change)="toggleCurrency($event)"
            />
            {{ 'calculator.currency' | translate }}
          </label>
          <p style="font-size:12px; opacity:0.7;">
            {{ 'calculator.currencyDisclaimer' | translate }}
          </p>
        </div>
      } @else {
        <input
          [value]="state().display"
          readonly
          style="font-size:24px; text-align:right; padding:10px; border:1px solid #ccc; border-radius:6px;"
        />

        @if (state().scientific) {
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
            <button (click)="applyUnary('sqrt')">√</button>
            <button (click)="applyUnary('pow2')">x²</button>
            <button (click)="applyUnary('sin')">sin</button>
            <button (click)="applyUnary('cos')">cos</button>
            <button (click)="applyUnary('tan')">tan</button>
            <button (click)="applyUnary('log')">log</button>
            <button (click)="applyUnary('ln')">ln</button>
            <button (click)="applyUnary('inv')">1/x</button>
          </div>
        }

        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
          <button (click)="clear()">C</button>
          <button (click)="toggleSign()">±</button>
          <button (click)="percent()">%</button>
          <button (click)="setOperator('÷')">÷</button>

          <button (click)="appendDigit('7')">7</button>
          <button (click)="appendDigit('8')">8</button>
          <button (click)="appendDigit('9')">9</button>
          <button (click)="setOperator('×')">×</button>

          <button (click)="appendDigit('4')">4</button>
          <button (click)="appendDigit('5')">5</button>
          <button (click)="appendDigit('6')">6</button>
          <button (click)="setOperator('-')">-</button>

          <button (click)="appendDigit('1')">1</button>
          <button (click)="appendDigit('2')">2</button>
          <button (click)="appendDigit('3')">3</button>
          <button (click)="setOperator('+')">+</button>

          <button style="grid-column: span 2;" (click)="appendDigit('0')">0</button>
          <button (click)="appendDecimal()">.</button>
          <button (click)="evaluate()">=</button>
        </div>

        @if (state().currencyEnabled) {
          <div
            style="margin-top: 12px; border-top:1px solid var(--color-border); padding-top:12px;"
          >
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <input
                type="number"
                min="0"
                [value]="state().currencyAmount"
                (input)="updateCurrencyAmount($event)"
                style="width:120px;"
              />
              <select [value]="state().currencyFrom" (change)="updateCurrencyFrom($event)">
                @for (code of currencies; track code) {
                  <option [value]="code" [selected]="code === state().currencyFrom">
                    {{ code }}
                  </option>
                }
              </select>
              <span>→</span>
              <select [value]="state().currencyTo" (change)="updateCurrencyTo($event)">
                @for (code of currencies; track code) {
                  <option [value]="code" [selected]="code === state().currencyTo">
                    {{ code }}
                  </option>
                }
              </select>
              <button (click)="convertCurrency()">{{ 'calculator.convert' | translate }}</button>
            </div>
            @if (state().currencyError) {
              <div style="color:#b00020; font-size:12px; margin-top:6px;">
                {{ state().currencyError }}
              </div>
            }
            @if (state().currencyResult) {
              <div style="margin-top:6px; font-weight:600;">
                {{ state().currencyResult }}
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class CalculatorComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  private prefs = inject(AppPreferencesService);
  private instanceSettings = inject(InstanceSettingsService);
  private translate = inject(TranslateService);
  state = signal<CalculatorState>(defaultState());
  settingsOpen = computed(() => this.instanceSettings.isOpen(this.instanceId));
  currencies = CURRENCIES;

  ngOnInit() {
    const userId = this.prefs.userId();
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(storageKey(userId, this.instanceId));
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as CalculatorState;
          this.state.set({ ...defaultState(), ...parsed });
          this.ensureDefaultCurrencyPair();
          stateStore.set(this.instanceId, this.state());
          return;
        } catch {
          // ignore malformed stored data
        }
      }
    }
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.state.set({ ...defaultState(), ...stored });
      this.ensureDefaultCurrencyPair();
    } else {
      stateStore.set(this.instanceId, this.state());
    }
    this.persistState();
  }

  closeSettings() {
    this.instanceSettings.close(this.instanceId);
  }

  private commit(next: CalculatorState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
    this.persistState();
  }

  private persistState() {
    if (typeof window === 'undefined') return;
    const userId = this.prefs.userId();
    window.localStorage.setItem(storageKey(userId, this.instanceId), JSON.stringify(this.state()));
  }

  toggleScientific(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.commit({ ...this.state(), scientific: checked });
  }

  toggleCurrency(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.commit({ ...this.state(), currencyEnabled: checked });
    this.ensureDefaultCurrencyPair();
  }

  updateCurrencyAmount(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.commit({ ...this.state(), currencyAmount: value });
  }

  updateCurrencyFrom(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.commit({ ...this.state(), currencyFrom: value });
  }

  updateCurrencyTo(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.commit({ ...this.state(), currencyTo: value });
  }

  async convertCurrency() {
    const amount = Number(this.state().currencyAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.commit({
        ...this.state(),
        currencyError: this.translate.instant('calculator.currencyErrorInvalid'),
        currencyResult: '',
      });
      return;
    }
    const now = Date.now();
    const current = this.state();
    if (current.currencyFetching) return;
    if (now - current.currencyLastFetch < MIN_REQUEST_INTERVAL_MS) {
      return;
    }
    const from = this.state().currencyFrom;
    const to = this.state().currencyTo;
    const cacheKey = `${from}:${to}`;
    const cached = currencyCache.get(cacheKey);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      const result = amount * cached.rate;
      this.commit({
        ...this.state(),
        currencyError: null,
        currencyResult: `${amount} ${from} = ${result} ${to}`,
        currencyLastFetch: now,
      });
      return;
    }
    try {
      if (!USE_FRANKFURTER_API) {
        throw new Error('demo');
      }
      this.commit({ ...this.state(), currencyFetching: true, currencyLastFetch: now });
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('convert');
      const data = (await res.json()) as { rates?: Record<string, number> };
      const rate = data.rates?.[to];
      if (!rate) throw new Error('convert');
      currencyCache.set(cacheKey, { rate, ts: now });
      const result = amount * rate;
      this.commit({
        ...this.state(),
        currencyError: null,
        currencyResult: `${amount} ${from} = ${result} ${to}`,
        currencyFetching: false,
        currencyLastFetch: now,
      });
    } catch {
      if (USE_DEMO_RATES_FALLBACK) {
        const rate = demoRate(from, to);
        if (rate) {
          currencyCache.set(cacheKey, { rate, ts: now });
          const result = amount * rate;
          this.commit({
            ...this.state(),
            currencyError: null,
            currencyResult: `${amount} ${from} = ${result} ${to}`,
            currencyFetching: false,
            currencyLastFetch: now,
          });
          return;
        }
      }
      this.commit({
        ...this.state(),
        currencyError: this.translate.instant('calculator.currencyErrorFetch'),
        currencyResult: '',
        currencyFetching: false,
        currencyLastFetch: now,
      });
    }
  }

  applyUnary(op: string) {
    const current = this.state();
    const value = Number(current.display);
    if (!Number.isFinite(value)) return;
    let result = value;
    switch (op) {
      case 'sqrt':
        result = Math.sqrt(value);
        break;
      case 'pow2':
        result = value * value;
        break;
      case 'sin':
        result = Math.sin(value);
        break;
      case 'cos':
        result = Math.cos(value);
        break;
      case 'tan':
        result = Math.tan(value);
        break;
      case 'log':
        result = Math.log10(value);
        break;
      case 'ln':
        result = Math.log(value);
        break;
      case 'inv':
        result = value === 0 ? 0 : 1 / value;
        break;
    }
    this.commit({ ...current, display: String(result), overwrite: true });
  }

  appendDigit(digit: string) {
    const current = this.state();
    const display = current.overwrite
      ? digit
      : current.display === '0'
        ? digit
        : current.display + digit;
    this.commit({ ...current, display, overwrite: false });
  }

  appendDecimal() {
    const current = this.state();
    if (current.overwrite) {
      this.commit({ ...current, display: '0.', overwrite: false });
      return;
    }
    if (current.display.includes('.')) return;
    this.commit({ ...current, display: `${current.display}.` });
  }

  clear() {
    this.commit({
      ...defaultState(),
      scientific: this.state().scientific,
      currencyEnabled: this.state().currencyEnabled,
    });
  }

  toggleSign() {
    const current = this.state();
    if (current.display === '0') return;
    const value = Number(current.display) * -1;
    this.commit({ ...current, display: String(value) });
  }

  percent() {
    const current = this.state();
    const value = Number(current.display) / 100;
    this.commit({ ...current, display: String(value) });
  }

  setOperator(op: string) {
    const current = this.state();
    const value = Number(current.display);
    if (current.accumulator !== null && current.pendingOp && !current.overwrite) {
      const result = this.applyOperation(current.accumulator, value, current.pendingOp);
      this.commit({
        ...current,
        display: String(result),
        accumulator: result,
        pendingOp: op,
        overwrite: true,
      });
      return;
    }
    this.commit({
      ...current,
      accumulator: value,
      pendingOp: op,
      overwrite: true,
    });
  }

  evaluate() {
    const current = this.state();
    if (current.accumulator === null || !current.pendingOp) return;
    const value = Number(current.display);
    const result = this.applyOperation(current.accumulator, value, current.pendingOp);
    this.commit({
      ...current,
      display: String(result),
      accumulator: null,
      pendingOp: null,
      overwrite: true,
    });
  }

  private applyOperation(a: number, b: number, op: string) {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '×':
        return a * b;
      case '÷':
        return b === 0 ? 0 : a / b;
      default:
        return b;
    }
  }

  private ensureDefaultCurrencyPair() {
    const current = this.state();
    const from = current.currencyFrom || 'USD';
    const to = current.currencyTo || 'EUR';
    const fromValid = CURRENCIES.includes(from);
    const toValid = CURRENCIES.includes(to);
    const nextFrom = fromValid ? from : 'USD';
    const nextTo = toValid ? to : 'EUR';
    const needsDefault = !fromValid || !toValid || (nextFrom === nextTo && nextFrom === 'USD');
    if (needsDefault) {
      const next = {
        ...current,
        currencyFrom: nextFrom,
        currencyTo: nextFrom === nextTo ? 'EUR' : nextTo,
      };
      this.state.set(next);
      stateStore.set(this.instanceId, next);
      this.persistState();
    }
  }
}
