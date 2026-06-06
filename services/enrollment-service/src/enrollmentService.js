// Làm mới cho "/services/enrollment-service/src/enrollmentsService.js":
import { randomUUID } from 'node:crypto';
import db from './db.js';
import * as enrollmentRepository from './enrollmentRepository.js';
import { studentGateway, courseGateway } from './circuitBreakers.js';

function normalizeUuid(value, fieldName) {
  const uuid = String(value ?? '').trim();

  if (!uuid) {
    const error = new Error(`${fieldName} is required`);
    error.code = 'INVALID_ARGUMENT';
    throw error;
  }

  return uuid;
}

export async function createEnrollment(request = {}) {
  const studentId = normalizeUuid(
    request.studentId ?? request.student_id,
    'student_id'
  );
  const courseId = normalizeUuid(
    request.courseId ?? request.course_id,
    'course_id'
  );
  const correlationId = request.correlationId ?? request.correlation_id ?? null;

  await studentGateway.getStudent(studentId);
  await courseGateway.getCourse(courseId);

  return db.transaction(async (trx) => {
    const enrollmentId = randomUUID();

    const enrollment = await enrollmentRepository.createEnrollment(
      {
        id: enrollmentId,
        studentId,
        courseId,
        status: 'CONFIRMED',
      },
      trx
    );

    await trx('outbox_events').insert({
      id: randomUUID(),
      event_type: 'EnrollmentConfirmed',
      routing_key: 'enrollment.confirmed',
      version: 1,
      correlation_id: correlationId,
      payload: {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
      },
      status: 'pending',
      attempts: 0,
    });

    return enrollment;
  });
}

export async function listEnrollmentsByStudent(studentId) {
  const id = normalizeUuid(
    studentId?.studentId ?? studentId?.student_id ?? studentId,
    'student_id'
  );

  return enrollmentRepository.listEnrollmentsByStudentId(id);
}