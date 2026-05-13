import https from 'https';
import http from 'http';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Proxía las peticiones WMS del navegador hacia GeoServer, evitando que
 * el cliente tenga que alcanzar directamente el puerto interno de GeoServer.
 */
export function wmsProxy(req: Request, res: Response, next: NextFunction): void {
  const baseUrl = `${env.geoserver.url}/${env.geoserver.workspace}/wms`;
  const params = new URLSearchParams(req.query as Record<string, string>);
  const targetUrl = `${baseUrl}?${params.toString()}`;

  const client = targetUrl.startsWith('https') ? https : http;
  const proxyReq = client.get(targetUrl, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] ?? 'image/png';
    res.status(proxyRes.statusCode ?? 200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    proxyRes.pipe(res);
  });
  proxyReq.on('error', next);
}
