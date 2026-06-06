// Làm mới cho "/services/course-service/src/courseService.js":
import db from "./db.js";
import { createCourseRepository } from "./courseRepository.js";

function normalizePagination(limit, offset) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  return {
    limit: safeLimit,
    offset: safeOffset
  };
}

function buildPageInfo({ total, limit, offset }) {
  return {
    total,
    limit,
    offset,
    has_next_page: offset + limit < total,
    has_previous_page: offset > 0
  };
}

function createError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeUuid(value, fieldName) {
  const uuid = String(value ?? '').trim();

  if (!uuid) {
    throw createError(`${fieldName} is required`, "INVALID_ARGUMENT");
  }

  return uuid;
}

function normalizeEnrollmentConfirmedInput(input = {}) {
  const payload = input.payload ?? {};
  const eventId = input.eventId ?? input.event_id;
  const eventType = input.eventType ?? input.event_type;
  const courseId = input.courseId ?? input.course_id ?? payload.courseId;

  if (!eventId) {
    throw createError("eventId is required", "INVALID_ARGUMENT");
  }

  if (eventType && eventType !== "EnrollmentConfirmed") {
    throw createError(`Unsupported event type`, "INVALID_ARGUMENT");
  }

  return {
    eventId,
    enrollmentId: normalizeUuid(
      input.enrollmentId ?? input.enrollment_id ?? payload.enrollmentId,
      "enrollment_id"
    ),
    studentId: normalizeUuid(
      input.studentId ?? input.student_id ?? payload.studentId,
      "student_id"
    ),
    courseId: normalizeUuid(courseId, "course_id")
  };
}

export function createCourseService(courseRepository) {
  return {
    async getCourse(id) {
      const course = await courseRepository.findById(
        normalizeUuid(id, "course_id")
      );

      if (!course) {
        throw createError("Course not found", "NOT_FOUND");
      }

      return course;
    },

    async listCourses({ limit, offset } = {}) {
      const pagination = normalizePagination(limit, offset);

      const [courses, total] = await Promise.all([
        courseRepository.findAll(pagination),
        courseRepository.countAll()
      ]);

      return {
        courses,
        page_info: buildPageInfo({
          total,
          limit: pagination.limit,
          offset: pagination.offset
        })
      };
    },

    async applyEnrollmentConfirmed(input) {
      const event = normalizeEnrollmentConfirmedInput(input);
      const result = await courseRepository.applyEnrollmentConfirmed(event);

      if (result.alreadyProcessed) {
        return {
          success: true,
          duplicated: true,
          message: `Event ${event.eventId} was already processed`
        };
      }

      return {
        success: true,
        duplicated: false,
        message: `Enrollment ${event.enrollmentId} applied to course ${event.courseId}`
      };
    }
  };
}

const defaultCourseService = createCourseService(createCourseRepository(db));

export async function getCourse(id) {
  return defaultCourseService.getCourse(id);
}

export async function listCourses(request) {
  return defaultCourseService.listCourses(request);
}

export async function applyEnrollmentConfirmed(input) {
  return defaultCourseService.applyEnrollmentConfirmed(input);
}

export default defaultCourseService;