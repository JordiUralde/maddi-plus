export interface Contenedor {
  matricula: number;
  distrito: string;
  barrio: string;
  punto_recogida: number;
  direccion: string;
  x: number;
  y: number;
  fraccion: string;
  tension_pila: number | null;
  modelo_contenedor: string | null;
  capacidad: number | null;
  aportaciones_ultimo_anio: number | null;
  estado: string | null;
  descripcion_incidencia: string | null;
  estado_tapa: string | null;
  estado_cerradura: string | null;
  [key: string]: unknown; // resto de columnas desconocidas
}
