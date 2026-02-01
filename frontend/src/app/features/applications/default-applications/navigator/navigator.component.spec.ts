import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NavigatorComponent } from './navigator.component';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';

describe('NavigatorComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders navigator tabs', async () => {
    await TestBed.configureTestingModule({
      imports: [
        NavigatorComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();

    const fixture = TestBed.createComponent(NavigatorComponent);
    fixture.componentInstance.instanceId = 'nav_test';
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('iframe')).toBeTruthy();
  });
});
