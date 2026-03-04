import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { mergeTimerStatesForSync, TimerComponent } from './timer.component';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';

describe('TimerComponent', () => {
  it('renders the timer display', async () => {
    await TestBed.configureTestingModule({
      imports: [
        TimerComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();

    const fixture = TestBed.createComponent(TimerComponent);
    fixture.componentInstance.instanceId = 'timer_test';
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(':');
  });

  it('merges timer conflict by preserving local intent and progress', () => {
    const merged = mergeTimerStatesForSync(
      {
        mode: 'stopwatch',
        running: true,
        elapsedSeconds: 32,
        remainingSeconds: 0,
        countdownSeconds: 300,
        pomodoroWork: 1500,
        pomodoroBreak: 300,
        pomodoroLongBreak: 900,
        pomodoroCycles: 2,
        pomodoroPhase: 'work',
      },
      {
        mode: 'countdown',
        running: false,
        elapsedSeconds: 12,
        remainingSeconds: 280,
        countdownSeconds: 280,
        pomodoroWork: 1200,
        pomodoroBreak: 240,
        pomodoroLongBreak: 600,
        pomodoroCycles: 1,
        pomodoroPhase: 'break',
      },
      {
        mode: 'stopwatch',
        running: false,
        elapsedSeconds: 0,
        remainingSeconds: 0,
        countdownSeconds: 300,
        pomodoroWork: 1500,
        pomodoroBreak: 300,
        pomodoroLongBreak: 900,
        pomodoroCycles: 0,
        pomodoroPhase: 'work',
      },
    );

    expect(merged.mode).toBe('countdown');
    expect(merged.running).toBe(true);
    expect(merged.elapsedSeconds).toBe(32);
    expect(merged.remainingSeconds).toBe(280);
    expect(merged.countdownSeconds).toBe(280);
    expect(merged.pomodoroCycles).toBe(2);
  });
});
