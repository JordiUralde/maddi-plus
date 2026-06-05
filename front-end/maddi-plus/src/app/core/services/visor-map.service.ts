import { Injectable, NgZone } from '@angular/core';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, transformExtent, toLonLat } from 'ol/proj';
import { extend, createEmpty, isEmpty } from 'ol/extent';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Icon from 'ol/style/Icon';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { circular } from 'ol/geom/Polygon';
import { easeOut } from 'ol/easing';
import { ContenedorGeoJSON, IncidenciasGeoJSON, PortalesGeoJSON } from '../models/contenedor.model';

export type ContenedorClickHandler = (
  lon: number,
  lat: number,
  fraccion: string,
  direccion: string,
  coords: number[],
  matricula: number | null,
) => void;

/**
 * Servicio de nivel de componente que encapsula toda la lógica de OpenLayers:
 * inicialización del mapa, capas base, WMS, contenedores, círculo de radio
 * y capa de resaltado de portales.
 *
 * Se provee en el componente (providers: [VisorMapService]) para que su ciclo
 * de vida quede ligado al del componente que lo declara.
 */
@Injectable()
export class VisorMapService {
  private map!: OlMap;
  private baseLayer!: TileLayer<XYZ>;
  private wmsLayers = new globalThis.Map<string, TileLayer<TileWMS>>();
  private contenedoresLayer!: VectorLayer<VectorSource>;
  private incidenciasLayer: VectorLayer<VectorSource> | null = null;
  private circleSource = new VectorSource();
  private portalesHighlightSource = new VectorSource();
  private resultadosSource = new VectorSource();

  private pickModeActive = false;
  private pickCallback: ((lon: number, lat: number) => void) | null = null;
  private pintoBusquedaSource = new VectorSource();

  // Radio actual para dibujar el círculo de selección
  private radioActual = 100;

  private readonly resultadosOuterStyle = new Style({
    image: new CircleStyle({
      radius: 11,
      fill: new Fill({ color: 'rgba(255, 220, 0, 0.55)' }),
    }),
  });

