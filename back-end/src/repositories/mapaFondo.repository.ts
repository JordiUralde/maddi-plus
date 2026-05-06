import { pool } from '../config/db';
import { MapaFondo } from '../models/mapaFondo.model';

export async function findAllMapasFondo(): Promise<MapaFondo[]> {
  // Usamos SELECT * y mapeamos manualmente para evitar problemas
  // con caracteres especiales en el nombre de columna
  const { rows } = await pool.query(`SELECT * FROM mapas_fondo ORDER BY id`);

  return rows.map((row: Record<string, unknown>) => ({
    id: row['id'] as number,
    nombre: row['nombre'] as string,
    url: row['url'] as string,
    // La columna puede llamarse 'previsualización', 'previsualizacion' o 'previsualización'
    previsualizacion: (row['previsualizacion'] ?? row['previsualización'] ?? row['previsualización'] ?? '') as string,
  }));
}
