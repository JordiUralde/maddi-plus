import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapaSelectorComponent } from './mapa-selector/mapa-selector.component';
import {
  CapaSelectorComponent,
  CapaEstado,
} from './capa-selector/capa-selector.component';
import { LeyendaComponent } from './leyenda/leyenda.component';
import { RadioInfoComponent } from './radio-info/radio-info.component';
import { ViviendaInfoComponent } from './vivienda-info/vivienda-info.component';
import { BuscadorComponent } from './buscador/buscador.component';
import { VisorMapService } from '../../core/services/visor-map.service';
import { MapaFondoService } from '../../core/services/mapa-fondo.service';
import { MapaFondo } from '../../core/models/mapa-fondo.model';
import { GeoLayerService } from '../../core/services/geo-layer.service';
import { ContenedorService } from '../../core/services/contenedor.service';
import {
  ContenedorInfo,
  PortalFeature,
  ViviendaRecord,
} from '../../core/models/contenedor.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-visor',
  standalone: true,
  imports: [
    CommonModule,
    MapaSelectorComponent,
    CapaSelectorComponent,
    LeyendaComponent,
    RadioInfoComponent,
    ViviendaInfoComponent,
    BuscadorComponent,
  ],
  templateUrl: './visor.component.html',
  styleUrl: './visor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VisorMapService],
})
export class VisorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  // ── Estado UI ─────────────────────────────────────────────────────────────
  mapasFondo: MapaFondo[] = [];
  mapaActivo: MapaFondo | null = null;
  capas: CapaEstado[] = [];
  cargando = true;
  error: string | null = null;

  infoContenedor: ContenedorInfo | null = null;
  portales: PortalFeature[] = [];
  radioInfo = 100;
  cargandoPortales = false;

  portalActivoId: number | null = null;
  portalActivoProps: Record<string, unknown> | null = null;
  viviendas: ViviendaRecord[] = [];
  cargandoViviendas = false;

  coordsCapturadas: [number, number] | null = null;

  constructor(
    private mapService: VisorMapService,
    private mapaFondoService: MapaFondoService,
    private geoLayerService: GeoLayerService,
    private contenedorService: ContenedorService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  // ── Ciclo de vida Angular ─────────────────────────────────────────────────

  ngOnInit(): void {  
    this.cargarMapasFondo();
    this.cargarCapasWMS();
    this.cargarContenedores();
  }

  ngAfterViewInit(): void {
    this.mapService.init(this.mapContainer.nativeElement);
    this.mapService.setupInteractions(
      (lon, lat, fraccion, direccion, _coords) => {
        this.infoContenedor = { lon, lat, fraccion, direccion };
        this.buscarPortales(lon, lat, this.radioInfo);
        this.cdr.markForCheck();
      },
      () => {
        this.infoContenedor = null;
        this.mapService.clearSeleccion();
        this.cdr.markForCheck();
      },
    );
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  logout(): void {
    localStorage.removeItem('maddiplus-auth');
    this.router.navigate(['/login']);
  }

  // ── Handlers de eventos del template ─────────────────────────────────────

  seleccionarMapa(mapa: MapaFondo): void {
    this.mapaActivo = mapa;
    this.mapService.setBaseLayerUrl(mapa.url);
  }

  onVisibilidadCambiada(estado: CapaEstado): void {
    this.capas = this.capas.map((c) =>
      c.capa.name === estado.capa.name ? estado : c,
    );
    this.mapService.setWmsLayerVisible(estado.capa.name, estado.visible);
    // Sincroniza la capa hit-test transparente con el toggle del WMS de QGIS.
    if (estado.capa.name === 'capa_contenedores') {
      this.mapService.setContenedoresVisible(estado.visible);
    }
  }

  onRadioCirculoCambiado(radio: number): void {
    this.radioInfo = radio;
    this.mapService.setRadio(radio);
    if (this.infoContenedor) {
      const { lon, lat } = this.infoContenedor;
      this.mapService.actualizarCirculoSilente(lon, lat, radio);
    }
  }

  onRadioCambiado(radio: number): void {
    this.radioInfo = radio;
    this.mapService.setRadio(radio);
    if (this.infoContenedor) {
      const { lon, lat } = this.infoContenedor;
      this.mapService.actualizarCirculo(lon, lat, radio);
      this.buscarPortales(lon, lat, radio);
    }
  }

  onCerrarInfo(): void {
    this.infoContenedor = null;
    this.portalActivoId = null;
    this.portalActivoProps = null;
    this.viviendas = [];
    this.mapService.clearSeleccion();
  }

  onPortalSeleccionado(event: { id: number; props: Record<string, unknown> }): void {
    if (this.portalActivoId === event.id) {
      this.portalActivoId = null;
      this.portalActivoProps = null;
      this.viviendas = [];
      return;
    }
    this.portalActivoId = event.id;
    this.portalActivoProps = event.props;
    this.viviendas = [];
    this.cargandoViviendas = true;
    this.cdr.markForCheck();
    this.contenedorService.getViviendas(event.id).subscribe({
      next: (viviendas) => {
        this.viviendas = viviendas;
        this.cargandoViviendas = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.viviendas = [];
        this.cargandoViviendas = false;
        this.cdr.markForCheck();
      },
    });
  }

  onCerrarViviendas(): void {
    this.portalActivoId = null;
    this.portalActivoProps = null;
    this.viviendas = [];
  }

  // ── Buscador ─────────────────────────────────────────────────────────

  onIniciarCapturaMapa(): void {
    this.mapService.activarCapturaCoordenadas((lon, lat) => {
      this.coordsCapturadas = [lon, lat];
      this.cdr.markForCheck();
    });
  }

  onResultadosBusqueda(
    geojson: import('../../core/models/contenedor.model').ContenedorGeoJSON,
  ): void {
    this.mapService.highlightResultados(geojson);
    this.mapService.zoomToResultados();
  }

  onLimpiarResultados(): void {
    this.mapService.clearResultados();
  }

  onZoomAContenedor(coords: [number, number]): void {
    this.mapService.animarZoomACoordenadas(coords[0], coords[1]);
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  private cargarMapasFondo(): void {
    this.mapaFondoService.getMapasFondo().subscribe({
      next: (mapas) => {
        this.mapasFondo = mapas;
        if (mapas.length > 0) {
          this.mapaActivo = mapas[0];
          this.mapService.setBaseLayerUrl(mapas[0].url);
        }
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudo cargar el mapa de fondo desde el servidor.';
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  private cargarCapasWMS(): void {
    this.geoLayerService.getCapas().subscribe({
      next: (layers) => {
        this.capas = layers.map((capa) => ({ capa, visible: true }));
        layers.forEach((capa) =>
          this.mapService.addWmsLayer(capa.name, capa.wmsUrl, capa.zIndex),
        );
        this.cdr.markForCheck();
      },
    });
  }

  private cargarContenedores(): void {
    this.contenedorService.getContenedores().subscribe({
      next: (geojson) => this.mapService.cargarContenedores(geojson),
    });
  }

  private buscarPortales(lon: number, lat: number, radio: number): void {
    this.cargandoPortales = true;
    this.portalActivoId = null;
    this.portalActivoProps = null;
    this.viviendas = [];
    this.cdr.markForCheck();
    this.contenedorService.getPortales(lon, lat, radio).subscribe({
      next: (geojson) => {
        this.portales = geojson.features ?? [];
        this.mapService.actualizarPortalesHighlight(geojson);
        this.cargandoPortales = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.portales = [];
        this.cargandoPortales = false;
        this.cdr.markForCheck();
      },
    });
  }
}
