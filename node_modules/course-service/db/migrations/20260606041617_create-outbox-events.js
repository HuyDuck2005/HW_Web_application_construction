export async function up(knex) {
  const exists = await knex.schema.hasTable('outbox_events');

  if (!exists) {
    await knex.schema.createTable('outbox_events', (table) => {
      table.uuid('id').primary();
      table.string('event_type').notNullable();
      table.string('routing_key').notNullable();
      table.integer('version').notNullable().defaultTo(1);
      table.jsonb('payload').notNullable();
      table.string('correlation_id').nullable();

      table.string('status').notNullable().defaultTo('pending');
      table.integer('attempts').notNullable().defaultTo(0);
      table.text('last_error').nullable();

      table.timestamp('published_at').nullable();
      table.timestamps(true, true);

      table.index(['status', 'created_at']);
      table.index(['event_type']);
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('outbox_events');
}