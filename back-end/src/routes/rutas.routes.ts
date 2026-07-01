import { Router } from 'express';
import { getRutaParadas } from '../controllers/ruta.controller';

const router = Router();

router.get('/', getRutaParadas);

export default router;
