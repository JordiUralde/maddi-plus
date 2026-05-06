import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import routes from './routes/index';

const app = express();

// Seguridad y cabeceras HTTP
app.use(helmet());

// CORS
app.use(cors({ origin: env.CORS_ORIGIN }));

// Logging HTTP
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Parseo de JSON y URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api', routes);

// Manejo de errores (debe ir al final)
app.use(errorHandler);

export default app;
