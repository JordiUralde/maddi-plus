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
  @Input() mostrarFlechasDireccion = true;
  @Input() mostrarRutaReal = true;
  @Input() mostrarRutaHistorica = true;

  @Output() cerrado = new EventEmitter<void>();
  @Output() fechaCambiada = new EventEmitter<string>();
  @Output() toggleRuta = new EventEmitter<RutaComparada>();
  @Output() paradaClick = new EventEmitter<RutaParada>();
  @Output() mostrarFlechasDireccionCambiado = new EventEmitter<boolean>();
  @Output() mostrarRutaRealCambiado = new EventEmitter<boolean>();
  @Output() mostrarRutaHistoricaCambiado = new EventEmitter<boolean>();

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

  puedeDibujarse(ruta: RutaComparada): boolean {
    return !!ruta.historica && ruta.historica.paradas.length > 0;
  }

  trackById(_: number, ruta: RutaComparada): string {
    return ruta.id;
  }

  cambiarFecha(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fechaCambiada.emit(input.value);
  }

  toggleFlechasDireccion(): void {
    this.mostrarFlechasDireccionCambiado.emit(!this.mostrarFlechasDireccion);
  }

  toggleRutaReal(): void {
    this.mostrarRutaRealCambiado.emit(!this.mostrarRutaReal);
  }

  toggleRutaHistorica(): void {
    this.mostrarRutaHistoricaCambiado.emit(!this.mostrarRutaHistorica);
  }

  textoRutaNoDisponible(): string {
    if (!this.fechaSeleccionada) {
      return 'Ruta histórica no disponible hasta seleccionar fecha';
    }
    return `Sin ruta histórica para ${this.formatearFecha(this.fechaSeleccionada)}`;
  }

  private formatearFecha(fechaIso: string): string {
    const m = fechaIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return fechaIso;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  formatMinutos(valor: number | null): string {
    return valor == null ? 'N/D' : `${valor.toFixed(1)} min`;
  }

  formatCobertura(valor: number | null): string {
    return valor == null ? 'N/D' : `${valor.toFixed(1)}%`;
  }

  formatDesviacion(valor: number | null): string {
    if (valor == null) return 'N/D';
    if (valor > 0) return `+${valor.toFixed(1)} min`;
    return `${valor.toFixed(1)} min`;
  }

  getDesviacionClass(valor: number | null): 'pos' | 'neg' | 'neutral' {
    if (valor == null || valor === 0) return 'neutral';
    return valor > 0 ? 'pos' : 'neg';
  }
}
