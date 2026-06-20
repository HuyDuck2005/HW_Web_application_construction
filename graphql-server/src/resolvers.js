import "dotenv/config";
import { GraphQLError } from "graphql";
import { grpc } from "./grpcClients.js";
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
import { withFilter } from "graphql-subscriptions";
import { pubsub, EVENTS } from "./pubsub.js";

function mapConversation(conversation) {
  return {
    id: conversation.id,
    type: conversation.type,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function mapChatMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function requireAuth(ctx) {
  if (!ctx.currentStudentId) throw new GraphQLError("Unauthorized");
  return { studentId: ctx.currentStudentId };
}

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

// BỔ SUNG: mapCourse thêm trường instanceName từ gRPC
function mapCourse(course) {
  if (!course) return null;
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    status: course.status,
    enrolledCount: course.enrolled_count,
    capacity: course.capacity,
    instanceName: course.instance_name || course.instanceName || "",
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
  Subscription: {
    chatMessageAdded: {
      subscribe: async (parent, args, ctx) => {
        const user = requireAuth(ctx);
        const response = await ctx.grpc.chat.call("isConversationMember", {
          conversationId: args.conversationId,
          studentId: user.studentId,
        });
        if (!response.isMember) {
          throw new GraphQLError("Forbidden conversation", {
            extensions: {
              code: "FORBIDDEN",
            },
          });
        }
        return withFilter(
          () => pubsub.asyncIterator(EVENTS.CHAT_MESSAGE_CREATED),
          (payload, variables) => {
            return payload.chatMessageCreated.conversationId === variables.conversationId;
          }
        )(parent, args, ctx);
      },
    },
  },

  Query: {
    async myConversations(parent, args, ctx) {
      const user = requireAuth(ctx);
      const response = await ctx.grpc.chat.call("listMyConversations", { studentId: user.studentId });
      return response.conversations.map(mapConversation);
    },
    async chatMessages(parent, args, ctx) {
      const user = requireAuth(ctx);
      const response = await ctx.grpc.chat.call("listMessages", {
        currentStudentId: user.studentId,
        conversationId: args.conversationId,
        limit: args.limit ?? 50,
        before: args.before ?? "",
      });
      return response.messages.map(mapChatMessage);
    },
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

    // BỔ SUNG: Đã chuyển đổi sang dùng gRPC thay vì fetchJson
    async course(_, { id }, ctx) {
      try {
        const response = await ctx.grpc.course.call("getCourse", { id });
        return mapCourse(response.course);
      } catch (error) {
        if (error?.code === grpc.status.NOT_FOUND) {
          return null;
        }
        throw toGraphQLError(error, "Cannot load course");
      }
    },

    // BỔ SUNG: Đã chuyển đổi sang dùng gRPC thay vì fetchJson
    async courses(_, { limit = 10, offset = 0 }, ctx) {
      try {
        const response = await ctx.grpc.course.call("listCourses", { limit, offset });
        return response.courses.map(mapCourse);
      } catch (error) {
        throw toGraphQLError(error, "Cannot load courses");
      }
    },

    // BỔ SUNG: Đã chuyển đổi sang dùng gRPC thay vì fetchJson
    async coursesPage(_, { limit = 10, offset = 0 }, ctx) {
      try {
        const response = await ctx.grpc.course.call("listCourses", { limit, offset });
        return {
          items: response.courses.map(mapCourse),
          pageInfo: mapPageInfo(response.page_info),
        };
      } catch (error) {
        throw toGraphQLError(error, "Cannot load courses page");
      }
    },

    // BỔ SUNG: Thêm resolver mới cho topCourses
    async topCourses(_, { limit = 10 }, ctx) {
      try {
        const response = await ctx.grpc.course.call("listTopCourses", { limit });
        return response.courses.map(mapCourse);
      } catch (error) {
        throw toGraphQLError(error, "Cannot load top courses");
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
    async getOrCreateDirectConversation(parent, args, ctx) {
      const user = requireAuth(ctx);
      const response = await ctx.grpc.chat.call("getOrCreateDirectConversation", {
        currentStudentId: user.studentId,
        targetStudentId: args.targetStudentId,
      });
      return mapConversation(response.conversation);
    },
    async sendChatMessage(parent, args, ctx) {
      const user = requireAuth(ctx);
      const response = await ctx.grpc.chat.call("sendMessage", {
        currentStudentId: user.studentId,
        conversationId: args.conversationId,
        content: args.content,
        correlationId: ctx.correlationId ?? "",
      });
      return mapChatMessage(response.message);
    },
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
    
    // BỔ SUNG: Đã đổi sang gọi gRPC để lấy thông tin course
    async course(enrollment, args, ctx) {
      try {
        const response = await ctx.grpc.course.call("getCourse", { 
          id: String(enrollment.courseId) 
        });
        return mapCourse(response.course);
      } catch {
        return null;
      }
    },
  },
};