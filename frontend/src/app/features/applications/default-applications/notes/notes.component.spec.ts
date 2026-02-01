import { TestBed } from '@angular/core/testing';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { NotesComponent } from './notes.component';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';

describe('NotesComponent', () => {
  it('renders notes tree', async () => {
    await TestBed.configureTestingModule({
      imports: [
        NotesComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { notes: { root: 'Notes' } });
    translate.use('en');

    const fixture = TestBed.createComponent(NotesComponent);
    fixture.componentInstance.instanceId = 'notes_test';
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Notes');
  });
});
