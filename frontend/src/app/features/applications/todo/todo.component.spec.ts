import { TestBed } from '@angular/core/testing';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { TodoPageComponent } from './todo.component';

interface OpWindow extends Window {
  __OP_CONFIG__?: { apiBaseUrl?: string; mockMode?: boolean };
}

describe('TodoPageComponent', () => {
  beforeEach(async () => {
    const w = window as OpWindow;
    w.__OP_CONFIG__ = { mockMode: true, apiBaseUrl: '' };
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [
        TodoPageComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      todo: {
        title: 'Todos App',
        placeholder: 'Add a todo',
        add: 'Add',
        reload: 'Reload',
        loading: 'Loading…',
        duplicate: 'Duplicate',
        delete: 'Delete',
        duplicateTitle: 'Duplicate',
        deleteTitle: 'Delete forever',
        error: { unknown: 'Something went wrong.' },
      },
    });
    translate.use('en');
  });

  afterEach(() => {
    localStorage.clear();
    const w = window as OpWindow;
    delete w.__OP_CONFIG__;
  });

  it('renders translated labels', async () => {
    const fixture = TestBed.createComponent(TodoPageComponent);
    fixture.componentInstance.instanceId = 'dlg_test';
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('input');
    expect(compiled.querySelector('h2')?.textContent).toContain('Todos App');
    expect(input?.getAttribute('placeholder')).toBe('Add a todo');
    expect(compiled.textContent).toContain('Add');
    expect(compiled.textContent).toContain('Reload');
  });

  it('adds and deletes a todo in mock mode', async () => {
    const fixture = TestBed.createComponent(TodoPageComponent);
    fixture.componentInstance.instanceId = 'dlg_test';
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    await component.onAdd('Buy milk');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Buy milk');

    const created = component.todos()[0];
    await component.onDelete(created);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(compiled.textContent).not.toContain('Buy milk');
  });
});
