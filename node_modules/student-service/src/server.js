import path from "node:path";
import { fileURLToPath } from "node:url";

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

import { db } from "./db.js";
import { startHealthServer } from "./health.js";
import { createStudentRepository } from "./studentRepository.js";
import { createStudentService } from "./studentService.js";
import { createStudentGrpcHandlers } from "./studentGrpcHandlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.resolve(__dirname, "../../../protos/student.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const studentProto = grpc.loadPackageDefinition(packageDefinition).student;

// Create the repository, service, and gRPC handlers
const repository = createStudentRepository(db);
const service = createStudentService(repository);
const handlers = createStudentGrpcHandlers(service);

// Create the gRPC server
const grpcServer = new grpc.Server();

// Add the service handlers to the gRPC server
grpcServer.addService(studentProto.StudentService.service, handlers);

// Start the gRPC server and the health check server
const grpcAddress = process.env.GRPC_ADDRESS || "0.0.0.0:50051";
const healthPort = Number(process.env.HEALTH_PORT || 3001);

// bindAsync is used to start the gRPC server and listen for incoming requests
grpcServer.bindAsync(
  grpcAddress,
  grpc.ServerCredentials.createInsecure(),
  (error, port) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }

    console.log(`student-service gRPC server listening on ${grpcAddress}`);
  },
);

startHealthServer({
  serviceName: "student-service",
  port: healthPort,
  db,
});

// Gracefull Shutdown
process.on("SIGTERM", async () => {
  console.log("student-service received SIGTERM");
  grpcServer.tryShutdown(async () => {
    console.log("gRPC server closed");
    await db.destroy();
    console.log("Database connection destroyed");
    process.exit(0);
  });
});
