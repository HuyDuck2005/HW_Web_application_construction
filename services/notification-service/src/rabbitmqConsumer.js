import 'dotenv/config';
import amqp from 'amqplib';
import { handleCourseEnrollmentCountIncreased } from './notificationService.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://app:app123@localhost:5672';
const EXCHANGE = process.env.COURSE_EVENTS_EXCHANGE ?? 'course.events';
const EXCHANGE_TYPE = process.env.COURSE_EVENTS_EXCHANGE_TYPE ?? 'topic';
const QUEUE = process.env.NOTIFICATION_QUEUE ?? 'notification.course.enrolled_count.increased.queue';
const ROUTING_KEY = process.env.COURSE_EVENT_ROUTING_KEY ?? 'course.enrolled_count.increased';
const PREFETCH = Number(process.env.RABBITMQ_PREFETCH ?? 1);

let connection;
let channel;

function parseEvent(msg) {
  return JSON.parse(msg.content.toString('utf8'));
}

async function setupTopology() {
  await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });
  await channel.assertQueue(QUEUE, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum' },
  });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
}

async function handleMessage(msg) {
  if (!msg) {
    return;
  }

  try {
    const event = parseEvent(msg);
    await handleCourseEnrollmentCountIncreased(event);
    channel.ack(msg);
  } catch (error) {
    console.error('[notification-consumer] failed:', error.message);
    // Với lab đơn giản: requeue=false để tránh retry vô hạn.
    // Có thể nâng cấp thêm DLQ giống course-service.
    channel.nack(msg, false, false);
  }
}

export async function startNotificationConsumer() {
  connection = await amqp.connect(RABBITMQ_URL);

  connection.on('error', (error) => {
    console.error('[notification-consumer] connection error:', error.message);
  });

  connection.on('close', () => {
    console.error('[notification-consumer] connection closed');
  });

  channel = await connection.createChannel();
  await setupTopology();
  channel.prefetch(PREFETCH);

  await channel.consume(QUEUE, async (msg) => {
    await handleMessage(msg);
  }, { noAck: false });

  console.log(`[notification-consumer] waiting queue=${QUEUE}`);
}

async function shutdown() {
  if (channel) await channel.close();
  if (connection) await connection.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startNotificationConsumer().catch((error) => {
  console.error('[notification-consumer] fatal error:', error);
  process.exit(1);
});