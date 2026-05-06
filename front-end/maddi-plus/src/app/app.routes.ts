import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'visor',
    loadComponent: () =>
      import('./features/visor/visor.component').then((m) => m.VisorComponent),
  },
  { path: '', redirectTo: 'visor', pathMatch: 'full' },
];
