import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: ':universeId', component: LoginComponent },
  { path: '**', redirectTo: '' },
];
