import amqp from 'amqplib';
import 'dotenv/config';
import { applyEnrollmentConfirmed } from './courseService.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://app:app123@localhost:5672';
const EXCHANGE = process.env.RABBITMQ_EXCHANGE ?? 'enrollment.events';
const EXCHANGE_TYPE = process.env.RABBITMQ_EXCHANGE_TYPE ?? 'topic';

const QUEUE = process.env.COURSE_ENROLLMENT_QUEUE ?? 'course.enrollment.confirmed.queue';
const ROUTING_KEY = process.env.COURSE_ENROLLMENT_ROUTING_KEY ?? 'enrollment.confirmed';
const PREFETCH = Number(process.env.RABBITMQ_PREFETCH ?? 1);

async function run() {
  console.log('[course-consumer] starting...');

  const conn = await amqp.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();

  await ch.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });
  await ch.assertQueue(QUEUE, { durable: true });
  await ch.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
  await ch.prefetch(PREFETCH);

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const content = msg.content.toString('utf8');
      const payload = JSON.parse(content);

      console.log('[course-consumer] received message', payload);

      await applyEnrollmentConfirmed(payload);

      ch.ack(msg);
      console.log('[course-consumer] message processed');
    } catch (err) {
      console.error('[course-consumer] processing error', err.message);
      // simple retry/poison handling: nack and requeue=false will send to DLQ if configured
      ch.nack(msg, false, false);
    }
  }, { noAck: false });

  process.on('SIGINT', async () => {
    await ch.close();
    await conn.close();
    process.exit(0);
  });
}

run().catch((err) => {
  console.error('[course-consumer] fatal error:', err);
  process.exit(1);
});
