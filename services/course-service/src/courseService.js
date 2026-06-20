import db from "./db.js";
import { createCourseRepository } from "./courseRepository.js";
import * as courseCache from "./courseCache.js";

const INSTANCE_NAME = process.env.INSTANCE_NAME ?? "course-service";

function attachInstanceName(course) {
  if (!course) {
    return course;
  }
  return {
    ...course,
    instance_name: INSTANCE_NAME,
  };
}

function attachInstanceNameToCourses(courses) {
  return courses.map(attachInstanceName);
}

function normalizePagination(limit, offset) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  return {
    limit: safeLimit,
    offset: safeOffset
  };
}

function normalizeTopCourseLimit(limit) {
  return Math.min(Math.max(Number(limit) || 10, 1), 100);
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

  if (!eventId || !payload.enrollmentId || !payload.studentId) {
    throw createError("INVALID_EVENT_PAYLOAD", "INVALID_EVENT_PAYLOAD");
  }

  if (eventType && eventType !== "EnrollmentConfirmed") {
    throw createError(`Unsupported event type`, "INVALID_ARGUMENT");
  }

  return {
    eventId,
    eventType,
    correlationId: input.correlationId ?? input.correlation_id ?? null,
    payload: {
      enrollmentId: normalizeUuid(
        input.enrollmentId ?? input.enrollment_id ?? payload.enrollmentId,
        "enrollment_id"
      ),
      studentId: normalizeUuid(
        input.studentId ?? input.student_id ?? payload.studentId,
        "student_id"
      ),
      courseId: normalizeUuid(courseId, "course_id")
    }
  };
}

async function loadTopCoursesFromCache(courseRepository, limit) {
  const ids = await courseCache.getTopCourseIds(limit);

  if (!ids.length) {
    return {
      courses: [],
      hasStaleIds: false,
    };
  }

  const courses = await courseRepository.findByIds(ids);
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const orderedCourses = ids.map((id) => coursesById.get(id)).filter(Boolean);

  return {
    courses: orderedCourses,
    hasStaleIds: orderedCourses.length !== ids.length,
  };
}

async function rebuildTopCourseIndex(courseRepository) {
  const courseScores = await courseRepository.findAllCoursesScores();
  await courseCache.rebuildTopCourseIndex(courseScores);
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

      return attachInstanceName(course);
    },

    async listCourses({ limit, offset } = {}) {
      const pagination = normalizePagination(limit, offset);

      const [courses, total] = await Promise.all([
        courseRepository.findAll(pagination),
        courseRepository.countAll()
      ]);

      return {
        courses: attachInstanceNameToCourses(courses),
        page_info: buildPageInfo({
          total,
          limit: pagination.limit,
          offset: pagination.offset
        }),
        instance_name: INSTANCE_NAME,
      };
    },

    // BỔ SUNG HÀM LIST TOP COURSES
    async listTopCourses({ limit } = {}) {
      const safeLimit = normalizeTopCourseLimit(limit);

      if (!(await courseCache.isTopCourseIndexReady())) {
        await rebuildTopCourseIndex(courseRepository);
      }

      let cachedResult = await loadTopCoursesFromCache(courseRepository, safeLimit);

      if (cachedResult.hasStaleIds) {
        await rebuildTopCourseIndex(courseRepository);
        cachedResult = await loadTopCoursesFromCache(courseRepository, safeLimit);
      }

      if (cachedResult.courses.length > 0) {
        return {
          courses: attachInstanceNameToCourses(cachedResult.courses),
          instance_name: INSTANCE_NAME,
        };
      }

      return {
        courses: attachInstanceNameToCourses(await courseRepository.findTopByEnrolledCount(safeLimit)),
        instance_name: INSTANCE_NAME,
      };
    },

    async applyEnrollmentConfirmed(input) {
      const event = normalizeEnrollmentConfirmedInput(input);
      const result = await courseRepository.applyEnrollmentConfirmed(event);

      if (result.duplicated) {
        return {
          success: true,
          duplicated: true,
          message: result.message,
          instance_name: INSTANCE_NAME,
        };
      }

      await Promise.all([
        courseCache.setCachedCourse(result.course),
        courseCache.updateTopCoursesScore(result.course),
      ]);

      return {
        success: true,
        duplicated: false,
        message: `Enrollment ${event.payload.enrollmentId} applied to course ${event.payload.courseId}`,
        course: attachInstanceName(result.course),
        emittedEventId: result.emittedEventId,
        instance_name: INSTANCE_NAME,
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

export async function listTopCourses(request) {
  return defaultCourseService.listTopCourses(request);
}

export async function applyEnrollmentConfirmed(input) {
  return defaultCourseService.applyEnrollmentConfirmed(input);
}

export default defaultCourseService;