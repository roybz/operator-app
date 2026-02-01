import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { CalculatorComponent } from './calculator.component';
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
});
