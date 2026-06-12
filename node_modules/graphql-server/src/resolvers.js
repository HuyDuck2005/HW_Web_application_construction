import "dotenv/config";
import { GraphQLError } from "graphql";
import { grpc } from "./grpcClients.js";
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function toGraphQLError(error, fallbackMessage = "Internal server error") {
  if (error?.code === grpc.status.NOT_FOUND) {
    return new GraphQLError(error.details || "Resource not found", {
      extensions: {
        code: "NOT_FOUND",
      },
    });
  }
  if (error?.code === grpc.status.INVALID_ARGUMENT) {
    return new GraphQLError(error.details || "Invalid argument", {
      extensions: {
        code: "BAD_USER_INPUT",
      },
    });
  }
  if (error?.code === grpc.status.ALREADY_EXISTS) {
    return new GraphQLError(error.details || "Resource already exists", {
      extensions: {
        code: "ALREADY_EXISTS",
      },
    });
  }
  if (error?.code === grpc.status.UNAVAILABLE) {
    return new GraphQLError("A backend service is unavailable", {
      extensions: {
        code: "SERVICE_UNAVAILABLE",
      },
    });
  }
  if (error?.code === grpc.status.DEADLINE_EXCEEDED) {
    return new GraphQLError("A backend service timed out", {
      extensions: {
        code: "SERVICE_TIMEOUT",
      },
    });
  }
  return new GraphQLError(fallbackMessage, {
    extensions: {
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}

function mapPageInfo(pageInfo) {
  return {
    total: pageInfo.total,
    limit: pageInfo.limit,
    offset: pageInfo.offset,
    hasNextPage: pageInfo.has_next_page,
    hasPreviousPage: pageInfo.has_previous_page,
  };
}

function mapCourse(course) {
  if (!course) return null;
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    status: course.status,
    enrolledCount: course.enrolled_count,
    capacity: course.capacity,
  };
}

function mapEnrollment(enrollment) {
  if (!enrollment) return null;
  return {
    id: enrollment.id,
    studentId: enrollment.student_id,
    courseId: enrollment.course_id,
    status: enrollment.status,
    createdAt: enrollment.created_at,
    updatedAt: enrollment.updated_at,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP request failed: ${response.status} ${text}`);
  }
  return response.json();
}

export const resolvers = {
  Query: {
    async student(_, { id }, ctx) {
      try {
        const response = await ctx.grpc.student.call("getStudent", { id });
        return response.student;
      } catch (error) {
        if (error?.code === grpc.status.NOT_FOUND) {
          return null;
        }
        throw toGraphQLError(error, "Cannot load student");
      }
    },
    async me(_, args, ctx) {
      if (!ctx.currentStudentId) {
        return null;
      }
      try {
        const response = await ctx.grpc.student.call("getStudent", {
          id: ctx.currentStudentId,
        });
        return response.student;
      } catch (error) {
        return null;
      }
    },
    async students(_, { limit = 20, offset = 0 }, ctx) {
      try {
        const response = await ctx.grpc.student.call("listStudents", {
          limit,
          offset,
        });
        return response.students;
      } catch (error) {
        throw toGraphQLError(error, "Cannot load students");
      }
    },
    async studentsPage(_, { limit = 20, offset = 0 }, ctx) {
      try {
        const response = await ctx.grpc.student.call("listStudents", {
          limit,
          offset,
        });
        return {
          items: response.students,
          pageInfo: mapPageInfo(response.page_info),
        };
      } catch (error) {
        throw toGraphQLError(error, "Cannot load students page");
      }
    },
    async course(_, { id }, ctx) {
      try {
        const course = await fetchJson(`${ctx.courseServiceUrl}/courses/${id}`);
        return mapCourse(course);
      } catch (error) {
        if (error.message.includes("404")) {
          return null;
        }
        throw new GraphQLError("Cannot load course", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
    async courses(_, { limit = 10, offset = 0 }, ctx) {
      try {
        const response = await fetchJson(
          `${ctx.courseServiceUrl}/courses?limit=${limit}&offset=${offset}`,
        );
        return response.data.map(mapCourse);
      } catch (error) {
        throw new GraphQLError("Cannot load courses", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
    async coursesPage(_, { limit = 10, offset = 0 }, ctx) {
      try {
        const response = await fetchJson(
          `${ctx.courseServiceUrl}/courses?limit=${limit}&offset=${offset}`,
        );
        return {
          items: response.data.map(mapCourse),
          pageInfo: {
            total: response.total,
            limit: response.limit,
            offset: response.offset,
            hasNextPage: response.offset + response.limit < response.total,
            hasPreviousPage: response.offset > 0,
          },
        };
      } catch (error) {
        throw new GraphQLError("Cannot load courses page", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
    async enrollment(_, { id }, ctx) {
      try {
        const enrollment = await fetchJson(
          `${ctx.enrollmentServiceUrl}/enrollments/${id}`,
        );
        return mapEnrollment(enrollment);
      } catch (error) {
        if (error.message.includes("404")) {
          return null;
        }
        throw new GraphQLError("Cannot load enrollment", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
    async enrollments(_, { limit = 10, offset = 0 }, ctx) {
      try {
        const response = await fetchJson(
          `${ctx.enrollmentServiceUrl}/enrollments?limit=${limit}&offset=${offset}`,
        );
        return response.data.map(mapEnrollment);
      } catch (error) {
        throw new GraphQLError("Cannot load enrollments", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
    async enrollmentsPage(_, { limit = 10, offset = 0 }, ctx) {
      try {
        const response = await fetchJson(
          `${ctx.enrollmentServiceUrl}/enrollments?limit=${limit}&offset=${offset}`,
        );
        return {
          items: response.data.map(mapEnrollment),
          pageInfo: {
            total: response.total,
            limit: response.limit,
            offset: response.offset,
            hasNextPage: response.offset + response.limit < response.total,
            hasPreviousPage: response.offset > 0,
          },
        };
      } catch (error) {
        throw new GraphQLError("Cannot load enrollments page", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },
  Mutation: {
    async login(_, { email, password }, ctx) {
      try {
        const response = await ctx.grpc.student.call("authenticateStudent", {
          email,
          password,
        });
        if (!response.success || !response.student) {
          throw new GraphQLError("Invalid email or password", {
            extensions: {
              code: "UNAUTHENTICATED",
            },
          });
        }
        const token = jwt.sign(
          {
            sub: response.student.id,
            email: response.student.email,
          },
          JWT_SECRET,
          {
            expiresIn: "2h",
          },
        );
        return {
          token,
          student: response.student,
        };
      } catch (error) {
        console.log("resolvers-login-error:", error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw toGraphQLError(error, "Cannot login");
      }
    },
    async createStudent(_, { input }, ctx) {
      try {
        const response = await ctx.grpc.student.call("createStudent", input);
        return response.student;
      } catch (error) {
        throw toGraphQLError(error, "Cannot create student");
      }
    },
    async createEnrollment(_, { input }, ctx) {
      try {
        const response = await fetchJson(`${ctx.enrollmentServiceUrl}/enrollments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        return mapEnrollment(response.data.enrollment);
      } catch (error) {
        throw new GraphQLError("Cannot create enrollment", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },
  Enrollment: {
    async student(enrollment, args, ctx) {
      try {
        const response = await ctx.grpc.student.call("getStudent", {
          id: String(enrollment.studentId),
        });
        return response.student;
      } catch {
        return null;
      }
    },
    async course(enrollment, args, ctx) {
      try {
        const course = await fetchJson(
          `${ctx.courseServiceUrl}/courses/${enrollment.courseId}`,
        );
        return mapCourse(course);
      } catch {
        return null;
      }
    },
  },
};
