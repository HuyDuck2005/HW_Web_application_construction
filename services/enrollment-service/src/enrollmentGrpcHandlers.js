import grpc from "@grpc/grpc-js";

export function createEnrollmentGrpcHandlers(enrollmentService) {
  return {
    async createEnrollment(call, callback) {
      try {
        const result = await enrollmentService.createEnrollment(call.request);
        callback(null, result);
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error?.message ?? "Internal server error",
        });
      }
    },

    async listEnrollmentsByStudent(call, callback) {
      try {
        const enrollments = await enrollmentService.listEnrollmentsByStudent(
          call.request
        );

        callback(null, { enrollments });
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error?.message ?? "Internal server error",
        });
      }
    },
  };
}
