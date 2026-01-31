import { TestBed } from '@angular/core/testing';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { ClockComponent } from './clock.component';

describe('ClockComponent', () => {
  it('renders the settings view with a time zone selector', async () => {
    await TestBed.configureTestingModule({
      imports: [
        ClockComponent,
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
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      clock: {
        settingsTitle: 'Clock settings',
        formatLabel: 'Format',
        clocksTitle: 'Clocks',
        addClock: 'Add clock',
        removeClock: 'Remove clock',
      },
    });
    translate.use('en');

    const fixture = TestBed.createComponent(ClockComponent);
    fixture.componentInstance.instanceId = 'clock_test';
    const instanceSettings = TestBed.inject(InstanceSettingsService);
    instanceSettings.open('clock_test');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('select')).toBeTruthy();
    expect(compiled.textContent).toContain('Clock settings');
  });
});
