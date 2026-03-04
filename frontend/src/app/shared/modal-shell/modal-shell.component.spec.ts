import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ModalShellComponent } from './modal-shell.component';

describe('ModalShellComponent', () => {
  let fixture: ComponentFixture<ModalShellComponent>;
  let component: ModalShellComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalShellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits closed when backdrop is clicked', () => {
    const closeSpy = vi.spyOn(component.closed, 'emit');
    const backdrop = fixture.nativeElement.querySelector('.modal-shell__backdrop') as HTMLElement;
    backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(closeSpy).toHaveBeenCalled();
  });

  it('does not emit closed on backdrop when closeOnBackdrop is false', () => {
    component.closeOnBackdrop = false;
    fixture.detectChanges();
    const closeSpy = vi.spyOn(component.closed, 'emit');
    const backdrop = fixture.nativeElement.querySelector('.modal-shell__backdrop') as HTMLElement;
    backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('emits closed on escape key', () => {
    const closeSpy = vi.spyOn(component.closed, 'emit');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closeSpy).toHaveBeenCalled();
  });

  it('focuses panel after initialization', async () => {
    await fixture.whenStable();
    const panel = fixture.nativeElement.querySelector('.modal-shell__panel') as HTMLElement;
    expect(document.activeElement).toBe(panel);
  });
});
