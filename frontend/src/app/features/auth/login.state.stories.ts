import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';

@Component({
  selector: 'app-login-state-fixture',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .login-fixture {
        max-width: 420px;
        display: grid;
        gap: 12px;
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 16px;
        background: var(--color-surface);
      }

      .login-title {
        margin: 0;
      }

      .login-caption {
        margin: 0;
        font-size: 13px;
        opacity: 0.8;
      }

      .login-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .login-button {
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 8px 12px;
        background: var(--color-bg);
      }

      .login-button[disabled] {
        opacity: 0.55;
      }

      .login-note {
        font-size: 13px;
        opacity: 0.8;
      }
    `,
  ],
  template: `
    <section class="login-fixture">
      <h3 class="login-title">{{ title }}</h3>
      <p class="login-caption">{{ caption }}</p>

      @if (showCredentialsForm) {
        <label>
          Username
          <input class="login-button" type="text" placeholder="username" />
        </label>
        <label>
          Password
          <input class="login-button" type="password" placeholder="��������" />
        </label>
      }

      <div class="login-actions">
        @if (showSignInButton) {
          <button class="login-button" type="button">Sign in</button>
        }
        @if (showGuestButton) {
          <button class="login-button" type="button">Continue as guest</button>
        }
        @if (showCreateAccountButton) {
          <button class="login-button" type="button" [disabled]="!signupEnabled">
            Create account
          </button>
        }
      </div>

      @if (showSignupDisabledMessage) {
        <p class="login-note">Registration is currently invite-only.</p>
      }
    </section>
  `,
})
class LoginStateFixtureComponent {
  @Input() title = 'Sign in';
  @Input() caption = 'Use secure sign in to access your account.';
  @Input() showCredentialsForm = false;
  @Input() showSignInButton = true;
  @Input() showGuestButton = false;
  @Input() showCreateAccountButton = false;
  @Input() signupEnabled = false;
  @Input() showSignupDisabledMessage = false;
}

const meta: Meta<LoginStateFixtureComponent> = {
  title: 'Features/Auth/Login States',
  component: LoginStateFixtureComponent,
  args: {
    showCredentialsForm: false,
    showSignInButton: true,
    showGuestButton: false,
    showCreateAccountButton: false,
    signupEnabled: false,
    showSignupDisabledMessage: false,
  },
};

export default meta;
type Story = StoryObj<LoginStateFixtureComponent>;

export const LocalAuth: Story = {
  args: {
    title: 'Local account sign in',
    caption: 'Username/password mode with local auth.',
    showCredentialsForm: true,
  },
};

export const ExternalAuth: Story = {
  args: {
    title: 'Secure sign in',
    caption: 'External identity provider sign in enabled.',
  },
};

export const SignupDisabledPrepared: Story = {
  args: {
    title: 'Secure sign in',
    caption: 'Public signup path is prepared but disabled.',
    showCreateAccountButton: true,
    signupEnabled: false,
    showSignupDisabledMessage: true,
  },
};

export const GuestOnlyMode: Story = {
  args: {
    title: 'Guest-only mode',
    caption: 'Public login is disabled. Guest local-only access remains available.',
    showSignInButton: false,
    showGuestButton: true,
  },
};
