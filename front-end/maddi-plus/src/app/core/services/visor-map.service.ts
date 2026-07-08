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
import Text from 'ol/style/Text';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { circular } from 'ol/geom/Polygon';
import { easeOut } from 'ol/easing';
import { ContenedorGeoJSON, IncidenciasGeoJSON, PortalesGeoJSON } from '../models/contenedor.model';
import { OsrmRouteGeometry, RutaParada } from '../models/ruta.model';

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
  private readonly resultadosStyleCache = new globalThis.Map<string, Style[]>();
  private contenedoresLayer!: VectorLayer<VectorSource>;
  private incidenciasLayer: VectorLayer<VectorSource> | null = null;
  private circleSource = new VectorSource();
  private portalesHighlightSource = new VectorSource();
  private resultadosSource = new VectorSource();

  private rutaLayer: VectorLayer<VectorSource> | null = null;
  private rutaParadasLayer: VectorLayer<VectorSource> | null = null;
  private paradaSeleccionadaLayer: VectorLayer<VectorSource> | null = null;
  private readonly rutasRenderizadas = new globalThis.Map<string, { rutaLayer: VectorLayer<VectorSource>; rutaParadasLayer: VectorLayer<VectorSource> }>();

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
    // Bounding box de la Comunidad de Madrid en EPSG:3857
    const madridExtent = transformExtent([-4.5775, 39.8853, -3.0517, 40.9177], 'EPSG:4326', 'EPSG:3857');

    this.baseLayer = new TileLayer({
      source: new XYZ({
        crossOrigin: 'anonymous',
      }),
      extent: madridExtent,
      preload: 1,
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
      style: (feature) => this.getResultadoStyle(feature.get('fraccion') as string),
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
        constrainResolution: true,
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
    this.baseLayer?.getSource()?.setUrl(url);
  }

  // ── Capas WMS ─────────────────────────────────────────────────────────────

  addWmsLayer(name: string, wmsUrl: string, zIndex: number): void {
    if (!this.map) return;
    const layer = new TileLayer({
      source: new TileWMS({
        url: wmsUrl,
        params: { LAYERS: name, TILED: true, FORMAT: 'image/png', TRANSPARENT: true },
        serverType: 'geoserver',
        crossOrigin: 'anonymous',
      }),
      visible: true,
      zIndex,
    });
    // No pedir tiles WMS nuevos mientras el usuario hace zoom/pan con la rueda;
    // OL muestra los tiles anteriores escalados y carga los correctos al parar.
    layer.set('updateWhileAnimating', false);
    layer.set('updateWhileInteracting', false);
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
    if (this.contenedoresLayer) {
      this.map.removeLayer(this.contenedoresLayer);
    }
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
    const polygon = circular([lon, lat], radio, 32);
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

  clearPortalesHighlight(): void {
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
      let lastPx = -999;
      let lastPy = -999;
      this.map.on('pointermove', (evt) => {
        if (rafPending) return;
        const px = evt.pixel[0];
        const py = evt.pixel[1];
        const dx = px - lastPx;
        const dy = py - lastPy;
        if (dx * dx + dy * dy < 4) return; // omitir si el ratón se movió menos de 2px
        rafPending = true;
        lastPx = px;
        lastPy = py;
        const pixel = [px, py] as [number, number];
        requestAnimationFrame(() => {
          rafPending = false;
          if (!this.contenedoresLayer) return;
          const hit = this.map.hasFeatureAtPixel(pixel, {
            layerFilter: (l) => l === this.contenedoresLayer,
            hitTolerance: 4,
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
          hitTolerance: 6,
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

  // ── Capa de ruta ──────────────────────────────────────────────────────────

  mostrarRuta(
    geometry: OsrmRouteGeometry,
    paradas: RutaParada[],
    color = '#843fa4',
    key = 'ruta-activa',
  ): void {
    if (!this.map) return;
    this.ocultarRuta(key);

    const coords3857 = geometry.coordinates.map(([lon, lat]) => fromLonLat([lon, lat]));
    const lineFeature = new Feature(new LineString(coords3857));

    const source = new VectorSource({ features: [lineFeature] });
    const rutaLayer = new VectorLayer({
      source,
      zIndex: 108,
      style: new Style({
        stroke: new Stroke({ color, width: 3, lineCap: 'round', lineJoin: 'round' }),
      }),
    });
    this.map.addLayer(rutaLayer);

    // Flechas de dirección cada ~500 m sobre la geometría de la ruta
    const ARROW_INTERVAL = 750;
    const arrowFeatures: Feature[] = [];
    let accumulated = 0;

    const makeArrowFeature = (coord: number[], bearing: number): Feature => {
      const af = new Feature(new Point(coord));
      af.setStyle(new Style({
        renderer: (pixelCoords, state) => {
          const [px, py] = pixelCoords as number[];
          const ctx = state.context;
          ctx.save();
          ctx.translate(Math.round(px), Math.round(py));
          ctx.rotate(bearing);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(-7, 0);
          ctx.lineTo(2, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-1, -4);
          ctx.lineTo(7, 0);
          ctx.lineTo(-1, 4);
          ctx.stroke();
          ctx.restore();
        },
      }));
      return af;
    };

    for (let i = 1; i < coords3857.length; i++) {
      const prev = coords3857[i - 1];
      const curr = coords3857[i];
      const dx = curr[0] - prev[0];
      const dy = curr[1] - prev[1];
      const segLen = Math.sqrt(dx * dx + dy * dy);
      const bearing = Math.atan2(-dy, dx);

      let remaining = segLen;
      let distIntoSeg = ARROW_INTERVAL - accumulated;

      while (distIntoSeg <= remaining) {
        const t = distIntoSeg / segLen;
        const coord = [prev[0] + dx * t, prev[1] + dy * t];
        arrowFeatures.push(makeArrowFeature(coord, bearing));
        distIntoSeg += ARROW_INTERVAL;
      }

      accumulated = (accumulated + segLen) % ARROW_INTERVAL;
    }

    // Punto de inicio (verde) y fin (rojo)
    const endpointFeatures: Feature[] = [];
    if (coords3857.length >= 2) {
      const makeEndpoint = (coord: number[], endpointColor: string) => {
        const f = new Feature(new Point(coord));
        f.setStyle(new Style({
          image: new CircleStyle({ radius: 7, fill: new Fill({ color: endpointColor }), stroke: new Stroke({ color: '#ffffff', width: 2 }) }),
        }));
        return f;
      };
      endpointFeatures.push(makeEndpoint(coords3857[0], color));
      endpointFeatures.push(makeEndpoint(coords3857[coords3857.length - 1], color));
    }

    const paradaSource = new VectorSource({ features: [...endpointFeatures, ...arrowFeatures] });
    const rutaParadasLayer = new VectorLayer({ source: paradaSource, zIndex: 109 });
    this.map.addLayer(rutaParadasLayer);

    this.rutasRenderizadas.set(key, {
      rutaLayer,
      rutaParadasLayer,
    });

    const extent = source.getExtent();
    if (extent && isFinite(extent[0])) {
      this.map.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 700, easing: easeOut });
    }
  }

  ocultarRuta(key?: string): void {
    if (!this.map) return;

    if (!key) {
      for (const layers of this.rutasRenderizadas.values()) {
        this.map.removeLayer(layers.rutaLayer);
        this.map.removeLayer(layers.rutaParadasLayer);
      }
      this.rutasRenderizadas.clear();
      return;
    }

    const layers = this.rutasRenderizadas.get(key);
    if (layers) {
      this.map.removeLayer(layers.rutaLayer);
      this.map.removeLayer(layers.rutaParadasLayer);
      this.rutasRenderizadas.delete(key);
    }
  }

  mostrarParadaSeleccionada(lon: number, lat: number): void {
    if (!this.map) return;
    if (this.paradaSeleccionadaLayer) {
      this.map.removeLayer(this.paradaSeleccionadaLayer);
    }
    const f = new Feature(new Point(fromLonLat([lon, lat])));
    f.setStyle(new Style({
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: '#843fa4' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
    }));
    this.paradaSeleccionadaLayer = new VectorLayer({
      source: new VectorSource({ features: [f] }),
      zIndex: 120,
    });
    this.map.addLayer(this.paradaSeleccionadaLayer);
  }

  ocultarParadaSeleccionada(): void {
    if (this.paradaSeleccionadaLayer && this.map) {
      this.map.removeLayer(this.paradaSeleccionadaLayer);
      this.paradaSeleccionadaLayer = null;
    }
  }

  // ── Utilidades privadas ───────────────────────────────────────────────────

  private getResultadoStyle(fraccion: string): Style[] {
    if (!this.resultadosStyleCache.has(fraccion)) {
      this.resultadosStyleCache.set(fraccion, [
        this.resultadosOuterStyle,
        new Style({
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: this.colorPorFraccion(fraccion) }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }),
      ]);
    }
    return this.resultadosStyleCache.get(fraccion)!;
  }

  private colorPorFraccion(fraccion: string): string {
    switch (fraccion) {
      case 'Papel/Cartón': return '#1565C0';
      case 'Orgánico':     return '#6D4C41';
      case 'Envases':      return '#F9A825';
      default:             return '#757575';
    }
  }
}
