import { Request, Response, NextFunction } from 'express';
import { findRutaComparadas } from '../repositories/ruta.repository';

export async function getRutaParadas(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const fecha = String(req.query.fecha ?? '').trim();

    const comparadas = await findRutaComparadas(fecha || null);
    res.status(200).json({ fecha, rutas: comparadas });
  } catch (err) {
    next(err);
  }
}
