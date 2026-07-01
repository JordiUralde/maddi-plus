import { Request, Response, NextFunction } from 'express';
import { findAllRutaParadas } from '../repositories/ruta.repository';

export async function getRutaParadas(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const paradas = await findAllRutaParadas();
    res.status(200).json(paradas);
  } catch (err) {
    next(err);
  }
}
