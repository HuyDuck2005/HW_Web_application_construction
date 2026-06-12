import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { registerHealthRoutes } from './health.js';
import { authenticateSseRequest } from './authMiddleware.js';
import { addClient, startHeartbeat } from './sseHub.js';
import { startNotificationConsumer } from './rabbitmqConsumer.js';

const PORT = Number(process.env.PORT ?? 3004);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = express();

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));

registerHealthRoutes(app);

app.get('/events', authenticateSseRequest, (req, res) => {
  addClient({ req, res });
});

app.listen(PORT, () => {
  startHeartbeat();
  startNotificationConsumer(); // Khởi chạy RabbitMQ Consumer cùng với Express Server
  console.log(`[notification-service] HTTP/SSE listening on port ${PORT}`);
});