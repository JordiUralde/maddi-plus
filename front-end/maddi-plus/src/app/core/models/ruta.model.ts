export interface RutaParada {
  id_parada: string | null;
  nombre_ruta: string | null;
  id_ubicacion: string | null;
  direccion: string | null;
  id_orden: string | null;
  numero_paradas: number | null;
  programado_en: string | null;
  /** Latitud */
  x: number | null;
  /** Longitud */
  y: number | null;
}

export interface Ruta {
  id: string;
  nombre: string;
  paradas: RutaParada[];
}

export interface RutaVersion {
  id: string;
  nombre: string;
  paradas: RutaParada[];
}

export interface RutaKpis {
  duracionRealMin: number | null;
  duracionTeoricaMin: number | null;
  desviacionDuracionMin: number | null;
  coberturaTeoricaPct: number | null;
  paradasTeoricasTotales: number;
  paradasTeoricasVisitadas: number;
  paradasTeoricasNoVisitadas: string[];
}

export interface RutaComparada {
  id: string;
  nombre: string;
  estado: 'completa' | 'error';
  diferencias: string[];
  kpis: RutaKpis;
  actual: RutaVersion;
  historica: RutaVersion | null;
}

export interface OsrmRouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}
