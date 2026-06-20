const PARTITION_COUNT = 8;

async function isEnrollmentsPartitioned(knex) {
  const row = await knex('pg_partitioned_table as p')
    .join('pg_class as c', 'p.partrelid', 'c.oid')
    .where('c.relname', 'enrollments')
    .first('c.relname');

  return Boolean(row);
}

async function createPartitionedEnrollmentsTable(knex) {
  await knex.raw(`
    CREATE TABLE enrollments (
      id uuid NOT NULL,
      student_id uuid NOT NULL,
      course_id uuid NOT NULL,
      status varchar(30) NOT NULL DEFAULT 'CONFIRMED',
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT enrollments_pkey PRIMARY KEY (student_id, id),
      CONSTRAINT enrollments_student_id_course_id_unique UNIQUE (student_id, course_id)
    ) PARTITION BY HASH (student_id)
  `);

  for (let index = 0; index < PARTITION_COUNT; index += 1) {
    await knex.raw(`
      CREATE TABLE enrollments_p${index}
      PARTITION OF enrollments
      FOR VALUES WITH (MODULUS ${PARTITION_COUNT}, REMAINDER ${index})
    `);
  }

  await knex.raw('CREATE INDEX enrollments_id_idx ON enrollments (id)');
  await knex.raw('CREATE INDEX enrollments_student_id_index ON enrollments (student_id)');
  await knex.raw('CREATE INDEX enrollments_course_id_index ON enrollments (course_id)');
  await knex.raw('CREATE INDEX enrollments_status_index ON enrollments (status)');
  await knex.raw('CREATE INDEX enrollments_created_at_index ON enrollments (created_at)');
}

export async function up(knex) {
  const exists = await knex.schema.hasTable('enrollments');

  if (exists && await isEnrollmentsPartitioned(knex)) {
    return;
  }

  await knex.transaction(async (trx) => {
    if (!exists) {
      await createPartitionedEnrollmentsTable(trx);
      return;
    }

    await trx.raw('ALTER TABLE enrollments RENAME TO enrollments_unpartitioned');
    await trx.raw('ALTER TABLE enrollments_unpartitioned DROP CONSTRAINT IF EXISTS enrollments_pkey');
    await trx.raw('ALTER TABLE enrollments_unpartitioned DROP CONSTRAINT IF EXISTS enrollments_student_id_course_id_unique');
    await trx.raw('DROP INDEX IF EXISTS enrollments_student_id_index');
    await trx.raw('DROP INDEX IF EXISTS enrollments_course_id_index');
    await trx.raw('DROP INDEX IF EXISTS enrollments_status_index');
    await trx.raw('DROP INDEX IF EXISTS enrollments_created_at_index');

    await createPartitionedEnrollmentsTable(trx);

    await trx.raw(`
      INSERT INTO enrollments (id, student_id, course_id, status, created_at, updated_at)
      SELECT id, student_id, course_id, status, created_at, updated_at
      FROM enrollments_unpartitioned
    `);

    await trx.raw('DROP TABLE enrollments_unpartitioned');
  });
}

export async function down(knex) {
  const exists = await knex.schema.hasTable('enrollments');

  if (!exists || !await isEnrollmentsPartitioned(knex)) {
    return;
  }

  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE enrollments_unpartitioned (
        id uuid NOT NULL,
        student_id uuid NOT NULL,
        course_id uuid NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'CONFIRMED',
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT enrollments_unpartitioned_pkey PRIMARY KEY (id),
        CONSTRAINT enrollments_unpartitioned_student_id_course_id_unique UNIQUE (student_id, course_id)
      )
    `);

    await trx.raw(`
      INSERT INTO enrollments_unpartitioned (id, student_id, course_id, status, created_at, updated_at)
      SELECT id, student_id, course_id, status, created_at, updated_at
      FROM enrollments
    `);

    await trx.raw('DROP TABLE enrollments CASCADE');
    await trx.raw('ALTER TABLE enrollments_unpartitioned RENAME TO enrollments');
    await trx.raw('ALTER INDEX enrollments_unpartitioned_pkey RENAME TO enrollments_pkey');
    await trx.raw('ALTER INDEX enrollments_unpartitioned_student_id_course_id_unique RENAME TO enrollments_student_id_course_id_unique');

    await trx.raw('CREATE INDEX enrollments_student_id_index ON enrollments (student_id)');
    await trx.raw('CREATE INDEX enrollments_course_id_index ON enrollments (course_id)');
    await trx.raw('CREATE INDEX enrollments_status_index ON enrollments (status)');
    await trx.raw('CREATE INDEX enrollments_created_at_index ON enrollments (created_at)');
  });
}