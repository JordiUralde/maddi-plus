import { Request, Response, NextFunction } from 'express';
import { getLayersFromGeoServer } from '../repositories/geoLayer.repository';

export async function getCapas(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const layers = await getLayersFromGeoServer();
    res.status(200).json(layers);
  } catch (err) {
    next(err);
  }
}
