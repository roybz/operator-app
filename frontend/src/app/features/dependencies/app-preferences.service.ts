import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Injectable({ providedIn: 'root' })
export class AppPreferencesService {
  private auth = inject(AuthService);

  readonly preferences = computed(() => this.auth.preferences());
  readonly language = computed(() => this.auth.preferences().language || 'en');
  readonly timeZone = computed(() => this.auth.preferences().timeZone || 'UTC');
  readonly timeFormat = computed(() => this.auth.preferences().timeFormat || '12h');
  readonly userId = computed(() => this.auth.storageUserKey());
}
