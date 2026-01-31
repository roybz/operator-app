import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TimerComponent } from './timer.component';

describe('TimerComponent', () => {
  it('renders the timer display', async () => {
    await TestBed.configureTestingModule({
      imports: [
        TimerComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TimerComponent);
    fixture.componentInstance.instanceId = 'timer_test';
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(':');
  });
});
