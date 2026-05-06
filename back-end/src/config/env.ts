import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
  PORT: Number(process.env['PORT'] ?? 3000),
  CORS_ORIGIN: process.env['CORS_ORIGIN'] ?? 'http://localhost:4200',
  db: {
    host: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 5432),
    user: process.env['DB_USER'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? '',
    database: process.env['DB_NAME'] ?? 'maddiplus',
  },
  geoserver: {
    url: process.env['GEOSERVER_URL'] ?? 'http://localhost:8080/geoserver',
    workspace: process.env['GEOSERVER_WORKSPACE'] ?? 'dorlet-maddiplus',
  },
};
