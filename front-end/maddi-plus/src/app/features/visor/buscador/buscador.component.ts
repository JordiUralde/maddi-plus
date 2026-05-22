import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BusquedaParams,
  ContenedorGeoJSON,
  ContenedorProperties,
  ResultadoContenedor,
} from '../../../core/models/contenedor.model';
import { ContenedorService } from '../../../core/services/contenedor.service';

export type TipoBusqueda = 'barrio' | 'calle' | 'punto_recogida' | 'coordenadas' | 'refcat';

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscador.component.html',
  styleUrl: './buscador.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscadorComponent {
  readonly tipos: { value: TipoBusqueda; label: string }[] = [
    { value: 'barrio',          label: 'Barrio' },
    { value: 'calle',           label: 'Calle' },
    { value: 'punto_recogida',  label: 'Punto de recogida' },
    { value: 'coordenadas',     label: 'Distancia desde punto' },
    //{ value: 'refcat',          label: 'Ref. catastral' },
  ];

  tipo: TipoBusqueda = 'barrio';
  textoBusqueda = '';
  numeroBusqueda: number | null = null;
  radio = 50;

  lon: number | null = null;
  lat: number | null = null;
  esperandoCoordenadas = false;

  abierto = false;
  cargando = false;
  error: string | null = null;
  resultados: ResultadoContenedor[] = [];

  @Input() set coordsCapturadas(val: [number, number] | null) {
    if (val) {
      this.lon = val[0];
      this.lat = val[1];
      this.esperandoCoordenadas = false;
      this.cdr.markForCheck();
    }
  }

  @Output() resultadosObtenidos = new EventEmitter<ContenedorGeoJSON>();
  @Output() iniciarCapturaMapa  = new EventEmitter<void>();
  @Output() limpiarResultados   = new EventEmitter<void>();
  @Output() zoomAContenedor     = new EventEmitter<[number, number]>();

  constructor(
    private contenedorService: ContenedorService,
    private cdr: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>,
  ) {}

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: HTMLElement): void {
    if (this.abierto && !this.el.nativeElement.contains(target)) {
      this.abierto = false;
      this.cdr.markForCheck();
    }
  }

  togglePanel(): void {
    this.abierto = !this.abierto;
  }

  cambiarTipo(tipo: TipoBusqueda): void {
    this.tipo = tipo;
    this.textoBusqueda = '';
    this.numeroBusqueda = null;
    this.lon = null;
    this.lat = null;
    this.error = null;
    this.resultados = [];
    this.limpiarResultados.emit();
  }

  activarCapturaMapa(): void {
    this.esperandoCoordenadas = true;
    this.abierto = false; // cierra el panel para que el mapa sea accesible
    this.iniciarCapturaMapa.emit();
  }

  get puedesBuscar(): boolean {
    switch (this.tipo) {
      case 'barrio':         return !!this.textoBusqueda.trim();
      case 'calle':          return !!this.textoBusqueda.trim();
      case 'punto_recogida': return this.numeroBusqueda !== null && this.numeroBusqueda > 0;
      case 'coordenadas':    return this.lon !== null && this.lat !== null;
      case 'refcat':         return !!this.textoBusqueda.trim();
    }
  }

  buscar(): void {
    if (!this.puedesBuscar) return;
    this.cargando = true;
    this.error = null;
    this.resultados = [];
    this.cdr.markForCheck();

    this.contenedorService.buscarContenedores(this.buildParams()).subscribe({
      next: (geojson) => {
        this.resultados = geojson.features.map((f) => ({
          props: f.properties as ContenedorProperties,
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }));
        this.cargando = false;
        this.resultadosObtenidos.emit(geojson);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudo realizar la búsqueda.';
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  irAContenedor(r: ResultadoContenedor): void {
    this.zoomAContenedor.emit([r.lon, r.lat]);
  }

  limpiar(): void {
    this.resultados = [];
    this.error = null;
    this.textoBusqueda = '';
    this.numeroBusqueda = null;
    this.lon = null;
    this.lat = null;
    this.limpiarResultados.emit();
  }

  colorFraccion(fraccion: string): string {
    switch (fraccion) {
      case 'Papel/Cartón': return '#1565C0';
      case 'Orgánico':     return '#6D4C41';
      case 'Envases':      return '#F9A825';
      default:             return '#757575';
    }
  }

  private buildParams(): BusquedaParams {
    switch (this.tipo) {
      case 'barrio':         return { barrio: this.textoBusqueda.trim() };
      case 'calle':          return { calle: this.textoBusqueda.trim() };
      case 'punto_recogida': return { punto_recogida: String(this.numeroBusqueda!) };
      case 'coordenadas':    return { lon: String(this.lon!), lat: String(this.lat!), radio: String(this.radio) };
      case 'refcat':         return { refcat: this.textoBusqueda.trim(), radio: String(this.radio) };
    }
  }
}
