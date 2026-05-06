import { Router } from 'express';
import { getMapasFondo } from '../controllers/mapaFondo.controller';

const router = Router();

router.get('/', getMapasFondo);

export default router;
