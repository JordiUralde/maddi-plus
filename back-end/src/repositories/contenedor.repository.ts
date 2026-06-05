import https from 'https';
import http from 'http';
import { pool } from '../config/db';
import { Contenedor } from '../models/contenedor.model';
import { env } from '../config/env';

const SELECT_CONTENEDOR = `SELECT * FROM contenedores`;

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function rowsToFeatureCollection(rows: Contenedor[]): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(c.y), Number(c.x)] },
      properties: {
        matricula:               c.matricula,
        direccion:               c.direccion,
        fraccion:                c.fraccion,
        barrio:                  c.barrio,
        distrito:                c.distrito,
        punto_recogida:          c.punto_recogida,
        tension_pila:            c.tension_pila            ?? null,
        modelo_contenedor:       c.modelo_contenedor       ?? null,
        capacidad:               c.capacidad               ?? null,
        aportaciones_ultimo_anio: c.aportaciones_ultimo_anio ?? null,
        estado:                  c.estado                  ?? null,
        descripcion_incidencia:  c.descripcion_incidencia  ?? null,
        estado_tapa:             c.estado_tapa             ?? null,
        estado_cerradura:        c.estado_cerradura        ?? null,
      },
    })),
  };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: unknown;
  properties: Record<string, unknown>;
}

/**
 * Carga todos los contenedores directamente desde GeoServer WFS (capa publicada desde QGIS).
 * Si GeoServer no está disponible o devuelve un error, cae al fallback de base de datos.
 */
export async function findAllContenedores(): Promise<GeoJSONFeatureCollection> {
  try {
    return await findAllContenedoresFromWFS();
  } catch {
    return findAllContenedoresFromDB();
  }
}

async function findAllContenedoresFromWFS(): Promise<GeoJSONFeatureCollection> {
  const wfsUrl = `${env.geoserver.url}/wfs`;
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: `${env.geoserver.workspace}:capa_contenedores`,
    outputFormat: 'application/json',
    srsName: 'CRS:84',  // CRS:84 siempre devuelve lon/lat, evita el swap de WFS 1.1.0 con EPSG:4326
  });

  const text = await fetchText(`${wfsUrl}?${params.toString()}`);

  if (text.trimStart().startsWith('<')) {
    throw new Error(`GeoServer WFS devolvió XML:\n${text.slice(0, 400)}`);
  }

  const raw = JSON.parse(text) as {
    type: string;
    features: Array<{
      type: string;
      geometry: { type: string; coordinates: number[] };
      properties: Record<string, unknown>;
    }>;
  };


  return {
    type: 'FeatureCollection',
    features: (raw.features ?? []).map((f) => {
      const p = f.properties;
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          ...p,  // propiedades en bruto del WFS (para diagnóstico y nombres no mapeados)
          matricula: p['Matricula'] ?? p['matricula'] ?? null,
          direccion: p['Dirección'] ?? p['Direccion'] ?? p['direccion'] ?? null,
          fraccion:  p['Fracción']  ?? p['Fraccion']  ?? p['fraccion']  ?? null,
        },
      };
    }),
  };
}

async function findAllContenedoresFromDB(): Promise<GeoJSONFeatureCollection> {
  const { rows } = await pool.query<Contenedor>(
    `SELECT * FROM contenedores ORDER BY matricula`
  );
  return rowsToFeatureCollection(rows);
}

export async function findParcelasByRadio(
  lon: number,
  lat: number,
  radio: number
): Promise<GeoJSONFeatureCollection> {
  const { rows } = await pool.query(
    `SELECT
       p.id,
       p."PARCELA",
       p."REFCAT",
       p."MASA",
       p."AREA",
       p."TIPO",
       ST_AsGeoJSON(ST_Transform(p.geom, 4326)) AS geometry
     FROM capa_parcelas p
     WHERE ST_DWithin(
       p.geom,
       ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 25830),
       $3
     )`,
    [lon, lat, radio]
  );

  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: JSON.parse(r.geometry as string),
      properties: {
        id: r.id,
        parcela: r['PARCELA'],
        refcat: r['REFCAT'],
        masa: r['MASA'],
        area: r['AREA'],
        tipo: r['TIPO'],
      },
    })),
  };
}

export async function findPortalesByRadio(
  lon: number,
  lat: number,
  radio: number
): Promise<GeoJSONFeatureCollection> {
  const { rows } = await pool.query(
    `SELECT
       ST_AsGeoJSON(ST_Transform(p.geom, 4326)) AS geometry,
       json_build_object(
         'id',     p.id,
         'numero', p."ROTULO",
         'calle',  (
           SELECT string_agg(rotulo, ' ' ORDER BY min_x)
           FROM (
             SELECT "ROTULO" AS rotulo,
                    MIN(ST_X(ST_Centroid(geom))) AS min_x
             FROM capa_portales
             WHERE "VIA" = p."VIA"
               AND ("PCAT2" IS NULL OR TRIM("PCAT2") = '')
             GROUP BY "ROTULO"
           ) seg
         )
       ) AS properties
     FROM capa_portales p
     WHERE ST_DWithin(
       p.geom,
       ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 25830),
       $3
     )
     AND p."PCAT2" IS NOT NULL AND TRIM(p."PCAT2") != ''`,
    [lon, lat, radio]
  );

  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: JSON.parse(r.geometry as string),
      properties: r.properties as Record<string, unknown>,
    })),
  };
}

