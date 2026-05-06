import { Router } from 'express';
import mapasFondoRoutes from './mapasFondo.routes';
import capasRoutes from './capas.routes';
import contenedoresRoutes from './contenedores.routes';

const router = Router();

router.use('/mapas-fondo', mapasFondoRoutes);
router.use('/capas', capasRoutes);
router.use('/contenedores', contenedoresRoutes);

export default router;
