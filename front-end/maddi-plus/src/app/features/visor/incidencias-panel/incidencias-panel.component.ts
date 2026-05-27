import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IncidenciaFeature,
  IncidenciasGeoJSON,
  TIPOS_INCIDENCIA,
  TipoIncidencia,
} from '../../../core/models/contenedor.model';

@Component({
  selector: 'app-incidencias-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './incidencias-panel.component.html',
  styleUrl: './incidencias-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidenciasPanelComponent implements OnChanges {
  @Input() incidencias: IncidenciasGeoJSON | null = null;
  @Input() capasVisible = true;

  @Output() cerrado = new EventEmitter<void>();
  @Output() visibilidadCapa = new EventEmitter<boolean>();
  @Output() zoomAIncidencia = new EventEmitter<{ lon: number; lat: number }>();

  readonly tipos = TIPOS_INCIDENCIA;
  filtroActivo: TipoIncidencia | null = null;
  featuresVisibles: IncidenciaFeature[] = [];

  ngOnChanges(): void {
    this.aplicarFiltro();
  }

  setFiltro(tipo: TipoIncidencia | null): void {
    this.filtroActivo = tipo;
    this.aplicarFiltro();
  }

  private aplicarFiltro(): void {
    const todas = this.incidencias?.features ?? [];
    this.featuresVisibles = this.filtroActivo
      ? todas.filter((f) => this.tipoDeIncidencia(f) === this.filtroActivo)
      : todas;
  }

  tipoDeIncidencia(f: IncidenciaFeature): TipoIncidencia {
    const desc = (f.properties.descripcion_incidencia ?? '').toLowerCase();
    if (desc.includes('bater'))  return 'Batería baja';
    if (desc.includes('cerradura')) return 'Cerradura dejada abierta';
    if (desc.includes('tapa'))   return 'Tapa abierta';
    return 'Otra';
  }

  colorTipo(tipo: TipoIncidencia): string {
    switch (tipo) {
      case 'Batería baja':             return '#F9A825';
      case 'Cerradura dejada abierta': return '#c0392b';
      case 'Tapa abierta':             return '#e67e22';
      default:                         return '#757575';
    }
  }

  countTipo(tipo: TipoIncidencia): number {
    return (this.incidencias?.features ?? []).filter(
      (f) => this.tipoDeIncidencia(f) === tipo,
    ).length;
  }

  onZoom(f: IncidenciaFeature): void {
    const [lon, lat] = f.geometry.coordinates;
    this.zoomAIncidencia.emit({ lon, lat });
  }

  toggleCapa(): void {
    this.visibilidadCapa.emit(!this.capasVisible);
  }

  trackByMatricula(_: number, f: IncidenciaFeature): number {
    return f.properties.matricula;
  }
}
