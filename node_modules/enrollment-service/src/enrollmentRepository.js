import db from './db.js';

const TABLE_NAME = 'enrollments';

function getQueryBuilder(trx) {
  return trx ?? db;
}

function mapEnrollmentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeEnrollmentInput(input) {
  return {
    id: input.id,
    student_id: input.studentId ?? input.student_id,
    course_id: input.courseId ?? input.course_id,
    status: input.status,
  };
}

export async function createEnrollment(input, trx = null) {
  const knex = getQueryBuilder(trx);

  const inserted = await knex(TABLE_NAME)
    .insert(normalizeEnrollmentInput(input))
    .returning('*');

  return mapEnrollmentRow(inserted[0]);
}

export async function findEnrollmentById(id, trx = null) {
  const knex = getQueryBuilder(trx);

  const row = await knex(TABLE_NAME)
    .select('*')
    .where({ id })
    .first();

  return mapEnrollmentRow(row);
}

export async function findEnrollmentByStudentAndCourse(
  studentId,
  courseId,
  trx = null
) {
  const knex = getQueryBuilder(trx);

  const row = await knex(TABLE_NAME)
    .select('*')
    .where({
      student_id: studentId,
      course_id: courseId,
    })
    .first();

  return mapEnrollmentRow(row);
}

export async function listEnrollments(
  limit = 50,
  offset = 0,
  trx = null
) {
  const knex = getQueryBuilder(trx);

  const rows = await knex(TABLE_NAME)
    .select('*')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return rows.map(mapEnrollmentRow);
}

export async function listEnrollmentsByStudentId(
  studentId,
  trx = null
) {
  const knex = getQueryBuilder(trx);

  const rows = await knex(TABLE_NAME)
    .select('*')
    .where({ student_id: studentId })
    .orderBy('created_at', 'desc');

  return rows.map(mapEnrollmentRow);
}

export async function listEnrollmentsByCourseId(
  courseId,
  trx = null
) {
  const knex = getQueryBuilder(trx);

  const rows = await knex(TABLE_NAME)
    .select('*')
    .where({ course_id: courseId })
    .orderBy('created_at', 'desc');

  return rows.map(mapEnrollmentRow);
}

export async function updateEnrollmentStatus(
  id,
  status,
  trx = null
) {
  const knex = getQueryBuilder(trx);

  const rows = await knex(TABLE_NAME)
    .where({ id })
    .update({
      status,
      updated_at: knex.fn.now(),
    })
    .returning('*');

  return mapEnrollmentRow(rows[0]);
}

export async function deleteEnrollmentById(
  id,
  trx = null
) {
  const knex = getQueryBuilder(trx);

  const deletedRows = await knex(TABLE_NAME)
    .where({ id })
    .del()
    .returning('*');

  return mapEnrollmentRow(deletedRows[0]);
}