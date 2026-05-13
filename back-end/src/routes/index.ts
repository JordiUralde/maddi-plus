import { Router } from 'express';
import mapasFondoRoutes from './mapasFondo.routes';
import capasRoutes from './capas.routes';
import contenedoresRoutes from './contenedores.routes';
import wmsProxyRoutes from './wmsProxy.routes';

const router = Router();

router.use('/mapas-fondo', mapasFondoRoutes);
router.use('/capas', capasRoutes);
router.use('/contenedores', contenedoresRoutes);
router.use('/wms-proxy', wmsProxyRoutes);

export default router;
