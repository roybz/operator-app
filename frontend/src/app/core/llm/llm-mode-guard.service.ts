import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';

@Injectable({ providedIn: 'root' })
export class LlmModeGuardService {
  private readonly auth = inject(AuthService);

  isCloudLlmAllowed(): boolean {
    if (this.auth.guestModeOnly()) return false;
    const user = this.auth.actualUser();
    if (!user) return false;
    if (user.id === 'u_guest' || user.role === 'guest' || user.role === 'observer') return false;
    if (this.auth.orgSettings().testModeEnabled) return false;
    return true;
  }

  assertCloudLlmAllowed(): { ok: true } | { ok: false; message: string } {
    if (this.isCloudLlmAllowed()) return { ok: true };
    return { ok: false, message: 'llm.mode.blocked' };
  }
}
