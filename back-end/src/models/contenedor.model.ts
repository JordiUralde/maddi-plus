export interface Contenedor {
  matricula: number;
  distrito: string;
  seccion: string;
  barrio: string;
  punto_recogida: number;
  direccion: string;
  x: number; // latitud  (EPSG:4326)
  y: number; // longitud (EPSG:4326)
  fraccion: string;
  seccion_censal: string;
  arquitectura: string;
  certificado: string;
}
