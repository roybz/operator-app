import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { CalculatorComponent, mergeCalculatorStatesForSync } from './calculator.component';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';

describe('CalculatorComponent', () => {
  it('renders a calculator display', async () => {
    await TestBed.configureTestingModule({
      imports: [
        CalculatorComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [
        {
          provide: AppPreferencesService,
          useValue: {
            language: () => 'en',
            timeZone: () => 'UTC',
            timeFormat: () => '12h',
            userId: () => 'test-user',
          },
        },
        { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
      ],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();

    const fixture = TestBed.createComponent(CalculatorComponent);
    fixture.componentInstance.instanceId = 'calc_test';
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input')?.value).toBe('0');
  });

  it('merges calculator conflict by preserving local expression and preferences', () => {
    const merged = mergeCalculatorStatesForSync(
      {
        display: '10',
        accumulator: 4,
        pendingOp: '+',
        overwrite: true,
        scientific: false,
        currencyEnabled: false,
        currencyAmount: '1',
        currencyFrom: 'USD',
        currencyTo: 'EUR',
        currencyResult: '1 USD = 0.9 EUR',
        currencyError: null,
        currencyLastFetch: 100,
        currencyFetching: false,
      },
      {
        display: '42',
        accumulator: null,
        pendingOp: null,
        overwrite: false,
        scientific: true,
        currencyEnabled: true,
        currencyAmount: '3',
        currencyFrom: 'GBP',
        currencyTo: 'JPY',
        currencyResult: '',
        currencyError: null,
        currencyLastFetch: 120,
        currencyFetching: false,
      },
      {
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
      },
    );

    expect(merged.display).toBe('42');
    expect(merged.scientific).toBe(true);
    expect(merged.currencyEnabled).toBe(true);
    expect(merged.currencyFrom).toBe('GBP');
    expect(merged.currencyTo).toBe('JPY');
    expect(merged.currencyLastFetch).toBe(120);
  });
});
