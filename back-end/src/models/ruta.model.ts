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