  constructor(private ngZone: NgZone) {}

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  init(target: HTMLElement): void {
    this.baseLayer = new TileLayer({
      source: new XYZ({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }),
    });

    const circleLayer = new VectorLayer({
      source: this.circleSource,
      zIndex: 90,
      style: new Style({
        stroke: new Stroke({ color: 'rgba(21, 101, 192, 0.8)', width: 2 }),
        fill: new Fill({ color: 'rgba(21, 101, 192, 0.1)' }),
      }),
    });

    const portalesHighlightLayer = new VectorLayer({
      source: this.portalesHighlightSource,
      zIndex: 95,
      style: new Style({
        stroke: new Stroke({ color: '#fffb00', width: 2 }),
        fill: new Fill({ color: 'rgba(233, 30, 140, 0.25)' }),
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#aec52b' }),
          stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
        }),
      }),
    });

    const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="#e53935"/><circle cx="14" cy="14" r="6" fill="white"/></svg>`;
    const pintoBusquedaLayer = new VectorLayer({
      source: this.pintoBusquedaSource,
      zIndex: 120,
      style: new Style({
        image: new Icon({
          src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svgPin),
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
        }),
      }),
    });

    const resultadosLayer = new VectorLayer({
      source: this.resultadosSource,
      zIndex: 110,
      style: (feature) => [
        this.resultadosOuterStyle,
        new Style({
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: this.colorPorFraccion(feature.get('fraccion') as string) }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }),
      ],
    });

    this.map = new OlMap({
      target,
      layers: [this.baseLayer, circleLayer, portalesHighlightLayer, resultadosLayer, pintoBusquedaLayer],
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      interactions: defaultInteractions({ doubleClickZoom: false }),
      view: new View({
        center: fromLonLat([-3.7100, 40.3080]), // Centro del municipio de Getafe
        zoom: 13,
        minZoom: 12,
        maxZoom: 19,
      }),
    });
  }

  destroy(): void {
    this.map?.setTarget(undefined);
  }

  // ── Capa base ─────────────────────────────────────────────────────────────

  /** Sincroniza el radio actual para que el click lo use directamente. */
  setRadio(radio: number): void {
    this.radioActual = radio;
  }

  setBaseLayerUrl(url: string): void {
    if (!this.map) return;
    this.baseLayer.setSource(
      new XYZ({
        url,
        attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }),
    );
  }

  // ── Capas WMS ─────────────────────────────────────────────────────────────

  addWmsLayer(name: string, wmsUrl: string, zIndex: number): void {
    if (!this.map) return;
    const layer = new TileLayer({
      source: new TileWMS({
        url: wmsUrl,
        params: { LAYERS: name, TILED: true, FORMAT: 'image/png', TRANSPARENT: true },
        serverType: 'geoserver',
      }),
      visible: true,
      zIndex,
    });
    this.map.addLayer(layer);
    this.wmsLayers.set(name, layer);
  }

  setWmsLayerVisible(name: string, visible: boolean): void {
    this.wmsLayers.get(name)?.setVisible(visible);
  }

  fitToExtent(bboxes: [number, number, number, number][]): void {
    if (!this.map || bboxes.length === 0) return;
    const combined = createEmpty();
    for (const bbox of bboxes) {
      extend(combined, transformExtent(bbox, 'EPSG:4326', 'EPSG:3857'));
    }
    if (!isEmpty(combined)) {
      this.map.getView().fit(combined, { padding: [40, 40, 40, 40], maxZoom: 18 });
    }
  }

  // ── Capa de contenedores ──────────────────────────────────────────────────

  /**
   * Carga los contenedores procedentes de GeoServer/QGIS como capa de detección
   * de clics y cursor (hit-test). El renderizado visual lo realiza la capa WMS
   * "capa_contenedores" publicada desde QGIS, por lo que esta VectorLayer es
   * completamente transparente: existe únicamente para que forEachFeatureAtPixel
   * y hasFeatureAtPixel funcionen con el mismo código de interacción.
   */
  cargarContenedores(geojson: ContenedorGeoJSON): void {
    if (!this.map) return;
    const features = new GeoJSON().readFeatures(geojson, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });
    this.contenedoresLayer = new VectorLayer({
      source: new VectorSource({ features }),
      zIndex: 101,
      // Estilo transparente: sólo detección de clics/hover, sin renderizado propio.
      // La capa WMS de QGIS (capa_contenedores) proporciona la simbología visible.
      style: new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: 'rgba(0,0,0,0)' }),
          stroke: new Stroke({ color: 'rgba(0,0,0,0)', width: 0 }),
        }),
      }),
    });
    this.map.addLayer(this.contenedoresLayer);
  }

  /** Sincroniza la visibilidad de la capa hit-test con el toggle del WMS. */
  setContenedoresVisible(visible: boolean): void {
    this.contenedoresLayer?.setVisible(visible);
  }

  // ── Capa de incidencias ─────────────────────────────────────────────

  cargarIncidencias(geojson: IncidenciasGeoJSON): void {
    if (!this.map) return;
    if (this.incidenciasLayer) {
      this.map.removeLayer(this.incidenciasLayer);
    }
    const features = new GeoJSON().readFeatures(geojson, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });
    this.incidenciasLayer = new VectorLayer({
      source: new VectorSource({ features }),
      zIndex: 106,
      style: new Style({
        image: new CircleStyle({
          radius: 4,
          fill: new Fill({ color: '#ff0000' }),
          stroke: new Stroke({ color: '#ffffff', width: 1 }),
        }),
      }),
    });
    this.map.addLayer(this.incidenciasLayer);
  }

  setIncidenciasVisible(visible: boolean): void {
    this.incidenciasLayer?.setVisible(visible);
  }

  // ── Selección: círculo + portales ─────────────────────────────────────────

  /** Actualiza el polígono circular en el mapa (dentro del Angular zone). */
  actualizarCirculo(lon: number, lat: number, radio: number): void {
    this.circleSource.clear();
    const polygon = circular([lon, lat], radio, 64);
    polygon.transform('EPSG:4326', 'EPSG:3857');
    this.circleSource.addFeature(new Feature(polygon));
  }

  /**
   * Igual que actualizarCirculo pero ejecuta fuera del Angular zone,
   * para evitar ciclos de CD en cada evento del slider.
   */
  actualizarCirculoSilente(lon: number, lat: number, radio: number): void {
    this.ngZone.runOutsideAngular(() => this.actualizarCirculo(lon, lat, radio));
  }

  actualizarPortalesHighlight(geojson: PortalesGeoJSON): void {
    this.portalesHighlightSource.clear();
    const features = new GeoJSON().readFeatures(geojson, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });
    this.portalesHighlightSource.addFeatures(features);
  }

  clearSeleccion(): void {
    this.circleSource.clear();
    this.portalesHighlightSource.clear();
  }

  // ── Resultados de búsqueda ────────────────────────────────────────────────

  highlightResultados(geojson: ContenedorGeoJSON): void {
    this.resultadosSource.clear();
    const features = new GeoJSON().readFeatures(geojson, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });
    this.resultadosSource.addFeatures(features);
  }

  clearResultados(): void {
    this.resultadosSource.clear();
  }

  clearPuntoBusqueda(): void {
    this.pintoBusquedaSource.clear();
  }

  zoomToResultados(): void {
    const extent = this.resultadosSource.getExtent();
    if (extent && isFinite(extent[0])) {
      this.map.getView().fit(extent, { padding: [80, 80, 80, 80], maxZoom: 17, duration: 400, easing: easeOut });
    }
  }

  animarZoomACoordenadas(lon: number, lat: number): void {
    this.map.getView().animate({
      center: fromLonLat([lon, lat]),
      zoom: Math.max(this.map.getView().getZoom() ?? 17, 17),
      duration: 400,
      easing: easeOut,
    });
  }

  // ── Modo captura de coordenadas desde el mapa ─────────────────────────────

  activarCapturaCoordenadas(cb: (lon: number, lat: number) => void): void {
    this.pickModeActive = true;
    this.pickCallback = cb;
    if (this.map) this.map.getTargetElement().style.cursor = 'crosshair';
  }

  cancelarCapturaCoordenadas(): void {
    this.pickModeActive = false;
    this.pickCallback = null;
    if (this.map) this.map.getTargetElement().style.cursor = '';
  }

  // ── Animación ─────────────────────────────────────────────────────────────

  animarZoom(coords: number[]): void {
    this.map.getView().animate({
      center: coords,
      zoom: Math.max(this.map.getView().getZoom() ?? 15, 17),
      duration: 400,
      easing: easeOut,
    });
  }

  // ── Interacciones ─────────────────────────────────────────────────────────

  setupInteractions(
    onContenedorClick: ContenedorClickHandler,
    onVacioClick: () => void,
  ): void {
    this.ngZone.runOutsideAngular(() => {
      let rafPending = false;
      this.map.on('pointermove', (evt) => {
        if (rafPending) return;
        rafPending = true;
        const pixel = evt.pixel.slice() as [number, number];
        requestAnimationFrame(() => {
          rafPending = false;
          if (!this.contenedoresLayer) return;
          const hit = this.map.hasFeatureAtPixel(pixel, {
            layerFilter: (l) => l === this.contenedoresLayer,
          });
          this.map.getTargetElement().style.cursor = hit ? 'pointer' : '';
        });
      });

      this.map.on('click', (evt) => {
        // El modo captura tiene prioridad sobre el click de contenedor
        if (this.pickModeActive && this.pickCallback) {
          const [lon, lat] = toLonLat(evt.coordinate);
          const cb = this.pickCallback;
          this.cancelarCapturaCoordenadas();
          // Colocar chincheta roja en el punto seleccionado
          this.pintoBusquedaSource.clear();
          this.pintoBusquedaSource.addFeature(new Feature(new Point(evt.coordinate)));
          this.ngZone.run(() => cb(lon, lat));
          return;
        }

        const feature = this.map.forEachFeatureAtPixel(evt.pixel, (f) => f, {
          layerFilter: (l) => l === this.contenedoresLayer,
        });

        if (feature) {
          // Operaciones de mapa: instantáneas, fuera de Angular zone
          const coords = (feature.getGeometry() as Point).getCoordinates();
          const [lon, lat] = toLonLat(coords);
          this.actualizarCirculo(lon, lat, this.radioActual);
          this.animarZoom(coords);
          // Actualización de estado de UI: dentro de zone
          this.ngZone.run(() => onContenedorClick(
            lon, lat,
            feature.get('fraccion'),
            feature.get('direccion'),
            coords,
            feature.get('matricula') ?? null,
          ));
        } else {
          this.ngZone.run(() => onVacioClick());
        }
      });
    });
  }

  // ── Utilidades privadas ───────────────────────────────────────────────────

  private colorPorFraccion(fraccion: string): string {
    switch (fraccion) {
      case 'Papel/Cartón': return '#1565C0';
      case 'Orgánico':     return '#6D4C41';
      case 'Envases':      return '#F9A825';
      default:             return '#757575';
    }
  }
}
