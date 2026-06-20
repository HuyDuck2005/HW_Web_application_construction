import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadProto(relativeProtoPath, packageName) {
  const protoPath = path.resolve(__dirname, "../../protos", relativeProtoPath);
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  return grpc.loadPackageDefinition(packageDefinition)[packageName];
}

function createUnaryCaller(client) {
  return function call(methodName, request) {
    return new Promise((resolve, reject) => {
      client[methodName](request, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  };
}

function promisifyClient(client) {
  return new Proxy(client, {
    get(target, prop) {
      const original = target[prop];
      if (typeof original !== "function") {
        return original;
      }
      return (request, metadata = new grpc.Metadata()) =>
        new Promise((resolve, reject) => {
          original.call(target, request, metadata, (error, response) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(response);
          });
        });
    },
  });
}

const studentProto = loadProto("student.proto", "student");
const chatProto = loadProto("chat.proto", "chat");
// Nạp file course.proto
const courseProto = loadProto("course.proto", "courseservice");

const studentClient = new studentProto.StudentService(
  process.env.STUDENT_SERVICE_ADDR || "localhost:50051",
  grpc.credentials.createInsecure(),
);

// Khởi tạo gRPC client cho course-service, trỏ qua cổng Load Balancer (Nginx)
const courseClient = new courseProto.CourseService(
  process.env.COURSE_SERVICE_ADDR || "localhost:15052",
  grpc.credentials.createInsecure()
);

export const grpcClients = {
  chat: promisifyClient(
    new chatProto.ChatService(
      process.env.CHAT_SERVICE_ADDR ?? "localhost:50054",
      grpc.credentials.createInsecure()
    )
  ),
  student: {
    raw: studentClient,
    call: createUnaryCaller(studentClient),
  },
  // Đưa course vào danh sách client export
  course: {
    raw: courseClient,
    call: createUnaryCaller(courseClient),
  },
};

export { grpc };