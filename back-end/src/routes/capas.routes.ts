import { Router } from 'express';
import { getCapas } from '../controllers/capas.controller';

const router = Router();

router.get('/', getCapas);

export default router;
