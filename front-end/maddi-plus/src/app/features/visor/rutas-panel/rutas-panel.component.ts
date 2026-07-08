import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RutaComparada, RutaParada } from '../../../core/models/ruta.model';

@Component({
  selector: 'app-rutas-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rutas-panel.component.html',
  styleUrl: './rutas-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RutasPanelComponent implements OnChanges {
  @Input() rutas: RutaComparada[] = [];
  @Input() rutasActivas: Set<string> = new Set();
  @Input() rutasCargando: Set<string> = new Set();
  @Input() fechaSeleccionada = '';

  @Output() cerrado = new EventEmitter<void>();
  @Output() fechaCambiada = new EventEmitter<string>();
  @Output() toggleRuta = new EventEmitter<RutaComparada>();
  @Output() paradaClick = new EventEmitter<RutaParada>();

  expandidas = new Set<string>();

  ngOnChanges(): void {
    // Eliminar expandidas que ya no existen
    const ids = new Set(this.rutas.map((r) => r.id));
    this.expandidas.forEach((id) => { if (!ids.has(id)) this.expandidas.delete(id); });
  }

  toggleExpandida(ruta: RutaComparada): void {
    if (this.expandidas.has(ruta.id)) {
      this.expandidas.delete(ruta.id);
    } else {
      this.expandidas.add(ruta.id);
    }
  }

  isExpandida(ruta: RutaComparada): boolean {
    return this.expandidas.has(ruta.id);
  }

  isActiva(ruta: RutaComparada): boolean {
    return this.rutasActivas.has(ruta.id);
  }

  isCargando(ruta: RutaComparada): boolean {
    return this.rutasCargando.has(ruta.id);
  }

  trackById(_: number, ruta: RutaComparada): string {
    return ruta.id;
  }

  cambiarFecha(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fechaCambiada.emit(input.value);
  }
}
