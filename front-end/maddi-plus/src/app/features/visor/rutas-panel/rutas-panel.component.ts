import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Ruta } from '../../../core/models/ruta.model';

@Component({
  selector: 'app-rutas-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rutas-panel.component.html',
  styleUrl: './rutas-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RutasPanelComponent implements OnChanges {
  @Input() rutas: Ruta[] = [];
  @Input() rutasActivas: Set<string> = new Set();
  @Input() rutasCargando: Set<string> = new Set();

  @Output() cerrado = new EventEmitter<void>();
  @Output() toggleRuta = new EventEmitter<Ruta>();

  expandidas = new Set<string>();

  ngOnChanges(): void {
    // Eliminar expandidas que ya no existen
    const ids = new Set(this.rutas.map((r) => r.id));
    this.expandidas.forEach((id) => { if (!ids.has(id)) this.expandidas.delete(id); });
  }

  toggleExpandida(ruta: Ruta): void {
    if (this.expandidas.has(ruta.id)) {
      this.expandidas.delete(ruta.id);
    } else {
      this.expandidas.add(ruta.id);
    }
  }

  isExpandida(ruta: Ruta): boolean {
    return this.expandidas.has(ruta.id);
  }

  isActiva(ruta: Ruta): boolean {
    return this.rutasActivas.has(ruta.id);
  }

  isCargando(ruta: Ruta): boolean {
    return this.rutasCargando.has(ruta.id);
  }

  trackById(_: number, ruta: Ruta): string {
    return ruta.id;
  }
}
