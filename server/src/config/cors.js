import { env } from './env.js';

const normalizeOrigin = (value) => value.trim().replace(/\/+$/, '');

const configuredOrigins = env.clientUrl
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const developmentOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

export const allowedOrigins = new Set([
  ...configuredOrigins,
  ...(env.nodeEnv === 'production' ? [] : developmentOrigins)
]);

export const corsOptions = {
  origin(origin, callback) {
    // Requests without Origin are server-to-server or same-origin requests.
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
      callback(null, true);
      return;
    }

    const error = new Error('Origin is not allowed by CORS');
    error.statusCode = 403;
    callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
};
