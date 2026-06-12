// Làm mới "/services/enrollment-service/src/server.js":
import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

import { db } from "./db.js";
import { startHealthServer } from "./health.js";
import { createEnrollmentGrpcHandlers } from "./enrollmentGrpcHandlers.js";
import * as enrollmentServiceModule from "./enrollmentService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_NAME = process.env.SERVICE_NAME ?? "enrollment-service";

const HEALTH_PORT = Number(process.env.PORT ?? process.env.HEALTH_PORT ?? 3003);

const GRPC_HOST = process.env.GRPC_HOST ?? "0.0.0.0";
const GRPC_PORT = Number(process.env.GRPC_PORT ?? 50053);

const ENROLLMENT_PROTO_PATH = process.env.ENROLLMENT_PROTO_PATH ??
  path.resolve(__dirname, "../../../protos/enrollment.proto");

function loadEnrollmentProto() {
  const packageDefinition = protoLoader.loadSync(ENROLLMENT_PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  return grpc.loadPackageDefinition(packageDefinition);
}

// For backward compatibility, support both "package enrollment; service
// EnrollmentService" and "service EnrollmentService without package"
function getEnrollmentServiceDefinition(proto) {
  if (proto.enrollment?.EnrollmentService?.service) {
    return proto.enrollment.EnrollmentService.service;
  }

  if (proto.EnrollmentService?.service) {
    return proto.EnrollmentService.service;
  }

  throw new Error(
    [
      `Cannot find EnrollmentService in proto.`,
      `Checked proto path: ${ENROLLMENT_PROTO_PATH}`,
      `Expected either:`,
      `- package enrollment; service EnrollmentService`,
      `- service EnrollmentService without package`
    ].join("\n")
  );
}

// Resolve the enrollment service implementation, supporting both default export
// and named exports
function resolveEnrollmentService() {
  const enrollmentService = enrollmentServiceModule.default ??
    enrollmentServiceModule;

  if (typeof enrollmentService.createEnrollment !== "function") {
    throw new Error(
      "enrollmentService must provide createEnrollment(request)"
    );
  }

  if (typeof enrollmentService.listEnrollmentsByStudent !== "function") {
    throw new Error(
      "enrollmentService must provide listEnrollmentsByStudent(request)"
    );
  }

  return enrollmentService;
}

// Start both gRPC server and health check server
function startGrpcServer() {
  try {
    const proto = loadEnrollmentProto();
    const serviceDefinition = getEnrollmentServiceDefinition(proto);
    const enrollmentService = resolveEnrollmentService();

    const server = new grpc.Server();

    // Thêm service vào server gRPC cùng với các handlers
    server.addService(
      serviceDefinition,
      createEnrollmentGrpcHandlers(enrollmentService)
    );

    const bindAddress = `${GRPC_HOST}:${GRPC_PORT}`;

    // Lắng nghe port cho gRPC
    server.bindAsync(
      bindAddress,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error(`[${SERVICE_NAME}] Failed to start gRPC server:`, error);
          process.exit(1);
        }

        console.log(`[${SERVICE_NAME}] gRPC server is running on ${bindAddress}`);
        
        // Khởi động thêm Health Check server
        if (typeof startHealthServer === 'function') {
          startHealthServer({
            serviceName: SERVICE_NAME,
            port: HEALTH_PORT,
            db,
          });
        }
      }
    );
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Initialization error:`, error);
    process.exit(1);
  }
}

// Thực thi hàm để khởi động server
startGrpcServer();