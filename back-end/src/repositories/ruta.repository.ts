import { pool } from '../config/db';
import { RutaParada } from '../models/ruta.model';

export async function findAllRutaParadas(): Promise<RutaParada[]> {
  const result = await pool.query<RutaParada>(`
    SELECT
      rp.id_parada,
      nr.nombre           AS nombre_ruta,
      rp.id_ubicacion,
      rp.direccion,
      rp.id_orden,
      rp.numero_paradas,
      rp.programado_en::text AS programado_en,
      rp.x::float            AS x,
      rp.y::float            AS y
    FROM rutas_paradas rp
    JOIN nombres_rutas nr ON nr.id_ruta = rp.id_ruta
    ORDER BY rp.id_parada, rp.programado_en
  `);
  return result.rows;
}
