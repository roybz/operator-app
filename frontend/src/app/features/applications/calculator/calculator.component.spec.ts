import { TestBed } from '@angular/core/testing';
import { CalculatorComponent } from './calculator.component';

describe('CalculatorComponent', () => {
  it('renders a calculator display', async () => {
    await TestBed.configureTestingModule({
      imports: [CalculatorComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(CalculatorComponent);
    fixture.componentInstance.instanceId = 'calc_test';
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input')?.value).toBe('0');
  });
});
