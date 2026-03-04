import { mergeCalendarStatesForSync } from './calendar.component';

describe('CalendarComponent conflict merge', () => {
  it('merges calendars/events and preserves local view state', () => {
    const merged = mergeCalendarStatesForSync(
      {
        viewDate: '2026-02-24T00:00:00.000Z',
        viewMode: 'month',
        calendars: [
          {
            id: 'cal_1',
            name: 'Work',
            color: '#60a5fa',
            visible: true,
            sourceUrl: '',
            events: [{ id: 'evt_1', title: 'Remote event', start: '2026-02-24', end: '2026-02-24' }],
          },
        ],
        showSettingsDesktop: false,
        showSettingsPhone: false,
        selectedCalendarId: 'cal_1',
      },
      {
        viewDate: '2026-02-25T00:00:00.000Z',
        viewMode: 'day',
        calendars: [
          {
            id: 'cal_1',
            name: 'Work',
            color: '#f97316',
            visible: true,
            sourceUrl: '',
            events: [
              { id: 'evt_1', title: 'Local override', start: '2026-02-24', end: '2026-02-24' },
              { id: 'evt_2', title: 'Local new event', start: '2026-02-25', end: '2026-02-25' },
            ],
          },
        ],
        showSettingsDesktop: true,
        showSettingsPhone: true,
        selectedCalendarId: 'cal_1',
      },
    );

    expect(merged.viewMode).toBe('day');
    expect(merged.showSettingsDesktop).toBe(true);
    expect(merged.showSettingsPhone).toBe(true);
    expect(merged.calendars[0].events.map((event) => event.id)).toEqual(['evt_1', 'evt_2']);
    expect(merged.calendars[0].events.find((event) => event.id === 'evt_1')?.title).toBe(
      'Local override',
    );
  });
});
