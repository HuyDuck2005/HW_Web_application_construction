export async function up(knex) {
  await knex.schema.createTable('enrollments', function (table) {
    table.uuid('id').primary();

    table.uuid('student_id').notNullable();
    table.uuid('course_id').notNullable();

    table.string('status', 30).notNullable().defaultTo('CONFIRMED');

    table.timestamps(true, true);

    table.unique(['student_id', 'course_id']);

    table.index(['student_id']);
    table.index(['course_id']);
    table.index(['status']);
    table.index(['created_at']);
  });

  await knex.schema.createTable('outbox_events', function (table) {
    table.uuid('id').primary();

    table.string('event_type', 100).notNullable();
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

export async function down(knex) {
  await knex.schema.dropTableIfExists('outbox_events');
  await knex.schema.dropTableIfExists('enrollments');
}