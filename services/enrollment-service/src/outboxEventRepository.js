// Tạo file "/services/enrollment-service/src/outboxEventRepository.js" và code:
import 'dotenv/config';
import db from './db.js';

const MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 10);

export async function resetStuckPublishingEvents() {
  await db('outbox_events')
    .where({ status: 'publishing' })
    .update({
      status: 'pending',
      updated_at: db.fn.now(),
    });
}

export async function reservePendingOutboxEvents(limit = 20) {
  return db.transaction(async (trx) => {
    const rows = await trx('outbox_events')
      .select('*')
      .where({ status: 'pending' })
      .andWhere('attempts', '<', MAX_ATTEMPTS)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .forUpdate()
      .skipLocked();

    if (rows.length === 0) {
      return [];
    }

    await trx('outbox_events')
      .whereIn(
        'id',
        rows.map((row) => row.id)
      )
      .update({
        status: 'publishing',
        updated_at: trx.fn.now(),
      });

    return rows;
  });
}

export async function markOutboxEventPublished(eventId) {
  await db('outbox_events')
    .where({ id: eventId })
    .update({
      status: 'published',
      published_at: db.fn.now(),
      updated_at: db.fn.now(),
      last_error: null,
    });
}

export async function markOutboxEventFailed(eventId, error) {
  const row = await db('outbox_events')
    .select('attempts')
    .where({ id: eventId })
    .first();

  const nextAttempts = Number(row?.attempts ?? 0) + 1;

  await db('outbox_events')
    .where({ id: eventId })
    .update({
      attempts: nextAttempts,
      status: nextAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
      last_error: String(error?.message ?? error).slice(0, 1000),
      updated_at: db.fn.now(),
    });
}