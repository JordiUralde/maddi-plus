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

// ── Incidencias ─────────────────────────────────────────────────────────────

export type TipoIncidencia =
  | 'Batería baja'
  | 'Cerradura dejada abierta'
  | 'Tapa abierta'
  | 'Otra';

export const TIPOS_INCIDENCIA: TipoIncidencia[] = [
  'Batería baja',
  'Cerradura dejada abierta',
  'Tapa abierta',
];

export interface IncidenciaProperties {
  matricula: number;
  direccion: string;
  fraccion: string;
  barrio: string | null;
  distrito: string | null;
  punto_recogida: number | null;
  estado: string | null;
  descripcion_incidencia: string;
  estado_tapa: string | null;
  estado_cerradura: string | null;
}

export interface IncidenciaFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: IncidenciaProperties;
}

export interface IncidenciasGeoJSON {
  type: 'FeatureCollection';
  features: IncidenciaFeature[];
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
  matricula: number | null;
  barrio: string | null;
  distrito: string | null;
  punto_recogida: number | null;
  tension_pila: number | null;
  modelo_contenedor: string | null;
  capacidad: number | null;
  aportaciones_ultimo_anio: number | null;
  estado: string | null;
  descripcion_incidencia: string | null;
  estado_tapa: string | null;
  estado_cerradura: string | null;
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
