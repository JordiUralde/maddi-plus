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
import { IncidenciasPanelComponent } from './incidencias-panel/incidencias-panel.component';
import { RutasPanelComponent } from './rutas-panel/rutas-panel.component';
import { VisorMapService } from '../../core/services/visor-map.service';
import { MapaFondoService } from '../../core/services/mapa-fondo.service';
import { MapaFondo } from '../../core/models/mapa-fondo.model';
import { GeoLayerService } from '../../core/services/geo-layer.service';
import { ContenedorService } from '../../core/services/contenedor.service';
import { RutaService } from '../../core/services/ruta.service';
import { Ruta, RutaParada } from '../../core/models/ruta.model';
import {
  ContenedorInfo,
  IncidenciasGeoJSON,
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
    IncidenciasPanelComponent,
    RutasPanelComponent,
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

  // ── Estado incidencias ────────────────────────────────────────────────────
  private static readonly COOKIE_INCIDENCIAS = 'maddiplus-incidencias-capa';

  incidenciasGeoJSON: IncidenciasGeoJSON | null = null;
  mostrarPanelIncidencias = false;
  incidenciasCapaVisible = this.leerCookieIncidencias();
  // ── Estado rutas ───────────────────────────────────────────────
  rutas: Ruta[] = [];
  rutasActivas = new Set<string>();
  rutasCargando = new Set<string>();
  mostrarPanelRutas = false;
  constructor(
    private mapService: VisorMapService,
    private mapaFondoService: MapaFondoService,
    private geoLayerService: GeoLayerService,
    private contenedorService: ContenedorService,
    private rutaService: RutaService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  // ── Ciclo de vida Angular ─────────────────────────────────────────────────

  ngOnInit(): void {  
    this.cargarMapasFondo();
    this.cargarCapasWMS();
    this.cargarContenedores();
    this.cargarIncidencias();
    this.cargarRutas();
  }

  ngAfterViewInit(): void {
    this.mapService.init(this.mapContainer.nativeElement);
    this.mapService.setupInteractions(
      (lon, lat, fraccion, direccion, _coords, matricula) => {
        // Mostrar panel inmediatamente con datos básicos del WFS
        this.infoContenedor = {
          lon, lat, fraccion, direccion, matricula,
          barrio: null, distrito: null, punto_recogida: null,
          tension_pila: null, modelo_contenedor: null, capacidad: null,
          aportaciones_ultimo_anio: null, estado: null,
          descripcion_incidencia: null, estado_tapa: null, estado_cerradura: null,
        };
        this.buscarPortales(lon, lat, this.radioInfo);
        this.cdr.markForCheck();
        // Cargar detalles completos desde la BD usando la matrícula
        if (matricula != null) {
          this.cargarDetallesContenedor(matricula, lon, lat);
        }
      },
      () => {
        this.infoContenedor = null;
        this.mapService.clearSeleccion();
        this.cdr.markForCheck();
      },
    );
  }

  private cargarDetallesContenedor(matricula: number, lon: number, lat: number): void {
    this.contenedorService.getDetalles(matricula).subscribe({
      next: (d) => {
        this.infoContenedor = {
          lon, lat,
          fraccion:                 String(d['fraccion']                  ?? this.infoContenedor?.fraccion  ?? ''),
          direccion:                String(d['direccion']                 ?? this.infoContenedor?.direccion ?? ''),
          matricula:                d['matricula']                != null ? Number(d['matricula'])                : null,
          barrio:                   d['barrio']                  != null ? String(d['barrio'])                   : null,
          distrito:                 d['distrito']                != null ? String(d['distrito'])                 : null,
          punto_recogida:           d['punto_recogida']          != null ? Number(d['punto_recogida'])           : null,
          tension_pila:             d['tension_pila']            != null ? Number(d['tension_pila'])             : null,
          modelo_contenedor:        d['modelo_contenedor']       != null ? String(d['modelo_contenedor'])        : null,
          capacidad:                d['capacidad']               != null ? Number(d['capacidad'])                : null,
          aportaciones_ultimo_anio: d['aportaciones_ultimo_anio'] != null ? Number(d['aportaciones_ultimo_anio']) : null,
          estado:                   d['estado']                  != null ? String(d['estado'])                   : null,
          descripcion_incidencia:   d['descripcion_incidencia']  != null ? String(d['descripcion_incidencia'])   : null,
          estado_tapa:              d['estado_tapa']             != null ? String(d['estado_tapa'])              : null,
          estado_cerradura:         d['estado_cerradura']        != null ? String(d['estado_cerradura'])         : null,
        };
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  // ── Incidencias ───────────────────────────────────────────────────────────

  private cargarIncidencias(): void {
    this.contenedorService.getIncidencias().subscribe({
      next: (geojson) => {
        this.incidenciasGeoJSON = geojson;
        this.mapService.cargarIncidencias(geojson);
        this.mapService.setIncidenciasVisible(this.incidenciasCapaVisible);
        this.cdr.markForCheck();
      },
    });
  }

  togglePanelIncidencias(): void {
    this.mostrarPanelIncidencias = !this.mostrarPanelIncidencias;
  }

  onVisibilidadCapaIncidencias(visible: boolean): void {
    this.incidenciasCapaVisible = visible;
    this.mapService.setIncidenciasVisible(visible);
    this.guardarCookieIncidencias(visible);
  }

  private leerCookieIncidencias(): boolean {
    const match = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(VisorComponent.COOKIE_INCIDENCIAS + '='));
    // Si la cookie no existe aún, el valor por defecto es visible (true)
    return match ? match.split('=')[1] !== 'false' : true;
  }

  private guardarCookieIncidencias(visible: boolean): void {
    // Expira en 365 días; SameSite=Lax es suficiente para uso interno
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie =
      `${VisorComponent.COOKIE_INCIDENCIAS}=${visible}` +
      `; expires=${expires.toUTCString()}` +
      `; path=/; SameSite=Lax`;
  }

  onZoomAIncidencia(coords: { lon: number; lat: number }): void {
    this.mapService.animarZoomACoordenadas(coords.lon, coords.lat);
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
    this.mapService.clearPuntoBusqueda();
  }

  onZoomAContenedor(coords: [number, number]): void {
    this.mapService.animarZoomACoordenadas(coords[0], coords[1]);
  }

  // ── Rutas ─────────────────────────────────────────────────────────────────

  togglePanelRutas(): void {
    this.mostrarPanelRutas = !this.mostrarPanelRutas;
    if (!this.mostrarPanelRutas) {
      this.mapService.ocultarParadaSeleccionada();
    }
  }

  onToggleRuta(ruta: Ruta): void {
    if (this.rutasActivas.has(ruta.id)) {
      // Desactivar — crear nueva referencia para que OnPush la detecte
      this.rutasActivas = new Set(this.rutasActivas);
      this.rutasActivas.delete(ruta.id);
      this.mapService.ocultarRuta();
      this.cdr.markForCheck();
      return;
    }
    // Activar: desactivar cualquier ruta previa y cargar geometría desde OSRM
    this.rutasActivas = new Set<string>();
    this.rutasCargando = new Set(this.rutasCargando);
    this.rutasCargando.add(ruta.id);
    this.cdr.markForCheck();
    this.rutaService.getRouteGeometry(ruta.paradas).subscribe({
      next: (geometry) => {
        this.rutasActivas = new Set<string>();
        this.rutasActivas.add(ruta.id);
        this.rutasCargando = new Set(this.rutasCargando);
        this.rutasCargando.delete(ruta.id);
        this.mapService.mostrarRuta(geometry, ruta.paradas);
        this.cdr.markForCheck();
      },
      error: () => {
        this.rutasCargando = new Set(this.rutasCargando);
        this.rutasCargando.delete(ruta.id);
        this.cdr.markForCheck();
      },
    });
  }

  onParadaClick(parada: RutaParada): void {
    if (parada.y == null || parada.x == null) return;

    const routeId = parada.id_parada ?? 'sin-id';
    const routeIsActive = this.rutasActivas.has(routeId);

    if (!routeIsActive) {
      // Activar la ruta primero; el fit de mostrarRuta centra la vista sobre ella
      const ruta = this.rutas.find(r => r.id === routeId);
      if (ruta) this.onToggleRuta(ruta);
      this.mapService.mostrarParadaSeleccionada(parada.y, parada.x);
      return;
    }

    // Ruta ya visible: navegar directamente al punto
    this.mapService.animarZoomACoordenadas(parada.y, parada.x);
    this.mapService.mostrarParadaSeleccionada(parada.y, parada.x);
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  private cargarMapasFondo(): void {
    this.mapaFondoService.getMapasFondo().subscribe({
      next: (mapas) => {
        this.mapasFondo = mapas;
        if (mapas.length > 0) {
          const carto = mapas.find((m) =>
            m.url.includes('carto') || m.nombre.toLowerCase().includes('carto'),
          );
          const mapaDefecto = carto ?? mapas[0];
          this.mapaActivo = mapaDefecto;
          this.mapService.setBaseLayerUrl(mapaDefecto.url);
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

  private cargarRutas(): void {
    this.rutaService.getRutas().subscribe({
      next: (rutas) => {
        this.rutas = rutas;
        this.cdr.markForCheck();
      },
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
