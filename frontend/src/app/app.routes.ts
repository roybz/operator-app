import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { TodoPageComponent } from './features/applications/todo/todo.component';
import { LoginComponent } from './features/auth/login.component';
import { SettingsComponent } from './features/settings/settings.component';
import { UsersSettingsComponent } from './features/settings/users/users.component';
import { PreferencesSettingsComponent } from './features/settings/preferences/preferences.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: LandingComponent, canActivate: [authGuard] },
  { path: 'todo', component: TodoPageComponent, canActivate: [authGuard] },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      { path: 'users', component: UsersSettingsComponent },
      { path: 'preferences', component: PreferencesSettingsComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
