import { Request, Response, NextFunction } from 'express';
import {
  findAllContenedores,
  findParcelasByRadio,
  findPortalesByRadio,
  findContenedoresByBarrio,
  findContenedoresByCalle,
  findContenedoresByPuntoRecogida,
  findContenedoresByRadio,
  findContenedoresByRefcat,
} from '../repositories/contenedor.repository';

export async function getContenedores(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const geojson = await findAllContenedores();
    res.status(200).json(geojson);
  } catch (err) {
    next(err);
  }
}

export async function getParcelasByContenedor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const lon = parseFloat(req.params['lon']);
    const lat = parseFloat(req.params['lat']);
    const radio = parseFloat(req.query['radio'] as string) || 100;

    if (isNaN(lon) || isNaN(lat)) {
      res.status(400).json({ message: 'Coordenadas inválidas' });
      return;
    }
    if (radio < 1 || radio > 5000) {
      res.status(400).json({ message: 'El radio debe estar entre 1 y 5000 metros' });
      return;
    }

    const geojson = await findParcelasByRadio(lon, lat, radio);
    res.status(200).json(geojson);
  } catch (err) {
    next(err);
  }
}

export async function getPortalesByContenedor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const lon = parseFloat(req.params['lon']);
    const lat = parseFloat(req.params['lat']);
    const radio = parseFloat(req.query['radio'] as string) || 100;

    if (isNaN(lon) || isNaN(lat)) {
      res.status(400).json({ message: 'Coordenadas inválidas' });
      return;
    }
    if (radio < 1 || radio > 5000) {
      res.status(400).json({ message: 'El radio debe estar entre 1 y 5000 metros' });
      return;
    }

    const geojson = await findPortalesByRadio(lon, lat, radio);
    res.status(200).json(geojson);
  } catch (err) {
    next(err);
  }
}

export async function buscarContenedores(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { barrio, calle, punto_recogida, lon, lat, radio, refcat } = req.query as Record<string, string>;

    if (barrio !== undefined) {
      if (!barrio.trim()) { res.status(400).json({ message: 'El parámetro barrio no puede estar vacío' }); return; }
      res.status(200).json(await findContenedoresByBarrio(barrio.trim()));
      return;
    }

    if (calle !== undefined) {
      if (!calle.trim()) { res.status(400).json({ message: 'El parámetro calle no puede estar vacío' }); return; }
      res.status(200).json(await findContenedoresByCalle(calle.trim()));
      return;
    }

    if (punto_recogida !== undefined) {
      const punto = parseInt(punto_recogida, 10);
      if (isNaN(punto) || punto < 1) { res.status(400).json({ message: 'El punto de recogida debe ser un número positivo' }); return; }
      res.status(200).json(await findContenedoresByPuntoRecogida(punto));
      return;
    }

    if (lon !== undefined && lat !== undefined) {
      const lonN = parseFloat(lon);
      const latN = parseFloat(lat);
      const radioN = parseFloat(radio) || 50;
      if (isNaN(lonN) || isNaN(latN)) { res.status(400).json({ message: 'Coordenadas inválidas' }); return; }
      if (radioN < 1 || radioN > 5000) { res.status(400).json({ message: 'El radio debe estar entre 1 y 5000 metros' }); return; }
      res.status(200).json(await findContenedoresByRadio(lonN, latN, radioN));
      return;
    }

    if (refcat !== undefined) {
      if (!refcat.trim()) { res.status(400).json({ message: 'La referencia catastral no puede estar vacía' }); return; }
      const radioN = parseFloat(radio) || 200;
      if (radioN < 1 || radioN > 5000) { res.status(400).json({ message: 'El radio debe estar entre 1 y 5000 metros' }); return; }
      res.status(200).json(await findContenedoresByRefcat(refcat.trim().toUpperCase(), radioN));
      return;
    }

    res.status(400).json({ message: 'Debe indicar al menos un criterio de búsqueda: barrio, calle, punto_recogida, lon+lat, o refcat' });
  } catch (err) {
    next(err);
  }
}
