import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'visor',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/visor/visor.component').then((m) => m.VisorComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
