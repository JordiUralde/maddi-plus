import { pool } from '../config/db';
import { RutaComparada, RutaKpis, RutaParada, RutaVersion } from '../models/ruta.model';

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

function normalizarTexto(valor: string): string {
  return valor.trim().toLowerCase().replace(/\s+/g, ' ');
}

function claveParada(parada: RutaParada): string | null {
  if (parada.id_ubicacion && parada.id_ubicacion.trim() !== '') {
    return `id:${normalizarTexto(parada.id_ubicacion)}`;
  }
  if (parada.direccion && parada.direccion.trim() !== '') {
    return `dir:${normalizarTexto(parada.direccion)}`;
  }
  return null;
}

function etiquetaParada(parada: RutaParada): string {
  if (parada.id_ubicacion && parada.direccion) {
    return `${parada.id_ubicacion} - ${parada.direccion}`;
  }
  if (parada.id_ubicacion) {
    return parada.id_ubicacion;
  }
  if (parada.direccion) {
    return parada.direccion;
  }
  return `Parada ${parada.numero_paradas ?? '-'}`;
}

function parseHoraSegundos(programadoEn: string | null): number | null {
  if (!programadoEn) return null;
  const valor = programadoEn.trim();
  if (!valor) return null;

  const horaMatch = valor.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (horaMatch) {
    const horas = Number(horaMatch[1]);
    const minutos = Number(horaMatch[2]);
    const segundos = Number(horaMatch[3] ?? '0');
    if (horas <= 23 && minutos <= 59 && segundos <= 59) {
      return horas * 3600 + minutos * 60 + segundos;
    }
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.getHours() * 3600 + fecha.getMinutes() * 60 + fecha.getSeconds();
}

function calcularDuracionMin(paradas: RutaParada[]): number | null {
  const segundosOrdenados = paradas
    .map((p) => parseHoraSegundos(p.programado_en))
    .filter((v): v is number => v != null);

  if (segundosOrdenados.length < 2) return null;

  let totalSegundos = 0;
  let previo = segundosOrdenados[0];

  for (let i = 1; i < segundosOrdenados.length; i += 1) {
    let actual = segundosOrdenados[i];
    while (actual < previo) {
      actual += 24 * 3600;
    }
    totalSegundos += actual - previo;
    previo = actual;
  }

  return Math.round((totalSegundos / 60) * 10) / 10;
}

function calcularKpis(actual: RutaParada[], historica: RutaParada[] | null): RutaKpis {
  const duracionRealMin = calcularDuracionMin(actual);

  if (!historica) {
    return {
      duracionRealMin,
      duracionTeoricaMin: null,
      desviacionDuracionMin: null,
      coberturaTeoricaPct: null,
      paradasTeoricasTotales: 0,
      paradasTeoricasVisitadas: 0,
      paradasTeoricasNoVisitadas: [],
    };
  }

  const duracionTeoricaMin = calcularDuracionMin(historica);
  const desviacionDuracionMin =
    duracionRealMin != null && duracionTeoricaMin != null
      ? Math.round((duracionRealMin - duracionTeoricaMin) * 10) / 10
      : null;

  const clavesReal = new Set(
    actual
      .map((p) => claveParada(p))
      .filter((v): v is string => v != null),
  );

  const teoricasUnicas = new globalThis.Map<string, RutaParada>();
  for (const parada of historica) {
    const clave = claveParada(parada);
    if (!clave || teoricasUnicas.has(clave)) continue;
    teoricasUnicas.set(clave, parada);
  }

  let visitadas = 0;
  const noVisitadas: string[] = [];
  for (const [clave, parada] of teoricasUnicas.entries()) {
    if (clavesReal.has(clave)) {
      visitadas += 1;
    } else {
      noVisitadas.push(etiquetaParada(parada));
    }
  }

  const paradasTeoricasTotales = teoricasUnicas.size;
  const coberturaTeoricaPct =
    paradasTeoricasTotales > 0
      ? Math.round((visitadas / paradasTeoricasTotales) * 1000) / 10
      : null;

  return {
    duracionRealMin,
    duracionTeoricaMin,
    desviacionDuracionMin,
    coberturaTeoricaPct,
    paradasTeoricasTotales,
    paradasTeoricasVisitadas: visitadas,
    paradasTeoricasNoVisitadas: noVisitadas,
  };
}

export async function findRutaComparadas(fecha: string | null): Promise<RutaComparada[]> {
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

  const historicoResult = fecha
    ? await pool.query<RutaParada>(`
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
    `, [fecha])
    : { rows: [] as RutaParada[] };

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
    const diferencias = !fecha
      ? []
      : historica
        ? compararParadas(actual.paradas, historica.paradas)
        : ['No existe la ruta histórica para la fecha seleccionada.'];
    const kpis = calcularKpis(actual.paradas, historica?.paradas ?? null);

    return {
      id,
      nombre: actual.nombre,
      estado: diferencias.length === 0 ? 'completa' : 'error',
      diferencias,
      kpis,
      actual,
      historica,
    };
  });
}
