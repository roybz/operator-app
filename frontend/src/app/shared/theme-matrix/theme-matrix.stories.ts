import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';

@Component({
  selector: 'app-theme-matrix-fixture',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .theme-fixture {
        display: grid;
        gap: 12px;
        max-width: 760px;
      }

      .theme-panel {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        box-shadow: var(--shadow-sm);
        padding: var(--space-4);
        display: grid;
        gap: var(--space-3);
      }

      .theme-row {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        align-items: center;
      }

      .theme-chip {
        border: 1px solid var(--color-border);
        border-radius: 999px;
        padding: 4px 8px;
        font-size: var(--font-size-xs);
      }

      .theme-chip--warn {
        background: color-mix(in srgb, var(--color-accent) 20%, var(--color-surface));
      }

      .theme-button {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-bg);
        color: var(--color-text);
        padding: 8px 12px;
      }

      .theme-button--primary {
        background: var(--color-accent);
        color: var(--color-accent-contrast);
      }
    `,
  ],
  template: `
    <section class="theme-fixture">
      <article class="theme-panel">
        <h3 style="margin: 0">Shared Component Theme Stress</h3>
        <div class="theme-row">
          <span class="theme-chip">Readonly</span>
          <span class="theme-chip theme-chip--warn">Remote deferred apply</span>
          @if (realtimeDegraded) {
            <span class="theme-chip">Realtime degraded</span>
          }
        </div>
        <div class="theme-row">
          <button class="theme-button" type="button">Cancel</button>
          <button class="theme-button theme-button--primary" type="button">Apply</button>
        </div>
      </article>
    </section>
  `,
})
class ThemeMatrixFixtureComponent {
  @Input() realtimeDegraded = false;
}

const meta: Meta<ThemeMatrixFixtureComponent> = {
  title: 'Shared/Theme Matrix',
  component: ThemeMatrixFixtureComponent,
};

export default meta;
type Story = StoryObj<ThemeMatrixFixtureComponent>;

export const LightDefault: Story = {
  args: { realtimeDegraded: false },
  globals: { themeMode: 'light', colorTheme: 'default', accessibilityMode: 'off' },
};

export const DarkDefault: Story = {
  args: { realtimeDegraded: true },
  globals: { themeMode: 'dark', colorTheme: 'default', accessibilityMode: 'off' },
};

export const LightNotepad: Story = {
  args: { realtimeDegraded: false },
  globals: { themeMode: 'light', colorTheme: 'notepad', accessibilityMode: 'off' },
};

export const DarkGreen: Story = {
  args: { realtimeDegraded: true },
  globals: { themeMode: 'dark', colorTheme: 'green', accessibilityMode: 'off' },
};

export const AccessibilityHighContrast: Story = {
  args: { realtimeDegraded: true },
  globals: { themeMode: 'light', colorTheme: 'default', accessibilityMode: 'on' },
};
