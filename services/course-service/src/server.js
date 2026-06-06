// Làm mới cho "/services/course-service/src/server.js":
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

import db from "./db.js";
import { startHealthServer } from "./health.js";
import { createCourseGrpcHandlers } from "./courseGrpcHandlers.js";
import * as courseService from "./courseService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_NAME = "course-service";

const HEALTH_PORT = Number(process.env.PORT ?? 3002);
const GRPC_HOST = process.env.GRPC_HOST ?? "0.0.0.0";
const GRPC_PORT = Number(process.env.GRPC_PORT ?? 50052);

const PROTO_PATH =
  process.env.COURSE_PROTO_PATH ??
  path.resolve(__dirname, "../../../protos/course.proto");

function loadCourseProto() {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  return grpc.loadPackageDefinition(packageDefinition);
}

function getCourseServiceDefinition(courseProto) {
  if (courseProto.course?.CourseService?.service) {
    return courseProto.course.CourseService.service;
  }

  if (courseProto.CourseService?.service) {
    return courseProto.CourseService.service;
  }

  // support package name 'courseservice' used in protos/course.proto
  if (courseProto.courseservice?.CourseService?.service) {
    return courseProto.courseservice.CourseService.service;
  }

  throw new Error(
    "Cannot find CourseService definition. Check package name in course.proto."
  );
}

async function startGrpcServer() {
  const courseProto = loadCourseProto();
  const courseServiceDefinition = getCourseServiceDefinition(courseProto);

  const server = new grpc.Server();

  server.addService(
    courseServiceDefinition,
    createCourseGrpcHandlers(courseService)
  );

  const address = `${GRPC_HOST}:${GRPC_PORT}`;

  await new Promise((resolve, reject) => {
    server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          reject(error);
          return;
        }

        console.log(`[${SERVICE_NAME}] gRPC server listening on ${address}`);
        console.log(`[${SERVICE_NAME}] gRPC bound port: ${port}`);

        resolve();
      }
    );
  });

  return server;
}

async function start() {
  try {
    startHealthServer({
      serviceName: SERVICE_NAME,
      port: HEALTH_PORT,
      db
    });

    const grpcServer = await startGrpcServer();

    const shutdown = async (signal) => {
      console.log(`[${SERVICE_NAME}] received ${signal}. Shutting down...`);

      grpcServer.tryShutdown(async (error) => {
        if (error) {
          console.error(`[${SERVICE_NAME}] gRPC shutdown error:`, error);
          grpcServer.forceShutdown();
        }

        try {
          await db.destroy();
          console.log(`[${SERVICE_NAME}] database connection closed`);
        } catch (dbError) {
          console.error(`[${SERVICE_NAME}] database close error:`, dbError);
        }

        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error(`[${SERVICE_NAME}] failed to start:`, error);

    try {
      await db.destroy();
    } catch {
      // ignore cleanup error
    }

    process.exit(1);
  }
}

start();