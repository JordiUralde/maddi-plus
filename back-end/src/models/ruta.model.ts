export interface RutaParada {
  id_parada: string | null;
  nombre_ruta: string | null;
  id_ubicacion: string | null;
  direccion: string | null;
  id_orden: string | null;
  numero_paradas: number | null;
  programado_en: string | null;
  /** Latitud (coordenada Norte/Sur) */
  x: number | null;
  /** Longitud (coordenada Este/Oeste) */
  y: number | null;
}

export interface RutaVersion {
  id: string;
  nombre: string;
  paradas: RutaParada[];
}

export interface RutaKpis {
  /** Duracion de la ruta real (actual) en minutos */
  duracionRealMin: number | null;
  /** Duracion de la ruta teorica (historica) en minutos */
  duracionTeoricaMin: number | null;
  /** Diferencia real - teorica en minutos */
  desviacionDuracionMin: number | null;
  /** % de paradas teoricas visitadas por la ruta real */
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
