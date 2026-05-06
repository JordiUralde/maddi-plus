import { Request, Response, NextFunction } from 'express';
import { findAllMapasFondo } from '../repositories/mapaFondo.repository';

export async function getMapasFondo(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await findAllMapasFondo();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}
