import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { TodoPageComponent } from './features/applications/todo/todo.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'todo', component: TodoPageComponent },
];
