import { Injectable } from '@angular/core';

type SwitchAction = 'UniverseSwitch' | 'WorkspaceSwitch';

interface LifecycleCounts {
  dialogHostInit: number;
  dialogHostDestroy: number;
  dialogInit: number;
  dialogDestroy: number;
}

interface SwitchToken {
  action: SwitchAction;
  id: number;
  dialogsBefore: number;
  startCounts: LifecycleCounts;
  startMark: string;
  endMark: string;
  measure: string;
  meta: Record<string, string | number | boolean | null>;
}

@Injectable({ providedIn: 'root' })
export class DebugPerfService {
  private readonly localStorageKey = 'op_debug_perf';
  private readonly counters: LifecycleCounts = {
    dialogHostInit: 0,
    dialogHostDestroy: 0,
    dialogInit: 0,
    dialogDestroy: 0,
  };
  private sequence = 0;
  private enabled: boolean | null = null;

  isEnabled() {
    if (this.enabled !== null) return this.enabled;
    if (typeof window === 'undefined') {
      this.enabled = false;
      return false;
    }
    const override = window.localStorage.getItem(this.localStorageKey)?.trim().toLowerCase();
    if (override === '1' || override === 'true') {
      this.enabled = true;
      return true;
    }
    if (override === '0' || override === 'false') {
      this.enabled = false;
      return false;
    }
    const config = (window as Window & { __OP_CONFIG__?: { debugPerf?: boolean } }).__OP_CONFIG__;
    this.enabled = config?.debugPerf === true;
    return this.enabled;
  }

  markDialogHostInit() {
    if (!this.isEnabled()) return;
    this.counters.dialogHostInit += 1;
  }

  markDialogHostDestroy() {
    if (!this.isEnabled()) return;
    this.counters.dialogHostDestroy += 1;
  }

  markDialogInit() {
    if (!this.isEnabled()) return;
    this.counters.dialogInit += 1;
  }

  markDialogDestroy() {
    if (!this.isEnabled()) return;
    this.counters.dialogDestroy += 1;
  }

  startSwitch(
    action: SwitchAction,
    dialogsBefore: number,
    meta: Record<string, string | number | boolean | null> = {},
  ): SwitchToken | null {
    if (!this.isEnabled()) return null;
    const id = ++this.sequence;
    const startMark = `op_debug_perf_${action}_${id}_start`;
    const endMark = `op_debug_perf_${action}_${id}_end`;
    const measure = `op_debug_perf_${action}_${id}`;
    performance.mark(startMark);
    return {
      action,
      id,
      dialogsBefore,
      startCounts: { ...this.counters },
      startMark,
      endMark,
      measure,
      meta,
    };
  }

  completeSwitch(token: SwitchToken | null, dialogsAfter: () => number) {
    if (!token || !this.isEnabled()) return;
    const finalize = () => {
      performance.mark(token.endMark);
      performance.measure(token.measure, token.startMark, token.endMark);
      const duration = performance.getEntriesByName(token.measure).slice(-1)[0]?.duration ?? 0;
      const mountDelta = this.counters.dialogInit - token.startCounts.dialogInit;
      const destroyDelta = this.counters.dialogDestroy - token.startCounts.dialogDestroy;
      const hostMountDelta = this.counters.dialogHostInit - token.startCounts.dialogHostInit;
      const hostDestroyDelta =
        this.counters.dialogHostDestroy - token.startCounts.dialogHostDestroy;
      const metaLabel = Object.entries(token.meta)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(' ');
      console.info(
        `[Perf][${token.action}] duration=${duration.toFixed(1)}ms mounts=${mountDelta} destroys=${destroyDelta} hostMounts=${hostMountDelta} hostDestroys=${hostDestroyDelta} dialogsBefore=${token.dialogsBefore} dialogsAfter=${dialogsAfter()} ${metaLabel}`.trim(),
      );
      performance.clearMarks(token.startMark);
      performance.clearMarks(token.endMark);
      performance.clearMeasures(token.measure);
    };
    if (typeof window === 'undefined') {
      finalize();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(finalize));
  }
}
