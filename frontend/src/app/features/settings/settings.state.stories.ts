import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';

@Component({
  selector: 'app-settings-state-fixture',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .settings-fixture {
        display: grid;
        gap: 12px;
        max-width: 680px;
      }

      .settings-card {
        border: 1px solid var(--color-border);
        border-radius: 12px;
        background: var(--color-surface);
        padding: 14px;
      }

      .settings-title {
        margin: 0 0 8px;
      }

      .settings-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 14px;
        margin: 4px 0;
      }

      .settings-badges {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .badge {
        border: 1px solid var(--color-border);
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 12px;
      }

      .badge--warn {
        color: #7a5b00;
        background: #fff3cd;
        border-color: #ffe49a;
      }

      .badge--error {
        color: #b42318;
        background: #fef3f2;
        border-color: #fecdca;
      }
    `,
  ],
  template: `
    <section class="settings-fixture">
      <article class="settings-card">
        <h3 class="settings-title">Settings status badges</h3>
        <div class="settings-badges">
          @if (showReadOnlyBadge) {
            <span class="badge">Read-only collaborator</span>
          }
          @if (showConflictBadge) {
            <span class="badge badge--warn">Remote changes deferred</span>
          }
          @if (showRealtimeDegradedBadge) {
            <span class="badge badge--error">Realtime degraded (polling fallback)</span>
          }
          @if (showTestModeBadge) {
            <span class="badge">Test mode</span>
          }
        </div>
      </article>

      <article class="settings-card">
        <h3 class="settings-title">Runtime quotas</h3>
        <div class="settings-row">
          <span>Requests per minute</span>
          <strong>{{ requestRateCount }} / {{ requestRateLimit }}</strong>
        </div>
        <div class="settings-row">
          <span>Realtime channels in use</span>
          <strong>{{ channelsInUse }} / {{ channelLimit }}</strong>
        </div>
        <div class="settings-row">
          <span>Storage budget</span>
          <strong>{{ storageBudget }}</strong>
        </div>
        <div class="settings-row">
          <span>Vault budget</span>
          <strong>{{ vaultBudget }}</strong>
        </div>
      </article>
    </section>
  `,
})
class SettingsStateFixtureComponent {
  @Input() showReadOnlyBadge = false;
  @Input() showConflictBadge = false;
  @Input() showRealtimeDegradedBadge = false;
  @Input() showTestModeBadge = false;
  @Input() requestRateCount = 12;
  @Input() requestRateLimit = 120;
  @Input() channelsInUse = 1;
  @Input() channelLimit = 10;
  @Input() storageBudget = '200 MB';
  @Input() vaultBudget = '1 GB';
}

const meta: Meta<SettingsStateFixtureComponent> = {
  title: 'Features/Settings/State Panels',
  component: SettingsStateFixtureComponent,
};

export default meta;
type Story = StoryObj<SettingsStateFixtureComponent>;

export const Healthy: Story = {
  args: {
    showTestModeBadge: false,
    showReadOnlyBadge: false,
    showConflictBadge: false,
    showRealtimeDegradedBadge: false,
    requestRateCount: 12,
    requestRateLimit: 120,
    channelsInUse: 1,
    channelLimit: 10,
  },
};

export const ReadonlyAndConflict: Story = {
  args: {
    showReadOnlyBadge: true,
    showConflictBadge: true,
    showRealtimeDegradedBadge: false,
    showTestModeBadge: false,
    requestRateCount: 88,
    requestRateLimit: 120,
    channelsInUse: 6,
    channelLimit: 10,
  },
};

export const RealtimeDegradedNearLimits: Story = {
  args: {
    showReadOnlyBadge: false,
    showConflictBadge: false,
    showRealtimeDegradedBadge: true,
    showTestModeBadge: true,
    requestRateCount: 118,
    requestRateLimit: 120,
    channelsInUse: 10,
    channelLimit: 10,
  },
};
