import { randomUUID } from "crypto";

export async function seed(knex) {
  await knex("courses").del();

  await knex("courses").insert([
    {
      id: randomUUID(),
      title: "Introduction to Microservices",
      description: "Learn microservice design, event-driven communication, and eventual consistency.",
      status: "OPEN",
      enrolled_count: 0,
      capacity: 50,
    },
    {
      id: randomUUID(),
      title: "Modern Node.js Architecture",
      description: "Build scalable backends using Node.js, Express, and event sourcing patterns.",
      status: "OPEN",
      enrolled_count: 0,
      capacity: 50,
    },
    {
      id: randomUUID(),
      title: "Distributed Systems and Circuit Breakers",
      description: "Implement fault tolerance with circuit breakers and idempotent event processing.",
      status: "OPEN",
      enrolled_count: 0,
      capacity: 50,
    },
  ]);
}
