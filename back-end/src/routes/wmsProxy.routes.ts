import { Router } from 'express';
import { wmsProxy } from '../controllers/wmsProxy.controller';

const router = Router();

router.get('/', wmsProxy);

export default router;
