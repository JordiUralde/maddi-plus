import { Router } from 'express';
import {
  getContenedores,
  getParcelasByContenedor,
  getPortalesByContenedor,
  getViviendasByPortal,
  buscarContenedores,
  getContenedorDetalles,
  getIncidencias,
} from '../controllers/contenedor.controller';

const router = Router();

router.get('/', getContenedores);
router.get('/incidencias', getIncidencias);
router.get('/buscar', buscarContenedores);
router.get('/detalles/:matricula', getContenedorDetalles);
router.get('/parcelas/:lon/:lat', getParcelasByContenedor);
router.get('/portales/:portalId/viviendas', getViviendasByPortal);
router.get('/portales/:lon/:lat', getPortalesByContenedor);

export default router;
