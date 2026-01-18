import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CalculatorState {
  display: string;
  accumulator: number | null;
  pendingOp: string | null;
  overwrite: boolean;
}

const stateStore = new Map<string, CalculatorState>();

export function clearCalculatorState(instanceId: string) {
  stateStore.delete(instanceId);
}

const defaultState = (): CalculatorState => ({
  display: '0',
  accumulator: null,
  pendingOp: null,
  overwrite: false,
});

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <input
        [value]="state().display"
        readonly
        style="font-size:24px; text-align:right; padding:10px; border:1px solid #ccc; border-radius:6px;"
      />

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
    </div>
  `,
})
export class CalculatorComponent implements OnInit {
  @Input({ required: true }) instanceId!: string;

  state = signal<CalculatorState>(defaultState());

  ngOnInit() {
    const stored = stateStore.get(this.instanceId);
    if (stored) {
      this.state.set({ ...stored });
    } else {
      stateStore.set(this.instanceId, this.state());
    }
  }

  private commit(next: CalculatorState) {
    this.state.set(next);
    stateStore.set(this.instanceId, next);
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
    this.commit(defaultState());
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
      display: String(result),
      accumulator: null,
      pendingOp: null,
      overwrite: true,
    });
  }

  private applyOperation(left: number, right: number, op: string) {
    switch (op) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '×':
        return left * right;
      case '÷':
        return right === 0 ? 0 : left / right;
      default:
        return right;
    }
  }
}
