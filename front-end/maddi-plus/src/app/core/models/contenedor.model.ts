export interface ContenedorProperties {
  matricula: number;
  direccion: string;
  fraccion: string;
  barrio: string;
  distrito: string;
  punto_recogida: number;
}

export interface ContenedorGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: ContenedorProperties;
  }>;
}

export interface PortalFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: number[] };
  properties: Record<string, unknown>;
}

export interface PortalesGeoJSON {
  type: 'FeatureCollection';
  features: PortalFeature[];
}

export interface ContenedorInfo {
  lon: number;
  lat: number;
  fraccion: string;
  direccion: string;
}

export interface ResultadoContenedor {
  props: ContenedorProperties;
  lon: number;
  lat: number;
}

export type ViviendaRecord = Record<string, unknown>;

export type BusquedaParams =
  | { barrio: string }
  | { calle: string }
  | { punto_recogida: string }
  | { lon: string; lat: string; radio: string }
  | { refcat: string; radio: string };
