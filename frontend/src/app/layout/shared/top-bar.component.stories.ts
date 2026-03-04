import type { Meta, StoryObj } from '@storybook/angular';
import { TopBarComponent } from './top-bar.component';

const universes = [
  { id: 'u-main', name: 'Main Universe' },
  { id: 'u-team', name: 'Team Universe' },
];

const meta: Meta<TopBarComponent> = {
  title: 'Layout/Top Bar',
  component: TopBarComponent,
  args: {
    siteLogoEmoji: 'O',
    siteTitle: 'Operator App',
    loggedInLabel: 'roynouneh',
    canSwitchUniverse: true,
    currentUniverseName: 'Main Universe',
    universes,
    activeUniverseId: 'u-main',
    showTime: true,
    timeLabel: '10:24 AM',
    city: 'Montreal',
  },
};

export default meta;
type Story = StoryObj<TopBarComponent>;

export const DefaultDesktop: Story = {};

export const ModeIndicatorsPhoneTest: Story = {
  args: {
    phoneMode: true,
    mockLabel: true,
    previewLabel: 'viewer_12',
    previewPersist: true,
    city: '',
  },
};

export const Loading: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div style="display:grid; gap:8px;">
        <div style="font-size:12px; opacity:0.7;">Loading top-bar state</div>
        <app-top-bar
          [siteLogoEmoji]="siteLogoEmoji"
          [siteTitle]="'Loading...'"
          [showTime]="false"
          [canSwitchUniverse]="false"
          [loggedInLabel]="''"
        ></app-top-bar>
      </div>
    `,
  }),
};

export const Error: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div style="display:grid; gap:8px;">
        <div style="font-size:12px; color:#991b1b;">Top-bar metadata failed to load.</div>
        <app-top-bar
          [siteLogoEmoji]="siteLogoEmoji"
          [siteTitle]="siteTitle"
          [loggedInLabel]="loggedInLabel"
          [showTime]="false"
          [canSwitchUniverse]="false"
        ></app-top-bar>
      </div>
    `,
  }),
};

export const RealtimeDegraded: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div style="display:grid; gap:8px;">
        <div
          style="font-size:12px; padding:6px 10px; border-radius:999px; background:#fff3cd; color:#7a5b00; border:1px solid #ffe49a; width:max-content;"
        >
          Realtime degraded: polling fallback active
        </div>
        <app-top-bar
          [siteLogoEmoji]="siteLogoEmoji"
          [siteTitle]="siteTitle"
          [loggedInLabel]="loggedInLabel"
          [showTime]="showTime"
          [timeLabel]="timeLabel"
          [city]="city"
          [canSwitchUniverse]="canSwitchUniverse"
          [currentUniverseName]="currentUniverseName"
          [universes]="universes"
          [activeUniverseId]="activeUniverseId"
          [previewPersist]="true"
        ></app-top-bar>
      </div>
    `,
  }),
};
