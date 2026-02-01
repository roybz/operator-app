import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-logout',
  standalone: true,
  template: '',
})
export class LogoutComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    const wasLoggedIn = this.auth.isLoggedIn();
    if (wasLoggedIn) {
      this.auth.logout();
    }
    if (typeof window !== 'undefined') {
      if (wasLoggedIn) {
        window.localStorage.removeItem('op_session');
      }
      window.location.replace(wasLoggedIn ? '/login?loggedOut=1' : '/login');
      return;
    }
    const url = wasLoggedIn ? '/login?loggedOut=1' : '/login';
    this.router.navigateByUrl(url);
  }
}
