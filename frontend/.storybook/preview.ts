import type { Preview } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { importProvidersFrom } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

class StorybookTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> {
    return of({});
  }
}

const applyThemeClasses = (globals: Record<string, unknown>) => {
  const body = document.body;
  const themeMode = globals['themeMode'] === 'dark' ? 'dark' : 'light';
  const colorTheme = String(globals['colorTheme'] ?? 'default');
  const accessibility = globals['accessibilityMode'] === 'on';

  body.classList.toggle('theme-dark', themeMode === 'dark');
  body.classList.toggle('accessibility-on', accessibility);
  body.classList.remove(
    'theme-color-notepad',
    'theme-color-ice',
    'theme-color-lava',
    'theme-color-green',
  );

  if (colorTheme !== 'default') {
    body.classList.add(`theme-color-${colorTheme}`);
  }
};

const preview: Preview = {
  decorators: [
    applicationConfig({
      providers: [
        importProvidersFrom(
          TranslateModule.forRoot({
            defaultLanguage: 'en',
            loader: {
              provide: TranslateLoader,
              useClass: StorybookTranslateLoader,
            },
          }),
        ),
      ],
    }),
    (storyFn, context) => {
      applyThemeClasses(context.globals);
      return {
        template:
          '<div style="padding: 16px; min-height: 70vh; box-sizing: border-box;"><story /></div>',
        styles: [':host { display: block; width: 100%; }'],
      };
    },
  ],
  globalTypes: {
    themeMode: {
      name: 'Mode',
      description: 'Global light/dark mode',
      defaultValue: 'light',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
    colorTheme: {
      name: 'Color Theme',
      description: 'Global color palette',
      defaultValue: 'default',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'default', title: 'Default' },
          { value: 'notepad', title: 'Notepad' },
          { value: 'ice', title: 'Ice' },
          { value: 'lava', title: 'Lava' },
          { value: 'green', title: 'Green' },
        ],
      },
    },
    accessibilityMode: {
      name: 'Accessibility',
      description: 'High contrast accessibility mode',
      defaultValue: 'off',
      toolbar: {
        icon: 'accessibility',
        items: [
          { value: 'off', title: 'Off' },
          { value: 'on', title: 'On' },
        ],
      },
    },
  },
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
