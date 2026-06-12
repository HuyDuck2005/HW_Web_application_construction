import { getClientCount } from './sseHub.js';

export function registerHealthRoutes(app) {
  app.get('/health', (req, res) => {
    res.json({
      service: 'notification-service',
      status: 'ok',
      sseClients: getClientCount(),
      timestamp: new Date().toISOString(),
    });
  });
}