// Làm mới cho "/services/course-service/src/courseRepository.js":
const TABLE_NAME = "courses";
const PROCESSED_EVENTS_TABLE = "processed_events";

function createError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createCourseRepository(db) {
  return {
    async findById(id) {
      return db(TABLE_NAME)
        .select(
          "id",
          "title",
          "description",
          "status",
          "enrolled_count",
          "capacity"
        )
        .where({ id })
        .first();
    },

    async findAll({ limit, offset }) {
      return db(TABLE_NAME)
        .select(
          "id",
          "title",
          "description",
          "status",
          "enrolled_count",
          "capacity"
        )
        .orderBy("id", "asc")
        .limit(limit)
        .offset(offset);
    },

    async countAll() {
      const row = await db(TABLE_NAME).count({ count: "*" }).first();
      return Number(row.count);
    },

    async applyEnrollmentConfirmed({
      eventId,
      enrollmentId,
      studentId,
      courseId
    }) {
      return db.transaction(async (trx) => {
        const insertedEvents = await trx(PROCESSED_EVENTS_TABLE)
          .insert({
            event_id: eventId,
            event_type: "EnrollmentConfirmed",
            processed_at: trx.fn.now()
          })
          .onConflict("event_id")
          .ignore()
          .returning("event_id");

        if (insertedEvents.length === 0) {
          return {
            alreadyProcessed: true,
            course: null
          };
        }

        const course = await trx(TABLE_NAME)
          .where({ id: courseId })
          .forUpdate()
          .first();

        if (!course) {
          throw createError("Course not found", "NOT_FOUND");
        }

        if (course.status !== "OPEN") {
          throw createError("Course is not open for enrollment", "FAILED_PRECONDITION");
        }

        if (Number(course.enrolled_count) >= Number(course.capacity)) {
          throw createError("Course capacity has been reached", "FAILED_PRECONDITION");
        }

        const [updatedCourse] = await trx(TABLE_NAME)
          .where({ id: courseId })
          .increment("enrolled_count", 1)
          .update({
            updated_at: db.fn.now()
          })
          .returning([
            "id",
            "title",
            "description",
            "status",
            "enrolled_count",
            "capacity"
          ]);

        return {
          alreadyProcessed: false,
          enrollmentId,
          studentId,
          courseId,
          course: updatedCourse
        };
      });
    }
  };
}