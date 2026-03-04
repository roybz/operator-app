import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { getOpCapabilities } from '../op-config';

export type EntitlementStatus = 'granted' | 'denied';

export interface EntitlementResult {
  status: EntitlementStatus;
  code?: string;
}

@Injectable({ providedIn: 'root' })
export class EntitlementService {
  private readonly auth = inject(AuthService);

  canUseCloudVaultBeta(): EntitlementResult {
    const caps = getOpCapabilities();
    if (!caps.billingGuard) return { status: 'granted' };
    if (!caps.cloudVault) return { status: 'denied', code: 'cloud_vault_disabled' };
    if (this.auth.guestModeOnly()) return { status: 'denied', code: 'guest_mode_only' };
    if (!this.auth.isLoggedIn()) return { status: 'denied', code: 'auth_required' };
    if (this.auth.session().userId === 'u_guest')
      return { status: 'denied', code: 'guest_account' };
    if (this.auth.orgSettings().testModeEnabled) return { status: 'denied', code: 'test_mode' };
    return { status: 'granted' };
  }
}
