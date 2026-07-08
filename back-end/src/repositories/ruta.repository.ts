import { pool } from '../config/db';
import { RutaComparada, RutaParada, RutaVersion } from '../models/ruta.model';

function agruparPorRuta(paradas: RutaParada[]): Map<string, RutaVersion> {
  const mapa = new Map<string, RutaVersion>();

  for (const parada of paradas) {
    const id = parada.id_parada ?? 'sin-id';
    if (!mapa.has(id)) {
      mapa.set(id, {
        id,
        nombre: parada.nombre_ruta ?? id,
        paradas: [],
      });
    }
    mapa.get(id)!.paradas.push(parada);
  }

  for (const ruta of mapa.values()) {
    ruta.paradas = ruta.paradas
      .filter((parada) => parada.numero_paradas != null)
      .sort((a, b) => Number(a.numero_paradas) - Number(b.numero_paradas));
  }

  return mapa;
}

function compararParadas(actual: RutaParada[], historica: RutaParada[]): string[] {
  const diferencias: string[] = [];

  if (actual.length !== historica.length) {
    diferencias.push(`Cantidad de paradas distinta (${actual.length} vs ${historica.length}).`);
  }

  const total = Math.max(actual.length, historica.length);
  for (let i = 0; i < total; i += 1) {
    const paradaActual = actual[i];
    const paradaHistorica = historica[i];

    if (!paradaActual || !paradaHistorica) {
      diferencias.push(`Falta la parada ${i + 1} en una de las versiones.`);
      continue;
    }

    const campos: Array<keyof RutaParada> = [
      'id_ubicacion',
      'direccion',
      'id_orden',
      'numero_paradas',
      'programado_en',
      'x',
      'y',
    ];

    const distintos = campos.some((campo) => paradaActual[campo] !== paradaHistorica[campo]);
    if (distintos) {
      diferencias.push(`La parada ${i + 1} no coincide entre la ruta actual y la histórica.`);
    }
  }

  return diferencias;
}

export async function findRutaComparadas(fecha: string): Promise<RutaComparada[]> {
  const actualResult = await pool.query<RutaParada>(`
    SELECT
      rp.id_ruta          AS id_parada,
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
    ORDER BY rp.id_ruta, rp.programado_en
  `);

  const historicoResult = await pool.query<RutaParada>(`
    SELECT
      rh.id_ruta          AS id_parada,
      nr.nombre           AS nombre_ruta,
      rh.id_ubicacion,
      rh.direccion,
      rh.id_orden,
      rh.numero_paradas,
      rh.programado_en::text AS programado_en,
      rh.x::float            AS x,
      rh.y::float            AS y
    FROM rutas_paradas_historico rh
    JOIN nombres_rutas nr ON nr.id_ruta = rh.id_ruta
    WHERE rh.fecha::date = $1::date
    ORDER BY rh.id_ruta, rh.programado_en
  `, [fecha]);

  const actualPorRuta = agruparPorRuta(actualResult.rows);
  const historicoPorRuta = agruparPorRuta(historicoResult.rows);
  const ids = new Set<string>([...actualPorRuta.keys(), ...historicoPorRuta.keys()]);

  return [...ids].sort().map((id) => {
    const actual = actualPorRuta.get(id) ?? {
      id,
      nombre: historicoPorRuta.get(id)?.nombre ?? id,
      paradas: [],
    };
    const historica = historicoPorRuta.get(id) ?? null;
    const diferencias = historica
      ? compararParadas(actual.paradas, historica.paradas)
      : ['No existe la ruta histórica para la fecha seleccionada.'];

    return {
      id,
      nombre: actual.nombre,
      estado: diferencias.length === 0 ? 'completa' : 'error',
      diferencias,
      actual,
      historica,
    };
  });
}