export async function findContenedorByMatricula(matricula: number): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM contenedores WHERE matricula = $1 LIMIT 1`,
    [matricula]
  );
  return rows[0] ?? null;
}

export async function findViviendasByPortalId(
  portalId: number
): Promise<Record<string, unknown>[]> {
  const portalResult = await pool.query<{ codigo: string }>(
    `SELECT "PCAT1" || "PCAT2" AS codigo FROM capa_portales WHERE id = $1 LIMIT 1`,
    [portalId]
  );

  if (portalResult.rows.length === 0) return [];

  const codigo = portalResult.rows[0].codigo;

  const { rows } = await pool.query(
    `SELECT (row_to_json(v)::jsonb - 'geom') AS vivienda
     FROM viviendas v
     WHERE v."31_pc" = $1
     ORDER BY v."31_pc"`,
    [codigo]
  );

  return rows.map((r) => r.vivienda as Record<string, unknown>);
}

// ── Búsqueda de contenedores ────────────────────────────────────

export async function findContenedoresByBarrio(
  barrio: string
): Promise<GeoJSONFeatureCollection> {
  const { rows } = await pool.query<Contenedor>(
    `${SELECT_CONTENEDOR} WHERE LOWER(barrio) LIKE LOWER($1) ORDER BY barrio, direccion`,
    [`%${barrio}%`]
  );
  return rowsToFeatureCollection(rows);
}

export async function findContenedoresByCalle(
  calle: string
): Promise<GeoJSONFeatureCollection> {
  const { rows } = await pool.query<Contenedor>(
    `${SELECT_CONTENEDOR} WHERE LOWER(direccion) LIKE LOWER($1) ORDER BY direccion`,
    [`%${calle}%`]
  );
  return rowsToFeatureCollection(rows);
}

export async function findContenedoresByPuntoRecogida(
  punto: number
): Promise<GeoJSONFeatureCollection> {
  const { rows } = await pool.query<Contenedor>(
    `${SELECT_CONTENEDOR} WHERE punto_recogida = $1 ORDER BY matricula`,
    [punto]
  );
  return rowsToFeatureCollection(rows);
}

export async function findContenedoresByRadio(
  lon: number,
  lat: number,
  radio: number
): Promise<GeoJSONFeatureCollection> {
  const { rows } = await pool.query<Contenedor>(
    `${SELECT_CONTENEDOR}
     WHERE ST_DWithin(
       ST_Transform(ST_SetSRID(ST_MakePoint(y::float, x::float), 4326), 25830),
       ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 25830),
       $3
     )
     ORDER BY matricula`,
    [lon, lat, radio]
  );
  return rowsToFeatureCollection(rows);
}

export async function findContenedoresByRefcat(
  refcat: string,
  radio: number
): Promise<GeoJSONFeatureCollection> {
  const { rows } = await pool.query<Contenedor>(
    `WITH parcela AS (
       SELECT ST_Transform(ST_Centroid(geom), 4326) AS centroid
       FROM capa_parcelas
       WHERE UPPER("REFCAT") = UPPER($1)
       LIMIT 1
     )
     ${SELECT_CONTENEDOR}, parcela
     WHERE ST_DWithin(
       ST_Transform(ST_SetSRID(ST_MakePoint(contenedores.y::float, contenedores.x::float), 4326), 25830),
       ST_Transform(parcela.centroid, 25830),
       $2
     )
     ORDER BY contenedores.matricula`,
    [refcat, radio]
  );
  return rowsToFeatureCollection(rows);
}

/**
 * Devuelve únicamente los contenedores que tienen una incidencia registrada,
 * consultando directamente la BD (los campos estado/descripcion_incidencia
 * no están disponibles en la capa WFS de GeoServer).
 */
export async function findContenedoresConIncidencias(): Promise<GeoJSONFeatureCollection> {
  // 1. Propiedades de incidencias desde BD (incluye descripcion_incidencia y resto de campos)
  const { rows } = await pool.query<Contenedor>(
    `${SELECT_CONTENEDOR}
     WHERE descripcion_incidencia IS NOT NULL
       AND TRIM(descripcion_incidencia) <> ''
     ORDER BY matricula`
  );

  if (rows.length === 0) return { type: 'FeatureCollection', features: [] };

  // 2. Intentar obtener geometrías actualizadas desde GeoServer WFS
  try {
    const wfs = await findAllContenedoresFromWFS();
    const geomByMatricula = new Map<number, unknown>();
    for (const f of wfs.features) {
      const mat = f.properties['matricula'];
      if (mat != null) geomByMatricula.set(Number(mat), f.geometry);
    }
    return {
      type: 'FeatureCollection',
      features: rows.map((c) => ({
        type: 'Feature',
        // Usa la geometría de WFS (posición actualizada); si no existe, cae a las coordenadas de BD
        geometry: geomByMatricula.get(c.matricula) ?? { type: 'Point', coordinates: [Number(c.y), Number(c.x)] },
        properties: {
          matricula:                c.matricula,
          direccion:                c.direccion,
          fraccion:                 c.fraccion,
          barrio:                   c.barrio,
          distrito:                 c.distrito,
          punto_recogida:           c.punto_recogida,
          tension_pila:             c.tension_pila             ?? null,
          modelo_contenedor:        c.modelo_contenedor        ?? null,
          capacidad:                c.capacidad                ?? null,
          aportaciones_ultimo_anio: c.aportaciones_ultimo_anio ?? null,
          estado:                   c.estado                   ?? null,
          descripcion_incidencia:   c.descripcion_incidencia   ?? null,
          estado_tapa:              c.estado_tapa              ?? null,
          estado_cerradura:         c.estado_cerradura         ?? null,
        },
      })),
    };
  } catch {
    // Fallback a coordenadas de la BD si WFS no está disponible
    return rowsToFeatureCollection(rows);
  }
}
