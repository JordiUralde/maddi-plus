import https from 'https';
import http from 'http';
import { XMLParser } from 'fast-xml-parser';
import { env } from '../config/env';
import { GeoLayerDto } from '../models/geoLayer.model';

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

export async function getLayersFromGeoServer(): Promise<GeoLayerDto[]> {
  const wmsUrl = `${env.geoserver.url}/${env.geoserver.workspace}/wms`;
  const capabilitiesUrl = `${wmsUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`;

  const xml = await fetchText(capabilitiesUrl);

  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  // WMS 1.1.1: WMT_MS_Capabilities > Capability > Layer (raíz sin Name) > Layer[] (capas hijas)
  const capability =
    parsed?.WMT_MS_Capabilities?.Capability ??
    parsed?.WMS_Capabilities?.Capability;

  if (!capability) return [];

  // El Layer raíz puede ser objeto o array; tomamos el primero
  const rootLayer = Array.isArray(capability.Layer)
    ? capability.Layer[0]
    : capability.Layer;

  if (!rootLayer) return [];

  // Las capas hijas pueden ser objeto o array
  const childLayers: unknown[] = Array.isArray(rootLayer.Layer)
    ? rootLayer.Layer
    : rootLayer.Layer
    ? [rootLayer.Layer]
    : [];

  const filteredLayers = childLayers
    .filter(
      (l): l is Record<string, unknown> =>
        typeof l === 'object' && l !== null &&
        typeof (l as Record<string, unknown>)['Name'] === 'string'
    )
    .sort((a, b) => {
      // capa_contenedores siempre aparece la primera (admite prefijo de workspace y typo histórico)
      const aName = String((a as Record<string, unknown>)['Name']);
      const bName = String((b as Record<string, unknown>)['Name']);
      const aIsContenedores = aName === 'capa_contenedores' || aName.endsWith(':capa_contenedores') || aName === 'capa_contendores' || aName.endsWith(':capa_contendores');
      const bIsContenedores = bName === 'capa_contenedores' || bName.endsWith(':capa_contenedores') || bName === 'capa_contendores' || bName.endsWith(':capa_contendores');
      if (aIsContenedores) return -1;
      if (bIsContenedores) return 1;
      return 0;
    });

  // capa_contenedores sorted to index 0; other layers get indices 1..n-1.
  // Ensure contenedores is always rendered above all other WMS layers (but below UI layers at 90+).
  const contenedoresZIndex = Math.min(filteredLayers.length + 10, 88);

  const result = filteredLayers
    .map((l, i) => {
      const rawName = String(l['Name']);
      const rawTitle = String(l['Title'] ?? rawName);
      const source = rawTitle.startsWith('capa_') ? rawTitle : rawName;
      const stripped = source.startsWith('capa_')
        ? source.slice(5).charAt(0).toUpperCase() + source.slice(6)
        : rawTitle;
      const displayTitle = stripped.replace(/_/g, ' ');
      const bbox = l['LatLonBoundingBox'] as Record<string, unknown> | undefined;
      const parsedBbox: [number, number, number, number] | undefined = bbox
        ? [
            Number(bbox['@_minx'] ?? bbox['minx'] ?? 0),
            Number(bbox['@_miny'] ?? bbox['miny'] ?? 0),
            Number(bbox['@_maxx'] ?? bbox['maxx'] ?? 0),
            Number(bbox['@_maxy'] ?? bbox['maxy'] ?? 0),
          ]
        : undefined;
      // Detecta contenedores: nombre canónico, con prefijo de workspace, o con el typo histórico de GeoServer ("contendores")
      const isContenedores =
        rawName === 'capa_contenedores' || rawName.endsWith(':capa_contenedores') ||
        rawName === 'capa_contendores'  || rawName.endsWith(':capa_contendores');
      return {
        name: rawName,
        title: displayTitle,
        // Usar el proxy backend en lugar de la URL directa de GeoServer (puerto interno no accesible desde el navegador)
        wmsUrl: 'api/wms-proxy',
        // contenedores siempre por encima del resto de WMS; demás capas nunca superan su índice
        zIndex: isContenedores ? contenedoresZIndex : Math.min(10 + i, contenedoresZIndex - 1),
        bbox: parsedBbox,
      };
    });

  return result;
}
