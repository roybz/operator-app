import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { LogoutComponent } from './features/auth/logout.component';

export const routes: Routes = [
  { path: '', component: LoginComponent, pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },
  { path: ':universeId', component: LoginComponent },
  { path: '**', redirectTo: '' },
];
