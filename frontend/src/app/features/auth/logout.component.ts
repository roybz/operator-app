import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { StorageService } from '../../core/storage/storage.service';

@Component({
  selector: 'app-logout',
  standalone: true,
  template: '',
})
export class LogoutComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private storage = inject(StorageService);

  ngOnInit() {
    const wasLoggedIn = this.auth.isLoggedIn();
    if (wasLoggedIn) {
      this.auth.logout();
    }
    if (wasLoggedIn) {
      void this.storage.removeItem('op_session');
    }
    const url = wasLoggedIn ? '/login?loggedOut=1' : '/login';
    if (typeof window !== 'undefined') {
      window.location.replace(url);
      return;
    }
    this.router.navigateByUrl(url);
  }
}
