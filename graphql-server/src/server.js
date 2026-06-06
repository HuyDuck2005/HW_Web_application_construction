import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import jwt from "jsonwebtoken";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { grpcClients } from "./grpcClients.js";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const PORT = Number(process.env.PORT || 4000);
const COURSE_SERVICE_URL =
  process.env.COURSE_HTTP_URL || "http://localhost:4001";
const ENROLLMENT_SERVICE_URL =
  process.env.ENROLLMENT_HTTP_URL || "http://localhost:4002";
const app = express();
const httpServer = http.createServer(app);
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "graphql-server",
  });
});
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});
await server.start();
app.use(
  "/graphql",
  cors(),
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }) => {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
      let currentStudentId = null;

      if (token) {
        try {
          const payload = jwt.verify(token, JWT_SECRET);
          currentStudentId = payload.sub;
        } catch {
          currentStudentId = null;
        }
      }

      return {
        grpc: grpcClients,
        currentStudentId,
        courseServiceUrl: COURSE_SERVICE_URL,
        enrollmentServiceUrl: ENROLLMENT_SERVICE_URL,
      };
    },
  }),
);
await new Promise((resolve) => {
  httpServer.listen(PORT, resolve);
});
console.log(`GraphQL Server listening on http://localhost:${PORT}/graphql`);
