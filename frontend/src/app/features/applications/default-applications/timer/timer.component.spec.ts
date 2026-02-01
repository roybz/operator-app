import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TimerComponent } from './timer.component';
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
});
